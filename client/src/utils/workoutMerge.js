/**
 * Merge- und Dedup-Logik für Workout-Listen (Server vs. Offline-Cache).
 * Reine Hilfsfunktionen ohne externe Abhängigkeiten.
 */

export function normalizeWorkoutFingerprint(workout = {}) {
  const date = String(workout?.date || '').trim()
  const name = String(workout?.name || '').trim().toLowerCase()
  const type = String(workout?.type || '').trim().toLowerCase()
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : []
  const exerciseCount = exercises.length
  const volume = exercises.reduce((sum, ex) => {
    if (Array.isArray(ex?.setDetails) && ex.setDetails.length) {
      return sum + ex.setDetails.reduce((setSum, set) => {
        const reps = Number(set?.reps) || 0
        const weight = Number(set?.weight) || 0
        return setSum + reps * weight
      }, 0)
    }
    const sets = Number(ex?.sets) || 0
    const reps = Number(ex?.reps) || 0
    const weight = Number(ex?.weight) || 0
    return sum + (sets * reps * weight)
  }, 0)
  return `${date}|${name}|${type}|${exerciseCount}|${Math.round(volume)}`
}

/**
 * Robuste Merge-Funktion für zwei Workout-Listen.
 * Regeln:
 *   - Server ist die autoritative Basis
 *   - Lokale offline-erstellte Workouts (_offlineCreated / offline_*) bleiben immer erhalten
 *   - Lokale Drafts overlay-en ggf. einen passenden Server-Eintrag
 *   - Für Konflikte ohne Draft-Flag: last-write-wins (updatedAt)
 */
export function mergeWorkoutLists(serverList, localList) {
  const map = new Map()

  for (const w of (serverList || [])) {
    const id = String(w?._id || '').trim()
    if (!id) continue
    map.set(id, w)
  }

  for (const w of (localList || [])) {
    const id = String(w?._id || '').trim()
    if (!id) continue
    const isDraft = w._isDraft === true || w.isDraft === true
    const isOfflineCreated = w._offlineCreated === true || id.startsWith('offline_')

    if (isOfflineCreated || isDraft) {
      if (!map.has(id)) {
        map.set(id, w)
      } else if (isDraft) {
        const existing = map.get(id)
        map.set(id, { ...existing, ...w, _isDraft: true, isDraft: true, completed: false })
      }
      continue
    }

    if (!map.has(id)) {
      map.set(id, w)
      continue
    }
    const existing = map.get(id)
    const existingTs = new Date(existing?.updatedAt || existing?.date || 0).getTime()
    const localTs = new Date(w?.updatedAt || w?.date || 0).getTime()
    if (localTs > existingTs) map.set(id, w)
  }

  return Array.from(map.values())
}

export function dedupeWorkoutsForStats(list = []) {
  const items = Array.isArray(list) ? list.filter(Boolean) : []
  const byKey = new Map()

  items.forEach((workout) => {
    if (workout?._isDraft === true || workout?.isDraft === true) return
    const uid = String(workout?._id || workout?.id || workout?.workoutId || '').trim()
    const identity = uid || normalizeWorkoutFingerprint(workout)
    const existing = byKey.get(identity)
    if (!existing) {
      byKey.set(identity, workout)
      return
    }
    const existingTs = new Date(existing?.updatedAt || existing?.date || existing?.createdAt || 0).getTime()
    const nextTs = new Date(workout?.updatedAt || workout?.date || workout?.createdAt || 0).getTime()
    if (nextTs >= existingTs) byKey.set(identity, workout)
  })

  return Array.from(byKey.values())
}
