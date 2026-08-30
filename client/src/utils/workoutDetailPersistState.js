const WORKOUT_DETAIL_VIEW_STATE_KEY = 'workout_detail_view_state_v1'

export function getWorkoutDetailViewStateKey() {
  return WORKOUT_DETAIL_VIEW_STATE_KEY
}

export function clearAllDetailDraftSnapshots(storage = sessionStorage) {
  try {
    const keys = Object.keys(storage)
    keys.forEach((key) => {
      if (key === 'workout_detail_draft' || key.startsWith('workout_detail_draft_')) {
        storage.removeItem(key)
      }
    })
  } catch {}
}

export function clearAllWorkoutMapKeys(storage = sessionStorage) {
  try {
    const keys = Object.keys(storage)
    keys.forEach((key) => {
      if (key.startsWith('workout_map_')) {
        storage.removeItem(key)
      }
    })
  } catch {}
}

export function getViewStateWorkoutId({ route, workout }) {
  const routeId = String(route?.params?.id || '').trim()
  const workoutId = String(workout?._id || '').trim()
  return workoutId || routeId
}

export function readDetailViewState(storage = localStorage) {
  try {
    const raw = storage.getItem(WORKOUT_DETAIL_VIEW_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeDetailViewState({ route, workout, lastFieldAnchor, storage = localStorage, key = WORKOUT_DETAIL_VIEW_STATE_KEY, reason = 'unknown' }) {
  try {
    const workoutId = getViewStateWorkoutId({ route, workout })
    if (!workoutId) return false
    const scrollY = typeof window !== 'undefined' ? Math.max(0, Math.round(window.scrollY || 0)) : 0
    const anchor = lastFieldAnchor && typeof lastFieldAnchor === 'object'
      ? {
          exIndex: Number(lastFieldAnchor.exIndex) || 0,
          setIndex: Number(lastFieldAnchor.setIndex) || 0,
          field: String(lastFieldAnchor.field || '')
        }
      : null

    storage.setItem(key, JSON.stringify({
      workoutId,
      scrollY,
      anchor,
      reason: String(reason || 'unknown'),
      timestamp: Date.now()
    }))
    return true
  } catch {
    return false
  }
}
