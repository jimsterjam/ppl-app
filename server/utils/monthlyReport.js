// ---------------------------------------------------------------------------
// Monatsbericht (Pro): Zahlen, Kurven und Stillstand der letzten 28 Tage.
//
// Rein deterministisch - keine KI, keine erfundenen Zahlen (Absprache Paul 10.10.). Alles, was der
// Bericht zeigt, rechnet diese Datei aus den abgeschlossenen Workouts. Der Fazit-Satz ist nur ein
// Schlüssel ('more' | 'same' | 'fewer' | 'first'); den Text dazu setzt der Client (DE/EN).
//
// Wann ein Bericht entsteht (evaluateReportDue):
//   - höchstens alle REPORT_PERIOD_DAYS Tage (28)
//   - der erste Bericht frühestens REPORT_PERIOD_DAYS Tage nach dem ersten abgeschlossenen Workout
//   - und nur mit mindestens REPORT_MIN_SESSIONS (12) Einheiten im Zeitraum - mit weniger lässt sich
//     kein Fortschritt belegen (Absprache Paul 10.10.)
//
// Zeitraum: [now - 28 Tage, now]. Vergleichszeitraum: die 28 Tage davor.
// Bestleistung: bestes geschätztes 1RM (Epley, wie die Stillstand-Diagnose) einer Übung im Zeitraum,
// das ihre bisherigen Einheiten (bis REPORT_HISTORY_DAYS zurück) um mehr als MIN_GAIN_RATIO übertrifft.
// Kurve: schwerster Arbeitssatz je Einheit (tatsächlich bewegtes Gewicht). Übungen ganz ohne Gewicht
// (Körpergewicht) zeigen die Wiederholungen (metric: 'reps').
// ---------------------------------------------------------------------------

import { getProgressionEngine } from './nextSessionFocus.js';
import {
  buildStagnationDiagnosis,
  estimateOneRepMax,
  exerciseKey,
  workoutDate,
  MAX_ITEMS,
  MIN_GAIN_RATIO,
  WINDOW_DAYS
} from './stagnationDiagnosis.js';

export const REPORT_VERSION = 1;
export const REPORT_PERIOD_DAYS = 28;
export const REPORT_MIN_SESSIONS = 12;
// Benötigte Workout-Historie: Zeitraum + Vergleichszeitraum + Rest für Bestleistungen/Diagnose.
export const REPORT_HISTORY_DAYS = WINDOW_DAYS;
export const MAX_CURVE_EXERCISES = 8;
export const MIN_CURVE_POINTS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round((Number(value) || 0) * f) / f;
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Arbeitssätze eines Workouts je Übung (ohne Aufwärmsätze und nicht abgehakte Sätze). */
function workingSetsByExercise(workout, engine) {
  const result = [];
  for (const ex of Array.isArray(workout?.exercises) ? workout.exercises : []) {
    const key = exerciseKey(ex);
    if (!key) continue;
    const sets = engine.getWorkingSets(ex);
    if (sets.length) result.push({ key, name: ex?.name || '', sets, ex });
  }
  return result;
}

/** Zählt als Einheit: abgeschlossenes Workout mit mindestens einem Arbeitssatz. */
function countableSessions(workouts, engine, from, to) {
  const sessions = [];
  for (const workout of Array.isArray(workouts) ? workouts : []) {
    const date = workoutDate(workout);
    if (!date || date < from || date > to) continue;
    const exercises = workingSetsByExercise(workout, engine);
    if (!exercises.length) continue;
    sessions.push({ workout, date, exercises });
  }
  return sessions.sort((a, b) => a.date - b.date);
}

function totalsOf(sessions) {
  let sets = 0;
  let volume = 0;
  for (const session of sessions) {
    for (const entry of session.exercises) {
      for (const set of entry.sets) {
        sets += 1;
        volume += set.weight * set.reps;
      }
    }
  }
  return { sessions: sessions.length, sets, volumeKg: Math.round(volume) };
}

/** Einheiten der letzten REPORT_PERIOD_DAYS Tage (für die Prüfung "genug Daten?"). */
export function countSessionsInPeriod(workouts, now, engine = getProgressionEngine()) {
  if (!engine) return 0;
  const from = new Date(now.getTime() - REPORT_PERIOD_DAYS * MS_PER_DAY);
  return countableSessions(workouts, engine, from, now).length;
}

/**
 * Ist ein neuer Bericht fällig? Reihenfolge der Gründe entspricht der Kostenreihenfolge der Abfragen:
 * Wer nur lastPeriodEnd/firstWorkoutDate kennt, lässt sessionsInPeriod weg (undefined = nicht geprüft).
 * @returns {{ due: boolean, reason: 'ok' | 'too_soon' | 'first_workout_too_recent' | 'too_few_sessions' }}
 */
export function evaluateReportDue({ now, lastPeriodEnd = null, firstWorkoutDate = null, sessionsInPeriod } = {}) {
  const last = toDate(lastPeriodEnd);
  if (last) {
    if (now.getTime() - last.getTime() < REPORT_PERIOD_DAYS * MS_PER_DAY) return { due: false, reason: 'too_soon' };
  } else {
    const first = toDate(firstWorkoutDate);
    if (!first || now.getTime() - first.getTime() < REPORT_PERIOD_DAYS * MS_PER_DAY) {
      return { due: false, reason: 'first_workout_too_recent' };
    }
  }
  if (sessionsInPeriod !== undefined && sessionsInPeriod < REPORT_MIN_SESSIONS) {
    return { due: false, reason: 'too_few_sessions' };
  }
  return { due: true, reason: 'ok' };
}

function bestOneRepMax(sets) {
  return Math.max(0, ...sets.map((s) => estimateOneRepMax(s.weight, s.reps)));
}

function countPersonalBests(periodSessions, olderSessions) {
  const baseline = new Map();
  for (const session of olderSessions) {
    for (const entry of session.exercises) {
      baseline.set(entry.key, Math.max(baseline.get(entry.key) || 0, bestOneRepMax(entry.sets)));
    }
  }
  const periodBest = new Map();
  for (const session of periodSessions) {
    for (const entry of session.exercises) {
      periodBest.set(entry.key, Math.max(periodBest.get(entry.key) || 0, bestOneRepMax(entry.sets)));
    }
  }
  let count = 0;
  for (const [key, best] of periodBest) {
    const before = baseline.get(key) || 0;
    // Ohne frühere Einheit gibt es nichts zu übertreffen - dann keine "Bestleistung".
    if (before > 0 && best > before * (1 + MIN_GAIN_RATIO)) count += 1;
  }
  return count;
}

function buildCurves(periodSessions) {
  const byKey = new Map();
  for (const session of periodSessions) {
    for (const entry of session.exercises) {
      const topWeight = entry.sets.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best), entry.sets[0]);
      const maxReps = Math.max(...entry.sets.map((s) => s.reps));
      const item = byKey.get(entry.key) || { key: entry.key, name: entry.name, points: [] };
      item.name = entry.name || item.name;
      item.points.push({ date: session.date.toISOString(), weight: topWeight.weight, reps: topWeight.reps, maxReps });
      byKey.set(entry.key, item);
    }
  }
  const curves = [];
  for (const item of byKey.values()) {
    const weighted = item.points.filter((p) => p.weight > 0);
    const metric = weighted.length ? 'weight' : 'reps';
    const points = (metric === 'weight' ? weighted : item.points).map((p) => ({
      date: p.date,
      value: metric === 'weight' ? round(p.weight) : p.maxReps,
      reps: metric === 'weight' ? p.reps : p.maxReps
    }));
    if (points.length < MIN_CURVE_POINTS) continue;
    curves.push({ key: item.key, name: item.name, metric, points });
  }
  curves.sort((a, b) => b.points.length - a.points.length || String(a.name).localeCompare(String(b.name)));
  return curves.slice(0, MAX_CURVE_EXERCISES);
}

function buildWeeks(periodSessions, periodStart) {
  const weeks = [];
  for (let i = 0; i < REPORT_PERIOD_DAYS / 7; i += 1) {
    const start = new Date(periodStart.getTime() + i * 7 * MS_PER_DAY);
    const end = new Date(start.getTime() + 7 * MS_PER_DAY);
    const last = i === REPORT_PERIOD_DAYS / 7 - 1;
    const inWeek = periodSessions.filter((s) => s.date >= start && (last ? s.date <= end : s.date < end));
    weeks.push({ start: start.toISOString(), sessions: inWeek.length, sets: totalsOf(inWeek).sets });
  }
  return weeks;
}

function conclusionFor(current, previous) {
  if (!previous || previous.sessions === 0) return 'first';
  if (current.sessions > previous.sessions) return 'more';
  if (current.sessions < previous.sessions) return 'fewer';
  return 'same';
}

/**
 * Bericht für [now - 28 Tage, now] berechnen.
 * @param {Array} workouts - abgeschlossene Workouts der letzten REPORT_HISTORY_DAYS Tage
 * @param {{ now?: Date, engine?: object }} [options]
 * @returns {{ unavailable: true } | { periodStart: Date, periodEnd: Date, facts: object }}
 */
export function buildMonthlyReport(workouts, { now = new Date(), engine = getProgressionEngine() } = {}) {
  // Ohne Progressionslogik keine Aussage - lieber "nicht verfügbar" als falsche Zahlen.
  if (!engine) return { unavailable: true };

  const periodEnd = now;
  const periodStart = new Date(now.getTime() - REPORT_PERIOD_DAYS * MS_PER_DAY);
  const previousStart = new Date(periodStart.getTime() - REPORT_PERIOD_DAYS * MS_PER_DAY);
  const historyStart = new Date(now.getTime() - REPORT_HISTORY_DAYS * MS_PER_DAY);

  const periodSessions = countableSessions(workouts, engine, periodStart, periodEnd);
  const previousSessions = countableSessions(workouts, engine, previousStart, new Date(periodStart.getTime() - 1));
  const olderSessions = countableSessions(workouts, engine, historyStart, new Date(periodStart.getTime() - 1));

  const current = totalsOf(periodSessions);
  const previousTotals = totalsOf(previousSessions);
  const previous = previousTotals.sessions > 0 ? previousTotals : null;

  const diagnosis = buildStagnationDiagnosis(workouts, { now, engine });
  const stalled = (diagnosis.items || []).filter((item) => item.cause !== 'insufficient_data').slice(0, MAX_ITEMS);

  return {
    periodStart,
    periodEnd,
    facts: {
      version: REPORT_VERSION,
      days: REPORT_PERIOD_DAYS,
      totals: { ...current, personalBests: countPersonalBests(periodSessions, olderSessions) },
      previous,
      conclusion: conclusionFor(current, previous),
      weeks: buildWeeks(periodSessions, periodStart),
      exercises: buildCurves(periodSessions),
      stagnation: { items: stalled, analyzedExercises: diagnosis.analyzedExercises || 0 }
    }
  };
}
