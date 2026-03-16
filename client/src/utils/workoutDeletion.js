import { queueAction } from '@/utils/offlineStorage'

function withTimeout(promise, timeoutMs, label = 'operation') {
  let timeoutId = null
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

async function safeCall(callback, logger, label) {
  if (typeof callback !== 'function') return null
  try {
    return await callback()
  } catch (error) {
    logger?.debug?.(`[workoutDeletion] ${label} failed`, error)
    return null
  }
}

async function resolveDeleteToken({ authToken, getIdToken, getCurrentUser, tokenTimeoutMs }) {
  if (authToken) return authToken

  const tokenFromHook = await withTimeout(
    Promise.resolve(typeof getIdToken === 'function' ? getIdToken() : null).catch(() => null),
    tokenTimeoutMs,
    'getIdToken'
  )
  if (tokenFromHook) return tokenFromHook

  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null
  if (!currentUser?.getIdToken) return null

  return withTimeout(
    Promise.resolve(currentUser.getIdToken(true)).catch(() => null),
    tokenTimeoutMs,
    'currentUser.getIdToken'
  )
}

export function getWorkoutIdentifier(workout) {
  const candidates = [workout?._id, workout?.id, workout?.workoutId]
  return candidates
    .map((value) => String(value || '').trim())
    .find(Boolean) || ''
}

export function isLocalOnlyWorkoutId(workoutId) {
  const id = String(workoutId || '').trim()
  return id.startsWith('offline_') || id.startsWith('draft-') || id === 'draft' || id === 'workout_detail_draft'
}

function resolveDeleteUserId(workout, currentUser) {
  return String(workout?.userId || currentUser?.uid || currentUser?.id || '').trim() || null
}

export async function deleteWorkoutFromStats({
  workout,
  authToken = null,
  online = true,
  deleteWorkoutApi,
  deleteWorkoutOffline,
  getIdToken,
  getCurrentUser,
  loadOfflineWorkouts,
  reloadWorkouts,
  reloadStats,
  onLocalRemove,
  logger,
  deleteSyncTimeoutMs = 5000,
  tokenTimeoutMs = 1500
}) {
  const workoutId = getWorkoutIdentifier(workout)
  if (!workoutId) {
    return { ok: false, reason: 'missing-id' }
  }

  onLocalRemove?.(workoutId)
  await deleteWorkoutOffline(workoutId)

  const localOnly = isLocalOnlyWorkoutId(workoutId)
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null
  const deleteUserId = resolveDeleteUserId(workout, currentUser)
  let token = null

  if (online && !localOnly) {
    token = await resolveDeleteToken({ authToken, getIdToken, getCurrentUser, tokenTimeoutMs }).catch(() => null)
  }

  if (online && !localOnly && !token) {
    await safeCall(() => queueAction('delete', 'workout', {
      _id: workoutId,
      userId: deleteUserId,
      _failedOnlineDelete: true,
      _queuedWithoutToken: true
    }), logger, 'queueAction(delete:no-token)')
    await safeCall(loadOfflineWorkouts, logger, 'loadOfflineWorkouts(no-token)')
    await safeCall(() => reloadStats?.(null), logger, 'reloadStats(no-token)')
    return {
      ok: true,
      workoutId,
      token: null,
      offlineFallback: true,
      queued: true
    }
  }

  try {
    const result = online && !localOnly
      ? await withTimeout(deleteWorkoutApi(workoutId, token), deleteSyncTimeoutMs, 'deleteWorkoutApi')
      : { success: true, _id: workoutId, offlineFallback: true }

    await safeCall(loadOfflineWorkouts, logger, 'loadOfflineWorkouts')

    if (online && result?.offlineFallback !== true) {
      await safeCall(() => reloadWorkouts?.(token), logger, 'reloadWorkouts')
    }

    await safeCall(() => reloadStats?.(token), logger, 'reloadStats')

    return {
      ok: true,
      workoutId,
      token,
      result,
      offlineFallback: result?.offlineFallback === true
    }
  } catch (error) {
    await safeCall(() => queueAction('delete', 'workout', {
      _id: workoutId,
      userId: deleteUserId,
      _failedOnlineDelete: true,
      reason: String(error?.message || 'delete-failed')
    }), logger, 'queueAction(delete:retry)')
    await safeCall(() => deleteWorkoutOffline(workoutId), logger, 'deleteWorkoutOffline(retry)')
    await safeCall(loadOfflineWorkouts, logger, 'loadOfflineWorkouts(retry)')
    await safeCall(() => reloadStats?.(token), logger, 'reloadStats(retry)')

    return {
      ok: true,
      workoutId,
      token,
      offlineFallback: true,
      error
    }
  }
}