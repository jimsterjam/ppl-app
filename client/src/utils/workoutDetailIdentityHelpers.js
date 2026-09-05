export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function resolveActiveWorkoutUserId({ workout, getCurrentUser, store, authStore } = {}) {
  return String(
    workout?.userId
    || getCurrentUser?.()?.uid
    || store?.user?.uid
    || store?.user?.id
    || authStore?.user?.uid
    || authStore?.uid
    || ''
  ).trim()
}

export function parseUidFromToken(token = null) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  const parts = raw.split('.')
  if (parts.length < 2) return ''
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    const json = JSON.parse(decoded)
    return String(json?.user_id || json?.uid || json?.sub || '').trim()
  } catch {
    return ''
  }
}

export async function resolveActiveWorkoutUserIdForSave({ workout, getCurrentUser, store, authStore, getIdToken }) {
  const localUid = resolveActiveWorkoutUserId({ workout, getCurrentUser, store, authStore })
  if (localUid) return localUid
  const token = await getIdToken().catch(() => null)
  return parseUidFromToken(token)
}

// draftFavoriteSource: optionaler Fallback aus dem persistenten Workout-Draft
// (activeWorkoutDraft.js), falls die Route-Query-Parameter fehlen - passiert z.B. wenn iOS/
// Capacitor die App nach dem Backgrounding direkt wieder auf die Workout-Detail-Route
// zurücksetzt, ohne die App-eigene Resume-Logik (main.js) zu durchlaufen, die die Query sonst
// wiederherstellen würde. Der Draft selbst übersteht das (localStorage), die Route-Query nicht.
export function isFavoriteSourceRoute(route = {}, draftFavoriteSource = null) {
  return String(route.query?.favoriteSource || '') === '1'
    || String(route.query?.favoriteStart || '') === '1'
    || Boolean(draftFavoriteSource?.favoriteId)
}

export function getFavoriteSourceMeta({ route, workout, normalizeWorkoutType, draftFavoriteSource = null }) {
  const favoriteId = String(route.query?.favoriteId || draftFavoriteSource?.favoriteId || '').trim()
  if (!favoriteId) return null
  return {
    favoriteId,
    favoriteName: String(route.query?.favoriteName || draftFavoriteSource?.favoriteName || '').trim(),
    favoriteType: normalizeWorkoutType(
      route.query?.favoriteType || draftFavoriteSource?.favoriteType || workout?.type || route.query?.type || 'push'
    )
  }
}

export function getLastSetFromExercise(exercise = {}) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  if (sets.length) {
    const last = sets[sets.length - 1] || {}
    return { reps: last.reps ?? 0, weight: last.weight ?? 0 }
  }
  return { reps: exercise?.reps ?? 0, weight: exercise?.weight ?? 0 }
}

export async function waitForRealIdFromDraftId({ id, resolveRealIdFromDraftId, route }) {
  const idStr = String(id || '')
  if (!idStr.startsWith('draft-') && !idStr.startsWith('offline_')) return ''
  const realId = await resolveRealIdFromDraftId(id, route)
  return realId || ''
}
