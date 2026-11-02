// Zeitmodell des Workout-Generators (Absprache Paul 02.11.): Die Wunschzeit ist die GESAMTZEIT inklusive Warm-up.
// Gerechnet wird, was beim Training wirklich Zeit kostet:
//
//   Gesamtzeit = W + Σ (C_i + n_i · s_i + (n_i − 1) · r_i) + P
//
//   W    Warm-up (Cardio 5 min + Gelenke 2 min + leichter Aufwärmsatz, Laufen, Einrichten)  ~ 9 min
//   C_i  Wechselzeit zur Übung: hingehen, Gewicht aufbauen, Gerät einstellen              ~ 2,5 min (Grundübung) / 1,5 min (Zusatz)
//   n_i  Arbeitssätze, s_i Dauer eines Satzes inklusive Einrichten                          ~ 40 s / 35 s
//   r_i  Pause zwischen den Sätzen (Standard des Pausentimers bzw. Wert der Übung)
//   P    Puffer: Trinken, Notizen, Handy                                                    ~ 3 min
//
// Nach dem letzten Satz einer Übung zählt keine Pause, sondern die Wechselzeit der nächsten.
// Eichpunkt (Paul): 4 Kraftübungen (5 + 5 + 4 + 3 Sätze) inklusive Warm-up ~ 70 min; das Modell liefert ~ 65 min,
// ein persönlicher Faktor k (aus echten Trainingsdauern, standardmäßig 1) gleicht den Rest aus.
import { getGeneratorRule } from './repTargets.js';

export const WARMUP_SECONDS = 540;
export const BUFFER_SECONDS = 180;
export const SET_SECONDS = Object.freeze({ main: 40, accessory: 35 });
export const CHANGEOVER_SECONDS = Object.freeze({ main: 150, accessory: 90 });
// So weit darf das Ergebnis über der Wunschzeit liegen (ein Satz mehr ist besser als eine halbe Übung weniger).
export const OVER_BUDGET_TOLERANCE = 0.05;
export const CALIBRATION_MIN = 0.8;
export const CALIBRATION_MAX = 1.5;

/** Zusatz-/Isolationsübung (kürzere Wechselzeit, kürzere Sätze), sonst Grundübung. */
export function isAccessoryExercise(exercise, goal) {
  const strength = String(goal || '').toLowerCase().includes('strength');
  return !!exercise?.isIsolation || (strength && exercise?.demandTier === 'low');
}

/** Persönlicher Faktor, begrenzt auf einen plausiblen Bereich; ungültig = 1. */
export function sanitizeCalibration(value) {
  const k = Number(value);
  if (!Number.isFinite(k) || k <= 0) return 1;
  return Math.min(CALIBRATION_MAX, Math.max(CALIBRATION_MIN, k));
}

function restSecondsOf(exercise, goal) {
  const rest = Number(exercise?.rest);
  if (Number.isFinite(rest) && rest > 0) return rest;
  return getGeneratorRule(goal, isAccessoryExercise(exercise, goal)).rest;
}

/** Sekunden für einen Übungsblock: Wechsel + Sätze + Pausen zwischen den Sätzen. */
export function estimateExerciseBlockSeconds(exercise, goal) {
  const accessory = isAccessoryExercise(exercise, goal);
  const kind = accessory ? 'accessory' : 'main';
  const sets = Math.max(1, Math.round(Number(exercise?.sets) || 3));
  return CHANGEOVER_SECONDS[kind] + sets * SET_SECONDS[kind] + (sets - 1) * restSecondsOf(exercise, goal);
}

/**
 * Gesamtzeit der Einheit in Sekunden (inklusive Warm-up und Puffer), mit persönlichem Faktor k.
 * Ohne Übungen: 0.
 */
export function estimateSessionSeconds(exercises = [], goal = 'hypertrophy', { calibration = 1 } = {}) {
  if (!Array.isArray(exercises) || exercises.length === 0) return 0;
  const blocks = exercises.reduce((sum, exercise) => sum + estimateExerciseBlockSeconds(exercise, goal), 0);
  return Math.round((WARMUP_SECONDS + blocks + BUFFER_SECONDS) * sanitizeCalibration(calibration));
}

/** Maximale Satzzahl je Übung laut Generator-Regel (Kraft-Grundübung 5, sonst 4). */
export function maxSetsFor(exercise, goal) {
  return getGeneratorRule(goal, isAccessoryExercise(exercise, goal)).sets[1];
}

/**
 * Wählt aus der nach Priorität sortierten Liste so viele Übungen, dass die Gesamtzeit zur Wunschzeit passt, und füllt
 * übrige Zeit mit zusätzlichen Sätzen der Grundübungen.
 *
 * @param {object[]} orderedExercises - nach Priorität (Hauptübungen zuerst), Sätze/Pausen schon nach Generator-Regel
 * @param {number} totalMinutes - Wunschzeit; 'total_session': Gesamtzeit inkl. Warm-up (Standard),
 *                                'training_only': Warm-up kommt obendrauf
 * @param {{ durationMode?: string, maxExerciseCount?: number, calibration?: number }} [options]
 */
export function selectExercisesForTotalTime(orderedExercises = [], totalMinutes = 45, goal = 'hypertrophy', options = {}) {
  const { durationMode = 'total_session', maxExerciseCount = Infinity } = options;
  const calibration = sanitizeCalibration(options.calibration);
  const wanted = Math.max(20, Number(totalMinutes) || 45) * 60;
  const budgetSeconds = durationMode === 'training_only'
    ? wanted + Math.round(WARMUP_SECONDS * calibration)
    : wanted;
  const limit = Math.round(budgetSeconds * (1 + OVER_BUDGET_TOLERANCE));
  const hardCap = Number.isFinite(maxExerciseCount) && maxExerciseCount > 0 ? Math.floor(maxExerciseCount) : Infinity;
  const minCount = Math.min(2, orderedExercises.length);
  const estimate = (list) => estimateSessionSeconds(list, goal, { calibration });

  const selected = [];
  for (const candidate of orderedExercises) {
    if (selected.length >= hardCap) break;
    const next = [...selected, { ...candidate }];
    // Passt eine Übung nicht mehr, kann eine kürzere weiter hinten (Isolation) trotzdem noch passen.
    if (estimate(next) <= limit || next.length <= minCount) selected.push({ ...candidate });
  }

  // Übrige Zeit: reihum ein Satz mehr, Grundübungen zuerst, bis Satzgrenze oder Zeit erreicht.
  const order = selected
    .map((exercise, index) => ({ exercise, index }))
    .sort((a, b) => Number(isAccessoryExercise(a.exercise, goal)) - Number(isAccessoryExercise(b.exercise, goal)) || a.index - b.index)
    .map((entry) => entry.exercise);
  let added = true;
  while (added) {
    added = false;
    for (const exercise of order) {
      if (exercise.sets >= maxSetsFor(exercise, goal)) continue;
      exercise.sets += 1;
      if (estimate(selected) <= limit) added = true;
      else exercise.sets -= 1;
    }
  }

  const totalSeconds = estimate(selected);
  const warmupSeconds = Math.round(WARMUP_SECONDS * calibration);
  return {
    exercises: selected,
    estimatedDurationSeconds: totalSeconds,
    warmupSeconds,
    trainingSeconds: Math.max(0, totalSeconds - warmupSeconds),
    timeBudgetSeconds: budgetSeconds,
    durationMode,
    calibration,
    trimmed: selected.length < orderedExercises.length
  };
}
