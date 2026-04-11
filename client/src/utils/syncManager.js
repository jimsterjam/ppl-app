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
  markActionFailed,
  incrementRetryCount,
  backfillQueueActionUserId,
  clearSyncedActions,
  setMetadata,
  isOnline
} from './offlineStorage'
import { logger } from './logger'
import { createWorkout, updateWorkout, deleteWorkout } from '@/api/workouts'
import { clearTokenCache, getAuthToken, parseUidFromToken } from './authToken'

// Max Retry Attempts für fehlgeschlagene Syncs
const MAX_RETRY_ATTEMPTS = 3
const NO_AUTH_RETRY_DELAY_MS = 3000
const AUTO_SYNC_POLL_MS = Number.parseInt(import.meta.env.VITE_SYNC_POLL_MS || '', 10) || 15000
const RETRYABLE_SYNC_BACKOFF_MS = Number.parseInt(import.meta.env.VITE_SYNC_RETRYABLE_BACKOFF_MS || '', 10) || 45000

// Sync Status
let isSyncing = false
let syncInProgress = false
let noAuthRetryTimer = null
let periodicSyncTimer = null
let syncPausedUntil = 0
let autoSyncInitialized = false

function isRetryableSyncError(error) {
  const status = Number(error?.response?.status || 0)
  const code = String(error?.code || '').toUpperCase()
  const message = String(error?.message || '').toLowerCase()
  if (status === 0) {
    // Fehler ohne HTTP-Response: nur echte Netzwerkfehler sind retryable,
    // nicht API-verpackte 404/403 (die kommen als Error mit message, ohne response)
    if (message.includes('nicht gefunden') || message.includes('not found') ||
        message.includes('403') || message.includes('forbidden') ||
        message.includes('404')) return false
    return true
  }
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') return true
  return false
}

function scheduleNoAuthRetry() {
  if (noAuthRetryTimer) return
  logger.warn('⏱️ Sync Manager - Plane Retry wegen fehlendem Auth Token', {
    delayMs: NO_AUTH_RETRY_DELAY_MS
  })
  noAuthRetryTimer = setTimeout(async () => {
    noAuthRetryTimer = null
    if (isOnline() && !syncInProgress) {
      logger.debug('🔁 Sync Manager - Starte geplanten Retry')
      await processSyncQueue()
    }
  }, NO_AUTH_RETRY_DELAY_MS)
}

/**
 * Verarbeitet die Sync Queue
 * @returns {Promise<Object>} Sync Results { success, failed, total }
 */
export async function processSyncQueue(preferredToken = null) {
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

  if (syncPausedUntil > Date.now()) {
    return {
      success: 0,
      failed: 0,
      total: 0,
      paused: true,
      retryInMs: Math.max(0, syncPausedUntil - Date.now())
    }
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
    let skippedCount = 0
    
    // Token holen für API Calls (robuste Helper-Funktion mit Fallbacks)
    let token = preferredToken || null
    if (token) {
      logger.debug('✅ Sync Manager - Verwende übergebenes Auth Token')
    }
    try {
      if (!token) {
        token = await getAuthToken()
        if (token) {
          logger.debug('✅ Sync Manager - Auth Token erhalten')
        } else {
          logger.warn('⚠️ Sync Manager - Kein gültiges Auth Token')
        }
      }
    } catch (error) {
      logger.error('❌ Sync Manager - Token-Fehler:', error)
    }

    // Zweiter Versuch nach kurzem Delay (z. B. wenn Clerk noch initialisiert)
    if (!token) {
      await new Promise(r => setTimeout(r, 600))
      try {
        const retryToken = preferredToken || await getAuthToken()
        if (retryToken) {
          token = retryToken
          logger.debug('✅ Sync Manager - Token beim 2. Versuch erhalten')
        }
      } catch {}
    }

    if (!token) {
      logger.warn('⚠️ Sync Manager - Kein Auth Token, überspringe Sync')
      syncInProgress = false
      scheduleNoAuthRetry()
      return { success: 0, failed: 0, total: pending.length, noAuth: true }
    }

    const currentUid = parseUidFromToken(token)

    // Verarbeite jede Action sequentiell
    for (const item of pending) {
      if (item?.entityType === 'workout' && (item?.action === 'create' || item?.action === 'update')) {
        let queuedUserId = String(item?.data?.userId || '').trim()
        if (!queuedUserId) {
          if (currentUid) {
            const patched = await backfillQueueActionUserId(item?.id, currentUid)
            if (patched) {
              queuedUserId = currentUid
              item.data = {
                ...(item?.data || {}),
                userId: currentUid
              }
              logger.info('🛠️ Sync Manager - Queue-Eintrag ohne userId repariert', {
                queueId: item?.id,
                action: item?.action,
                dataId: item?.data?._id || null,
                userId: currentUid
              })
            }
          }

          if (!queuedUserId) {
            skippedCount++
            logger.warn('🟡 Sync Manager - Überspringe Workout-Queue-Eintrag ohne userId', {
              queueId: item?.id,
              action: item?.action,
              dataId: item?.data?._id || null
            })
            continue
          }
        }
        if (currentUid && queuedUserId !== currentUid) {
          skippedCount++
          logger.warn('🟡 Sync Manager - Überspringe fremden Workout-Queue-Eintrag', {
            queueId: item?.id,
            action: item?.action,
            queuedUserId,
            currentUid
          })
          continue
        }
      }

      try {
        await syncAction(item, token)
        await markActionSynced(item.id)
        successCount++
        logger.debug('✅ Sync Manager - Action erfolgreich:', item.id, item.action)
      } catch (error) {
        const status = error?.response?.status || null
        const retryable = isRetryableSyncError(error)
        if (status === 401) {
          logger.warn('🔐 Sync Manager - 401 bei Sync Action, Token-Cache wird geleert und Retry geplant', {
            queueId: item?.id,
            action: item?.action
          })
          clearTokenCache()
          scheduleNoAuthRetry()
        }

        const logPayload = {
          queueId: item?.id,
          action: item?.action,
          entityType: item?.entityType,
          message: error?.message,
          code: error?.code || null,
          status,
          method: error?.config?.method || null,
          url: error?.config?.url || null,
          baseURL: error?.config?.baseURL || null,
          timeout: error?.config?.timeout || null
        }

        if (retryable) {
          logger.warn('⚠️ Sync Manager - Retrybarer Netzwerkfehler bei Action:', logPayload)
        } else {
          logger.error('❌ Sync Manager - Action fehlgeschlagen:', logPayload)
        }
        
        // Erhöhe Retry Count (atomar in IndexedDB)
        const nextRetryCount = await incrementRetryCount(item.id, error.message)

        // Bei transienten Netzwerkproblemen NIE dauerhaft aufgeben.
        // Sonst bleibt ein offline erstelltes Workout für immer lokal und erreicht MongoDB nie.
        if (retryable) {
          syncPausedUntil = Date.now() + RETRYABLE_SYNC_BACKOFF_MS
          logger.warn('🔁 Sync Manager - Retryable Fehler, Queue-Eintrag bleibt pending', {
            queueId: item?.id,
            retryCount: nextRetryCount,
            code: error?.code || null,
            status: status || null,
            pausedForMs: RETRYABLE_SYNC_BACKOFF_MS
          })
          continue
        }

        // Nur bei nicht-retrybaren Fehlern nach einigen Versuchen dauerhaft markieren.
        if (nextRetryCount >= MAX_RETRY_ATTEMPTS) {
          logger.error('🚫 Sync Manager - Max Retries erreicht, gebe auf:', item.id)
          await markActionFailed(item.id, error?.message || 'max-retries-reached', { terminal: true })
        }
        
        failedCount++
      }
    }
    
    // Cleanup: Lösche bereits synchronisierte Actions
    await clearSyncedActions({
      includeFailedTerminal: true,
      maxRetryAttempts: MAX_RETRY_ATTEMPTS
    })
    
    // Speichere letzten Sync Timestamp
    await setMetadata('lastSyncTimestamp', Date.now())
    
    const result = {
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      total: pending.length
    }
    logger.debug('✅ Sync Manager - Sync abgeschlossen', result)
    syncInProgress = false
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
  
  logger.debug('🔄 Sync Manager - Synce Action', {
    queueId: item?.id,
    action,
    entityType,
    dataId: data?._id || 'new',
    hasToken: !!token,
    retryCount: item?.retryCount || 0
  })
  
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
    case 'create': {
      // Bei offline erstellten Workouts: Entferne temporäre _id UND offline flags
      const createData = { ...data }
      // Entferne offline-spezifische Felder
      if (createData._id && typeof createData._id === 'string' && createData._id.startsWith('offline_')) {
        logger.debug('🔄 Sync - Entferne temporäre offline _id:', createData._id)
        delete createData._id
      }
      if (createData._id && typeof createData._id === 'string' && createData._id.startsWith('draft-')) {
        logger.debug('🔄 Sync - Entferne temporäre draft _id:', createData._id)
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
        type: createData.type,
        exercises: Array.isArray(createData?.exercises) ? createData.exercises.length : 0
      })
      
      const createdWorkout = await createWorkout(createData, token, { skipOfflineQueue: true })
      logger.debug('✅ Sync - Workout erstellt mit neuer _id:', createdWorkout._id)
      
      // TODO: Optional - Update lokales Workout mit echter _id
      // await saveWorkoutOffline({ ...createData, _id: createdWorkout._id })
      break
    }
      
    case 'update': {
      // Bereinige Update-Daten
      const updateData = { ...data }
      delete updateData._offlineCreated
      delete updateData._offlineUpdated
      delete updateData._failedOnline
      delete updateData._syncedAt
      
      // Bei temporären lokalen IDs (offline_/draft-) muss ein Create passieren.
      if (data._id && typeof data._id === 'string' && (data._id.startsWith('offline_') || data._id.startsWith('draft-'))) {
        logger.warn('⚠️ Sync - Update mit temp_id gefunden, konvertiere zu Create', { id: data._id })
        delete updateData._id
        const createdWorkout = await createWorkout(updateData, token, { skipOfflineQueue: true })
        logger.debug('✅ Sync - Workout als Create erstellt:', createdWorkout._id)
      } else {
        await updateWorkout(data._id, updateData, token)
        logger.debug('✅ Sync - Workout aktualisiert:', data._id)
      }
      break
    }
      
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
  if (autoSyncInitialized) {
    logger.debug('ℹ️ Sync Manager - setupAutoSync bereits initialisiert, überspringe')
    return
  }
  autoSyncInitialized = true

  // Event Listener für Online Status
  window.addEventListener('online', async () => {
    logger.debug('📡 Sync Manager - Network reconnected, starte Auto-Sync')

    // Warte kurz damit der Browser sich stabilisiert
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Starte Sync
    await processSyncQueue()
  })

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return
    if (!isOnline()) return
    if (syncInProgress) return
    logger.debug('📡 Sync Manager - App wieder aktiv, prüfe Sync Queue')
    await processSyncQueue()
  })

  window.addEventListener('offline', () => {
    logger.warn('📡 Sync Manager - Network lost, Offline Mode')
  })

  logger.debug('✅ Sync Manager - Auto-Sync aktiviert')

  if (!periodicSyncTimer) {
    periodicSyncTimer = setInterval(async () => {
      if (!isOnline() || syncInProgress) return
      try {
        const pending = await getPendingSyncActions()
        if (pending.length === 0) return
        logger.debug('⏱️ Sync Manager - Periodischer Sync mit pending Actions:', pending.length)
        await processSyncQueue()
      } catch (error) {
        logger.warn('⚠️ Sync Manager - Periodischer Sync fehlgeschlagen:', error?.message || error)
      }
    }, AUTO_SYNC_POLL_MS)
    logger.debug('⏱️ Sync Manager - Periodischer Sync aktiviert', { intervalMs: AUTO_SYNC_POLL_MS })
  }

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
  return processSyncQueue()
}

/**
 * Prüft ob Sync aktuell läuft
 * @returns {boolean}
 */
export function isSyncInProgress() {
  return syncInProgress
}

export function stopAutoSync() {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer)
    periodicSyncTimer = null
    logger.debug('🛑 Sync Manager - Periodischer Sync gestoppt')
  }
}

// Export für Testing
export { syncWorkoutAction }
