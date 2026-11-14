// Antworten des Nutzers auf die kurzen Fragen nach dem Training (Backlog F16, Etappe 1).
//
// Grundsatz: nur feste Werte aus Listen, kein Freitext. Der Server speichert nie den Request-Body, sondern baut jeden
// Eintrag aus geprüften Werten neu zusammen. Ungültiges wird verworfen statt abgelehnt (Offline-Sync würde abgelehnte
// Speichervorgänge endlos wiederholen). Der Übungsname kommt vom Workout, nie vom Client.

import { isExerciseNotDone } from './exerciseDone.js';

export const ATHLETE_TOPICS = Object.freeze(['last_set', 'compare', 'intent']);

// Höchstens zwei Themen je Workout (Absprache Jimmy 14.11.).
export const MAX_ATHLETE_ANSWERS = 2;

// Thema B "Wie war der letzte Satz?" (Ziel in allen Sätzen erreicht)
const LAST_SET_ANSWERS = Object.freeze(['easy', 'hard_air', 'limit_clean', 'limit_shaky']);
// Thema C Vergleich mit dem letzten Mal
const COMPARE_ANSWERS = Object.freeze(['cleaner', 'same', 'harder', 'shakier']);
export const COMPARE_VARIANTS = Object.freeze(['same', 'less']);
// Thema A "War das Absicht?"
const INTENT_ANSWERS = Object.freeze(['intended', 'adjusted', 'unsure']);

export const INTENT_REASONS = Object.freeze({
  intended: Object.freeze(['other_goal', 'deload', 'feel_muscle', 'variety', 'other']),
  adjusted: Object.freeze(['too_tired', 'too_heavy', 'body_off', 'equipment_busy', 'no_time', 'other'])
});

const ANSWERS_BY_TOPIC = Object.freeze({
  last_set: LAST_SET_ANSWERS,
  compare: COMPARE_ANSWERS,
  intent: INTENT_ANSWERS
});

export function exerciseKey(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Prüft EINEN Eintrag und baut ihn aus festen Werten neu auf.
 * @param {*} raw
 * @returns {{topic:string, exerciseIndex:number, answer:string, reason:(string|null), variant:(string|null)}|null}
 *   null, wenn Thema, Antwort oder Übungsposition ungültig sind. Ein ungültiger Grund wird nur weggelassen.
 */
export function sanitizeAthleteAnswer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const topic = ATHLETE_TOPICS.includes(raw.topic) ? raw.topic : null;
  if (!topic) return null;
  const answer = ANSWERS_BY_TOPIC[topic].includes(raw.answer) ? raw.answer : null;
  if (!answer) return null;
  const exerciseIndex = raw.exerciseIndex;
  if (!Number.isInteger(exerciseIndex) || exerciseIndex < 0 || exerciseIndex > 99) return null;
  const reasons = topic === 'intent' ? INTENT_REASONS[answer] : null;
  const reason = reasons && reasons.includes(raw.reason) ? raw.reason : null;
  const variant = topic === 'compare' && COMPARE_VARIANTS.includes(raw.variant) ? raw.variant : null;
  return { topic, exerciseIndex, answer, reason, variant };
}

/**
 * Prüft die Antworten zu einem Workout: gültige Einträge, je Übung nur ein Thema (das erste), höchstens zwei.
 * Die Übung muss im Workout existieren und tatsächlich gemacht sein; ihr Name wird vom Server eingetragen.
 * @param {*} rawList
 * @param {{exercises?: Array}} workout
 * @returns {Array<{topic, exercise, exerciseIndex, answer, reason, variant}>}
 */
export function sanitizeAthleteAnswers(rawList, workout) {
  if (!Array.isArray(rawList)) return [];
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  const seen = new Set();
  const out = [];
  // Nur die ersten Einträge ansehen: ein manipulierter Body mit tausenden Einträgen kostet sonst unnötig Zeit.
  for (const raw of rawList.slice(0, 20)) {
    const entry = sanitizeAthleteAnswer(raw);
    if (!entry) continue;
    const ex = exercises[entry.exerciseIndex];
    const name = typeof ex?.name === 'string' ? ex.name.trim() : '';
    if (!name) continue;
    // Eine ausgelassene Übung kann nur die Frage "War das Absicht?" bekommen.
    const skipped = isExerciseNotDone(ex);
    if (skipped && entry.topic !== 'intent') continue;
    // Je Übung nur ein Thema: die KI bekommt je Übung genau eine Antwort (activeAthleteAnswerMap).
    if (seen.has(entry.exerciseIndex)) continue;
    seen.add(entry.exerciseIndex);
    out.push({ ...entry, exercise: name.slice(0, 120) });
    if (out.length >= MAX_ATHLETE_ANSWERS) break;
  }
  return out;
}

/**
 * Setter für das Mongoose-Feld: ohne Workout-Bezug nur Form und Werte prüfen (Name wird gekürzt, nicht geprüft).
 */
export function sanitizeStoredAthleteAnswers(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value.slice(0, 20)) {
    const entry = sanitizeAthleteAnswer(raw);
    const name = typeof raw?.exercise === 'string' ? raw.exercise.trim().slice(0, 120) : '';
    if (!entry || !name || seen.has(entry.exerciseIndex)) continue;
    seen.add(entry.exerciseIndex);
    out.push({ ...entry, exercise: name });
    if (out.length >= MAX_ATHLETE_ANSWERS) break;
  }
  return out;
}

/**
 * Gespeicherte Antworten, die noch zum Workout passen: wurde die Übung nach dem Beantworten umbenannt, ersetzt oder
 * verschoben (Bearbeiten), gehört die Antwort nicht mehr dazu und wird nicht mehr an die KI gegeben.
 * Schlüssel ist die Position der Übung im Workout (derselbe Übungsname kann zweimal vorkommen). Der Eintrag enthält
 * nur die festen Felder, nie den Übungsnamen (der kann ein eigener Freitext sein und käme sonst ungekapselt in die KI).
 * @returns {Map<number, {topic, answer, reason, variant}>}
 */
export function activeAthleteAnswerMap(workout) {
  const map = new Map();
  const stored = Array.isArray(workout?.athlete_answers) ? workout.athlete_answers : [];
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  for (const entry of stored) {
    const current = exercises[entry?.exerciseIndex];
    if (!current || exerciseKey(current.name) !== exerciseKey(entry.exercise)) continue;
    const clean = sanitizeAthleteAnswer(entry);
    if (clean && !map.has(clean.exerciseIndex)) {
      map.set(clean.exerciseIndex, { topic: clean.topic, answer: clean.answer, reason: clean.reason, variant: clean.variant, exerciseIndex: clean.exerciseIndex });
    }
  }
  return map;
}

const LAST_SET_TEXT = Object.freeze({
  easy: 'Der letzte Satz fühlte sich leicht an, da wäre mehr gegangen.',
  hard_air: 'Der letzte Satz war anstrengend, aber es war noch Luft da.',
  limit_clean: 'Der letzte Satz war am Limit, aber sauber ausgeführt.',
  limit_shaky: 'Der letzte Satz war am Limit, die Ausführung wurde dabei wackelig.'
});

const COMPARE_TEXT = Object.freeze({
  cleaner: 'Im Vergleich zum letzten Mal lief es sauberer und kontrollierter.',
  same: 'Im Vergleich zum letzten Mal fühlte es sich ungefähr gleich an.',
  harder: 'Im Vergleich zum letzten Mal fühlte es sich schwerer an als sonst.',
  shakier: 'Im Vergleich zum letzten Mal war die Ausführung wackeliger.'
});

const REASON_TEXT = Object.freeze({
  other_goal: 'ein anderes Ziel als sonst',
  deload: 'eine Erholungswoche',
  feel_muscle: 'den Zielmuskel besser zu spüren',
  variety: 'Abwechslung',
  too_tired: 'er war zu müde',
  too_heavy: 'das Gewicht war zu schwer',
  body_off: 'der Körper hat heute nicht mitgemacht (ohne Ursache zu nennen)',
  equipment_busy: 'das Gerät war belegt',
  no_time: 'Zeitmangel',
  other: 'ein anderer Grund'
});

/**
 * Ein deutscher Satz für den KI-Prompt. Nur feste Bausteine, kein Nutzertext - daher kein Einkapseln nötig.
 * @returns {string} leer, wenn der Eintrag unbrauchbar ist
 */
export function describeAthleteAnswer(entry) {
  const clean = sanitizeAthleteAnswer(entry);
  if (!clean) return '';
  if (clean.topic === 'last_set') return LAST_SET_TEXT[clean.answer];
  if (clean.topic === 'compare') {
    const base = clean.variant === 'less' ? 'Heute war es etwas weniger als beim letzten Mal. ' : clean.variant === 'same' ? 'Heute war es genau wie beim letzten Mal. ' : '';
    return `${base}${COMPARE_TEXT[clean.answer]}`;
  }
  if (clean.answer === 'unsure') return 'Auf die Frage, ob die Abweichung Absicht war, antwortete der Nutzer: weiß nicht.';
  const reason = clean.reason ? ` Grund: ${REASON_TEXT[clean.reason]}.` : '';
  return clean.answer === 'intended'
    ? `Die Abweichung war Absicht (bewusste Entscheidung).${reason}`
    : `Der Nutzer musste die Abweichung anpassen (keine bewusste Entscheidung).${reason}`;
}

// Gemeinsame Anweisung für alle KI-Anbieter (OpenAI-Regel 33; weitere Anbieter sollen dieselbe Anweisung nutzen).
// Bewusst ohne Regelnummern, damit der Text auch ohne den OpenAI-System-Prompt verständlich ist.
export const ATHLETE_ANSWER_DIRECTIVE_LINES = Object.freeze([
  'Der Nutzer hat bei dieser Übung eine kurze Frage per Antippen beantwortet. Das ist seine eigene Aussage, keine',
  'Vermutung - greife sie auf und ordne sie ein, aber erfinde nichts darüber hinaus. Keine Zahlen nennen, die nicht in',
  'den Trainingsdaten stehen. Du EMPFIEHLST nichts für die nächste Einheit - ob es mehr Gewicht oder mehr',
  'Wiederholungen gibt, zeigt die App selbst.',
  '- Letzter Satz "leicht": würdige, dass noch Reserve da war. "anstrengend, aber noch Luft": solide Arbeit, noch',
  '  Reserve. "am Limit, aber sauber": starke, saubere Arbeit an der Grenze. "am Limit, Ausführung wackelig": ruhig',
  '  und ohne Vorwurf einordnen, an der Grenze wird es zum Schluss unruhig, das gehört dazu - nie als Versagen.',
  '- Vergleich mit dem letzten Mal: "sauberer/kontrollierter" zählt als Fortschritt, auch bei gleichen oder',
  '  etwas niedrigeren Zahlen. "ungefähr gleich": Konsolidierung, kein Grund zur Mahnung. "schwerer als sonst":',
  '  Pause, Schlaf, Tagesform können mitspielen, nicht jede Einheit ist ein Rekord. "wackeliger": ruhig einordnen.',
  '- Abweichung "Absicht": bestätigen und den genannten Grund aufgreifen - nie als Rückschritt bezeichnen.',
  '  "musste anpassen": verständnisvoll einordnen, ein Grund wie müde/Zeit/Gerät belegt ist kein Fehler.',
  '  Beim Grund "Körper hat nicht mitgemacht" keine Ursache vermuten, keine medizinischen Aussagen.',
  '- "weiß nicht" oder kein Grund: nichts hineindeuten.',
  '- Technik-Übungen und Übungen auf Zeit werden nicht nach Gewicht oder Fortschritt bewertet; in der ersten Einordnung',
  '  (feedback_mode "first_look") kein Vergleich und keine Entwicklung - dort nur die Antwort selbst würdigen. Eine',
  '  Antwort macht die Übung zum Kandidaten für die Höchstgrenze von 3 Übungen mit Besonderheit, zwingt aber nicht zur Nennung.'
]);
