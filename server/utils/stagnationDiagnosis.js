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
//   3. Leichte Tage (unter LIGHT_SESSION_RATIO der bisherigen Bestleistung, z.B. Technik- oder
//      Speed-Tage unter demselben Übungsnamen) zählen weder als "Einheit ohne Bestleistung" noch
//      für die Häufigkeit - sie sollen gar keine Bestleistung bringen.
//   4. Letzte Bestleistung = letzte schwere Session, die alle vorherigen um mehr als MIN_GAIN_RATIO
//      übertrifft. Stillstand, wenn seitdem mindestens STALL_MIN_SESSIONS schwere Sessions und
//      STALL_MIN_DAYS Tage vergangen sind.
//   5. Ursache in fester Reihenfolge (genau eine):
//      insufficient_data > low_frequency > repeating > plateau > plateau_long
//      "Zu selten" misst am EIGENEN Rhythmus der Übung (z.B. schwere Kniebeugen bewusst nur alle
//      12 Tage), nicht an einer festen Norm: gemeldet wird nur, wenn die Abstände seit der letzten
//      Bestleistung deutlich länger sind als sonst.
//
// "Ist so geplant" (Nutzer bestätigt): applyAcknowledgements blendet den Hinweis ACK_DAYS Tage aus
// und fragt danach erneut nach, ob es noch so geplant ist.
// ---------------------------------------------------------------------------

import { exerciseInfo, getProgressionEngine } from './nextSessionFocus.js';

export const WINDOW_DAYS = 84;
export const STALL_MIN_DAYS = 21;
export const STALL_MIN_SESSIONS = 3;
// Nur Übungen, die zuletzt noch trainiert wurden - eine aufgegebene Übung "stagniert" nicht.
export const ACTIVE_WITHIN_DAYS = 21;
// "Zu selten" nur, wenn die Abstände seit der letzten Bestleistung im Schnitt länger sind als
// dieser Faktor × der übliche Abstand der Übung UND länger als eine Woche.
export const IRREGULAR_GAP_FACTOR = 1.5;
export const MIN_IRREGULAR_GAP_DAYS = 7;
// Leichter Tag: Leistung unter diesem Anteil der bisherigen Bestleistung.
export const LIGHT_SESSION_RATIO = 0.85;
// Mindestanteil vollständig eingetragener Sessions; darunter ist keine Aussage möglich.
export const MIN_COMPLETE_RATIO = 0.6;
export const MIN_LOGGED_FOR_DATA_HINT = 3;
// Kleinere Steigerungen gelten als Messrauschen, nicht als neue Bestleistung.
export const MIN_GAIN_RATIO = 0.005;
// Ab so vielen Wochen ohne Bestleistung reicht eine Entlastungswoche meist nicht mehr.
export const LONG_PLATEAU_WEEKS = 8;
export const DELOAD_RATIO = 0.9;
export const MAX_ITEMS = 3;
// "Ist so geplant": so lange ausblenden, danach erneut nachfragen.
export const ACK_DAYS = 42;
export const MAX_ACKS = 50;
export const DIAGNOSIS_CAUSES = Object.freeze(['insufficient_data', 'low_frequency', 'repeating', 'plateau', 'plateau_long']);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SMALL_STEP_EQUIPMENT = new Set(['kurzhanteln', 'kurzhantel', 'dumbbell', 'dumbbells', 'kettlebell']);

export function workoutDate(workout) {
  const raw = workout?.date || workout?.completedAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function exerciseKey(ex) {
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
      const entry = byKey.get(key) || { key, name: ex?.name || '', info, sessions: [] };
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

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sameSummary(a, b) {
  return a.weight === b.weight && a.reps.length === b.reps.length && a.reps.every((r, i) => r === b.reps[i]);
}

/**
 * Diagnose für EINE Übung. Gibt null zurück, wenn kein Stillstand und kein Datenproblem vorliegt.
 * @param {{ key, name, info, sessions }} entry - Sessions älteste zuerst
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
  const base = { key: entry.key, name: entry.name, goal };

  // 1. Datenlage: oft eingetragen, aber selten mit echten Sätzen.
  if (sameGoal.length >= MIN_LOGGED_FOR_DATA_HINT && complete.length / sameGoal.length < MIN_COMPLETE_RATIO) {
    return { ...base, cause: 'insufficient_data', logged: sameGoal.length, complete: complete.length };
  }

  // 2. Leichte Tage aussortieren - nur schwere Einheiten zählen für Bestleistung und Rhythmus.
  const heavy = [];
  let best = 0;
  for (const session of complete) {
    const perf = sessionPerformance(session);
    if (heavy.length && perf < best * LIGHT_SESSION_RATIO) continue;
    heavy.push({ ...session, perf });
    best = Math.max(best, perf);
  }
  if (heavy.length < STALL_MIN_SESSIONS + 1) return null;

  // 3. Letzte Bestleistung suchen.
  let runningBest = 0;
  let prIndex = 0;
  heavy.forEach((s, i) => {
    if (i === 0 || s.perf > runningBest * (1 + MIN_GAIN_RATIO)) prIndex = i;
    runningBest = Math.max(runningBest, s.perf);
  });
  const sessionsSince = heavy.length - 1 - prIndex;
  const prDate = heavy[prIndex].date;
  const daysSincePr = (now - prDate) / MS_PER_DAY;
  if (sessionsSince < STALL_MIN_SESSIONS || daysSincePr < STALL_MIN_DAYS) return null;

  const weeks = Math.max(1, Math.floor(daysSincePr / 7));
  const period = heavy.slice(prIndex);
  const lastSummary = mainSummary(heavy[heavy.length - 1], engine);
  const step = incrementFor(info);
  // sessions = schwere Einheiten NACH der letzten Bestleistung ("3 Einheiten in 5 Wochen").
  const stalled = { ...base, weeks, sessions: sessionsSince, weight: lastSummary.weight, sets: lastSummary.sets };

  // 4. Seltener als im eigenen Rhythmus? Üblicher Abstand = Median der Abstände VOR der
  //    Bestleistung (mind. 2), sonst aller Abstände.
  const gaps = heavy.slice(1).map((s, i) => (s.date - heavy[i].date) / MS_PER_DAY);
  const usualGap = median(prIndex >= 2 ? gaps.slice(0, prIndex) : gaps);
  const recentGap = (heavy[heavy.length - 1].date - prDate) / MS_PER_DAY / sessionsSince;
  if (usualGap != null && recentGap > Math.max(MIN_IRREGULAR_GAP_DAYS, usualGap * IRREGULAR_GAP_FACTOR)) {
    return { ...stalled, cause: 'low_frequency', usualDays: Math.round(usualGap), recentDays: Math.round(recentGap) };
  }

  // 5. Immer exakt dasselbe: kein Versuch zu steigern.
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

  // 6. Echter Stillstand: Entlastungswoche; sehr lang -> Schema wechseln.
  if (weeks >= LONG_PLATEAU_WEEKS) {
    return { ...stalled, cause: 'plateau_long', switchTo: goal === 'strength' ? 'hypertrophy' : 'strength' };
  }
  return { ...stalled, cause: 'plateau', deloadWeight: roundToStep(lastSummary.weight * DELOAD_RATIO, step) };
}

/**
 * Diagnose über alle Übungen - ALLE Einträge, sortiert (Stillstände zuerst, längster oben,
 * Datenhinweise zuletzt). Ausblenden und Kürzen auf MAX_ITEMS macht applyAcknowledgements.
 * @param {Array} workouts - abgeschlossene Workouts (mind. date/goal/exercises)
 * @param {{ now?: Date }} [options]
 * @returns {{ items: Array, analyzedExercises: number, windowDays: number, unavailable?: true }}
 */
export function buildStagnationDiagnosis(workouts, { now = new Date(), engine = getProgressionEngine() } = {}) {
  // Ohne Progressionslogik keine Aussage - lieber "nicht verfügbar" als ein falsches "kein Stillstand".
  if (!engine) return { unavailable: true, items: [], analyzedExercises: 0, windowDays: WINDOW_DAYS };
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

  results.sort((a, b) => {
    const aData = a.cause === 'insufficient_data';
    const bData = b.cause === 'insufficient_data';
    if (aData !== bData) return aData ? 1 : -1;
    return (b.weeks || 0) - (a.weeks || 0) || String(a.name).localeCompare(String(b.name));
  });

  return { items: results, analyzedExercises: byKey.size, windowDays: WINDOW_DAYS };
}

// --- "Ist so geplant" -----------------------------------------------------------------------

function ackMatches(ack, item) {
  return ack && ack.key === item.key && ack.cause === item.cause;
}

/**
 * Bestätigungen anwenden: aktiv (until in der Zukunft) -> ausblenden; abgelaufen -> wieder
 * zeigen mit recheck: true ("Ist das immer noch so geplant?"). Gilt nur für dieselbe Ursache -
 * kommt eine andere Ursache dazu, wird sie normal gezeigt.
 * @param {{ items: Array }} diagnosis - Ergebnis von buildStagnationDiagnosis
 * @param {Array<{ key, cause, until }>} acks
 * @returns {{ items, stalledCount, snoozedCount }}
 */
export function applyAcknowledgements(diagnosis, acks = [], now = new Date()) {
  const list = Array.isArray(acks) ? acks : [];
  const visible = [];
  let snoozedCount = 0;
  for (const item of diagnosis?.items || []) {
    const ack = list.find((a) => ackMatches(a, item));
    const until = ack?.until ? new Date(ack.until) : null;
    if (until && until > now) {
      snoozedCount++;
      continue;
    }
    visible.push(ack ? { ...item, recheck: true } : item);
  }
  return {
    items: visible.slice(0, MAX_ITEMS),
    stalledCount: visible.filter((i) => i.cause !== 'insufficient_data').length,
    snoozedCount
  };
}

// Form eines Übungs-Schlüssels (siehe exerciseKey). Bewusst nur grob (eigene Übungsnamen dürfen
// Sonderzeichen enthalten): keine Steuerzeichen, keine spitzen/geschweiften Klammern, kein "$".
// Die eigentliche Absicherung: die Route nimmt nur Schlüssel an, die gerade in der Diagnose des
// Nutzers stehen - beliebige Werte lassen sich so nicht speichern.
// eslint-disable-next-line no-control-regex -- Steuerzeichen werden hier bewusst AUSGESCHLOSSEN.
const KEY_PATTERN = /^(id|name):[^\u0000-\u001f\u007f<>{}$]{1,150}$/u;

/**
 * Eingabe für "Ist so geplant" prüfen. Nimmt nur key + cause an, keinen freien Text.
 * @returns {null | { key: string, cause: string }}
 */
export function validateAckInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { key, cause } = body;
  if (typeof key !== 'string' || typeof cause !== 'string') return null;
  if (!KEY_PATTERN.test(key) || !DIAGNOSIS_CAUSES.includes(cause)) return null;
  return { key, cause };
}

/**
 * Neue Bestätigungsliste: bestehende für denselben key ersetzen, abgelaufene älter als ACK_DAYS
 * entfernen, höchstens MAX_ACKS (neueste behalten).
 */
export function upsertAck(acks = [], { key, cause }, now = new Date()) {
  const until = new Date(now.getTime() + ACK_DAYS * MS_PER_DAY);
  const staleBefore = now.getTime() - ACK_DAYS * MS_PER_DAY;
  const kept = (Array.isArray(acks) ? acks : [])
    .filter((a) => a && a.key !== key && new Date(a.until).getTime() > staleBefore)
    .map((a) => ({ key: a.key, cause: a.cause, until: new Date(a.until) }));
  kept.push({ key, cause, until });
  return kept.slice(-MAX_ACKS);
}

export function removeAck(acks = [], key) {
  return (Array.isArray(acks) ? acks : [])
    .filter((a) => a && a.key !== key)
    .map((a) => ({ key: a.key, cause: a.cause, until: new Date(a.until) }));
}
