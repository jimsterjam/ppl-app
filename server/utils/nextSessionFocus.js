import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { resolveEnglishExerciseName, toTitleCase } from './feedbackLocalization.js';

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

let catalog = null;
function loadCatalog() {
  if (catalog) return catalog;
  catalog = new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    for (const entry of Array.isArray(parsed) ? parsed : []) {
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
  for (const entry of entries || []) {
    if (entry?.name) catalog.set(String(entry.name).trim().toLowerCase(), entry);
    if (entry?.name_en) catalog.set(String(entry.name_en).trim().toLowerCase(), entry);
  }
}

function exerciseInfo(ex = {}) {
  const cat = loadCatalog().get(String(ex?.name || '').trim().toLowerCase()) || {};
  return {
    name: ex?.name,
    name_en: cat.name_en,
    category: cat.category_raw || cat.category || ex?.category,
    equipment: cat.equipment || ex?.equipment,
    equipment_en: cat.equipment_en || ex?.equipment_en,
    aiMetadata: cat.aiMetadata || ex?.aiMetadata
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
    increase: (n, p) => `Nächstes Mal – ${n}: ${p.weight} kg probieren. Schaffst du nicht alle Wiederholungen, bleib dabei, bis es klappt.`,
    speed: (n) => `Nächstes Mal – ${n}: Bleibt jede Wiederholung schnell, nimm etwas mehr Gewicht. Wirst du in den letzten Wiederholungen deutlich langsamer, bleib beim Gewicht.`,
    close: (n, p) => `Nächstes Mal – ${n}: gleiches Gewicht (${p.weight} kg), diesmal fehlte nur 1 Wiederholung. Ziel: ${p.reps} Wdh. in jedem Satz.`,
    hold: (n, p) => `Nächstes Mal – ${n}: gleiches Gewicht (${p.weight} kg). Ziel: ${p.reps} Wdh. in jedem Satz.`
  },
  en: {
    increase: (n, p) => `Next time – ${n}: try ${p.weight} kg. If you don't hit all reps, stay there until you do.`,
    speed: (n) => `Next time – ${n}: if every rep stays fast, add a little weight. If you slow down noticeably on the last reps, keep the weight.`,
    close: (n, p) => `Next time – ${n}: same weight (${p.weight} kg), only 1 rep was missing this time. Goal: ${p.reps} reps in every set.`,
    hold: (n, p) => `Next time – ${n}: same weight (${p.weight} kg). Goal: ${p.reps} reps in every set.`
  }
};

const PRIORITY = { increase: 1, speed: 2, close: 3, hold: 4 };

/**
 * Wählt EINE Übung und baut die "Nächstes Mal"-Zeile.
 * Basis ist das gerade gespeicherte Workout: für die nächste Einheit ist es "die letzte Session".
 * @param {object} params
 * @param {object} params.workout - aktuelles Workout (exercises mit setDetails, goal)
 * @param {'de'|'en'} [params.language]
 * @param {Map<string, object>} [params.profileHintByName] - Übungsprofil je Name (lowercase)
 * @param {Map<string, string>} [params.englishNameByName] - englischer Anzeigename je Name (lowercase), z.B. aus der DB
 * @returns {null | { kind, exercise, text }}
 */
export function buildNextSessionFocus({ workout, language = 'de', profileHintByName = new Map(), englishNameByName = new Map() } = {}) {
  if (!engine?.getProgressionStatus) return null;
  const lang = language === 'en' ? 'en' : 'de';
  const goal = workout?.goal || 'hypertrophy';
  let best = null;

  (Array.isArray(workout?.exercises) ? workout.exercises : []).forEach((ex, order) => {
    const info = exerciseInfo(ex);
    const hint = profileHintByName.get(String(ex?.name || '').trim().toLowerCase()) || null;
    let candidate = null;

    const exGoal = exerciseGoal(info, ex, goal, hint);
    if (exGoal === 'explosive') {
      if (hasLoad(ex)) candidate = { kind: 'speed', params: {} };
    } else {
      const status = engine.getProgressionStatus(info, ex, exGoal);
      if (status?.state === 'increase' && status.suggestion?.suggestedWeights?.length) {
        candidate = { kind: 'increase', params: { weight: formatKg(status.suggestion.suggestedWeights[0], lang) } };
      } else if (status?.state === 'close' || status?.state === 'hold') {
        candidate = { kind: status.state, params: { weight: formatKg(status.weight, lang), reps: status.targetReps } };
      }
    }

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
