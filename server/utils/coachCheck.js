// Coach-Check (Absprache Jimmy 13.11.): Der Coach beurteilt, ob Übungsauswahl, Reihenfolge, Sätze und Wiederholungen
// zum Ziel (Muskelaufbau/Kraft) und zum Tag (Push/Pull/Legs/Ganzkörper) passen.
//   - automatisch beim ERSTEN Speichern eines selbst zusammengestellten Workouts (origin 'manual', noch kein gleiches
//     Workout) - statt der Ersten Einordnung, die dort kaum etwas zu sagen hätte;
//   - auf Wunsch per Knopf im Feedback-Verlauf (selbst zusammengestellte Workouts, verbraucht eine KI-Anfrage).
// Generierte Workouts bekommen keinen Coach-Check: Die Auswahl hat dort die KI selbst getroffen.
//
// Hier steht nur reine Logik (Daten für die KI, Prüfung der Antwort, fester Text der App). Der KI-Aufruf steht in
// services/coachCheckService.js.
import { resolveEnglishExerciseName } from './feedbackLocalization.js';
import { safeExerciseName } from './noteQuestionData.js';
import { clampText } from './textLimits.js';

export const WORKOUT_ORIGINS = Object.freeze(['manual', 'generated', 'favorite', 'plan']);
export const MAX_COACH_CHECK_HINTS = 3;
export const MAX_COACH_CHECK_TEXT = 900;
const MAX_LINE = 260;
const WORKOUT_TYPES = new Set(['push', 'pull', 'legs', 'fullbody']);
const GOALS = new Set(['strength', 'hypertrophy', 'explosive', 'technique']);
// Zahlen, die die KI außer den Trainingsdaten nennen darf: die Wiederholungsbereiche der App (REP_TARGETS, siehe
// utils/repTargets.js) - z. B. "8 bis 12 für Muskelaufbau".
const RANGE_NUMBERS = ['1', '6', '8', '12'];

/** Herkunft eines Workouts (Mongoose-Setter): nur feste Werte, sonst null. */
export function sanitizeWorkoutOrigin(value) {
  return WORKOUT_ORIGINS.includes(value) ? value : null;
}

const hasExerciseNote = (workout) => (Array.isArray(workout?.exercises) ? workout.exercises : [])
  .some((ex) => typeof ex?.note === 'string' && ex.note.trim() !== '');

/**
 * Automatischer Coach-Check beim Speichern? Nur das erste Mal mit genau diesen Übungen und nur bei selbst
 * zusammengestellten Workouts. Steht bei einer Übung eine Notiz, bleibt es bei der Ersten Einordnung: Die beantwortet
 * Fragen aus der Notiz und bestätigt bewusste Entscheidungen - der Coach-Check sieht keine Notizen (Selbstprüfung 13.11.).
 */
export function shouldAutoCoachCheck(workout, matchingCount) {
  return workout?.origin === 'manual' && Number(matchingCount) <= 1 && !hasExerciseNote(workout);
}

/**
 * Coach-Check auf Wunsch möglich? Selbst zusammengestellt, abgeschlossen und das Feedback ist nicht schon selbst ein
 * Coach-Check (sonst zahlte der Nutzer zweimal für dieselbe Auswertung).
 */
export function canRequestCoachCheck(workout) {
  return workout?.origin === 'manual' && workout?.completed === true && workout?.ai_feedback_kind !== 'coach_check';
}

/**
 * Hat sich die Zusammenstellung geändert (Übungen, Reihenfolge, Sätze, Wiederholungen)? Dann passt ein gespeicherter
 * Coach-Check nicht mehr. Notiz- oder Gewichtsänderungen lassen ihn stehen.
 */
export function coachCheckInputChanged(before, after) {
  return JSON.stringify(buildCoachCheckData(before)) !== JSON.stringify(buildCoachCheckData(after));
}

/**
 * Begrenzter Datensatz für die KI: Übungen in Reihenfolge mit englischem Namen, Arbeitssätzen und Wiederholungen.
 * Keine Notizen, keine Freitexte außer dem gekürzten, neutralisierten Übungsnamen.
 */
export function buildCoachCheckData(workout) {
  const exercises = (Array.isArray(workout?.exercises) ? workout.exercises : []).map((ex, index) => {
    const working = (Array.isArray(ex?.setDetails) ? ex.setDetails : []).filter((s) => s && !s.isWarmup && s.done !== false);
    const reps = working.map((s) => Number(s.reps)).filter((n) => Number.isFinite(n) && n > 0);
    const timed = ex?.measureMode === 'time' || ex?.measureMode === 'repsTime';
    return {
      position: index + 1,
      name: safeExerciseName(resolveEnglishExerciseName(ex?.name)),
      sets: working.length,
      ...(reps.length ? { reps } : {}),
      ...(timed ? { timed: true } : {})
    };
  }).filter((ex) => ex.name);
  return {
    workout_type: WORKOUT_TYPES.has(workout?.type) ? workout.type : 'unknown',
    goal: GOALS.has(workout?.goal) ? workout.goal : 'hypertrophy',
    // Summe der Arbeitssätze - damit die KI den Umfang mit einer echten Zahl nennen kann
    total_sets: exercises.reduce((sum, ex) => sum + ex.sets, 0),
    exercises
  };
}

/** Zahlen, die in der Antwort vorkommen dürfen (aus dem Datensatz + Wiederholungsbereiche der App). */
export function allowedCoachCheckNumbers(data) {
  const allowed = new Set(RANGE_NUMBERS);
  if (Number.isFinite(data?.total_sets)) allowed.add(String(data.total_sets));
  for (const ex of data?.exercises || []) {
    allowed.add(String(ex.position));
    allowed.add(String(ex.sets));
    for (const r of ex.reps || []) allowed.add(String(r));
  }
  return allowed;
}

function cleanLine(value) {
  // Steuerzeichen raus (textLimits.clampText), dann Aufzählungszeichen am Anfang und Mehrfach-Leerzeichen
  return clampText(String(value ?? ''), 2000)
    .replace(/^[\s\-–•*]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LINE);
}

const numbersIn = (text) => String(text ?? '').match(/\d+/g) || [];

/**
 * Antwort der KI prüfen: Einstieg ohne Zahlen, höchstens MAX_COACH_CHECK_HINTS Hinweise, nur erlaubte Zahlen, genannte
 * Übungen müssen im Workout vorkommen. Ungültige Hinweise fallen weg; ohne gültigen Einstieg gibt es keinen Text.
 * @returns {string|null} fertiger Text (Einstieg + Zeilen mit Bindestrich) oder null
 */
export function sanitizeCoachCheck(raw, data) {
  if (!raw || typeof raw !== 'object') return null;
  const allowed = allowedCoachCheckNumbers(data);
  const names = (data?.exercises || []).map((ex) => ex.name.toLowerCase());
  const intro = cleanLine(raw.intro);
  if (!intro || numbersIn(intro).length) return null;
  const hints = [];
  for (const entry of Array.isArray(raw.hints) ? raw.hints : []) {
    if (hints.length >= MAX_COACH_CHECK_HINTS) break;
    const text = cleanLine(typeof entry === 'string' ? entry : entry?.text);
    if (!text) continue;
    if (!numbersIn(text).every((n) => allowed.has(n))) continue;
    const exercise = cleanLine(entry?.exercise).toLowerCase();
    if (exercise && !names.includes(exercise)) continue;
    hints.push(text);
  }
  const lines = [intro, ...hints.map((h) => `- ${h}`)];
  return lines.join('\n').slice(0, MAX_COACH_CHECK_TEXT);
}

const FIRST_INTRO = {
  de: 'Dein erstes Workout mit diesen Übungen. Deshalb schaut der Coach heute auf die Zusammenstellung.',
  en: 'Your first workout with these exercises, so today the coach looks at how it\'s put together.'
};

/** Fester Einstieg der App vor dem automatischen Coach-Check beim ersten Mal. */
export function firstCoachCheckIntro(language = 'de') {
  return FIRST_INTRO[language === 'en' ? 'en' : 'de'];
}

/** Gespeicherter Coach-Check auf Wunsch (Mongoose-Setter-Hilfe). */
export function sanitizeStoredCoachCheck(value) {
  if (!value || typeof value !== 'object') return null;
  const text = clampText(String(value.text ?? ''), MAX_COACH_CHECK_TEXT, { multiline: true }).trim();
  if (!text) return null;
  const at = value.generated_at ? new Date(value.generated_at) : new Date();
  return {
    text,
    language: value.language === 'en' ? 'en' : 'de',
    generated_at: Number.isNaN(at.getTime()) ? new Date() : at
  };
}
