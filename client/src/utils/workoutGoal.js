// Ziel eines Workouts (Muskelaufbau/Kraft/Explosiv/Technik). Wird beim Erstellen/Starten JEDES Workouts im
// Dashboard abgefragt (WorkoutGoalPicker.vue), am Workout gespeichert (Feld `goal`) und ist im
// laufenden Workout fest. Bestimmt das Wiederholungsziel für den Gewichtsvorschlag
// (utils/weightSuggestion.js) und die Wiederholungen im Quick Generator.

export const WORKOUT_GOALS = Object.freeze(['hypertrophy', 'strength', 'explosive', 'technique'])

// Der KI-Workout-Generator kennt nur diese beiden Ziele (Absprache Paul 19.10.).
export const GENERATOR_GOALS = Object.freeze(['hypertrophy', 'strength'])

// i18n-Schlüssel für Anzeigenamen und Wiederholungsbereich je Ziel.
export const WORKOUT_GOAL_LABEL_KEYS = Object.freeze({
  hypertrophy: 'quickGenerator.goalHypertrophy',
  strength: 'quickGenerator.goalStrength',
  explosive: 'workoutGoal.explosive',
  technique: 'workoutGoal.technique'
})

/** Gültiges Ziel oder null (für gespeicherte Daten - nie raten). */
export function sanitizeWorkoutGoal(value) {
  const v = String(value || '').trim().toLowerCase()
  return WORKOUT_GOALS.includes(v) ? v : null
}
