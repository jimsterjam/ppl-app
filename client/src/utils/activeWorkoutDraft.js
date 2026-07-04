/**
 * activeWorkoutDraft.js — Isolated localStorage-based draft management
 *
 * Separates "workout in progress" (local-only) from "workout" (server entity).
 * A single localStorage entry per user: active_workout_${uid}
 *
 * Structure:
 * {
 *   workout: { ...full workout object },
 *   editingWorkoutId: "64f3a2b1c5e7d9f3..." (realId) or null (new workout),
 *   startedAt: "2026-06-15T10:00:00.000Z",
 *   lastModifiedAt: "2026-06-15T10:05:30.000Z"
 * }
 *
 * No server calls, no IndexedDB, no Sync-Queue involvement — pure localStorage.
 * Survives app kills, backgrounding, and page reloads on iOS/Capacitor.
 */

import { logger } from './logger'

const STORAGE_KEY_PREFIX = 'active_workout_'

/**
 * @param {string} uid - User ID
 * @returns {string} localStorage key for this user's active draft
 */
function getStorageKey(uid) {
  return STORAGE_KEY_PREFIX + uid
}

/**
 * Reads the active workout draft for a user from localStorage
 * @param {string} uid - User ID
 * @returns {Object|null} { workout, editingWorkoutId, startedAt, lastModifiedAt } or null
 */
export function getActiveDraft(uid) {
  if (!uid) return null
  try {
    const key = getStorageKey(uid)
    const stored = localStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed || null
  } catch (err) {
    logger.warn('[activeWorkoutDraft] getActiveDraft error:', err?.message)
    return null
  }
}

/**
 * Checks if an active draft exists for a user
 * @param {string} uid - User ID
 * @returns {boolean}
 */
export function hasActiveDraft(uid) {
  if (!uid) return false
  try {
    const key = getStorageKey(uid)
    return localStorage.getItem(key) !== null
  } catch (err) {
    logger.warn('[activeWorkoutDraft] hasActiveDraft error:', err?.message)
    return false
  }
}

/**
 * Creates or overwrites the active draft for a user
 * @param {string} uid - User ID
 * @param {Object} workout - Workout object (will be cloned)
 * @param {string|null} editingWorkoutId - Real MongoDB ID (null for new), or existing draft ID
 * @returns {boolean} true if successful
 */
export function setActiveDraft(uid, workout, editingWorkoutId = null) {
  if (!uid || !workout) return false
  try {
    const key = getStorageKey(uid)
    const existing = getActiveDraft(uid)

    // Preserve startedAt from existing draft, or use now
    const startedAt = existing?.startedAt || new Date().toISOString()

    const draft = {
      workout: { ...workout },
      editingWorkoutId: editingWorkoutId || null,
      startedAt,
      lastModifiedAt: new Date().toISOString()
    }

    localStorage.setItem(key, JSON.stringify(draft))
    logger.debug('[activeWorkoutDraft] Draft set:', {
      uid,
      editingWorkoutId,
      workoutId: workout?._id
    })
    return true
  } catch (err) {
    logger.error('[activeWorkoutDraft] setActiveDraft error:', err?.message)
    return false
  }
}

/**
 * Updates only the workout + lastModifiedAt in an existing draft
 * Does nothing if no draft exists for this user
 * @param {string} uid - User ID
 * @param {Object} workout - Updated workout object
 * @returns {boolean} true if successful, false if no draft exists or error
 */
export function updateActiveDraft(uid, workout) {
  if (!uid || !workout) return false
  try {
    const existing = getActiveDraft(uid)
    if (!existing) {
      logger.debug('[activeWorkoutDraft] updateActiveDraft: no existing draft for uid', uid)
      return false
    }

    const key = getStorageKey(uid)
    const draft = {
      ...existing,
      workout: { ...workout },
      lastModifiedAt: new Date().toISOString()
    }

    localStorage.setItem(key, JSON.stringify(draft))
    logger.debug('[activeWorkoutDraft] Draft updated:', {
      uid,
      workoutId: workout?._id
    })
    return true
  } catch (err) {
    logger.error('[activeWorkoutDraft] updateActiveDraft error:', err?.message)
    return false
  }
}

/**
 * Removes the active draft for a user
 * @param {string} uid - User ID
 * @returns {boolean} true if successful
 */
export function clearActiveDraft(uid) {
  if (!uid) return false
  try {
    const key = getStorageKey(uid)
    localStorage.removeItem(key)
    logger.debug('[activeWorkoutDraft] Draft cleared:', uid)
    return true
  } catch (err) {
    logger.error('[activeWorkoutDraft] clearActiveDraft error:', err?.message)
    return false
  }
}

/**
 * Gets the workout object from an active draft (shorthand)
 * @param {string} uid - User ID
 * @returns {Object|null}
 */
export function getActiveDraftWorkout(uid) {
  const draft = getActiveDraft(uid)
  return draft?.workout || null
}

/**
 * Gets the editingWorkoutId from an active draft (shorthand)
 * @param {string} uid - User ID
 * @returns {string|null}
 */
export function getActiveDraftEditingId(uid) {
  const draft = getActiveDraft(uid)
  return draft?.editingWorkoutId || null
}
