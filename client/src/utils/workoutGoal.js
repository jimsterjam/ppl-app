// Ziel eines Workouts (Muskelaufbau/Kraft). Wird beim Erstellen/Starten JEDES Workouts im
// Dashboard abgefragt (WorkoutGoalPicker.vue), am Workout gespeichert (Feld `goal`) und ist im
// laufenden Workout fest. Bestimmt das Wiederholungsziel für den Gewichtsvorschlag
// (utils/weightSuggestion.js) und die Wiederholungen im Quick Generator.

export const WORKOUT_GOALS = Object.freeze(['hypertrophy', 'strength'])

/** Gültiges Ziel oder null (für gespeicherte Daten - nie raten). */
export function sanitizeWorkoutGoal(value) {
  const v = String(value || '').trim().toLowerCase()
  return WORKOUT_GOALS.includes(v) ? v : null
}
