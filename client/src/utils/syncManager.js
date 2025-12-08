/**
 * Sync Manager für Offline-zu-Online Synchronisation
 * 
 * Verarbeitet die Sync Queue und synchronisiert Offline-Änderungen
 * mit dem Backend sobald die Verbindung wieder verfügbar ist.
 * 
 * @module syncManager
 */

import { 
  getPendingSyncActions, 
  markActionSynced, 
  incrementRetryCount,
  clearSyncedActions,
  setMetadata,
  isOnline
} from './offlineStorage'
import { logger } from './logger'
import { createWorkout, updateWorkout, deleteWorkout } from '@/api/workouts'
import { getAuthToken } from './authToken'
import { useToastStore } from '@/stores/toastStore'
// Silent Sync: keine Toasts für automatische Synchronisation
const SILENT_SYNC = true

// Max Retry Attempts für fehlgeschlagene Syncs
const MAX_RETRY_ATTEMPTS = 3

// Sync Status
let isSyncing = false
let syncInProgress = false

/**
 * Verarbeitet die Sync Queue
 * @returns {Promise<Object>} Sync Results { success, failed, total }
 */
export async function processSyncQueue() {
  // Verhindere parallele Syncs
  if (syncInProgress) {
    logger.debug('⏳ Sync Manager - Sync bereits aktiv, überspringe')
    return { success: 0, failed: 0, total: 0, skipped: true }
  }
  
  // Prüfe Online Status
  if (!isOnline()) {
    logger.warn('📡 Sync Manager - Offline, Sync nicht möglich')
    return { success: 0, failed: 0, total: 0, offline: true }
  }
  
  syncInProgress = true
  logger.debug('🔄 Sync Manager - Starte Synchronisation...')
  
  try {
    const pending = await getPendingSyncActions()
    
    if (pending.length === 0) {
      logger.debug('✅ Sync Manager - Keine pending Actions')
      syncInProgress = false
      return { success: 0, failed: 0, total: 0 }
    }
    
    logger.debug('📋 Sync Manager - Pending Actions:', pending.length)
    
    let successCount = 0
    let failedCount = 0
    
    // Token holen für API Calls (robuste Helper-Funktion mit Fallbacks)
    let token = null
    try {
      token = await getAuthToken()
      if (token) {
        logger.debug('✅ Sync Manager - Auth Token erhalten')
      } else {
        logger.warn('⚠️ Sync Manager - Kein gültiges Auth Token')
      }
    } catch (error) {
      logger.error('❌ Sync Manager - Token-Fehler:', error)
    }

    // Zweiter Versuch nach kurzem Delay (z. B. wenn Clerk noch initialisiert)
    if (!token) {
      await new Promise(r => setTimeout(r, 600))
      try {
        const retryToken = await getAuthToken()
        if (retryToken) {
          token = retryToken
          logger.debug('✅ Sync Manager - Token beim 2. Versuch erhalten')
        }
      } catch {}
    }

    if (!token) {
      logger.warn('⚠️ Sync Manager - Kein Auth Token, überspringe Sync')
      syncInProgress = false
      return { success: 0, failed: 0, total: pending.length, noAuth: true }
    }

    // Verarbeite jede Action sequentiell
    for (const item of pending) {
      try {
        await syncAction(item, token)
        await markActionSynced(item.id)
        successCount++
        logger.debug('✅ Sync Manager - Action erfolgreich:', item.id, item.action)
      } catch (error) {
        logger.error('❌ Sync Manager - Action fehlgeschlagen:', item.id, error.message)
        
        // Erhöhe Retry Count
        await incrementRetryCount(item.id, error.message)
        
        // Bei zu vielen Retries: Markiere als failed
        if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
          logger.error('🚫 Sync Manager - Max Retries erreicht, gebe auf:', item.id)
        }
        
        failedCount++
      }
    }
    
    // Cleanup: Lösche bereits synchronisierte Actions
    await clearSyncedActions()
    
    // Speichere letzten Sync Timestamp
    await setMetadata('lastSyncTimestamp', Date.now())
    
    logger.debug('✅ Sync Manager - Sync abgeschlossen', {
      success: successCount,
      failed: failedCount,
      total: pending.length
    })
    
    // Toast Notification (optional Zusammenfassung)
    if (!SILENT_SYNC) {
      const toast = useToastStore()
      if (successCount > 0) {
        toast.success(`${successCount} Änderung${successCount > 1 ? 'en' : ''} synchronisiert`, { duration: 3000 })
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} Sync fehlgeschlagen`, { duration: 5000 })
      }
    }
    
    // Setze syncInProgress NACH den Toasts zurück
    // damit der Indicator Zeit hat auf die neue pendingCount zu reagieren
    syncInProgress = false
    logger.debug('📊 Sync Manager - Result:', result)
    return result
    
  } catch (error) {
    logger.error('❌ Sync Manager - Sync Error:', error)
    syncInProgress = false
    return { success: 0, failed: 0, total: 0, error: error.message }
  }
}

/**
 * Synchronisiert eine einzelne Action
 * @param {Object} item - Sync Queue Item
 * @param {string} token - Auth Token
 * @returns {Promise<void>}
 */
async function syncAction(item, token) {
  const { action, entityType, data } = item
  
  logger.debug('🔄 Sync Manager - Synce Action:', action, entityType, data._id || 'new')
  
  // Route zur richtigen API basierend auf Entity Type
  if (entityType === 'workout') {
    return await syncWorkoutAction(action, data, token)
  }
  
  // Weitere Entity Types können hier hinzugefügt werden
  throw new Error(`Unknown entity type: ${entityType}`)
}

/**
 * Synchronisiert Workout Actions
 * @param {string} action - 'create', 'update', 'delete'
 * @param {Object} data - Workout Daten
 * @returns {Promise<void>}
 */
async function syncWorkoutAction(action, data, token) {
  switch (action) {
    case 'create':
      // Bei offline erstellten Workouts: Entferne temporäre _id UND offline flags
      const createData = { ...data }
      // Entferne offline-spezifische Felder
      if (createData._id && typeof createData._id === 'string' && createData._id.startsWith('offline_')) {
        logger.debug('🔄 Sync - Entferne temporäre offline _id:', createData._id)
        delete createData._id
      }
      
      // Entferne offline Marker Flags
      delete createData._offlineCreated
      delete createData._offlineUpdated
      delete createData._failedOnline
      delete createData._syncedAt
      
      logger.debug('🔄 Sync - Bereinigte Daten für API:', {
        hasId: !!createData._id,
        name: createData.name,
        type: createData.type
      })
      
      const createdWorkout = await createWorkout(createData, token)
      logger.debug('✅ Sync - Workout erstellt mit neuer _id:', createdWorkout._id)
      
      // TODO: Optional - Update lokales Workout mit echter _id
      // await saveWorkoutOffline({ ...createData, _id: createdWorkout._id })
      break
      
    case 'update':
      // Bereinige Update-Daten
      const updateData = { ...data }
      delete updateData._offlineCreated
      delete updateData._offlineUpdated
      delete updateData._failedOnline
      delete updateData._syncedAt
      
      // Bei offline erstellten Workouts die jetzt geupdated werden sollen:
      // Diese sollten eigentlich als 'create' in der Queue sein, aber falls nicht:
      if (data._id && typeof data._id === 'string' && data._id.startsWith('offline_')) {
        logger.warn('⚠️ Sync - Update mit offline_id gefunden, konvertiere zu Create')
        delete updateData._id
        const createdWorkout = await createWorkout(updateData, token)
        logger.debug('✅ Sync - Workout als Create erstellt:', createdWorkout._id)
      } else {
        await updateWorkout(data._id, updateData, token)
        logger.debug('✅ Sync - Workout aktualisiert:', data._id)
      }
      break
      
    case 'delete':
      await deleteWorkout(data._id, token)
      logger.debug('✅ Sync - Workout gelöscht:', data._id)
      break
      
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

/**
 * Startet Auto-Sync wenn Online
 * Registriert Event Listener für 'online' Event
 */
export async function setupAutoSync() {
  // Event Listener für Online Status
  window.addEventListener('online', async () => {
    logger.debug('📡 Sync Manager - Network reconnected, starte Auto-Sync')

    // Optionaler Hinweis
    if (!SILENT_SYNC) {
      const toast = useToastStore()
      toast.info('Verbindung wiederhergestellt, synchronisiere...', { duration: 2000 })
    }

    // Warte kurz damit der Browser sich stabilisiert
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Starte Sync
    await processSyncQueue()
  })

  window.addEventListener('offline', () => {
    logger.warn('📡 Sync Manager - Network lost, Offline Mode')

    if (!SILENT_SYNC) {
      const toast = useToastStore()
      toast.warning('Keine Verbindung - Offline Mode aktiv', { duration: 3000 })
    }
  })

  logger.debug('✅ Sync Manager - Auto-Sync aktiviert')

  // Initialer Sync beim App-Start, falls bereits online & Pending Actions vorhanden
  if (isOnline()) {
    try {
      const pending = await getPendingSyncActions()
      if (pending.length > 0) {
        logger.debug('📡 Sync Manager - Initial pending Actions beim Start:', pending.length)
        // Kleiner Delay, damit Clerk Session geladen werden kann
        setTimeout(() => {
          // Nur starten wenn kein anderer Sync läuft
          if (!isSyncInProgress()) {
            processSyncQueue()
          } else {
            logger.debug('⏳ Sync Manager - Initial Sync übersprungen, da bereits aktiv')
          }
        }, 500)
      }
    } catch (error) {
      logger.error('❌ Sync Manager - Initial Sync Fehler:', error)
    }
  }
}

/**
 * Manueller Sync Trigger (für "Sync Now" Button)
 * @returns {Promise<Object>} Sync Results
 */
export async function triggerManualSync() {
  logger.debug('🔄 Sync Manager - Manueller Sync gestartet')
  
  const toast = useToastStore()
  if (!SILENT_SYNC) {
    toast.info('Synchronisiere...', { duration: 1000 })
  }
  
  const result = await processSyncQueue()
  
  if (!SILENT_SYNC) {
    if (result.offline) {
      toast.error('Keine Verbindung - bitte später versuchen', { duration: 3000 })
    } else if (result.noAuth) {
      toast.error('Nicht eingeloggt – bitte anmelden, um zu synchronisieren', { duration: 4000 })
    } else if (result.total === 0) {
      toast.success('Alles synchronisiert ✓', { duration: 2000 })
    }
  }
  
  return result
}

/**
 * Prüft ob Sync aktuell läuft
 * @returns {boolean}
 */
export function isSyncInProgress() {
  return syncInProgress
}

// Export für Testing
export { syncWorkoutAction }
