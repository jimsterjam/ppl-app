// Favorit-Frage beim Speichern (Absprache Jimmy 13.11.): Wer ein selbst zusammengestelltes oder generiertes Workout zum
// ersten Mal speichert, wird gefragt, ob er es als Favorit merken möchte - damit er es nicht jedes Mal neu zusammenstellen
// muss. Reine Logik ohne Vue, damit jede Regel direkt testbar ist (WorkoutDetailView.vue nutzt sie).
//
// Nicht gefragt wird:
//   - bei Workouts aus einem Favoriten oder einem Trainingsplan (die gibt es schon als Vorlage),
//   - beim Favoriten-Anpassen und beim nachträglichen Bearbeiten eines schon gespeicherten Workouts,
//   - bei älteren Workouts ohne Herkunft (origin null),
//   - wenn es schon einen Favoriten mit genau diesen Übungen gibt.
// Ist das Limit an Favoriten für den Typ erreicht, gibt es statt der Frage einen kurzen Hinweis.

export const FAVORITE_ASK_ORIGINS = Object.freeze(['manual', 'generated'])

/** Herkunft eines Workouts (Client-Seite, wie server/utils/coachCheck.js): nur feste Werte, sonst null. */
export function sanitizeWorkoutOrigin(value) {
  return ['manual', 'generated', 'favorite', 'plan'].includes(value) ? value : null
}

function exerciseKey(exercise) {
  const id = String(exercise?.exerciseId || '').trim()
  return id || String(exercise?.name || '').trim().toLowerCase()
}

/** Gleiche Übungen in gleicher Reihenfolge? */
export function sameExercises(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return false
  return a.every((exercise, i) => exerciseKey(exercise) === exerciseKey(b[i]))
}

/**
 * @param {{ workout: object, fromFavorite?: boolean, favoriteAdjust?: boolean, favorites?: Array<{ workout?: object }>, limit?: number }} input
 * @returns {'ask'|'limit'|'skip'}
 */
export function decideFavoriteAsk({ workout, fromFavorite = false, favoriteAdjust = false, favorites = [], limit = Infinity } = {}) {
  if (!workout || fromFavorite || favoriteAdjust) return 'skip'
  if (workout.completed === true) return 'skip' // gespeichertes Workout wird nur bearbeitet
  if (!FAVORITE_ASK_ORIGINS.includes(workout.origin)) return 'skip'
  if (workout.planId) return 'skip'
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : []
  if (exercises.length === 0) return 'skip'
  const list = Array.isArray(favorites) ? favorites : []
  if (list.some((favorite) => sameExercises(favorite?.workout?.exercises, exercises))) return 'skip'
  if (list.length >= limit) return 'limit'
  return 'ask'
}
