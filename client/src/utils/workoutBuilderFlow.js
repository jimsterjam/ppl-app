const VALID_WORKOUT_TYPES = new Set(['push', 'pull', 'legs', 'fullbody'])

export const QUICK_PREFILL_KEY = 'quick_workout_prefill'
export const DETAIL_DRAFT_KEY = 'workout_detail_draft'

/**
 * Returns a user-scoped sessionStorage key for the workout detail draft.
 * Using a UID-suffix prevents cross-user draft leakage on shared devices or
 * after account switches. Falls back to the legacy key when uid is unknown.
 */
export function getDetailDraftKey(uid) {
  const cleanUid = String(uid || '').trim()
  return cleanUid ? `workout_detail_draft_${cleanUid}` : DETAIL_DRAFT_KEY
}

export function normalizeBuilderWorkoutType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_WORKOUT_TYPES.has(normalized) ? normalized : 'push'
}

export function buildWorkoutBuilderRoute(type, options = {}) {
  const query = {
    type: normalizeBuilderWorkoutType(type)
  }

  if (options.quick === true) {
    query.quick = '1'
  }
  if (options.favoriteStart === true) {
    query.favoriteStart = '1'
  }
  if (options.favoriteAdjust === true) {
    query.favoriteAdjust = '1'
  }

  return {
    name: 'workout-builder',
    query
  }
}

export function saveWorkoutBuilderPrefill(prefill) {
  try {
    sessionStorage.setItem(QUICK_PREFILL_KEY, JSON.stringify(prefill || {}))
    return true
  } catch {
    return false
  }
}

export function consumeWorkoutBuilderPrefill() {
  try {
    const raw = sessionStorage.getItem(QUICK_PREFILL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    sessionStorage.removeItem(QUICK_PREFILL_KEY)
    return parsed
  } catch {
    return null
  }
}

export function readWorkoutBuilderRouteState(routeQuery = {}) {
  return {
    type: normalizeBuilderWorkoutType(routeQuery?.type),
    quick: String(routeQuery?.quick || '') === '1',
    favoriteStart: String(routeQuery?.favoriteStart || '') === '1',
    favoriteAdjust: String(routeQuery?.favoriteAdjust || '') === '1'
  }
}