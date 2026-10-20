/**
 * Baukasten für Eval-Szenarien: erzeugt die strukturierten Trainingsdaten NICHT von Hand, sondern aus
 * einfachen Rohdaten (Sätze als [Wdh, kg]) über dieselbe Pipeline wie die echte Route
 * (analyzeWorkoutProgression -> structureAnalysisForAI). So veralten die Szenarien nicht, wenn sich die
 * Datenstruktur ändert (das war bei feedbackQualityCases.js passiert - siehe Test feedbackEvalCases.test.js).
 *
 * Alle Daten sind erfunden. Es werden keine Nutzerdaten gelesen oder gespeichert.
 */
import {
  analyzeWorkoutProgression,
  collectNotDoneExercises,
  resolveBodyweightCorrelation,
  structureAnalysisForAI
} from '../../services/trainingAnalysisService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_DATE_MS = Date.UTC(2026, 9, 19, 10, 0, 0); // fester Bezugstag -> reproduzierbar

/**
 * @param {string} name
 * @param {Array<Array<number>>} sets - [Wdh, kg] oder [Wdh, kg, Sekunden]
 * @param {Object} [opts]
 * @param {Array<Array<number>>} [opts.warmup] - Aufwärmsätze [Wdh, kg]
 * @param {string} [opts.note] - Notiz zur Übung in dieser Session
 * @param {'strength'|'hypertrophy'|'explosive'|'technique'} [opts.trainingType]
 * @param {'time'|'repsTime'} [opts.measureMode]
 * @param {boolean} [opts.notDone] - kein Arbeitssatz abgehakt
 */
export function ex(name, sets, opts = {}) {
  const warm = (opts.warmup || []).map(([reps, weight]) => ({ reps, weight, isWarmup: true, done: true }));
  const work = sets.map(([reps, weight, durationSeconds]) => ({
    reps,
    weight,
    isWarmup: false,
    done: !opts.notDone,
    ...(durationSeconds ? { durationSeconds } : {})
  }));
  return {
    name,
    setDetails: [...warm, ...work],
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.trainingType ? { trainingType: opts.trainingType } : {}),
    ...(opts.measureMode ? { measureMode: opts.measureMode } : {})
  };
}

function workout(id, daysAgo, exercises, bodyweightKg = null) {
  return {
    _id: id,
    date: new Date(BASE_DATE_MS - daysAgo * DAY_MS).toISOString(),
    completed: true,
    isDraft: false,
    exercises,
    ...(bodyweightKg != null ? { athleteBodyweightKg: bodyweightKg } : {})
  };
}

/**
 * @param {string} name - Szenarioname (Risiko-Zone / Regel im Titel nennen)
 * @param {Object} spec
 * @param {Array} spec.current - Übungen der aktuellen Session (ex(...))
 * @param {Array} [spec.previous] - Übungen der Vorsession; leer/fehlend = erste Session
 * @param {number} [spec.daysAgo=7] - Abstand zur Vorsession in Tagen
 * @param {number} [spec.bodyweight] - Körpergewicht aktuell (kg)
 * @param {number} [spec.previousBodyweight] - Körpergewicht Vorsession (kg)
 * @param {Object<string, Object>} [spec.profiles] - Übungsname (klein) -> metricProfile
 */
export function scenario(name, spec) {
  const current = workout('cur', 0, spec.current, spec.bodyweight ?? null);
  const all = spec.previous
    ? [workout('prev', spec.daysAgo ?? 7, spec.previous, spec.previousBodyweight ?? null)]
    : [];
  const profileByExerciseName = new Map(Object.entries(spec.profiles || {}));
  const analyses = analyzeWorkoutProgression(current, all, { profileByExerciseName });
  const notDoneExercises = collectNotDoneExercises(current);
  const structuredAnalysis = structureAnalysisForAI(analyses, {
    athleteBodyweightKg: current.athleteBodyweightKg ?? null,
    bodyweightCorrelation: resolveBodyweightCorrelation(current, all, analyses),
    notDoneExercises
  });
  return { name, structuredAnalysis };
}
