// ---------------------------------------------------------------------------
// Monatsbericht V1: Befunde (Spezifikation "Intelligenter Monatsbericht", Absprache Jimmy 06.11.2026).
//
// Rein deterministisch: der Server rechnet alle Befunde aus den abgeschlossenen Workouts, der Client
// zeigt feste Texte (DE+EN) dazu. Keine Bewertung ohne festgelegte Schwelle - es gibt bewusst KEINE
// Aussagen wie "zu viel/zu wenig Training", keine Übertrainings-Warnung und keine Reihenfolge-Regel.
//
// Vergleichbare Einheit (für Fortschritt/Stagnation): gleiche Übung, gleiches Ziel (Kraft/Muskelaufbau),
// Messart Gewicht, nur erledigte Arbeitssätze (Aufwärmsätze zählen nie). Verglichen wird der beste
// Arbeitssatz je Einheit (schwerstes Gewicht, bei Gleichstand die meisten Wiederholungen).
// ---------------------------------------------------------------------------

import { exerciseKey } from './stagnationDiagnosis.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Schwellen (freigegeben von Jimmy 06.11.2026)
export const PROGRESS_MIN_SESSIONS = 3;
export const PROGRESS_MIN_DAYS = 14;
export const STAGNATION_MIN_SESSIONS = 4;
export const STAGNATION_MIN_DAYS = 21;
export const RELEVANT_WEIGHT_GAIN = 0.025;
export const CONFIDENCE_MEDIUM_SESSIONS = 4;
export const CONFIDENCE_HIGH_SESSIONS = 6;
export const PERMANENT_SWAP_SESSIONS = 3;
export const HOPPING_SWAPS = 3;
export const REP_HINT_MIN_SESSIONS = 3;
export const MAX_PROGRESS_ITEMS = 8;
export const MAX_REP_ITEMS = 6;
export const MAX_SWAP_ITEMS = 5;
export const MAX_MUSCLE_ITEMS = 8;

// Wiederholungsbereiche je Ziel (wie client utils/weightSuggestion.js PROGRESSION_RANGES). 7 = Übergang, neutral.
export const REP_RANGES = Object.freeze({
  strength: Object.freeze({ min: 1, max: 6 }),
  hypertrophy: Object.freeze({ min: 8, max: 12 })
});
export const TRANSITION_REPS = 7;

const round = (value, digits = 1) => {
  const f = 10 ** digits;
  return Math.round((Number(value) || 0) * f) / f;
};

/** Ziel dieser Übung in dieser Einheit: 'strength' | 'hypertrophy' | null (explosiv/Technik/unbekannt). */
export function goalOf(workout, ex) {
  const raw = String(ex?.trainingType || workout?.goal || '').toLowerCase();
  return raw === 'strength' || raw === 'hypertrophy' ? raw : null;
}

const isWeightMode = (ex) => !ex?.measureMode || ex.measureMode === 'weight';

export function confidenceFor(sessions) {
  if (sessions >= CONFIDENCE_HIGH_SESSIONS) return 'high';
  if (sessions >= CONFIDENCE_MEDIUM_SESSIONS) return 'medium';
  return 'low';
}

function bestSet(sets) {
  return sets.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best), sets[0]);
}

/** 'improved' | 'worsened' | 'unchanged' für zwei beste Sätze (erster vs. letzter Vergleichswert). */
export function compareBestSets(first, last) {
  const gain = (a, b) => (a.weight > 0 ? b.weight >= a.weight * (1 + RELEVANT_WEIGHT_GAIN) : b.weight > 0);
  if ((gain(first, last) && last.reps >= first.reps) || (last.weight === first.weight && last.reps >= first.reps + 1)) return 'improved';
  if ((gain(last, first) && first.reps >= last.reps) || (last.weight === first.weight && last.reps <= first.reps - 1)) return 'worsened';
  return 'unchanged';
}

function groupComparable(periodSessions) {
  const groups = new Map();
  for (const session of periodSessions) {
    const seen = new Set();
    for (const entry of session.exercises) {
      const goal = goalOf(session.workout, entry.ex);
      if (!goal || !isWeightMode(entry.ex) || seen.has(entry.key)) continue;
      seen.add(entry.key);
      const id = `${entry.key}|${goal}`;
      const group = groups.get(id) || { key: entry.key, name: entry.name, goal, sessions: [] };
      group.name = entry.name || group.name;
      group.sessions.push({ date: session.date, best: bestSet(entry.sets), sets: entry.sets });
      groups.set(id, group);
    }
  }
  return [...groups.values()];
}

/** Fortschritt/Stillstand je Übung. Einheiten sind nach Datum aufsteigend (periodSessions ist sortiert). */
export function buildProgressFindings(periodSessions) {
  const items = [];
  let insufficientCount = 0;
  for (const group of groupComparable(periodSessions)) {
    const n = group.sessions.length;
    const first = group.sessions[0];
    const last = group.sessions[n - 1];
    const days = (last.date - first.date) / MS_PER_DAY;
    if (n < PROGRESS_MIN_SESSIONS || days < PROGRESS_MIN_DAYS) {
      insufficientCount += 1;
      continue;
    }
    const result = compareBestSets(first.best, last.best);
    if (result === 'unchanged' && (n < STAGNATION_MIN_SESSIONS || days < STAGNATION_MIN_DAYS)) {
      insufficientCount += 1;
      continue;
    }
    items.push({
      type: result,
      key: group.key,
      exercise: group.name,
      goal: group.goal,
      sessions: n,
      weeks: Math.max(1, Math.round(days / 7)),
      from: { weight: round(first.best.weight, 2), reps: first.best.reps },
      to: { weight: round(last.best.weight, 2), reps: last.best.reps },
      confidence: confidenceFor(n)
    });
  }
  items.sort((a, b) => b.sessions - a.sessions || String(a.exercise).localeCompare(String(b.exercise)));
  return { items: items.slice(0, MAX_PROGRESS_ITEMS), insufficientCount };
}

/** Anteil der Arbeitssätze im Zielbereich je Übung; Hinweis nur bei >= 3 Einheiten und > 50 % klar außerhalb. */
export function buildRepRangeFindings(periodSessions) {
  const groups = new Map();
  for (const session of periodSessions) {
    const seen = new Set();
    for (const entry of session.exercises) {
      const goal = goalOf(session.workout, entry.ex);
      if (!goal || !isWeightMode(entry.ex) || seen.has(entry.key)) continue;
      seen.add(entry.key);
      const id = `${entry.key}|${goal}`;
      const group = groups.get(id) || { key: entry.key, name: entry.name, goal, sessions: 0, total: 0, inRange: 0, outside: 0 };
      const range = REP_RANGES[goal];
      group.sessions += 1;
      for (const set of entry.sets) {
        group.total += 1;
        if (set.reps >= range.min && set.reps <= range.max) group.inRange += 1;
        else if (set.reps !== TRANSITION_REPS) group.outside += 1;
      }
      groups.set(id, group);
    }
  }
  const items = [];
  for (const group of groups.values()) {
    if (group.sessions < REP_HINT_MIN_SESSIONS || !group.total) continue;
    const range = REP_RANGES[group.goal];
    items.push({
      key: group.key,
      exercise: group.name,
      goal: group.goal,
      sessions: group.sessions,
      percentInRange: Math.round((group.inRange / group.total) * 100),
      min: range.min,
      max: range.max,
      hint: group.outside / group.total > 0.5
    });
  }
  // Übungen mit Hinweis zuerst, dann nach Einheiten.
  items.sort((a, b) => Number(b.hint) - Number(a.hint) || b.sessions - a.sessions || String(a.exercise).localeCompare(String(b.exercise)));
  return { items: items.slice(0, MAX_REP_ITEMS) };
}

/**
 * Übungswechsel aus workout.exercises[].replacedFrom/replacedScope.
 * Dauerhaft: im Plan gespeichert ('plan') oder dieselbe neue Übung statt derselben alten in >= 3 Einheiten.
 * Exercise-Hopping: >= 3 "nur heute"-Wechsel an derselben Planposition (Plan-Tag + ursprüngliche Übung),
 * die nicht dauerhaft sind.
 */
export function buildSwapFindings(periodSessions) {
  const groups = new Map();
  for (const session of periodSessions) {
    const seen = new Set();
    for (const entry of session.exercises) {
      const from = String(entry.ex?.replacedFrom || '').trim();
      if (!from) continue;
      const oldKey = exerciseKey({ name: from });
      if (!oldKey || oldKey === entry.key || seen.has(`${oldKey}|${entry.key}`)) continue;
      seen.add(`${oldKey}|${entry.key}`);
      const position = `${session.workout?.planDayId || ''}|${oldKey}`;
      const group = groups.get(position) || { oldName: from, planDayId: session.workout?.planDayId || '', byNew: new Map(), plan: false, today: 0 };
      const next = group.byNew.get(entry.key) || { name: entry.name, count: 0 };
      next.count += 1;
      group.byNew.set(entry.key, next);
      if (entry.ex?.replacedScope === 'plan') group.plan = true;
      else group.today += 1;
      groups.set(position, group);
    }
  }
  const permanent = [];
  const hopping = [];
  for (const group of groups.values()) {
    const top = [...group.byNew.values()].sort((a, b) => b.count - a.count)[0];
    if (group.plan || top.count >= PERMANENT_SWAP_SESSIONS) {
      permanent.push({ type: 'permanent', from: group.oldName, to: top.name });
    } else if (group.planDayId && group.today >= HOPPING_SWAPS) {
      hopping.push({ type: 'hopping', from: group.oldName, count: group.today });
    }
  }
  return { items: [...permanent, ...hopping].slice(0, MAX_SWAP_ITEMS) };
}

/** Arbeitssätze pro Woche je Muskelgruppe (nur Zahl, keine Bewertung). muscleByExerciseId: Map<String, String>. */
export function buildMuscleSetFindings(periodSessions, muscleByExerciseId, weeks) {
  if (!(muscleByExerciseId instanceof Map) || muscleByExerciseId.size === 0 || !(weeks > 0)) return { items: [] };
  const totals = new Map();
  for (const session of periodSessions) {
    for (const entry of session.exercises) {
      const muscle = muscleByExerciseId.get(String(entry.ex?.exerciseId || ''))
        || muscleByExerciseId.get(`name:${String(entry.name || '').trim().toLowerCase()}`);
      if (!muscle) continue;
      totals.set(muscle, (totals.get(muscle) || 0) + entry.sets.length);
    }
  }
  const items = [...totals.entries()]
    .map(([muscle, sets]) => ({ muscle, setsPerWeek: round(sets / weeks, 1) }))
    .sort((a, b) => b.setsPerWeek - a.setsPerWeek || a.muscle.localeCompare(b.muscle))
    .slice(0, MAX_MUSCLE_ITEMS);
  return { items };
}

export const MAX_RECOMMENDATIONS = 3;

/**
 * Empfehlungen (höchstens 3) als Verweise auf Befunde: erst verschlechtert, dann Stillstand, dann Wiederholungs-Hinweis,
 * dann Exercise-Hopping. Leer = nichts zu ändern.
 */
export function buildRecommendations({ progress, repRange, swaps }) {
  const refs = [];
  progress.items.forEach((item, index) => { if (item.type === 'worsened') refs.push({ section: 'progress', index }); });
  progress.items.forEach((item, index) => { if (item.type === 'unchanged') refs.push({ section: 'progress', index }); });
  repRange.items.forEach((item, index) => { if (item.hint) refs.push({ section: 'repRange', index }); });
  swaps.items.forEach((item, index) => { if (item.type === 'hopping') refs.push({ section: 'swaps', index }); });
  return refs.slice(0, MAX_RECOMMENDATIONS);
}

/** Alle Befunde für facts.findings (Version 2 des Berichts). */
export function buildFindings(periodSessions, { muscleByExerciseId = null, periodDays = 28 } = {}) {
  const progress = buildProgressFindings(periodSessions);
  const repRange = buildRepRangeFindings(periodSessions);
  const swaps = buildSwapFindings(periodSessions);
  const muscles = buildMuscleSetFindings(periodSessions, muscleByExerciseId, periodDays / 7);
  const recommendations = buildRecommendations({ progress, repRange, swaps });
  return { progress, repRange, swaps, muscles, recommendations, nothingToChange: recommendations.length === 0 };
}
