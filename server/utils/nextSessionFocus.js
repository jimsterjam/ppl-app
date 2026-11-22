import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { resolveEnglishExerciseName, toTitleCase } from './feedbackLocalization.js';
import { findCatalogEntryForName } from './catalogMatch.js';

// ---------------------------------------------------------------------------
// "Nächstes Mal"-Zeile unter dem KI-Feedback - deterministisch statt von der KI formuliert.
//
// User-Report: Die KI schrieb Fokus-Sätze wie "Überlege, wie du das Gewicht besser anpassen
// kannst" - keine Handlung, oft gegen die eigenen Prompt-Regeln. Jetzt wählt die App den Fokus
// selbst, mit DERSELBEN Progressionslogik wie die Hinweise im Workout
// (client/src/utils/weightSuggestion.js wird direkt importiert - so sagen Coach und Workout-
// Hinweis immer dasselbe). Die KI schreibt keinen Fokus mehr (Regel 25 im Prompt);
// stripAiFocusLines entfernt trotzdem geschriebene Fokus-Zeilen.
//
// Reihenfolge: Steigern > Speed/Power (Tempo als Maßstab) > Knapp dran > Halten. Trifft nichts
// zu, gibt es keine Zeile - lieber nichts als ein erfundener Tipp.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_PATH = path.resolve(__dirname, '..', '..', 'client', 'src', 'utils', 'weightSuggestion.js');
const CATALOG_PATH = path.resolve(__dirname, '..', '..', 'client', 'public', 'data', 'default-exercises.json');

let engine = null;
try {
  engine = await import(pathToFileURL(ENGINE_PATH).href);
} catch {
  // Client-Datei nicht verfügbar -> keine Fokus-Zeile (Feedback funktioniert unverändert).
  engine = null;
}

// Für utils/stagnationDiagnosis.js: dieselbe Progressionslogik wie Workout-Hinweis und Fokus-Zeile.
export function getProgressionEngine() {
  return engine;
}

let catalog = null;
let catalogList = [];
function loadCatalog() {
  if (catalog) return catalog;
  catalog = new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    catalogList = Array.isArray(parsed) ? parsed : [];
    for (const entry of catalogList) {
      if (entry?.name) catalog.set(String(entry.name).trim().toLowerCase(), entry);
      if (entry?.name_en) catalog.set(String(entry.name_en).trim().toLowerCase(), entry);
    }
  } catch {
    // ohne Katalog: Einordnung nur über Name/Equipment der Übung selbst
  }
  return catalog;
}

// Nur für Tests
export function __setFocusCatalogForTests(entries) {
  catalog = new Map();
  catalogList = Array.isArray(entries) ? entries : [];
  for (const entry of entries || []) {
    if (entry?.name) catalog.set(String(entry.name).trim().toLowerCase(), entry);
    if (entry?.name_en) catalog.set(String(entry.name_en).trim().toLowerCase(), entry);
  }
}

// Auch von utils/stagnationDiagnosis.js genutzt (gleiche Katalog-Einordnung wie hier).
export function exerciseInfo(ex = {}) {
  const catalogMap = loadCatalog();
  const cat = catalogMap.get(String(ex?.name || '').trim().toLowerCase())
    || findCatalogEntryForName(catalogList, ex?.name)
    || {};
  return {
    name: ex?.name,
    name_en: cat.name_en,
    category: cat.category_raw || cat.category || ex?.category,
    equipment: cat.equipment || ex?.equipment,
    equipment_en: cat.equipment_en || ex?.equipment_en,
    aiMetadata: cat.aiMetadata || ex?.aiMetadata,
    // Zeit-Übungen haben kein Gewicht (Engine: isNoLoadExercise).
    measureMode: ex?.measureMode
  };
}

// Trainingsart je Übung wie im Workout: eigene Wahl > automatisch explosiv > Workout-Ziel
// (resolveExerciseGoal in weightSuggestion.js). Ein Übungsprofil "power" zählt ebenfalls als explosiv.
function exerciseGoal(info, ex, workoutGoal, profileHint) {
  const goal = engine.resolveExerciseGoal
    ? engine.resolveExerciseGoal(info, workoutGoal, ex?.trainingType)
    : (workoutGoal || 'hypertrophy');
  if (!ex?.trainingType && profileHint?.exerciseType === 'power') return 'explosive';
  return goal;
}

function hasLoad(ex) {
  const sets = Array.isArray(ex?.setDetails) ? ex.setDetails : [];
  return sets.some((s) => s && !s.isWarmup && s.done !== false && (Number(s.weight) || 0) > 0 && (Number(s.reps) || 0) > 0);
}

function formatKg(value, language) {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: 2 }).format(n);
}

const TEXTS = {
  de: {
    increase: (n, p) => `Nächstes Mal – ${n}: ${p.weight} kg probieren.`,
    speed: (n) => `Nächstes Mal – ${n}: Bleibt jede Wiederholung schnell, nimm etwas mehr Gewicht. Wirst du in den letzten Wiederholungen deutlich langsamer, bleib beim Gewicht.`,
    close: (n, p) => `Nächstes Mal – ${n}: gleiches Gewicht (${p.weight} kg), diesmal fehlte nur 1 Wiederholung. Ziel: ${p.reps} Wdh. in jedem Satz – schaffst du das, ist danach mehr Gewicht dran.`,
    hold: (n, p) => `Nächstes Mal – ${n}: gleiches Gewicht (${p.weight} kg). Ziel: ${p.reps} Wdh. in jedem Satz.`,
    climb: (n, p) => `Nächstes Mal – ${n}: ${p.nextReps} Wdh. pro Satz mit ${p.weight} kg versuchen. Bei ${p.max} in allen Sätzen gibt es mehr Gewicht.`,
    confirm: (n, p) => `Nächstes Mal – ${n}: ${p.sets}×${p.reps} mit ${p.weight} kg noch einmal bestätigen, dann mehr Gewicht.`,
    plateau: (n, p) => `Hinweis – ${n}: seit ${p.sessions} Einheiten bei ${p.weight} kg. Ein kleinerer Steigerungsschritt oder etwas längere Pausen können helfen.`,
    below: (n, p) => `Hinweis – ${n}: unter ${p.min} Wdh. ist ${p.weight} kg für Muskelaufbau eher zu schwer. Etwas weniger Gewicht kann besser passen.`,
    restore: (n, p) => `Nächstes Mal – ${n}: Letztes Mal waren es ${p.last} kg, heute ${p.weight} kg. Wenn nichts dagegenspricht (z. B. eine Verletzung), starte wieder bei ${p.last} kg. Sonst taste dich von ${p.weight} kg Schritt für Schritt heran.`,
    rebuild: (n, p) => `Nächstes Mal – ${n}: gleiches Gewicht (${p.weight} kg), dann Schritt für Schritt wieder steigern.`
  },
  en: {
    increase: (n, p) => `Next time – ${n}: try ${p.weight} kg.`,
    speed: (n) => `Next time – ${n}: if every rep stays fast, add a little weight. If you slow down noticeably on the last reps, keep the weight.`,
    close: (n, p) => `Next time – ${n}: same weight (${p.weight} kg), only 1 rep was missing this time. Goal: ${p.reps} reps in every set – once you hit that, more weight is next.`,
    hold: (n, p) => `Next time – ${n}: same weight (${p.weight} kg). Goal: ${p.reps} reps in every set.`,
    climb: (n, p) => `Next time – ${n}: try ${p.nextReps} reps per set at ${p.weight} kg. Once every set hits ${p.max}, add weight.`,
    confirm: (n, p) => `Next time – ${n}: confirm ${p.sets}×${p.reps} at ${p.weight} kg once more, then add weight.`,
    plateau: (n, p) => `Note – ${n}: ${p.sessions} sessions at ${p.weight} kg. A smaller increase step or slightly longer rests can help.`,
    below: (n, p) => `Note – ${n}: below ${p.min} reps, ${p.weight} kg is rather heavy for muscle building. A little less weight may suit you better.`,
    restore: (n, p) => `Next time – ${n}: last time it was ${p.last} kg, today ${p.weight} kg. If nothing speaks against it (e.g. an injury), start at ${p.last} kg again. Otherwise work back up from ${p.weight} kg step by step.`,
    rebuild: (n, p) => `Next time – ${n}: same weight (${p.weight} kg), then build back up step by step.`
  }
};

// Keine Senkung, nur ein Hinweis (Absprache Jimmy): nach PLATEAU_SESSIONS Einheiten mit demselben
// Hauptgewicht ohne Steigerung.
export const PLATEAU_SESSIONS = 3;
const LOOKBACK_SESSIONS = 12;
const PRIORITY = { restore: 0, rebuild: 0, increase: 1, plateau: 2, below: 2, speed: 3, confirm: 4, close: 5, climb: 6, hold: 7 };

// Dieselbe Übung aus früheren Workouts (neueste zuerst), passend über den Namen.
function previousSessionsOf(ex, history, limit) {
  const name = String(ex?.name || '').trim().toLowerCase();
  const found = [];
  for (const w of Array.isArray(history) ? history : []) {
    if (found.length >= limit) break;
    const match = (w?.exercises || []).find((item) => String(item?.name || '').trim().toLowerCase() === name
      && engine.getWorkingSets(item).length > 0);
    // Workout-Ziel der Session mitgeben - verglichen werden nur Sessions derselben Trainingsart.
    if (match) found.push(w?.goal ? { ...match, __workoutGoal: w.goal } : match);
  }
  return found;
}

function mainWeightOf(sessionExercise) {
  const split = engine.splitMainAndBackoffSets(engine.getWorkingSets(sessionExercise));
  return split ? split.weight : null;
}

// Starker Einbruch (Absprache Jimmy 17.11./19.11.): Die Regel steckt in der gemeinsamen Engine (client/src/utils/weightSuggestion.js,
// getProgressionStatus: Zustände 'restore'/'rebuild'), damit Workout-Kasten, "Nächstes Mal"-Zeile und Coach-Zustand dasselbe sagen.
export const STRONG_DROP_RATIO = engine?.STRONG_DROP_RATIO ?? 0.2;

// Bewusste Entscheidung des Nutzers: "Absicht"-Antwort (bewusst/musste anpassen) oder eine Notiz an der Übung.
function hasDeliberateReason(ex, answer) {
  if (answer?.topic === 'intent' && (answer.answer === 'intended' || answer.answer === 'adjusted')) return true;
  if (typeof ex?.note === 'string' && ex.note.trim()) return true;
  return (Array.isArray(ex?.setDetails) ? ex.setDetails : []).some((set) => typeof set?.notes === 'string' && set.notes.trim());
}

// Antwort auf "Wie war der letzte Satz?" (F16, Thema B): nach "Am Limit" (sauber oder wackelig) nicht steigern bzw. nur bestätigen,
// sondern das Gewicht halten (Absprache Jimmy 14.11., Etappe 5b). Die App schlägt dabei nie weniger Gewicht vor. "Leicht" und
// "anstrengend, aber noch Luft" ändern nichts. Gilt nur für die Übung, zu der die Antwort gehört (Schlüssel: Position im Workout).
export const HOLD_AFTER_LAST_SET_ANSWERS = Object.freeze(['limit_clean', 'limit_shaky']);

// Einordnung EINER Übung nach der Progressionslogik (wie im Workout-Hinweis): { kind, params } oder null.
function resolveCandidate({ ex, info, hint, goal, history, lang, answer = null }) {
  let candidate = null;
  const exGoal = exerciseGoal(info, ex, goal, hint);
  if (exGoal === 'explosive') {
    if (hasLoad(ex)) candidate = { kind: 'speed', params: {} };
    return candidate;
  }
  // Genug Einheiten zurück, damit auch bei wechselnder Trainingsart (beim Filtern fallen andere weg) die passende gefunden wird.
  const previousSessions = previousSessionsOf(ex, history, LOOKBACK_SESSIONS);
  const status = engine.getProgressionStatus(info, ex, exGoal, { previousSessions, deliberate: hasDeliberateReason(ex, answer) });
  const compatible = engine.compatibleSessions ? engine.compatibleSessions(info, previousSessions, exGoal) : previousSessions;
  const params = {
    weight: formatKg(status?.weight, lang),
    reps: status?.targetReps,
    sets: status?.sets,
    nextReps: status?.nextReps,
    max: status?.max
  };
  // Starker Einbruch gegenüber der Einheit davor (Engine): nicht weitersteigern, Hinweis aufs frühere Gewicht bzw. schrittweise zurück.
  if (status?.state === 'restore' || status?.state === 'rebuild') {
    return { kind: status.state, params: { last: formatKg(status.previousWeight, lang), weight: formatKg(status.weight, lang) } };
  }
  if (status?.state === 'increase' && status.suggestion?.suggestedWeights?.length) {
    candidate = { kind: 'increase', params: { weight: formatKg(status.suggestion.suggestedWeights[0], lang) } };
  } else if (status?.state === 'climb' && status.belowRange) {
    // Muskelaufbau unter 8 Wdh.: nur Hinweis im Feedback, keine direkte Senkung (Absprache Jimmy).
    candidate = { kind: 'below', params: { ...params, min: status.min } };
  } else if (status && compatible.length >= PLATEAU_SESSIONS - 1
    && compatible.slice(0, PLATEAU_SESSIONS - 1).every((prev) => mainWeightOf(prev) === status.weight)) {
    // Seit mehreren Einheiten dasselbe Gewicht ohne Steigerung -> nur ein Hinweis, keine Senkung.
    candidate = { kind: 'plateau', params: { ...params, sessions: PLATEAU_SESSIONS } };
  } else if (['confirm', 'close', 'climb', 'hold'].includes(status?.state)) {
    candidate = { kind: status.state, params };
  }
  // Am Limit: Steigern bzw. Bestätigen wird zum Halten (gleiches Gewicht, gleiches Ziel). Andere Zustände bleiben.
  if ((candidate?.kind === 'increase' || candidate?.kind === 'confirm') && answer?.topic === 'last_set'
    && HOLD_AFTER_LAST_SET_ANSWERS.includes(answer.answer)) {
    // aiKind: Für die KI bleibt es beim Erfolg ("Ziel in allen Sätzen geschafft", Regel 29). hold_weight würde ihr sagen,
    // das Ziel sei noch nicht erreicht - das stimmt hier nicht, nur die Empfehlung unten (Halten) ändert sich.
    candidate = { kind: 'hold', params, aiKind: candidate.kind };
  }
  return candidate;
}

// Zustand je Übung für die KI (Regel 29): dieselbe Progressionslogik wie Workout-Hinweis und "Nächstes Mal"-Zeile.
const AI_PROGRESSION_STATES = {
  close: 'almost_there',
  increase: 'ready_to_increase',
  hold: 'hold_weight',
  climb: 'build_reps',
  confirm: 'confirm_once_more',
  // Starker Einbruch gegenüber dem letzten Mal (Regel 29): nie als "bereit zum Steigern" melden.
  restore: 'strong_drop',
  rebuild: 'strong_drop'
};

/**
 * Fortschrittszustand je Übung als Tatsache für die KI (Absprache Jimmy 14.10.): z. B. "almost_there" = Ziel nur knapp
 * verfehlt (ein Satz genau 1 Wdh. zu wenig). Nur Zustände, die dem Nutzer etwas sagen; sonst kein Eintrag.
 * @returns {Map<string, string>} Übungsname (lowercase) -> Zustand
 */
export function buildProgressionStates({ workout, profileHintByName = new Map(), history = [], athleteAnswers = new Map() } = {}) {
  const states = new Map();
  if (!engine?.getProgressionStatus) return states;
  const goal = workout?.goal || 'hypertrophy';
  (Array.isArray(workout?.exercises) ? workout.exercises : []).forEach((ex, index) => {
    try {
      const key = String(ex?.name || '').trim().toLowerCase();
      const info = exerciseInfo(ex);
      const candidate = resolveCandidate({ ex, info, hint: profileHintByName.get(key) || null, goal, history, lang: 'de', answer: athleteAnswers.get(index) || null });
      const state = candidate ? AI_PROGRESSION_STATES[candidate.aiKind || candidate.kind] : null;
      if (state) states.set(key, state);
    } catch {
      // eine Übung ohne Einordnung darf die Auswertung nie stoppen
    }
  });
  return states;
}

/**
 * Wählt EINE Übung und baut die "Nächstes Mal"-Zeile.
 * Basis ist das gerade gespeicherte Workout: für die nächste Einheit ist es "die letzte Session".
 * @param {object} params
 * @param {object} params.workout - aktuelles Workout (exercises mit setDetails, goal)
 * @param {'de'|'en'} [params.language]
 * @param {Map<string, object>} [params.profileHintByName] - Übungsprofil je Name (lowercase)
 * @param {Map<string, string>} [params.englishNameByName] - englischer Anzeigename je Name (lowercase), z.B. aus der DB
 * @param {Array} [params.history] - frühere abgeschlossene Workouts, neueste zuerst (ohne das aktuelle) -
 *   für Schema-Erkennung, Bestätigungs-Regel bei Singles und den Plateau-Hinweis
 * @returns {null | { kind, exercise, text }}
 */
export function buildNextSessionFocus({ workout, language = 'de', profileHintByName = new Map(), englishNameByName = new Map(), history = [], athleteAnswers = new Map() } = {}) {
  if (!engine?.getProgressionStatus) return null;
  const lang = language === 'en' ? 'en' : 'de';
  const goal = workout?.goal || 'hypertrophy';
  let best = null;

  (Array.isArray(workout?.exercises) ? workout.exercises : []).forEach((ex, order) => {
    const info = exerciseInfo(ex);
    const hint = profileHintByName.get(String(ex?.name || '').trim().toLowerCase()) || null;
    const candidate = resolveCandidate({ ex, info, hint, goal, history, lang, answer: athleteAnswers.get(order) || null });

    if (!candidate) return;
    if (!best || PRIORITY[candidate.kind] < PRIORITY[best.kind] ||
      (PRIORITY[candidate.kind] === PRIORITY[best.kind] && order < best.order)) {
      // Übungsnamen immer englisch: DB-Name > Katalog dieser Datei > allgemeine Auflösung.
      const key = String(ex?.name || '').trim().toLowerCase();
      const name = englishNameByName.get(key) || (info.name_en ? toTitleCase(info.name_en) : resolveEnglishExerciseName(ex?.name));
      best = { ...candidate, order, name };
    }
  });

  if (!best) return null;
  return { kind: best.kind, exercise: best.name, text: TEXTS[lang][best.kind](best.name, best.params) };
}

// Fokus-/"Nächstes Mal"-Zeilen, die die KI trotz Regel 25 geschrieben hat.
const AI_FOCUS_LINE = /^\s*(?:[-•*]\s*)?(?:\*\*)?\s*(?:fokus|focus|nächstes mal|next time|für die nächste einheit|for (?:the |your )?next (?:session|workout)|tipp für (?:die |das )?nächste)/i;

export function stripAiFocusLines(text) {
  if (!text) return text;
  return String(text)
    .split('\n')
    .filter((line) => !AI_FOCUS_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Entfernt KI-Fokus-Zeilen und hängt die App-eigene Zeile an (falls vorhanden). */
export function applyNextSessionFocus(text, focus) {
  const base = stripAiFocusLines(text);
  if (!focus?.text) return base;
  return base ? `${base}\n\n${focus.text}` : focus.text;
}
