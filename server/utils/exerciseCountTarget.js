// Ziel-/Obergrenze für die Übungsanzahl im Quick Generator (vorher modul-lokal in
// routes/workouts.js und dadurch nicht testbar). Wird an zwei Stellen genutzt, die
// übereinstimmen müssen:
//   1. createQuickGeneratorPrompt(): sagt der KI vorab, wie viele Übungen sie planen soll
//   2. enforceWorkoutProgrammingRules(): harte Obergrenze bei der Übungsauswahl
// Früher stand im Prompt fest "5-6 Übungen", während die Nachbearbeitung z.B. bei Kraft/60 min
// auf 4 kürzte - die KI plante also systematisch Übungen, die danach wieder wegfielen.

export const EXERCISE_COUNT_MIN = 2;
export const EXERCISE_COUNT_MAX = 8;

// Normalisiert beliebige Zielangaben ("strength", "muscle_building", ...) auf die zwei Modi
// des Zeitmodells - identisch zu normalizeGoal() in routes/workouts.js.
function toGoalMode(goal) {
  return String(goal || '').toLowerCase().includes('strength') ? 'strength' : 'hypertrophy';
}

// Automatische Obergrenze Ziel x Dauer (User-Vorgabe: Kraft/60 min max. 4, Muskelaufbau 5-6). Ab 60 Minuten wächst sie
// mit der Wunschzeit (vorher blieb sie bei 6 bzw. 4: 75 Minuten ergaben ein 49-Minuten-Workout). Die eigentliche Zahl
// bestimmt das Zeitmodell (utils/workoutTimeModel.js); diese Tabelle ist nur die Sicherung nach oben.
export function getTimeAdjustedExerciseTarget(durationMinutes = 45, goal = 'hypertrophy') {
  const duration = Number(durationMinutes) || 45;
  const isStrength = toGoalMode(goal) === 'strength';
  if (duration <= 30) return isStrength ? 3 : 4;
  if (duration <= 45) return isStrength ? 4 : 5;
  if (duration <= 60) return isStrength ? 4 : 6;
  if (duration <= 75) return isStrength ? 5 : 7;
  return isStrength ? 6 : EXERCISE_COUNT_MAX;
}

// Manueller Override des Nutzers hat Vorrang, bleibt aber in sinnvollen Grenzen (2-8).
export function getMaxExerciseCount(durationMinutes, goal, override) {
  const overrideNumber = Number(override);
  if (override !== null && override !== undefined && Number.isFinite(overrideNumber) && overrideNumber > 0) {
    return Math.max(EXERCISE_COUNT_MIN, Math.min(EXERCISE_COUNT_MAX, Math.round(overrideNumber)));
  }
  return getTimeAdjustedExerciseTarget(durationMinutes, goal);
}
