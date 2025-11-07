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
      if (token && token !== 'demo-token-for-testing') {
        logger.debug('✅ Sync Manager - Auth Token erhalten')
      } else {
        logger.warn('⚠️ Sync Manager - Kein gültiges Auth Token (Demo/Fallback)')
      }
    } catch (error) {
      logger.error('❌ Sync Manager - Token-Fehler:', error)
    }

    // Zweiter Versuch nach kurzem Delay (z. B. wenn Clerk noch initialisiert)
    if (!token || token === 'demo-token-for-testing') {
      await new Promise(r => setTimeout(r, 600))
      try {
        const retryToken = await getAuthToken()
        if (retryToken && retryToken !== 'demo-token-for-testing') {
          token = retryToken
          logger.debug('✅ Sync Manager - Token beim 2. Versuch erhalten')
        }
      } catch {}
    }

    if (!token || token === 'demo-token-for-testing') {
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
    
    // Toast Notification
    const toast = useToastStore()
    if (successCount > 0) {
      toast.success(`${successCount} Änderung${successCount > 1 ? 'en' : ''} synchronisiert`, {
        duration: 3000
      })
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} Sync fehlgeschlagen`, {
        duration: 5000
      })
    }
    
    syncInProgress = false
    return { success: successCount, failed: failedCount, total: pending.length }
    
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
 * @param {string} token - Auth Token
 * @returns {Promise<void>}
 */
async function syncWorkoutAction(action, data, token) {
  switch (action) {
    case 'create':
      await createWorkout(data, token)
      logger.debug('✅ Sync - Workout erstellt:', data._id)
      break
      
    case 'update':
      await updateWorkout(data._id, data, token)
      logger.debug('✅ Sync - Workout aktualisiert:', data._id)
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

    // Toast Notification
    const toast = useToastStore()
    toast.info('Verbindung wiederhergestellt, synchronisiere...', {
      duration: 2000
    })

    // Warte kurz damit der Browser sich stabilisiert
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Starte Sync
    await processSyncQueue()
  })

  window.addEventListener('offline', () => {
    logger.warn('📡 Sync Manager - Network lost, Offline Mode')

    const toast = useToastStore()
    toast.warning('Keine Verbindung - Offline Mode aktiv', {
      duration: 3000
    })
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
  toast.info('Synchronisiere...', { duration: 1000 })
  
  const result = await processSyncQueue()
  
  if (result.offline) {
    toast.error('Keine Verbindung - bitte später versuchen', { duration: 3000 })
  } else if (result.noAuth) {
    toast.error('Nicht eingeloggt – bitte anmelden, um zu synchronisieren', { duration: 4000 })
  } else if (result.total === 0) {
    toast.success('Alles synchronisiert ✓', { duration: 2000 })
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
