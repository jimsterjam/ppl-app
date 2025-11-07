/**
 * Offline Storage mit Dexie.js (IndexedDB)
 * 
 * Ermöglicht lokales Speichern von Workouts und Exercises für Offline-Nutzung.
 * Sync Queue speichert Änderungen die gemacht wurden während Offline.
 * 
 * @module offlineStorage
 */

import Dexie from 'dexie'
import { logger } from './logger'

// Dexie Database Instance
export const db = new Dexie('PPLAppDB')

// Database Schema (Version 1)
// Nutzt .filter() statt .where('synced') für Queries, daher kein Index auf synced nötig
db.version(1).stores({
  workouts: '_id, userId, date, type, completed, createdAt',
  exercises: '_id, category, name, muscleGroup',
  syncQueue: '++id, action, entityType, timestamp, retryCount',
  metadata: 'key'
})

// Datenbank öffnen
db.open().catch(err => {
  logger.error('❌ Offline Storage - Failed to open database:', err)
})

// ============================================================================
// WORKOUTS - Offline Storage
// ============================================================================

/**
 * Speichert ein Workout lokal
 * @param {Object} workout - Workout Objekt
 * @returns {Promise<string>} Workout ID
 */
export async function saveWorkoutOffline(workout) {
  try {
    await db.workouts.put({
      ...workout,
      _syncedAt: Date.now() // Timestamp für Cache-Invalidierung
    })
    logger.debug('💾 Offline Storage - Workout gespeichert:', workout._id)
    return workout._id
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Speichern:', error)
    throw error
  }
}

/**
 * Lädt ein Workout aus dem Offline Storage
 * @param {string} id - Workout ID
 * @returns {Promise<Object|null>} Workout oder null
 */
export async function getWorkoutOffline(id) {
  try {
    const workout = await db.workouts.get(id)
    if (workout) {
      logger.debug('📦 Offline Storage - Workout geladen:', id)
      return workout
    }
    return null
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Laden:', error)
    return null
  }
}

/**
 * Lädt alle Workouts aus dem Offline Storage
 * @param {Object} filters - Optional: { userId, type, completed }
 * @returns {Promise<Array>} Array von Workouts
 */
export async function getAllWorkoutsOffline(filters = {}) {
  try {
    let query = db.workouts.toCollection()
    
    // Filter anwenden
    if (filters.userId) {
      query = query.filter(w => w.userId === filters.userId)
    }
    if (filters.type) {
      query = query.filter(w => w.type === filters.type)
    }
    if (typeof filters.completed === 'boolean') {
      query = query.filter(w => w.completed === filters.completed)
    }
    
    const workouts = await query.toArray()
    logger.debug('📦 Offline Storage - Workouts geladen:', workouts.length)
    return workouts
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Laden aller Workouts:', error)
    return []
  }
}

/**
 * Löscht ein Workout aus dem Offline Storage
 * @param {string} id - Workout ID
 * @returns {Promise<void>}
 */
export async function deleteWorkoutOffline(id) {
  try {
    await db.workouts.delete(id)
    logger.debug('🗑️ Offline Storage - Workout gelöscht:', id)
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Löschen:', error)
    throw error
  }
}

/**
 * Cached mehrere Workouts gleichzeitig (Bulk Insert)
 * @param {Array} workouts - Array von Workouts
 * @returns {Promise<number>} Anzahl gespeicherter Workouts
 */
export async function cacheWorkouts(workouts) {
  try {
    const workoutsWithTimestamp = workouts.map(w => ({
      ...w,
      _syncedAt: Date.now()
    }))
    await db.workouts.bulkPut(workoutsWithTimestamp)
    logger.debug('💾 Offline Storage - Workouts cached:', workouts.length)
    return workouts.length
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Cachen:', error)
    return 0
  }
}

// ============================================================================
// EXERCISES - Offline Storage
// ============================================================================

/**
 * Speichert eine Exercise lokal
 * @param {Object} exercise - Exercise Objekt
 * @returns {Promise<string>} Exercise ID
 */
export async function saveExerciseOffline(exercise) {
  try {
    await db.exercises.put({
      ...exercise,
      _syncedAt: Date.now()
    })
    logger.debug('💾 Offline Storage - Exercise gespeichert:', exercise._id)
    return exercise._id
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Speichern Exercise:', error)
    throw error
  }
}

/**
 * Lädt eine Exercise aus dem Offline Storage
 * @param {string} id - Exercise ID
 * @returns {Promise<Object|null>} Exercise oder null
 */
export async function getExerciseOffline(id) {
  try {
    const exercise = await db.exercises.get(id)
    return exercise || null
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Laden Exercise:', error)
    return null
  }
}

/**
 * Lädt alle Exercises aus dem Offline Storage
 * @param {Object} filters - Optional: { category }
 * @returns {Promise<Array>} Array von Exercises
 */
export async function getAllExercisesOffline(filters = {}) {
  try {
    let query = db.exercises.toCollection()
    
    if (filters.category) {
      query = query.filter(ex => ex.category === filters.category)
    }
    
    const exercises = await query.toArray()
    logger.debug('📦 Offline Storage - Exercises geladen:', exercises.length)
    return exercises
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Laden aller Exercises:', error)
    return []
  }
}

/**
 * Cached mehrere Exercises gleichzeitig (Bulk Insert)
 * @param {Array} exercises - Array von Exercises
 * @returns {Promise<number>} Anzahl gespeicherter Exercises
 */
export async function cacheExercises(exercises) {
  try {
    const exercisesWithTimestamp = exercises.map(ex => ({
      ...ex,
      _syncedAt: Date.now()
    }))
    await db.exercises.bulkPut(exercisesWithTimestamp)
    logger.debug('💾 Offline Storage - Exercises cached:', exercises.length)
    return exercises.length
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Cachen Exercises:', error)
    return 0
  }
}

// ============================================================================
// SYNC QUEUE - Offline Changes
// ============================================================================

/**
 * Fügt eine Aktion zur Sync Queue hinzu
 * @param {string} action - 'create', 'update', 'delete'
 * @param {string} entityType - 'workout', 'exercise'
 * @param {Object} data - Die zu synchronisierenden Daten
 * @returns {Promise<number>} Queue Item ID
 */
export async function queueAction(action, entityType, data) {
  try {
    const id = await db.syncQueue.add({
      action,
      entityType,
      data,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0,
      error: null
    })
    logger.debug('📝 Sync Queue - Action hinzugefügt:', action, entityType, id)
    return id
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Hinzufügen:', error)
    throw error
  }
}

/**
 * Holt alle ungesyncten Actions aus der Queue
 * @returns {Promise<Array>} Array von Sync Queue Items
 */
export async function getPendingSyncActions() {
  try {
    // .filter() statt .where() weil synced möglicherweise keinen Index hat
    const all = await db.syncQueue.toArray()
    const pending = all
      .filter(action => !action.synced)
      .sort((a, b) => a.timestamp - b.timestamp)
    
    logger.debug('📋 Sync Queue - Pending Actions:', pending.length)
    return pending
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Laden:', error)
    return []
  }
}

/**
 * Markiert eine Action als synchronisiert
 * @param {number} id - Queue Item ID
 * @returns {Promise<void>}
 */
export async function markActionSynced(id) {
  try {
    await db.syncQueue.update(id, { 
      synced: true, 
      syncedAt: Date.now() 
    })
    logger.debug('✅ Sync Queue - Action als synced markiert:', id)
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Markieren:', error)
  }
}

/**
 * Erhöht den Retry Counter für eine fehlgeschlagene Action
 * @param {number} id - Queue Item ID
 * @param {string} error - Error Message
 * @returns {Promise<void>}
 */
export async function incrementRetryCount(id, error) {
  try {
    const item = await db.syncQueue.get(id)
    if (item) {
      await db.syncQueue.update(id, { 
        retryCount: item.retryCount + 1,
        error: error,
        lastRetry: Date.now()
      })
      logger.warn('⚠️ Sync Queue - Retry Count erhöht:', id, 'Count:', item.retryCount + 1)
    }
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Retry Count:', error)
  }
}

/**
 * Löscht alle bereits synchronisierten Actions (Cleanup)
 * @returns {Promise<number>} Anzahl gelöschter Items
 */
export async function clearSyncedActions() {
  try {
    // .filter() statt .where() weil synced möglicherweise keinen Index hat
    const all = await db.syncQueue.toArray()
    const syncedIds = all
      .filter(action => action.synced === true)
      .map(action => action.id)
    
    await db.syncQueue.bulkDelete(syncedIds)
    
    logger.debug('🧹 Sync Queue - Synced Actions gelöscht:', syncedIds.length)
    return syncedIds.length
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Cleanup:', error)
    return 0
  }
}

/**
 * Zählt Pending Actions für UI Badge
 * @returns {Promise<number>} Anzahl pending Actions
 */
export async function countPendingActions() {
  try {
    // .filter() statt .where() weil synced möglicherweise keinen Index hat
    // (funktioniert auch mit Version 1 Schema ohne synced Index)
    const actions = await db.syncQueue.toArray()
    const count = actions.filter(action => !action.synced).length
    
    return count
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Zählen:', error)
    return 0
  }
}

// ============================================================================
// METADATA - App State
// ============================================================================

/**
 * Speichert Metadata (z.B. letzter Sync Timestamp)
 * @param {string} key - Metadata Key
 * @param {any} value - Metadata Value
 * @returns {Promise<void>}
 */
export async function setMetadata(key, value) {
  try {
    await db.metadata.put({ key, value, updatedAt: Date.now() })
    logger.debug('💾 Metadata - Gespeichert:', key, value)
  } catch (error) {
    logger.error('❌ Metadata - Fehler beim Speichern:', error)
  }
}

/**
 * Lädt Metadata
 * @param {string} key - Metadata Key
 * @returns {Promise<any>} Metadata Value oder null
 */
export async function getMetadata(key) {
  try {
    const item = await db.metadata.get(key)
    return item?.value || null
  } catch (error) {
    logger.error('❌ Metadata - Fehler beim Laden:', error)
    return null
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Prüft ob die App online ist
 * @returns {boolean} True wenn online
 */
export function isOnline() {
  return navigator.onLine
}

/**
 * Löscht alle Offline-Daten (Danger Zone!)
 * @returns {Promise<void>}
 */
export async function clearAllOfflineData() {
  try {
    await db.workouts.clear()
    await db.exercises.clear()
    await db.syncQueue.clear()
    await db.metadata.clear()
    logger.warn('⚠️ Offline Storage - Alle Daten gelöscht!')
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler beim Löschen:', error)
    throw error
  }
}

/**
 * Gibt Statistiken über den Offline Storage zurück
 * @returns {Promise<Object>} Stats Objekt
 */
export async function getStorageStats() {
  try {
    // .filter() für pendingSync weil synced möglicherweise keinen Index hat
    const allSyncActions = await db.syncQueue.toArray()
    const pendingCount = allSyncActions.filter(action => !action.synced).length
    
    const stats = {
      workouts: await db.workouts.count(),
      exercises: await db.exercises.count(),
      pendingSync: pendingCount,
      totalSync: await db.syncQueue.count(),
      lastSync: await getMetadata('lastSyncTimestamp')
    }
    
    logger.debug('📊 Offline Storage - Stats:', stats)
    return stats
  } catch (error) {
    logger.error('❌ Offline Storage - Fehler bei Stats:', error)
    return {
      workouts: 0,
      exercises: 0,
      pendingSync: 0,
      totalSync: 0,
      lastSync: null
    }
  }
}

// Export Database für direkten Zugriff (falls nötig)
export default db
