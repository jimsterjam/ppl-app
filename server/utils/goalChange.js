// Trainingsziel gewechselt (Absprache Jimmy 23.11.): Wechselt der Nutzer bei derselben Übung das Ziel (z. B. Kraft 5×60 kg -> Muskelaufbau
// 8×40 kg), ist "weniger Gewicht, mehr Wiederholungen" die erwartete Folge, kein Rückschritt. Bisher wählte die Auswertung die letzte
// Einheit nur nach dem Übungsnamen und die KI erfuhr nichts vom Ziel.
//
// Die wirksame Trainingsart je Übung kommt aus derselben Logik wie im Workout (client/src/utils/weightSuggestion.js
// resolveExerciseGoal: eigene Wahl > explosiv > Workout-Ziel). Ist das Ziel einer der beiden Einheiten unbekannt (ältere Workouts ohne
// Ziel), wird NICHTS behauptet.

import { getProgressionEngine, exerciseInfo } from './nextSessionFocus.js';
import { resolveEnglishExerciseName } from './feedbackLocalization.js';

const KNOWN_GOALS = new Set(['strength', 'hypertrophy', 'explosive', 'technique']);

const GOAL_LABELS = Object.freeze({
  de: Object.freeze({ strength: 'Kraft', hypertrophy: 'Muskelaufbau', explosive: 'Explosiv', technique: 'Technik' }),
  en: Object.freeze({ strength: 'Strength', hypertrophy: 'Muscle growth', explosive: 'Explosive', technique: 'Technique' })
});

// Eigene Wahl an der Übung oder Ziel des Workouts bekannt?
function hasKnownGoal(exercise, workoutGoal) {
  return KNOWN_GOALS.has(String(exercise?.trainingType || '')) || KNOWN_GOALS.has(String(workoutGoal || ''));
}

/**
 * @returns {{from: string, to: string}|null} null = kein Wechsel oder nicht sicher bekannt
 */
export function detectGoalChange({ exercise, previousExercise, currentGoal, previousGoal } = {}) {
  const engine = getProgressionEngine();
  if (!engine?.resolveExerciseGoal || !exercise || !previousExercise) return null;
  if (!hasKnownGoal(exercise, currentGoal) || !hasKnownGoal(previousExercise, previousGoal)) return null;
  const info = exerciseInfo(exercise);
  const to = engine.resolveExerciseGoal(info, currentGoal, exercise.trainingType);
  const from = engine.resolveExerciseGoal(info, previousGoal, previousExercise.trainingType);
  return KNOWN_GOALS.has(to) && KNOWN_GOALS.has(from) && to !== from ? { from, to } : null;
}

const MAX_NAMES = 3;
const TEXTS = {
  de: {
    line: (names, from, to) => `Trainingsfokus gewechselt: ${names}: von ${from} auf ${to}. Dann sind andere Gewichte und Wiederholungen normal – das ist kein Rückschritt.`,
    more: 'u. a.'
  },
  en: {
    line: (names, from, to) => `Training focus changed: ${names}: from ${from} to ${to}. Different weights and reps are expected then – this is not a step back.`,
    more: 'and others'
  }
};

/**
 * Feste Zeile der App (nicht von der KI): je Wechsel (von -> auf) eine Zeile mit den Übungen (englische Namen, höchstens drei).
 * @param {Array} exerciseAnalyses Ergebnis von analyzeWorkoutProgression() (Feld goalChange)
 * @param {'de'|'en'} language
 * @returns {string|null}
 */
export function buildGoalChangeLine(exerciseAnalyses, language = 'de') {
  const lang = language === 'en' ? 'en' : 'de';
  const groups = new Map();
  for (const analysis of Array.isArray(exerciseAnalyses) ? exerciseAnalyses : []) {
    const change = analysis?.goalChange;
    if (!change?.from || !change?.to) continue;
    const key = `${change.from}>${change.to}`;
    if (!groups.has(key)) groups.set(key, { change, names: [] });
    groups.get(key).names.push(analysis.exerciseNameForAI || resolveEnglishExerciseName(analysis.exercise) || analysis.exercise);
  }
  if (!groups.size) return null;
  const labels = GOAL_LABELS[lang];
  return [...groups.values()].map(({ change, names }) => {
    const shown = names.slice(0, MAX_NAMES).join(', ');
    const list = names.length > MAX_NAMES ? `${shown} ${TEXTS[lang].more}` : shown;
    return TEXTS[lang].line(list, labels[change.from], labels[change.to]);
  }).join('\n');
}

/** Hängt die Zeile an den Text (falls es einen Wechsel gab). */
export function applyGoalChangeLine(text, exerciseAnalyses, language = 'de') {
  const line = buildGoalChangeLine(exerciseAnalyses, language);
  if (!line) return text;
  return text ? `${text}\n\n${line}` : line;
}
