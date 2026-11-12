// Zeitmodell des Workout-Generators (Absprache Jimmy 02.11.): Die Wunschzeit ist die GESAMTZEIT inklusive Warm-up.
// Gerechnet wird, was beim Training wirklich Zeit kostet:
//
//   Gesamtzeit = W + Σ (C_i + n_i · s_i + (n_i − 1) · r_i) + P
//
//   W    Warm-up (Cardio 5 min + Gelenke 2 min + leichter Aufwärmsatz, Laufen, Einrichten)  ~ 9 min;
//        bei kurzen Einheiten (<= 30 min) nur noch das übungsspezifische Aufwärmen, ~ 5 min (Iversen et al. 2021)
//   C_i  Wechselzeit zur Übung: hingehen, Gewicht aufbauen, Gerät einstellen              ~ 2,5 min (Grundübung) / 1,5 min (Zusatz)
//   n_i  Arbeitssätze, s_i Dauer eines Satzes inklusive Einrichten                          ~ 40 s / 35 s
//   r_i  Pause zwischen den Sätzen (Standard des Pausentimers bzw. Wert der Übung)
//   P    Puffer: Trinken, Notizen, Handy                                                    ~ 3 min
//   K    Cool-down am Ende (Vorschlag, 5-10 min): locker bewegen, dehnen, die Spannung wieder loslassen. Bekommt die
//        Zeit, die nach den Übungen übrig bleibt, statt zusätzlicher Sätze (Absprache Jimmy 02.11.). Zählt zur Gesamtzeit,
//        ist aber unabhängig vom persönlichen Faktor k.
//
// Zusätzliche Sätze gibt es nur für Grundübungen, und erst nachdem Platz für das Cool-down reserviert ist.
// Nach dem letzten Satz einer Übung zählt keine Pause, sondern die Wechselzeit der nächsten.
// Eichpunkt (Jimmy): 4 Kraftübungen (5 + 5 + 4 + 3 Sätze) inklusive Warm-up ~ 70 min; das Modell liefert ~ 65 min,
// ein persönlicher Faktor k (aus echten Trainingsdauern, standardmäßig 1) gleicht den Rest aus.
import { getGeneratorRule } from './repTargets.js';
import { getMaxExerciseCount } from './exerciseCountTarget.js';

export const WARMUP_SECONDS = 540;
export const SHORT_WARMUP_SECONDS = 300;
const SHORT_SESSION_MINUTES = 30;
const FULL_WARMUP_FROM_MINUTES = 45;
export const BUFFER_SECONDS = 180;
export const SET_SECONDS = Object.freeze({ main: 40, accessory: 35 });
export const CHANGEOVER_SECONDS = Object.freeze({ main: 150, accessory: 90 });
// So weit darf das Ergebnis über der Wunschzeit liegen (ein Satz mehr ist besser als eine halbe Übung weniger).
export const OVER_BUDGET_TOLERANCE = 0.05;
export const COOLDOWN_MIN_SECONDS = 300;
export const COOLDOWN_MAX_SECONDS = 600;
// Ab dieser Wunschzeit gibt es ein Cool-down (und bleibt beim Auffüllen mit Sätzen Platz dafür); kürzere Einheiten
// nutzen die ganze Zeit für Arbeitssätze.
const COOLDOWN_RESERVE_FROM_MINUTES = 45;
export const CALIBRATION_MIN = 0.8;
export const CALIBRATION_MAX = 1.5;

/** Zusatz-/Isolationsübung (kürzere Wechselzeit, kürzere Sätze), sonst Grundübung. */
export function isAccessoryExercise(exercise, goal) {
  const strength = String(goal || '').toLowerCase().includes('strength');
  return !!exercise?.isIsolation || (strength && exercise?.demandTier === 'low');
}

/**
 * Warm-up in Sekunden je Wunschzeit: bis 30 min nur das übungsspezifische Aufwärmen (5 min), ab 45 min das volle
 * Warm-up (9 min), dazwischen gleitend. Bei kurzen Einheiten bleibt so mehr Zeit für Arbeitssätze.
 */
export function warmupSecondsFor(totalMinutes) {
  const minutes = Number(totalMinutes);
  if (!Number.isFinite(minutes) || minutes >= FULL_WARMUP_FROM_MINUTES) return WARMUP_SECONDS;
  if (minutes <= SHORT_SESSION_MINUTES) return SHORT_WARMUP_SECONDS;
  const share = (minutes - SHORT_SESSION_MINUTES) / (FULL_WARMUP_FROM_MINUTES - SHORT_SESSION_MINUTES);
  return Math.round(SHORT_WARMUP_SECONDS + share * (WARMUP_SECONDS - SHORT_WARMUP_SECONDS));
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
export function estimateSessionSeconds(exercises = [], goal = 'hypertrophy', { calibration = 1, warmupSeconds = WARMUP_SECONDS } = {}) {
  if (!Array.isArray(exercises) || exercises.length === 0) return 0;
  const blocks = exercises.reduce((sum, exercise) => sum + estimateExerciseBlockSeconds(exercise, goal), 0);
  return Math.round((warmupSeconds + blocks + BUFFER_SECONDS) * sanitizeCalibration(calibration));
}

/** Maximale Satzzahl je Übung laut Generator-Regel (Kraft-Grundübung 5, sonst 4). */
export function maxSetsFor(exercise, goal) {
  return getGeneratorRule(goal, isAccessoryExercise(exercise, goal)).sets[1];
}

/** Minimale Satzzahl je Übung laut Generator-Regel (Kraft-Grundübung 3, sonst 2). */
export function minSetsFor(exercise, goal) {
  return getGeneratorRule(goal, isAccessoryExercise(exercise, goal)).sets[0];
}

/**
 * Wählt aus der nach Priorität sortierten Liste so viele Übungen, dass die Gesamtzeit zur Wunschzeit passt, und füllt
 * übrige Zeit mit zusätzlichen Sätzen der Grundübungen.
 *
 * Passt eine Übung mit ihrer Satzzahl nicht mehr, wird sie zuerst mit weniger Sätzen versucht (bis zum Minimum der
 * Generator-Regel); passt sie auch dann nicht, kommt eine kürzere Kandidatin weiter hinten (Zusatzübung) an die
 * Reihe. Eine feste Mindestzahl von Übungen gibt es nicht: Entscheidend ist das Volumen, nicht die Übungszahl
 * (Iversen et al. 2021). Nur wenn gar nichts passt, wird die kürzeste Übung mit Mindestsätzen genommen.
 *
 * @param {object[]} orderedExercises - nach Priorität (Hauptübungen zuerst), Sätze/Pausen schon nach Generator-Regel
 * @param {number} totalMinutes - Wunschzeit; 'total_session': Gesamtzeit inkl. Warm-up (Standard),
 *                                'training_only': Warm-up kommt obendrauf
 * @param {{ durationMode?: string, maxExerciseCount?: number, calibration?: number }} [options]
 */
export function selectExercisesForTotalTime(orderedExercises = [], totalMinutes = 45, goal = 'hypertrophy', options = {}) {
  const { durationMode = 'total_session', maxExerciseCount = Infinity } = options;
  const calibration = sanitizeCalibration(options.calibration);
  const wantedMinutes = Math.max(20, Number(totalMinutes) || 45);
  const warmupSeconds = warmupSecondsFor(wantedMinutes);
  const scaledWarmup = Math.round(warmupSeconds * calibration);
  const budgetSeconds = durationMode === 'training_only'
    ? wantedMinutes * 60 + scaledWarmup
    : wantedMinutes * 60;
  const limit = Math.round(budgetSeconds * (1 + OVER_BUDGET_TOLERANCE));
  const hardCap = Number.isFinite(maxExerciseCount) && maxExerciseCount > 0 ? Math.floor(maxExerciseCount) : Infinity;
  const estimate = (list) => estimateSessionSeconds(list, goal, { calibration, warmupSeconds });

  const selected = [];
  for (const candidate of orderedExercises) {
    if (selected.length >= hardCap) break;
    const entry = { ...candidate };
    const minSets = minSetsFor(entry, goal);
    // Sätze schrittweise bis zum Minimum der Generator-Regel senken, bis die Übung ins Budget passt.
    while (estimate([...selected, entry]) > limit && entry.sets > minSets) entry.sets -= 1;
    if (estimate([...selected, entry]) <= limit) selected.push(entry);
  }

  if (selected.length === 0 && orderedExercises.length > 0) {
    // Nichts passt (sehr kurze Wunschzeit): die kürzeste Übung mit Mindestsätzen, die Überschreitung bleibt sichtbar.
    const cheapest = orderedExercises
      .map((exercise) => ({ ...exercise, sets: minSetsFor(exercise, goal) }))
      .sort((a, b) => estimateExerciseBlockSeconds(a, goal) - estimateExerciseBlockSeconds(b, goal))[0];
    selected.push(cheapest);
  }

  // Übrige Zeit: reihum ein Satz mehr, nur für Grundübungen (bis zur Satzgrenze der Generator-Regel). Ab 45 min bleibt
  // Platz für das Cool-down: bei Kraft mindestens 5 min (mehr Sätze sind dort der natürliche Hebel), bei Muskelaufbau
  // das volle Cool-down von bis zu 10 min - Sätze gibt es erst für Zeit darüber hinaus.
  const reserve = goal && String(goal).toLowerCase().includes('strength') ? COOLDOWN_MIN_SECONDS : COOLDOWN_MAX_SECONDS;
  const topUpLimit = wantedMinutes >= COOLDOWN_RESERVE_FROM_MINUTES ? budgetSeconds - reserve : limit;
  const mains = selected.filter((exercise) => !isAccessoryExercise(exercise, goal));
  let added = true;
  while (added) {
    added = false;
    for (const exercise of mains) {
      if (exercise.sets >= maxSetsFor(exercise, goal)) continue;
      exercise.sets += 1;
      if (estimate(selected) <= topUpLimit) added = true;
      else exercise.sets -= 1;
    }
  }

  const exercisesSeconds = estimate(selected);
  // Cool-down: 5-10 Minuten (volle Minuten) aus der Zeit, die bis zur Wunschzeit übrig ist; sonst keins.
  const leftover = budgetSeconds - exercisesSeconds;
  // Gleiche Mindestdauer wie bei der Cool-down-Reserve: kurze Einheiten (< 45 min) bekommen keins, auch nicht,
  // wenn zum Beispiel durch eine manuelle Obergrenze der Übungsanzahl Zeit übrig bleibt.
  const cooldownSeconds = wantedMinutes >= COOLDOWN_RESERVE_FROM_MINUTES && leftover >= COOLDOWN_MIN_SECONDS
    ? Math.min(COOLDOWN_MAX_SECONDS, Math.floor(leftover / 60) * 60)
    : 0;
  const totalSeconds = exercisesSeconds + cooldownSeconds;
  return {
    exercises: selected,
    estimatedDurationSeconds: totalSeconds,
    warmupSeconds: scaledWarmup,
    cooldownSeconds,
    trainingSeconds: Math.max(0, exercisesSeconds - scaledWarmup),
    timeBudgetSeconds: budgetSeconds,
    durationMode,
    calibration,
    overBudget: exercisesSeconds > limit,
    trimmed: selected.length < orderedExercises.length
  };
}

/**
 * Zeit-Optionen aus dem (bereits geprüften) Request: Modus, persönlicher Faktor und Obergrenze der Übungsanzahl.
 * Ein Ort für alles, was vom Request bis zur Auswahl durchgereicht wird (siehe workoutSanitizer.js).
 */
export function resolveTimeSelectionOptions(context = {}, durationMinutes = context?.durationMinutes, goal = context?.goal) {
  return {
    durationMode: context?.durationMode === 'training_only' ? 'training_only' : 'total_session',
    calibration: sanitizeCalibration(context?.timeCalibration),
    maxExerciseCount: getMaxExerciseCount(durationMinutes, goal, context?.exerciseCountOverride)
  };
}
