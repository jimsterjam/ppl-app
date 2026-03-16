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
import { normalizeDefaultExercises } from './normalizeDefaultExercises'
import { ensureWorkoutNotes } from './workoutNotes'

export const OFFLINE_WORKOUTS_UPDATED_EVENT = 'offline-workouts-updated'
const MAX_OFFLINE_WORKOUTS = 400
const DELETED_WORKOUT_TOMBSTONES_KEY = 'deleted_workout_ids_v1'
const DELETED_WORKOUT_TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000

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

function emitOfflineWorkoutsUpdated(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_WORKOUTS_UPDATED_EVENT, { detail }))
  } catch (error) {
    logger.warn('⚠️ Offline Storage - Event dispatch failed:', error)
  }
}

function readDeletedWorkoutTombstones() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(DELETED_WORKOUT_TOMBSTONES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDeletedWorkoutTombstones(map) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DELETED_WORKOUT_TOMBSTONES_KEY, JSON.stringify(map || {}))
  } catch {}
}

export function markWorkoutDeleted(id) {
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return
  const next = readDeletedWorkoutTombstones()
  next[normalizedId] = Date.now()
  writeDeletedWorkoutTombstones(next)
}

export function isWorkoutDeleted(id) {
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return false
  const map = readDeletedWorkoutTombstones()
  const entry = map[normalizedId]
  if (!entry) return false
  const timestamp = Number(typeof entry === 'object' ? (entry?.timestamp || entry?.deletedAt || 0) : entry)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true
  return (Date.now() - timestamp) <= DELETED_WORKOUT_TOMBSTONE_TTL_MS
}

export function filterDeletedWorkouts(list = []) {
  const items = Array.isArray(list) ? list : []
  return items.filter((item) => !isWorkoutDeleted(item?._id || item?.id || item?.workoutId))
}

async function enforceWorkoutHistoryLimit() {
  try {
    const all = await db.workouts.toArray()
    const nonDrafts = all.filter(item => !(item?._isDraft))
    if (nonDrafts.length <= MAX_OFFLINE_WORKOUTS) return
    const sorted = [...nonDrafts].sort((a, b) => {
      const aDate = new Date(a.updatedAt || a.date || a.createdAt || a._syncedAt || 0).getTime()
      const bDate = new Date(b.updatedAt || b.date || b.createdAt || b._syncedAt || 0).getTime()
      return bDate - aDate
    })
    const stale = sorted.slice(MAX_OFFLINE_WORKOUTS)
    const staleIds = stale.map(item => item._id).filter(Boolean)
    if (staleIds.length === 0) return
    await db.workouts.bulkDelete(staleIds)
    emitOfflineWorkoutsUpdated({ type: 'trim', removed: staleIds.length })
  } catch (error) {
    logger.warn('⚠️ Offline Storage - Konnte Verlaufslimit nicht anwenden:', error)
  }
}

// ============================================================================
// WORKOUTS - Offline Storage
// ============================================================================

/**
 * Sanitize object für IndexedDB (entfernt nicht-klonierbare Properties)
 * @param {any} obj - Zu bereinigendes Objekt
 * @returns {any} Bereinigtes Objekt
 */
function sanitizeForIndexedDB(obj) {
  if (obj === null || obj === undefined) return obj
  
  // Primitive Typen direkt zurückgeben
  if (typeof obj !== 'object') return obj
  
  // Arrays rekursiv bereinigen
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForIndexedDB(item))
  }
  
  // Date-Objekte als ISO String speichern
  if (obj instanceof Date) {
    return obj.toISOString()
  }
  
  // Plain Object: Nur eigene enumerable Properties übernehmen
  const sanitized = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]
      
      // Skip Funktionen und Symbole
      if (typeof value === 'function' || typeof value === 'symbol') {
        continue
      }
      
      // Rekursiv für verschachtelte Objekte
      sanitized[key] = sanitizeForIndexedDB(value)
    }
  }
  
  return sanitized
}

/**
 * Speichert ein Workout lokal
 * @param {Object} workout - Workout Objekt
 * @returns {Promise<string>} Workout ID
 */
export async function saveWorkoutOffline(workout) {
  // Kurzer Retry bei transienten IndexedDB-Abbrüchen (iOS/Safari ist hier empfindlich).
  const RETRIES = 2
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      // Sanitize workout vor dem Speichern (entfernt Vue Proxies, Funktionen, etc.)
      const cleanWorkout = sanitizeForIndexedDB(workout)
      ensureWorkoutNotes(cleanWorkout)
      // Draft-Workouts niemals in die Sync-Queue aufnehmen
      if (cleanWorkout._isDraft) {
        await db.workouts.put({
          ...cleanWorkout,
          _syncedAt: Date.now()
        })
        logger.debug('💾 Offline Storage - Draft gespeichert (kein Sync!):', cleanWorkout._id)
        emitOfflineWorkoutsUpdated({ type: 'draft-save', id: cleanWorkout._id })
        return cleanWorkout._id
      }
      // Normale Workouts wie gehabt speichern
      await db.workouts.put({
        ...cleanWorkout,
        _syncedAt: Date.now()
      })
      logger.debug('💾 Offline Storage - Workout gespeichert:', cleanWorkout._id)
      emitOfflineWorkoutsUpdated({ type: 'save', id: cleanWorkout._id })

      // WICHTIG: Drafts nicht global löschen.
      // Das führte zu Race-Conditions, bei denen neue Drafts im Dashboard kurz verschwanden.
      await enforceWorkoutHistoryLimit()
      return cleanWorkout._id
    } catch (error) {
      const isRetryable = error?.name === 'AbortError' || error?.name === 'UnknownError'
      if (isRetryable && attempt < RETRIES) {
        logger.warn('⚠️ Offline Storage - Retry nach transientem IndexedDB-Fehler', {
          attempt: attempt + 1,
          error: error?.name || 'unknown'
        })
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
        continue
      }
      logger.error('❌ Offline Storage - Fehler beim Speichern:', error, workout)
      throw error
    }
  }
}

/**
 * Lädt ein Workout aus dem Offline Storage
 * @param {string} id - Workout ID
 * @returns {Promise<Object|null>} Workout oder null
 */
export async function getWorkoutOffline(id) {
  try {
    if (isWorkoutDeleted(id)) return null
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
    
    const workouts = filterDeletedWorkouts(await query.toArray())
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
    markWorkoutDeleted(id)
    await db.workouts.delete(id)
    logger.debug('🗑️ Offline Storage - Workout gelöscht:', id)
    emitOfflineWorkoutsUpdated({ type: 'delete', id })
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
    // Sanitize alle Workouts
    const cleanWorkouts = filterDeletedWorkouts(workouts).map(w => {
      const sanitized = sanitizeForIndexedDB(w)
      ensureWorkoutNotes(sanitized)
      return sanitized
    })
    
    const workoutsWithTimestamp = cleanWorkouts.map(w => ({
      ...w,
      _syncedAt: Date.now()
    }))
    await db.workouts.bulkPut(workoutsWithTimestamp)
    logger.debug('💾 Offline Storage - Workouts cached:', workouts.length)
    emitOfflineWorkoutsUpdated({ type: 'cache', count: workouts.length })
    await enforceWorkoutHistoryLimit()
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
    // Sanitize exercise vor dem Speichern
    const cleanExercise = sanitizeForIndexedDB(exercise)
    
    await db.exercises.put({
      ...cleanExercise,
      _syncedAt: Date.now()
    })
    logger.debug('💾 Offline Storage - Exercise gespeichert:', cleanExercise._id)
    return cleanExercise._id
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
      // Case-insensitive Filterung für bessere Kompatibilität
      const targetCategory = filters.category.toLowerCase()
      query = query.filter(ex => {
        const exCategory = (ex.category || '').toLowerCase()
        return exCategory === targetCategory
      })
    }
    
    const exercises = await query.toArray()
    logger.debug('📦 Offline Storage - Exercises geladen:', exercises.length, filters.category ? `(filtered: ${filters.category})` : '')
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
    // Sanitize alle Exercises
    const cleanExercises = exercises.map(ex => sanitizeForIndexedDB(ex))
    
    const exercisesWithTimestamp = cleanExercises.map(ex => ({
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

/**
 * Initialisiert die Datenbank mit Standard-Übungen (falls leer)
 * Wird beim ersten App-Start aufgerufen
 * @returns {Promise<boolean>} True wenn Übungen geladen wurden
 */
export async function initializeDefaultExercises() {
  try {
    // Prüfe ob schon Übungen vorhanden sind
    const count = await db.exercises.count()
    if (count > 0) {
      logger.debug('✅ Exercises bereits vorhanden:', count)
      return false
    }
    
    logger.info('📥 Lade Standard-Übungen...')
    
    // Lade Standard-Übungen (bundled import primary, fetch fallback)
    let exercises = []
    try {
      const { loadDefaultExercises } = await import('@/utils/defaultExercisesLoader')
      exercises = await loadDefaultExercises()
    } catch {
      const response = await fetch('/data/default-exercises.json')
      if (!response.ok) throw new Error('Default exercises nicht verfügbar')
      exercises = normalizeDefaultExercises(await response.json())
    }
    if (!Array.isArray(exercises) || exercises.length === 0) {
      throw new Error('Keine Übungen geladen')
    }
    
    // Generiere IDs für die Übungen
    const exercisesWithIds = exercises.map((ex, idx) => ({
      _id: ex._id || (ex.id ? `ex_${ex.id}` : `default_${idx + 1}`),
      ...ex,
      _isDefault: true,
      _syncedAt: Date.now()
    }))
    
    // Speichere in IndexedDB
    await db.exercises.bulkAdd(exercisesWithIds)
    
    logger.info(`✅ ${exercisesWithIds.length} Standard-Übungen geladen!`)
    return true
  } catch (error) {
    logger.error('❌ Fehler beim Laden der Standard-Übungen:', error)
    return false
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
    // Sanitize data vor dem Speichern (entfernt Vue Proxies, Funktionen, etc.)
    const cleanData = sanitizeForIndexedDB(data)
    // Draft-Workouts niemals in die Sync-Queue aufnehmen
    if (entityType === 'workout' && cleanData._isDraft) {
      logger.debug('📝 Sync Queue - Draft-Workout NICHT zur Queue hinzugefügt')
      return null
    }
    const id = await db.syncQueue.add({
      action,
      entityType,
      data: cleanData,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0,
      error: null
    })
    logger.debug('📝 Sync Queue - Action hinzugefügt:', action, entityType, id)
    return id
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Hinzufügen:', error, data)
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
      .filter(action => !action.synced && action.failed !== true)
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
 * Markiert eine Action als dauerhaft fehlgeschlagen (wird nicht weiter retried)
 * @param {number} id - Queue Item ID
 * @param {string} reason - Fehlergrund
 * @returns {Promise<void>}
 */
export async function markActionFailed(id, reason = 'max-retries-reached') {
  try {
    await db.syncQueue.update(id, {
      failed: true,
      failedAt: Date.now(),
      failReason: reason
    })
    logger.warn('🚫 Sync Queue - Action als failed markiert:', id, reason)
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Markieren als failed:', error)
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
    let nextCount = 0
    await db.syncQueue.where('id').equals(id).modify((item) => {
      const current = Number(item.retryCount || 0)
      nextCount = current + 1
      item.retryCount = nextCount
      item.error = error
      item.lastRetry = Date.now()
    })
    if (nextCount > 0) {
      logger.warn('⚠️ Sync Queue - Retry Count erhöht:', id, 'Count:', nextCount)
    }
    return nextCount
  } catch (error) {
    logger.error('❌ Sync Queue - Fehler beim Retry Count:', error)
    return 0
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
      .filter(action => action.synced === true || action.failed === true)
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
 * Macht einen echten API-Test statt nur navigator.onLine
 * @returns {boolean} True wenn online
 */
export function isOnline() {
  // Prüfe zuerst navigator.onLine (schneller Check)
  if (!navigator.onLine) {
    return false
  }
  
  // Wenn navigator sagt Online, aber Localhost nicht erreichbar ist,
  // sind wir trotzdem "offline" für die App
  // Aber wir können nicht synchron testen, also verlassen wir uns auf navigator.onLine
  return true
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
