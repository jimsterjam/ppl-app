// ---------------------------------------------------------------------------
// Stillstand-Diagnose (Pro): WARUM kommt eine Übung nicht voran, und was ist der nächste Schritt?
//
// Rein deterministisch - keine KI, keine erfundenen Zahlen. Grundlage sind die abgeschlossenen
// Workouts der letzten WINDOW_DAYS Tage. Dieselbe Progressionslogik wie Workout-Hinweis und
// "Nächstes Mal"-Zeile (client/src/utils/weightSuggestion.js über getProgressionEngine).
//
// Ablauf je Übung:
//   1. Nur Sessions derselben Trainingsart wie die letzte (Kraft-Sessions verfälschen sonst
//      Muskelaufbau-Verläufe). Körpergewicht-, Core- und explosive Übungen fallen raus.
//   2. Leistung pro Session = bestes geschätztes 1RM der Arbeitssätze (Epley: kg × (1 + Wdh/30)).
//   3. Letzte Bestleistung = letzte Session, die alle vorherigen um mehr als MIN_GAIN_RATIO
//      übertrifft. Stillstand, wenn seitdem mindestens STALL_MIN_SESSIONS Sessions und
//      STALL_MIN_DAYS Tage vergangen sind.
//   4. Ursache in fester Reihenfolge (genau eine):
//      insufficient_data > low_frequency > repeating > plateau > plateau_long
// ---------------------------------------------------------------------------

import { exerciseInfo, getProgressionEngine } from './nextSessionFocus.js';

export const WINDOW_DAYS = 84;
export const STALL_MIN_DAYS = 21;
export const STALL_MIN_SESSIONS = 3;
// Nur Übungen, die zuletzt noch trainiert wurden - eine aufgegebene Übung "stagniert" nicht.
export const ACTIVE_WITHIN_DAYS = 21;
// Unter dieser Häufigkeit (Sessions pro Woche im Stillstands-Zeitraum) ist zu seltenes Training
// die wahrscheinlichste Ursache.
export const LOW_FREQUENCY_PER_WEEK = 0.75;
// Mindestanteil vollständig eingetragener Sessions; darunter ist keine Aussage möglich.
export const MIN_COMPLETE_RATIO = 0.6;
export const MIN_LOGGED_FOR_DATA_HINT = 3;
// Kleinere Steigerungen gelten als Messrauschen, nicht als neue Bestleistung.
export const MIN_GAIN_RATIO = 0.005;
// Ab so vielen Wochen ohne Bestleistung reicht eine Entlastungswoche meist nicht mehr.
export const LONG_PLATEAU_WEEKS = 8;
export const DELOAD_RATIO = 0.9;
export const MAX_ITEMS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SMALL_STEP_EQUIPMENT = new Set(['kurzhanteln', 'kurzhantel', 'dumbbell', 'dumbbells', 'kettlebell']);

function workoutDate(workout) {
  const raw = workout?.date || workout?.completedAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function exerciseKey(ex) {
  const id = String(ex?.exerciseId || '').trim();
  if (id) return `id:${id}`;
  const name = String(ex?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
}

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round((Number(value) || 0) * f) / f;
}

function incrementFor(info = {}) {
  const values = [info.equipment, info.equipment_en].map((v) => String(v || '').trim().toLowerCase());
  return values.some((v) => SMALL_STEP_EQUIPMENT.has(v)) ? 2 : 2.5;
}

/** Auf den Steigerungsschritt der Übung abrunden (2 bzw. 2,5 kg). */
export function roundToStep(weight, step) {
  if (!(weight > 0) || !(step > 0)) return 0;
  return round(Math.floor(weight / step + 1e-9) * step);
}

/** Geschätztes 1RM nach Epley. */
export function estimateOneRepMax(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

/**
 * Sessions einer Übung (älteste zuerst) aus den Workouts sammeln.
 * @returns {Map<string, { name, info, sessions: Array<{ date, goal, sets, complete }> }>}
 */
function collectExerciseSessions(workouts, engine) {
  const byKey = new Map();
  const sorted = (Array.isArray(workouts) ? workouts : [])
    .map((w) => ({ w, date: workoutDate(w) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date);

  for (const { w, date } of sorted) {
    const seen = new Set();
    for (const ex of Array.isArray(w?.exercises) ? w.exercises : []) {
      const key = exerciseKey(ex);
      // Dieselbe Übung zweimal im selben Workout zählt als eine Session.
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const info = exerciseInfo(ex);
      const goal = engine.resolveExerciseGoal(info, w?.goal, ex?.trainingType);
      const sets = engine.getWorkingSets(ex).filter((s) => s.weight > 0);
      const entry = byKey.get(key) || { name: ex?.name || '', info, sessions: [] };
      entry.name = ex?.name || entry.name;
      entry.info = info;
      entry.sessions.push({ date, goal, sets, complete: sets.length > 0 });
      byKey.set(key, entry);
    }
  }
  return byKey;
}

function sessionPerformance(session) {
  return Math.max(0, ...session.sets.map((s) => estimateOneRepMax(s.weight, s.reps)));
}

function mainSummary(session, engine) {
  const split = engine.splitMainAndBackoffSets(session.sets);
  const main = split?.main?.length ? split.main : session.sets;
  const weight = split ? split.weight : Math.max(...session.sets.map((s) => s.weight));
  const reps = main.map((s) => s.reps);
  return { weight, sets: main.length, reps, minReps: Math.min(...reps), maxReps: Math.max(...reps) };
}

function sameSummary(a, b) {
  return a.weight === b.weight && a.reps.length === b.reps.length && a.reps.every((r, i) => r === b.reps[i]);
}

/**
 * Diagnose für EINE Übung. Gibt null zurück, wenn kein Stillstand und kein Datenproblem vorliegt.
 * @param {{ name, info, sessions }} entry - Sessions älteste zuerst
 * @param {Date} now
 */
export function diagnoseExercise(entry, now, engine = getProgressionEngine()) {
  if (!engine || !entry?.sessions?.length) return null;
  const { info } = entry;
  if (engine.isNoLoadExercise(info)) return null;

  const last = entry.sessions[entry.sessions.length - 1];
  const goal = last.goal;
  if (!engine.progressionModeFor(info, goal)) return null; // explosiv oder Core: kein Wdh.-Ziel

  const daysSinceLast = (now - last.date) / MS_PER_DAY;
  if (daysSinceLast > ACTIVE_WITHIN_DAYS) return null;

  const sameGoal = entry.sessions.filter((s) => s.goal === goal);
  const complete = sameGoal.filter((s) => s.complete);
  const base = { name: entry.name, goal };

  // 1. Datenlage: oft eingetragen, aber selten mit echten Sätzen.
  if (sameGoal.length >= MIN_LOGGED_FOR_DATA_HINT && complete.length / sameGoal.length < MIN_COMPLETE_RATIO) {
    return { ...base, cause: 'insufficient_data', logged: sameGoal.length, complete: complete.length };
  }
  if (complete.length < STALL_MIN_SESSIONS + 1) return null;

  // 2. Letzte Bestleistung suchen.
  let best = 0;
  let prIndex = 0;
  complete.forEach((s, i) => {
    const perf = sessionPerformance(s);
    if (i === 0 || perf > best * (1 + MIN_GAIN_RATIO)) prIndex = i;
    best = Math.max(best, perf);
  });
  const sessionsSince = complete.length - 1 - prIndex;
  const prDate = complete[prIndex].date;
  const daysSincePr = (now - prDate) / MS_PER_DAY;
  if (sessionsSince < STALL_MIN_SESSIONS || daysSincePr < STALL_MIN_DAYS) return null;

  const weeks = Math.max(1, Math.floor(daysSincePr / 7));
  const period = complete.slice(prIndex);
  const lastSummary = mainSummary(complete[complete.length - 1], engine);
  const step = incrementFor(info);
  // sessions = Einheiten NACH der letzten Bestleistung ("3 Einheiten in 5 Wochen").
  const stalled = { ...base, weeks, sessions: sessionsSince, weight: lastSummary.weight, sets: lastSummary.sets };

  // 3. Zu selten trainiert.
  const perWeek = sessionsSince / (daysSincePr / 7);
  if (perWeek < LOW_FREQUENCY_PER_WEEK) {
    return { ...stalled, cause: 'low_frequency' };
  }

  // 4. Immer exakt dasselbe: kein Versuch zu steigern.
  const summaries = period.map((s) => mainSummary(s, engine));
  if (summaries.every((s) => sameSummary(s, summaries[0]))) {
    const target = engine.getRepTarget(info, goal, { sessions: [] });
    const canAddReps = target?.mode === 'range' && lastSummary.maxReps < target.max;
    return {
      ...stalled,
      cause: 'repeating',
      reps: lastSummary.minReps,
      nextReps: canAddReps ? lastSummary.minReps + 1 : null,
      nextWeight: canAddReps ? null : round(lastSummary.weight + step)
    };
  }

  // 5. Echter Stillstand: Entlastungswoche; sehr lang -> Schema wechseln.
  if (weeks >= LONG_PLATEAU_WEEKS) {
    return { ...stalled, cause: 'plateau_long', switchTo: goal === 'strength' ? 'hypertrophy' : 'strength' };
  }
  return { ...stalled, cause: 'plateau', deloadWeight: roundToStep(lastSummary.weight * DELOAD_RATIO, step) };
}

/**
 * Diagnose über alle Übungen.
 * @param {Array} workouts - abgeschlossene Workouts (mind. date/goal/exercises)
 * @param {{ now?: Date }} [options]
 * @returns {{ items: Array, analyzedExercises: number, stalledCount: number, windowDays: number }}
 */
export function buildStagnationDiagnosis(workouts, { now = new Date(), engine = getProgressionEngine() } = {}) {
  // Ohne Progressionslogik keine Aussage - lieber "nicht verfügbar" als ein falsches "kein Stillstand".
  if (!engine) return { unavailable: true, items: [], analyzedExercises: 0, stalledCount: 0, windowDays: WINDOW_DAYS };
  const since = now.getTime() - WINDOW_DAYS * MS_PER_DAY;
  const inWindow = (Array.isArray(workouts) ? workouts : []).filter((w) => {
    const date = workoutDate(w);
    return date && date.getTime() >= since && date <= now;
  });

  const byKey = collectExerciseSessions(inWindow, engine);
  const results = [];
  for (const entry of byKey.values()) {
    const item = diagnoseExercise(entry, now, engine);
    if (item) results.push(item);
  }

  // Stillstände zuerst (längster oben), Datenhinweise danach.
  results.sort((a, b) => {
    const aData = a.cause === 'insufficient_data';
    const bData = b.cause === 'insufficient_data';
    if (aData !== bData) return aData ? 1 : -1;
    return (b.weeks || 0) - (a.weeks || 0) || String(a.name).localeCompare(String(b.name));
  });

  return {
    items: results.slice(0, MAX_ITEMS),
    analyzedExercises: byKey.size,
    stalledCount: results.filter((r) => r.cause !== 'insufficient_data').length,
    windowDays: WINDOW_DAYS
  };
}
