/**
 * SaveWorkoutService — einzige autorisierte Schreibstelle für Workouts.
 *
 * Garantien:
 * - Interner saveInProgress-Lock verhindert parallele Final-Saves (löst Duplicate-Create-Bug).
 * - _isDraft wird atomar mit der Persistenz gesetzt (gemäß WORKOUT_DRAFT_RULE.md).
 * - reconcileCallback wird hier registriert, nicht in main.js.
 */

import { logger } from './logger'
import { getToken } from './authToken'
import { resolveRealIdFromDraftId, snapshotCore } from './workoutHelpers'
import { saveWorkoutOffline } from './offlineStorage'
import { setReconcileCallback } from './syncManager'

// ── Sentinel-Fehlerklasse ────────────────────────────────────────────────────

export class SaveInProgressError extends Error {
  constructor() {
    super('SaveWorkoutService: Final-Save bereits aktiv')
    this.name = 'SaveInProgressError'
  }
}

// ── Interner Zustand ─────────────────────────────────────────────────────────

let _saveInProgress = false

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function isTransientError(error) {
  const status = Number(error?.statusCode || error?.response?.status || 0)
  const code = String(error?.code || '').toUpperCase()
  if (!status) return true
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  if (code === 'ECONNABORTED') return true
  return false
}

function isAuthError(error) {
  const status = Number(error?.statusCode || error?.response?.status || 0)
  return status === 401 || status === 403
}

// ── Singleton-Service ────────────────────────────────────────────────────────

export const saveWorkoutService = {

  /**
   * Einmalig beim App-Start aufrufen. Registriert den reconcileCallback beim syncManager.
   * @param {(tempId: string, workout: object) => void} cb
   */
  init(cb) {
    setReconcileCallback((tempId, workout) => {
      if (typeof cb === 'function') {
        try { cb(tempId, workout) } catch (e) {
          logger.warn('[SaveWorkoutService] reconcileCallback warf Fehler:', e?.message)
        }
      }
    })
    logger.debug('[SaveWorkoutService] init: reconcileCallback registriert')
  },

  /** @type {boolean} */
  get isSaving() {
    return _saveInProgress
  },

  // ── Draft-Save (Auto-Save) ─────────────────────────────────────────────────

  /**
   * Speichert ein Workout als Draft (completed=false, _isDraft=true).
   * Wirft niemals. Gibt immer { saved, skipped, reason? } zurück.
   *
   * @param {string} workoutId - route.params.id
   * @param {object} workout - Snapshot des Workouts (wird nicht mutiert)
   * @param {object} [opts]
   * @param {string|null} [opts.userId]
   * @param {boolean} [opts.isFavoriteAdjustMode]
   * @param {boolean} [opts.suppressDraftPersistence]
   * @param {object} [opts.store] - userStore-Instanz (für updateWorkout-Aufruf)
   * @param {() => boolean} [opts.shouldAbort] - Callback: true → mid-flight abbrechen (z. B. saving.value)
   * @returns {Promise<{saved: boolean, skipped: boolean, reason?: string, snapshot?: string}>}
   */
  async saveDraft(workoutId, workout, opts = {}) {
    const { userId = null, isFavoriteAdjustMode = false, suppressDraftPersistence = false, store = null, shouldAbort = null } = opts
    const abort = () => typeof shouldAbort === 'function' && shouldAbort()

    if (_saveInProgress) return { saved: false, skipped: true, reason: 'final-save-active' }
    if (suppressDraftPersistence || abort()) return { saved: false, skipped: true, reason: 'suppress-flag' }
    if (isFavoriteAdjustMode) return { saved: false, skipped: true, reason: 'adjust-mode' }
    if (!workout) return { saved: false, skipped: true, reason: 'no-workout' }

    const id = String(workoutId || workout._id || '')
    if (!id) return { saved: false, skipped: true, reason: 'no-id' }

    try {
      if (id === 'draft') {
        // Permanenter "draft"-Slot: nur offline persistieren
        await saveWorkoutOffline({
          ...workout,
          _id: 'draft',
          userId: userId || workout.userId || null,
          _isDraft: true,
          isDraft: true,
          completed: false,
          updatedAt: Date.now()
        })
        const snapshot = snapshotCore(workout)
        logger.debug('[SaveWorkoutService] Draft gespeichert (slot: draft)')
        return { saved: true, skipped: false, snapshot }
      }

      if (id.startsWith('draft-')) {
        // Draft-ID mit optionaler Server-Mapping
        if (_saveInProgress || suppressDraftPersistence || abort()) return { saved: false, skipped: true, reason: 'race-during-await' }
        const realId = await resolveRealIdFromDraftId(id)
        if (_saveInProgress || suppressDraftPersistence || abort()) return { saved: false, skipped: true, reason: 'race-during-await' }

        if (realId && store) {
          const token = await getToken()
          if (_saveInProgress || suppressDraftPersistence || abort()) return { saved: false, skipped: true, reason: 'race-during-await' }
          const { _id: _draftId, ...wWithoutId } = workout
          await store.updateWorkout(realId, { ...wWithoutId, _isDraft: true, isDraft: true, completed: false }, token)
          const snapshot = snapshotCore({ ...workout, _id: realId })
          logger.debug('[SaveWorkoutService] Draft-ID mit realId gespeichert:', realId)
          return { saved: true, skipped: false, snapshot }
        }

        // Kein realId: nur offline
        await saveWorkoutOffline({
          ...workout,
          _id: id,
          userId: userId || workout.userId || null,
          _isDraft: true,
          isDraft: true,
          completed: false,
          updatedAt: Date.now()
        })
        const snapshot = snapshotCore(workout)
        logger.debug('[SaveWorkoutService] Draft-ID ohne realId lokal gespeichert:', id)
        return { saved: true, skipped: false, snapshot }
      }

      // Bekannte Server-ID oder offline_xxx
      if (_saveInProgress || suppressDraftPersistence || abort()) return { saved: false, skipped: true, reason: 'race-during-await' }
      const token = await getToken()
      if (_saveInProgress || suppressDraftPersistence || abort()) return { saved: false, skipped: true, reason: 'race-during-await' }

      const keepDraft = workout.completed !== true
      const { _id: _wid, ...wWithoutId } = workout
      const payload = { ...wWithoutId, _isDraft: keepDraft, isDraft: keepDraft }

      if (store) {
        await store.updateWorkout(id, payload, token)
      } else {
        await saveWorkoutOffline({
          ...payload,
          _id: id,
          userId: userId || workout.userId || null,
          updatedAt: Date.now()
        })
      }

      const snapshot = snapshotCore(payload)
      logger.debug('[SaveWorkoutService] Server-Workout als Draft gespeichert:', id)
      return { saved: true, skipped: false, snapshot }

    } catch (e) {
      logger.error('[SaveWorkoutService] saveDraft fehlgeschlagen:', e?.message || e)
      return { saved: false, skipped: false, reason: e?.message || 'unknown' }
    }
  },

  // ── Final-Save (abschließen) ───────────────────────────────────────────────

  /**
   * Speichert ein Workout als abgeschlossen (completed=true, _isDraft=false).
   * Wirft SaveInProgressError bei parallelem Aufruf.
   * Wirft bei echten (nicht-transienten) Fehlern.
   *
   * @param {string} workoutId - route.params.id
   * @param {object} normalizedWorkout - Bereits normalisiertes Workout-Objekt
   * @param {object} [opts]
   * @param {string|null} [opts.userId]
   * @param {number} [opts.timerElapsedMs]
   * @param {object} [opts.store] - userStore-Instanz
   * @returns {Promise<{savedWorkout: object, isOffline: boolean, durationMinutes: number, snapshot: string}>}
   */
  async saveComplete(workoutId, normalizedWorkout, opts = {}) {
    if (_saveInProgress) throw new SaveInProgressError()

    _saveInProgress = true
    logger.debug('[SaveWorkoutService] saveComplete: Lock gesetzt', { workoutId })

    try {
      const { userId = null, timerElapsedMs = 0, store } = opts
      const id = String(workoutId || '')

      const timerElapsedSeconds = Math.max(0, Math.round((Number(timerElapsedMs) || 0) / 1000))
      const timerDurationMinutes = timerElapsedSeconds > 0 ? Math.max(1, Math.round(timerElapsedSeconds / 60)) : 0
      const existingDuration = Number(normalizedWorkout.duration) || 0
      const durationMinutes = timerDurationMinutes > 0 ? timerDurationMinutes : existingDuration

      // Atomares Payload — _isDraft=false und completed=true zusammen gesetzt
      const finalPayload = {
        ...normalizedWorkout,
        userId: userId || normalizedWorkout.userId || undefined,
        duration: durationMinutes,
        completed: true,
        _isDraft: false,
        isDraft: false
      }

      // ── Pfad A: draft-ID mit bekannter realId → Update ──────────────────
      if (id.startsWith('draft-')) {
        const realId = await resolveRealIdFromDraftId(id)
        if (realId) {
          const token = await getToken()
          if (!store) throw new Error('[SaveWorkoutService] store fehlt für draft-Update')
          await store.updateWorkout(realId, finalPayload, token)
          const snapshot = snapshotCore({ ...finalPayload, _id: realId })
          logger.debug('[SaveWorkoutService] saveComplete (draft→realId):', realId)
          return { savedWorkout: { ...finalPayload, _id: realId }, isOffline: false, durationMinutes, snapshot }
        }
        // Kein realId → Create-Pfad (fällt durch zu Pfad C)
      }

      // ── Pfad B: bekannte Server-ID → Update ─────────────────────────────
      if (!id.startsWith('draft-') && !id.startsWith('offline_') && id !== 'draft') {
        const token = await getToken()
        if (!store) throw new Error('[SaveWorkoutService] store fehlt für Update')
        await store.updateWorkout(id, finalPayload, token)
        const snapshot = snapshotCore({ ...finalPayload, _id: id })
        logger.debug('[SaveWorkoutService] saveComplete (update):', id)
        return { savedWorkout: { ...finalPayload, _id: id }, isOffline: false, durationMinutes, snapshot }
      }

      // ── Pfad C: neues Workout (draft ohne realId, draft-ID ohne realId) ──
      const createPayload = { ...finalPayload }
      const token = await getToken()
      if (!store) throw new Error('[SaveWorkoutService] store fehlt für Create')

      let savedWorkout = null
      let isOffline = false
      let offlineMessage = null

      try {
        savedWorkout = await store.createWorkout(createPayload, token)
        isOffline = Boolean(savedWorkout?._offlineCreated)
      } catch (createError) {
        const transient = isTransientError(createError)
        const auth = isAuthError(createError)

        if (transient) {
          logger.warn('[SaveWorkoutService] createWorkout transient, nutze optimistischen Fallback', createError?.message)
          savedWorkout = await store.createWorkoutOptimistic(createPayload, token).catch(() => null)
          if (!savedWorkout) throw createError
          isOffline = true
        } else if (auth) {
          logger.warn('[SaveWorkoutService] createWorkout Auth-Fehler, bewahre lokal auf', createError?.message)
          savedWorkout = await store.createWorkoutOptimistic({
            ...createPayload,
            _syncPendingAuth: true
          }, token).catch(() => null)
          if (!savedWorkout) throw createError
          isOffline = true
          offlineMessage = 'Lokal gespeichert. Sync startet nach erneuter Anmeldung.'
        } else {
          logger.warn('[SaveWorkoutService] createWorkout nicht-retrybar fehlgeschlagen, bewahre lokal auf', createError?.message)
          savedWorkout = await store.createWorkoutOptimistic(createPayload, token).catch(() => null)
          if (!savedWorkout) throw createError
          isOffline = true
          offlineMessage = 'Lokal gespeichert. Sync wird erneut versucht.'
        }
      }

      const snapshot = snapshotCore({ ...createPayload, _id: savedWorkout?._id || id })
      logger.debug('[SaveWorkoutService] saveComplete (create):', savedWorkout?._id, { isOffline })
      return { savedWorkout, isOffline, durationMinutes, snapshot, offlineMessage }

    } finally {
      _saveInProgress = false
      logger.debug('[SaveWorkoutService] saveComplete: Lock freigegeben')
    }
  }
}
