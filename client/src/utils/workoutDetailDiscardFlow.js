import { logDiagnostic } from './diagnosticsLog'
import { deleteWorkout as deleteWorkoutApi } from '@/api/workouts'
import { purgePendingCreateQueueForWorkoutId } from './offlineStorage'
import { resolveRealIdFromDraftId as resolveRealIdFromDraftIdUtil } from './workoutHelpers'

export async function discardDraftAndLeaveFlow({
  route,
  workout,
  store,
  db,
  getIdToken,
  isFavoriteAdjustMode,
  suppressDraftPersistence,
  timerStore,
  router,
  clearActiveDraftForCurrentUser,
  clearAllDetailDraftSnapshots,
  clearAllWorkoutMapKeys,
  resolveRealIdFromDraftId = resolveRealIdFromDraftIdUtil,
  deleteWorkoutApiFn = deleteWorkoutApi
} = {}) {
  if (typeof suppressDraftPersistence === 'object' && suppressDraftPersistence !== null) {
    suppressDraftPersistence.value = true
  }

  const safetyResetTimer = setTimeout(() => {
    if (typeof suppressDraftPersistence === 'object' && suppressDraftPersistence !== null) {
      suppressDraftPersistence.value = false
    }
    logDiagnostic('suppress-safety-reset', { reason: 'discardDraftAndLeave-timeout' })
  }, 3000)

  if (typeof clearActiveDraftForCurrentUser === 'function') {
    clearActiveDraftForCurrentUser('discard-draft-leave')
  }
  if (typeof clearAllDetailDraftSnapshots === 'function') {
    clearAllDetailDraftSnapshots()
  }
  if (typeof clearAllWorkoutMapKeys === 'function') {
    clearAllWorkoutMapKeys()
  }

  const routeId = String(route?.params?.id || '')
  if (routeId.startsWith('draft-') || routeId.startsWith('offline_')) {
    await purgePendingCreateQueueForWorkoutId(routeId)
    try { await db?.workouts?.delete(routeId) } catch {}
    try {
      const idx = store?.workouts?.findIndex(w => String(w?._id || '') === routeId)
      if (idx !== -1) store.workouts.splice(idx, 1)
    } catch {}
    try {
      const mappedReal = await resolveRealIdFromDraftId(routeId)
      if (mappedReal) {
        const tk = await getIdToken?.().catch(() => null)
        deleteWorkoutApiFn(mappedReal, tk).catch(() => null)
        try {
          const midx = store?.workouts?.findIndex(w => String(w?._id || '') === mappedReal)
          if (midx !== -1) store.workouts.splice(midx, 1)
        } catch {}
      }
    } catch {}
  } else if (routeId && !isFavoriteAdjustMode) {
    const isOrphanNewWorkout =
      workout?.completed !== true &&
      (String(route?.query?.created || '') === '1' ||
        workout?._isDraft === true ||
        workout?.isDraft === true)
    if (isOrphanNewWorkout) {
      try {
        const tk = await getIdToken?.().catch(() => null)
        deleteWorkoutApiFn(routeId, tk).catch(() => null)
      } catch {}
      try {
        const idx = store?.workouts?.findIndex(w => String(w?._id || '') === routeId)
        if (idx !== -1) store.workouts.splice(idx, 1)
      } catch {}
      try { await db?.workouts?.delete(routeId) } catch {}
    }
  }

  try { timerStore?.reset?.() } catch {}
  clearTimeout(safetyResetTimer)
  if (router && typeof router.push === 'function') {
    await router.push('/dashboard')
  }
}
