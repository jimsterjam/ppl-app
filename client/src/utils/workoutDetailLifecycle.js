import { buildWorkoutNotesSummary } from './workoutNotes'
import { getActiveDraft, setActiveDraft, clearActiveDraft } from './activeWorkoutDraft'
import { logDiagnostic } from './diagnosticsLog'
import { logger } from './logger'

export function shouldKeepAsDraft({ route, workoutLike, isFavoriteSourceRoute } = {}) {
  if (!workoutLike) return false
  const routeId = String(route?.params?.id || '')
  if (routeId === 'draft' || routeId.startsWith('draft-')) return true
  if (String(route?.query?.created || '') === '1') return true
  if (typeof isFavoriteSourceRoute === 'function' && isFavoriteSourceRoute() && workoutLike.completed !== true) return true
  return workoutLike._isDraft === true || workoutLike.isDraft === true
}

export function resolveActiveWorkoutUserId({ workout, getCurrentUser, userStore, authStore } = {}) {
  const result = String(
    workout?.userId
    || getCurrentUser?.()?.uid
    || userStore?.user?.uid
    || userStore?.user?.id
    || authStore?.user?.uid
    || authStore?.uid
    || ''
  ).trim()
  return result
}

export function clearActiveDraftForCurrentUser({ uid, reason = 'unknown', loggerInstance = logger } = {}) {
  if (!uid) return false
  const cleared = clearActiveDraft(uid)
  if (cleared && loggerInstance?.debug) {
    loggerInstance.debug('[WorkoutDetail] active draft cleared', { reason, uid })
  }
  return cleared
}

export function saveActiveDraftDirect({
  route,
  workout,
  exerciseNotes,
  isDirty,
  suppressDraftPersistence,
  isFavoriteAdjustMode,
  resolveActiveWorkoutUserIdFn,
  shouldKeepAsDraftFn,
  getActiveDraftFn = getActiveDraft,
  setActiveDraftFn = setActiveDraft,
  loggerInstance = logger,
  diagnosticLogger = logDiagnostic,
  reason = 'unknown',
  forceIgnoreDirty = false
} = {}) {
  if (suppressDraftPersistence) return false
  if (isFavoriteAdjustMode) return false

  const w = workout
  if (!w || w.completed === true) return false
  if (typeof shouldKeepAsDraftFn === 'function' ? !shouldKeepAsDraftFn(w) : false) return false
  if (!forceIgnoreDirty && !isDirty) return false

  const uid = typeof resolveActiveWorkoutUserIdFn === 'function' ? resolveActiveWorkoutUserIdFn() : ''
  if (!uid) return false

  const exercises = Array.isArray(w.exercises) && Array.isArray(exerciseNotes)
    ? w.exercises.map((ex, idx) => ({
        ...ex,
        note: typeof exerciseNotes[idx] === 'string' ? exerciseNotes[idx] : ex.note || ''
      }))
    : (w.exercises || [])

  const notes = buildWorkoutNotesSummary(exercises)
  const existing = getActiveDraftFn(uid)
  let editingWorkoutId = existing?.editingWorkoutId ?? null

  if (!editingWorkoutId) {
    const routeId = String(route?.params?.id || '').trim()
    if (routeId && routeId !== 'draft' && !routeId.startsWith('draft-') && !routeId.startsWith('offline_')) {
      editingWorkoutId = routeId
    }
  }

  const ok = setActiveDraftFn(uid, {
    ...w,
    _id: String(w._id || route?.params?.id || ''),
    exercises,
    notes
  }, editingWorkoutId || null)

  if (ok && loggerInstance?.debug) {
    loggerInstance.debug('[WorkoutDetail] active draft saved', {
      reason,
      forceIgnoreDirty,
      editingWorkoutId: editingWorkoutId || null,
      exerciseCount: exercises.length
    })
    if (typeof diagnosticLogger === 'function') {
      diagnosticLogger('draft-write', {
        reason,
        forceIgnoreDirty,
        exercises: exercises.map(ex => ({ name: ex.name, setDetails: ex.setDetails }))
      })
    }
  }
  return ok
}

export function persistActiveDraftFromLifecycle({
  route,
  workout,
  exerciseNotes,
  isDirty,
  suppressDraftPersistence,
  isFavoriteAdjustMode,
  resolveActiveWorkoutUserIdFn,
  saveActiveDraftDirectFn,
  writeDetailViewStateFn,
  reason = 'unknown'
} = {}) {
  if (typeof writeDetailViewStateFn === 'function') {
    writeDetailViewStateFn(reason)
  }
  if (typeof saveActiveDraftDirectFn === 'function') {
    saveActiveDraftDirectFn(reason, true)
  } else {
    saveActiveDraftDirect({
      route,
      workout,
      exerciseNotes,
      isDirty,
      suppressDraftPersistence,
      isFavoriteAdjustMode,
      resolveActiveWorkoutUserIdFn,
      shouldKeepAsDraftFn: (w) => shouldKeepAsDraft({ route, workoutLike: w, isFavoriteSourceRoute: () => String(route?.query?.favoriteSource || '') === '1' || String(route?.query?.favoriteStart || '') === '1' }),
      reason,
      forceIgnoreDirty: true
    })
  }
}
