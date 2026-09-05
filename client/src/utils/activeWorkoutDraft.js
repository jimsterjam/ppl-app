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

// Event-Name, auf den Components (BottomNav, DashboardView, ...) lauschen können,
// um reaktiv auf Änderungen am Active-Draft-localStorage zu reagieren.
export const ACTIVE_DRAFT_UPDATED_EVENT = 'active-draft-updated'

// Debounce-Timer: verhindert, dass bei schnell aufeinanderfolgenden Writes
// (z.B. loadWorkout + deep-watch + WorkoutBuilder-Migration) mehrere synchrone
// CustomEvent-Dispatches den Vue-Reaktivitätszyklus und WKWebView-Rendering überlasten.
let _emitDebounceTimer = null

function emitActiveDraftUpdated(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  if (_emitDebounceTimer) clearTimeout(_emitDebounceTimer)
  _emitDebounceTimer = setTimeout(() => {
    _emitDebounceTimer = null
    try {
      window.dispatchEvent(new CustomEvent(ACTIVE_DRAFT_UPDATED_EVENT, { detail }))
    } catch (err) {
      logger.warn('[activeWorkoutDraft] Event dispatch failed:', err?.message)
    }
  }, 60)
}

function getStorageKey(uid) {
  return STORAGE_KEY_PREFIX + uid
}

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

// favoriteSource: { favoriteId, favoriteName, favoriteType } | null - wird gesetzt, wenn dieses
// Workout aus einem Favoriten gestartet wurde. Bisher lebte diese Info NUR im Router-Query
// (favoriteSource=1&favoriteId=...), das beim App-Resume verloren geht, sobald iOS/Capacitor
// direkt auf die Workout-Detail-Route zurückspringt statt über die App-eigene Resume-Logik in
// main.js (die nur beim Landen auf Welcome/Dashboard/Root greift). Jetzt zusätzlich hier im
// ohnehin schon persistenten Draft mitgespeichert, damit "Favorit aktualisieren"-Button auch
// nach einem App-Wechsel/-Neustart erhalten bleibt (siehe WorkoutDetailView.vue).
export function setActiveDraft(uid, workout, editingWorkoutId = null, favoriteSource = null) {
  if (!uid || !workout) return false
  try {
    const key = getStorageKey(uid)
    const existing = getActiveDraft(uid)

    const startedAt = existing?.startedAt || new Date().toISOString()

    const draft = {
      workout: { ...workout },
      editingWorkoutId: editingWorkoutId || null,
      // Explizit übergebener Wert hat Vorrang; ohne neue Angabe bleibt ein bereits gesetzter
      // favoriteSource aus einem vorherigen setActiveDraft-Aufruf für denselben Draft erhalten
      // (z.B. wenn der Draft später aus anderen Gründen neu geschrieben wird).
      favoriteSource: favoriteSource !== null ? favoriteSource : (existing?.favoriteSource || null),
      startedAt,
      lastModifiedAt: new Date().toISOString()
    }

    localStorage.setItem(key, JSON.stringify(draft))
    logger.debug('[activeWorkoutDraft] Draft set:', {
      uid,
      editingWorkoutId,
      workoutId: workout?._id
    })
    emitActiveDraftUpdated({ type: 'set', uid, workoutId: workout?._id || null })
    return true
  } catch (err) {
    logger.error('[activeWorkoutDraft] setActiveDraft error:', err?.message)
    return false
  }
}

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
    emitActiveDraftUpdated({ type: 'update', uid, workoutId: workout?._id || null })
    return true
  } catch (err) {
    logger.error('[activeWorkoutDraft] updateActiveDraft error:', err?.message)
    return false
  }
}

export function clearActiveDraft(uid) {
  if (!uid) return false
  try {
    const key = getStorageKey(uid)
    localStorage.removeItem(key)
    logger.debug('[activeWorkoutDraft] Draft cleared:', uid)
    emitActiveDraftUpdated({ type: 'clear', uid })
    return true
  } catch (err) {
    logger.error('[activeWorkoutDraft] clearActiveDraft error:', err?.message)
    return false
  }
}

export function getActiveDraftWorkout(uid) {
  const draft = getActiveDraft(uid)
  return draft?.workout || null
}

export function getActiveDraftEditingId(uid) {
  const draft = getActiveDraft(uid)
  return draft?.editingWorkoutId || null
}

export function getActiveDraftFavoriteSource(uid) {
  const draft = getActiveDraft(uid)
  return draft?.favoriteSource || null
}

/**
 * Fallback-Suche über ALLE aktiven Drafts (unabhängig vom User), wenn die uid-basierte
 * Suche fehlschlägt oder die uid zum Zeitpunkt des Aufrufs (noch) nicht auflösbar ist.
 *
 * Hintergrund: resolveActiveWorkoutUserId() in WorkoutDetailView.vue hängt u.a. von
 * auth.currentUser (Firebase) und dem Pinia-User-Store ab. Bei einem echten App-Kaltstart
 * (z.B. nach langem Backgrounding, wenn iOS den Prozess beendet hat) sind diese beim
 * allerersten Mount-Zyklus noch nicht zwingend hydriert - resolveActiveWorkoutUserId() kann
 * dann kurzzeitig einen leeren String liefern, obwohl der korrekte Draft längst in
 * localStorage liegt. Ohne diesen Fallback wird die uid-Prüfung übersprungen, der Code fällt
 * auf einen veralteten Store-/IndexedDB-Stand zurück, und frische Eingaben scheinen "zurück-
 * gesetzt". Da es auf einem Gerät zu jedem Zeitpunkt praktisch nur einen aktiven Draft pro
 * Workout-ID gibt, ist die Suche über alle active_workout_*-Keys unabhängig von der uid sicher.
 *
 * @param {string} workoutId - gesuchte Workout-ID (Route-Param oder editingWorkoutId)
 * @returns {{ uid: string, draft: object } | null}
 */
export function findActiveDraftByWorkoutId(workoutId) {
  const id = String(workoutId || '').trim()
  if (!id || typeof localStorage === 'undefined') return null
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(STORAGE_KEY_PREFIX)) continue
      let draft
      try {
        draft = JSON.parse(localStorage.getItem(key) || 'null')
      } catch {
        continue
      }
      if (!draft?.workout) continue
      const draftWorkoutId = String(draft.workout._id || '').trim()
      const draftEditingId = String(draft.editingWorkoutId || '').trim()
      if (draftWorkoutId === id || draftEditingId === id) {
        return { uid: key.slice(STORAGE_KEY_PREFIX.length), draft }
      }
    }
  } catch (err) {
    logger.warn('[activeWorkoutDraft] findActiveDraftByWorkoutId error:', err?.message)
  }
  return null
}