import { buildTemplateExercise, getAllFavorites } from './planFromTemplate'
import { updateFavoriteWorkout } from './workoutFavorites'

// Übung wechseln: die neue Übung übernimmt die Satzanzahl der alten, alles andere (Wiederholungen, Gewicht, Notiz,
// Pause, Trainingsart, Aufwärmsätze) gehört zur alten Übung und wird nicht mitgenommen.

const keyOf = (value) => String(value || '').trim().toLowerCase()

function workingSetCount(exercise) {
  const rows = (Array.isArray(exercise?.setDetails) ? exercise.setDetails : []).filter((row) => row && !row.isWarmup)
  return rows.length || Math.max(1, Number(exercise?.sets) || 1)
}

/** Neue Übung für das laufende Workout (gleiche Form wie „Übung hinzufügen“); `replacedFrom` nur für den Hinweis in der Sitzung. */
export function buildSwappedExercise(oldExercise, entry) {
  return {
    exerciseId: entry._id || entry.id || null,
    name: entry.name_en || entry.name,
    muscleGroup: entry.muscleGroup,
    imageUrl: entry.imageUrl || '',
    thumbnailUrl: entry.thumbnailUrl || '',
    thumbnailStaticUrl: entry.thumbnailStaticUrl || '',
    setDetails: Array.from({ length: workingSetCount(oldExercise) }, () => ({ reps: 10, weight: 0 })),
    note: '',
    replacedFrom: oldExercise?.name || ''
  }
}

/** Ist schon ein Satz abgehakt, würde der Wechsel Eingetragenes verwerfen - dann ist er nicht möglich. */
export function canSwapExercise(exercise) {
  return !(Array.isArray(exercise?.setDetails) ? exercise.setDetails : []).some((row) => row?.done === true)
}

/**
 * Plan-Tag dauerhaft ändern: die Übung im Favoriten des Tages ersetzen.
 * @returns {{ ok: true } | { ok: false, error: 'favoriteNotFound'|'exerciseNotFound'|'storage' }}
 */
export function replaceExerciseInFavorite({ userId, favoriteId, oldExercise, entry }) {
  const favorite = getAllFavorites(userId).find((fav) => fav.id === favoriteId)
  if (!favorite) return { ok: false, error: 'favoriteNotFound' }
  const exercises = Array.isArray(favorite.workout?.exercises) ? favorite.workout.exercises : []
  const index = exercises.findIndex((ex) => (oldExercise?.exerciseId && String(ex?.exerciseId || ex?._id || '') === String(oldExercise.exerciseId))
    || keyOf(ex?.name) === keyOf(oldExercise?.name))
  if (index < 0) return { ok: false, error: 'exerciseNotFound' }
  const next = exercises.map((ex, i) => (i === index ? buildTemplateExercise(entry, workingSetCount(ex)) : ex))
  const result = updateFavoriteWorkout({
    userId,
    type: favorite.type,
    id: favorite.id,
    name: favorite.name,
    workout: { ...favorite.workout, exercises: next }
  })
  return result?.success ? { ok: true } : { ok: false, error: 'storage' }
}
