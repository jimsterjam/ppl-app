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
import { findCatalogEntryForName } from './catalogMatch.js';
import exerciseList from '../data/exercises.js';

export const WORKOUT_ORIGINS = Object.freeze(['manual', 'generated', 'favorite', 'plan']);
export const MAX_COACH_CHECK_TEXT = 1400;
// Länger als die längste Anfrage (Client wartet bis 150 s, siehe client/src/utils/feedbackRetryRules.js)
export const COACH_CHECK_LOCK_MS = 3 * 60 * 1000;
// Felder, die nur der Server setzt - aus POST/PUT-Bodys entfernen. origin nur beim Anlegen (POST), nie beim Bearbeiten:
// Sonst ließe sich ein generiertes Workout nachträglich zu "selbst zusammengestellt" machen (Copilot-Review 13.11.).
export const SERVER_ONLY_CREATE_FIELDS = Object.freeze(['ai_coach_check', 'ai_coach_check_lock_at']);
export const SERVER_ONLY_UPDATE_FIELDS = Object.freeze([...SERVER_ONLY_CREATE_FIELDS, 'origin']);
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
  // completed: wie canRequestCoachCheck - ein laufendes Workout bekommt keinen Coach-Check (Copilot-Review Runde 3)
  return workout?.origin === 'manual' && workout?.completed === true && Number(matchingCount) <= 1
    && !hasExerciseNote(workout);
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

// Hauptmuskel laut Katalog (englisch, z. B. "pectorals") - damit die KI die Auswahl nicht raten muss (Fund 13.11.:
// Archer Push Up galt als reine Trizeps-Übung, obwohl sie die Brust trainiert). Eigene Übungen: keine Angabe.
function targetMuscle(name) {
  const entry = findCatalogEntryForName(exerciseList, name);
  const muscle = String(entry?.muscleGroup_en || entry?.target || '').trim().toLowerCase();
  return /^[a-z ]{2,30}$/.test(muscle) ? muscle : '';
}

const setHasData = (s) => Number(s?.reps) > 0 || Number(s?.durationSeconds) > 0 || Number(s?.duration) > 0;
const isLoggedSet = (s) => s && !s.isWarmup && s.done !== false && setHasData(s);

/**
 * Hat das Workout mindestens einen erledigten Arbeitssatz mit Werten? Ohne gibt es kein KI-Feedback (Absprache Jimmy
 * 13.11.: "Ohne eingetragene Werte kein Feedback") - weder Coach-Check noch Erste Einordnung oder Vergleich.
 */
export function workoutHasLoggedSets(workout) {
  return (Array.isArray(workout?.exercises) ? workout.exercises : []).some((ex) => {
    const details = Array.isArray(ex?.setDetails) ? ex.setDetails : [];
    // Älteres Format ohne setDetails: Sätze/Wiederholungen direkt an der Übung (trainingAnalysisService kennt es noch)
    if (details.length === 0) return Number(ex?.reps) > 0 || Number(ex?.sets) > 0;
    return details.some(isLoggedSet);
  });
}

/**
 * Dieselbe Bedingung als MongoDB-Abfrage (Feedback-Verlauf): offene Einträge ohne Werte gar nicht erst listen.
 * Kein Status wird geändert - kommen die Werte später (Offline-Sync), ist der Eintrag wieder da.
 */
export const HAS_LOGGED_SETS_QUERY = Object.freeze({
  $or: [
    { exercises: { $elemMatch: { setDetails: { $elemMatch: {
      isWarmup: { $ne: true }, done: { $ne: false },
      $or: [{ reps: { $gt: 0 } }, { durationSeconds: { $gt: 0 } }]
    } } } } },
    { exercises: { $elemMatch: { 'setDetails.0': { $exists: false }, $or: [{ reps: { $gt: 0 } }, { sets: { $gt: 0 } }] } } }
  ]
});

// Katalog-Muskeln (englische Fachwörter) in Alltagssprache (Absprache Jimmy 13.11.: "Pectorals und Delts" stand im
// deutschen Text; Nutzer sind keine Fitness-Experten).
const MUSCLE_WORDS = {
  pectorals: { de: 'Brust', en: 'chest' },
  delts: { de: 'Schultern', en: 'shoulders' },
  shoulders: { de: 'Schultern', en: 'shoulders' },
  triceps: { de: 'Trizeps', en: 'triceps' },
  biceps: { de: 'Bizeps', en: 'biceps' },
  lats: { de: 'Rücken', en: 'back' },
  'upper back': { de: 'oberer Rücken', en: 'upper back' },
  traps: { de: 'Nacken', en: 'neck' },
  quads: { de: 'vordere Oberschenkel', en: 'front of the thighs' },
  hamstrings: { de: 'hintere Oberschenkel', en: 'back of the thighs' },
  glutes: { de: 'Gesäß', en: 'glutes' },
  calves: { de: 'Waden', en: 'calves' },
  abs: { de: 'Bauch', en: 'abs' },
  forearms: { de: 'Unterarme', en: 'forearms' },
  spine: { de: 'unterer Rücken', en: 'lower back' },
  adductors: { de: 'Innenseite der Oberschenkel', en: 'inner thighs' },
  abductors: { de: 'Außenseite der Hüfte', en: 'outer hips' },
  'serratus anterior': { de: 'seitlicher Brustkorb', en: 'side of the ribcage' },
  'cardiovascular system': { de: 'Ausdauer', en: 'cardio' }
};
const muscleWord = (key, lang) => MUSCLE_WORDS[key]?.[lang] || '';

// Was ein Tag mindestens abdecken soll (Katalog-Muskeln je Gruppe). Ganzkörper wird nicht fest geprüft.
const DAY_GROUPS = {
  push: [
    { muscles: ['pectorals'], label: { de: 'Brust', en: 'chest' } },
    { muscles: ['delts', 'shoulders'], label: { de: 'Schultern', en: 'shoulders' } },
    { muscles: ['triceps'], label: { de: 'Trizeps', en: 'triceps' } }
  ],
  pull: [
    { muscles: ['lats', 'upper back', 'traps'], label: { de: 'Rücken', en: 'back' } },
    { muscles: ['biceps'], label: { de: 'Bizeps', en: 'biceps' } }
  ],
  legs: [
    { muscles: ['quads'], label: { de: 'vordere Oberschenkel', en: 'front of the thighs' } },
    { muscles: ['hamstrings', 'glutes'], label: {
      de: `${MUSCLE_WORDS.hamstrings.de} oder ${MUSCLE_WORDS.glutes.de}`,
      en: `${MUSCLE_WORDS.hamstrings.en} or ${MUSCLE_WORDS.glutes.en}`
    } }
  ]
};
const DAY_NAMES = { push: 'Push', pull: 'Pull', legs: 'Legs' };

/**
 * Welche Muskelgruppen des Tages hat keine Übung als Hauptmuskel? Nur, wenn alle Übungen aus dem Katalog stammen
 * (bei eigenen Übungen ist der Muskel unbekannt - dann keine Aussage). Fund 13.11.: Push ohne Trizeps blieb unerwähnt.
 */
function missingDayGroups(type, muscles, lang) {
  const groups = DAY_GROUPS[type];
  if (!groups || !muscles.length || muscles.some((m) => !m)) return [];
  return groups.filter((g) => !g.muscles.some((m) => muscles.includes(m))).map((g) => g.label[lang]);
}

/**
 * Begrenzter Datensatz für die KI: Übungen in Reihenfolge mit englischem Namen, Hauptmuskel, Arbeitssätzen und
 * Wiederholungen. Sätze ohne eingetragene Werte zählen nicht; eine Übung ganz ohne Werte bekommt logged: false (dazu
 * schreibt die App selbst einen Satz, Fund 13.11.). Keine Notizen, keine Freitexte außer dem neutralisierten Namen.
 */
export function buildCoachCheckData(workout, language = 'de') {
  const lang = language === 'en' ? 'en' : 'de';
  const catalogMuscles = [];
  const exercises = (Array.isArray(workout?.exercises) ? workout.exercises : []).map((ex, index) => {
    const working = (Array.isArray(ex?.setDetails) ? ex.setDetails : []).filter(isLoggedSet);
    const reps = working.map((s) => Number(s.reps)).filter((n) => Number.isFinite(n) && n > 0);
    const timed = ex?.measureMode === 'time' || ex?.measureMode === 'repsTime';
    const catalogMuscle = targetMuscle(ex?.name);
    catalogMuscles.push(catalogMuscle);
    // In der Sprache der App und in Alltagswörtern (die KI übernimmt die Wörter aus den Daten)
    const muscle = muscleWord(catalogMuscle, lang);
    return {
      position: index + 1,
      name: safeExerciseName(resolveEnglishExerciseName(ex?.name)),
      ...(muscle ? { muscle } : {}),
      sets: working.length,
      ...(reps.length ? { reps } : {}),
      ...(timed ? { timed: true } : {}),
      logged: working.length > 0
    };
  }).filter((ex) => ex.name);
  const workoutType = WORKOUT_TYPES.has(workout?.type) ? workout.type : 'unknown';
  return {
    workout_type: workoutType,
    goal: GOALS.has(workout?.goal) ? workout.goal : 'hypertrophy',
    missing_groups: missingDayGroups(workoutType, catalogMuscles, lang),
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
    // Zahlen im Übungsnamen ("45° Side Bend", "V. 2"): die KI soll Übungen beim Namen nennen
    for (const n of numbersIn(ex.name)) allowed.add(n);
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
 * Coach-Check erzeugen UND speichern als ein Schritt für withAiQuotaSlot (Copilot-Review Runde 3): Der Platz im
 * Kontingent zählt nur, wenn das Ergebnis auch gespeichert ist. Scheitert das Speichern (Datenbankfehler) oder wurde
 * das Workout inzwischen umgebaut ('stale'), geht der Platz zurück (isCoachCheckSaved).
 * @param {{ generate: () => Promise<string|null>, persist: (text: string) => Promise<'ok'|'stale'>,
 *   onPersistError?: (error: Error) => void }} input
 * @returns {Promise<{ text: string, saved: 'ok'|'stale'|'error' } | null>} null = KI lieferte nichts Verwertbares
 */
export async function generateAndPersistCoachCheck({ generate, persist, onPersistError = () => {} }) {
  const text = await generate();
  if (!text) return null;
  try {
    return { text, saved: (await persist(text)) === 'ok' ? 'ok' : 'stale' };
  } catch (error) {
    onPersistError(error);
    return { text, saved: 'error' };
  }
}
export const isCoachCheckSaved = (result) => result?.saved === 'ok';

/** Body ohne die angegebenen Felder (flache Kopie). */
export function withoutFields(body, fields) {
  const copy = { ...(body && typeof body === 'object' ? body : {}) };
  for (const field of fields) delete copy[field];
  return copy;
}

// Häufige Übungswörter (englisch, wie in der App, und die üblichen deutschen Begriffe). Nennt ein Hinweis eines davon,
// ohne dass eine Übung im Workout es im Namen trägt, schlägt die KI eine fremde Übung vor - der Hinweis fällt weg.
// Fehlendes soll sie als Muskelgruppe nennen (Prompt). Copilot-Review 13.11.
const EXERCISE_WORDS = [
  'squat', 'deadlift', 'bench press', 'overhead press', 'shoulder press', 'leg press', 'row', 'pull-up', 'pullup',
  'chin-up', 'pulldown', 'lunge', 'curl', 'dip', 'dips', 'fly', 'flye', 'raise', 'extension', 'pushdown', 'push-up',
  'pushup', 'plank', 'crunch', 'hip thrust', 'face pull', 'shrug', 'kickback', 'step-up',
  'kniebeuge', 'kniebeugen', 'kreuzheben', 'bankdrücken', 'rudern', 'klimmzug', 'klimmzüge', 'ausfallschritt',
  'ausfallschritte', 'liegestütz', 'liegestütze', 'schulterdrücken', 'beinpresse'
];
const wordPattern = (word) => new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu');
const EXERCISE_WORD_PATTERNS = EXERCISE_WORDS.map((word) => ({ word, pattern: wordPattern(word) }));

/** Nennt der Text eine Übung, die nicht im Workout ist? */
export function mentionsForeignExercise(text, exerciseNames) {
  const names = (exerciseNames || []).map((n) => String(n).toLowerCase());
  return EXERCISE_WORD_PATTERNS.some(({ word, pattern }) =>
    pattern.test(text) && !names.some((name) => pattern.test(name) || name.includes(word)));
}

const SECTIONS = ['selection', 'order', 'reps', 'volume'];
const SECTION_LABELS = {
  de: { selection: 'Auswahl', order: 'Reihenfolge', reps: 'Wiederholungen', volume: 'Umfang' },
  en: { selection: 'Selection', order: 'Order', reps: 'Reps', volume: 'Volume' }
};
// Diese Punkte muss die KI immer beantworten (Absprache Jimmy 13.11.: feste Punkte statt "nur Auffälliges")
const REQUIRED_SECTIONS = ['selection', 'order', 'reps'];
// Hinweise zu diesen Punkten müssen eine Übung aus dem Workout beim Namen nennen (kein "Diese Übung …", Fund 13.11.)
const NAME_REQUIRED_SECTIONS = new Set(['order', 'reps']);

// Übungen ohne erledigte Sätze mit Werten (leer, nicht abgehakt oder ausgelassen; auch Zeitübungen): neutral, ohne
// zu unterstellen, dass etwas vergessen wurde. Höchstens MAX_UNLOGGED_NAMES Namen, damit der Text begrenzt bleibt.
const MAX_UNLOGGED_NAMES = 4;
const UNLOGGED = {
  de: (names, more) => `Für ${names}${more ? ' und weitere' : ''} sind keine erledigten Sätze mit Werten eingetragen – dazu kann der Coach nichts sagen.`,
  en: (names, more) => `${names}${more ? ' and others' : ''}: no completed sets with values logged, so the coach can't assess them.`
};
// "Diese Übung …" ohne Namen - in keinem Punkt erlaubt (Fall aus Produktion 13.11.)
const NAMELESS_REFERENCE = /(^|[^\p{L}])(diese[rnms]?\s+übung|this\s+exercise|that\s+exercise)/iu;

// Fachwörter, die trotz Prompt in der Antwort landen, durch Alltagswörter ersetzen (statt die Antwort zu verwerfen).
// Großschreibung nur am Satzanfang (deutsche Nomen stehen schon groß in der Liste: "Brust", aber "vordere Oberschenkel").
const bounded = (source) => new RegExp(`(^|[^\\p{L}])(${source})(?=$|[^\\p{L}])`, 'giu');
const JARGON = {
  de: [['hypertrophie|hypertrophy', 'Muskelaufbau'], ['pectorals?|pecs|pectoralis', MUSCLE_WORDS.pectorals.de],
    ['deltoids?|delts', MUSCLE_WORDS.delts.de], ['lats', MUSCLE_WORDS.lats.de], ['quadriceps|quads', MUSCLE_WORDS.quads.de],
    ['hamstrings', MUSCLE_WORDS.hamstrings.de], ['glutes', MUSCLE_WORDS.glutes.de], ['traps', MUSCLE_WORDS.traps.de]],
  en: [['hypertrophy', 'muscle growth'], ['pectorals?|pecs|pectoralis', MUSCLE_WORDS.pectorals.en],
    ['deltoids?|delts', MUSCLE_WORDS.delts.en], ['lats', MUSCLE_WORDS.lats.en], ['quadriceps|quads', MUSCLE_WORDS.quads.en],
    ['hamstrings', MUSCLE_WORDS.hamstrings.en], ['traps', MUSCLE_WORDS.traps.en]]
};
// Einmal beim Laden vorbereiten
const JARGON_PATTERNS = Object.fromEntries(Object.entries(JARGON)
  .map(([lang, list]) => [lang, list.map(([source, word]) => [bounded(source), word])]));

const atSentenceStart = (textBefore) => /(^|[.!?:]\s*)$/.test(textBefore.trimEnd() === '' ? '' : textBefore.replace(/\s+$/, ' '));

function replaceJargon(part, lang, prefix) {
  let out = part;
  for (const [pattern, word] of JARGON_PATTERNS[lang]) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, (_, before, found, offset, whole) => {
      const start = atSentenceStart(prefix + whole.slice(0, offset) + before);
      return before + (start ? word.charAt(0).toUpperCase() + word.slice(1) : word);
    });
  }
  return out;
}

/**
 * Fachwörter durch Alltagswörter ersetzen. Übungsnamen aus dem Workout bleiben unverändert (eine eigene Übung
 * "Glutes Kickback" darf nicht zu "Gesäß Kickback" werden - sonst fände die Namensprüfung sie nicht mehr).
 */
export function plainWords(text, lang = 'de', exerciseNames = []) {
  const l = lang === 'en' ? 'en' : 'de';
  const source = String(text ?? '');
  const names = (exerciseNames || []).map((n) => String(n)).filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!names.length) return replaceJargon(source, l, '');
  const keep = new RegExp(`(${names.join('|')})`, 'giu');
  let out = '';
  let last = 0;
  for (const match of source.matchAll(keep)) {
    out += replaceJargon(source.slice(last, match.index), l, out) + match[0];
    last = match.index + match[0].length;
  }
  return out + replaceJargon(source.slice(last), l, out);
}

const MISSING_SENTENCE = {
  de: (day, groups) => `Für einen ${day}-Tag fehlt noch eine Übung für: ${groups}.`,
  en: (day, groups) => `A ${day} day still needs an exercise for: ${groups}.`
};

const nameTokens = (value) => String(value ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Nennt der Text mindestens eine Übung aus dem Workout? Ganze Wörter (kein "Fly" in "Butterfly"); bei mehrteiligen
 * Namen reichen zwei aufeinanderfolgende Wörter (die KI kürzt "Bench Press Barbell" gern zu "Bench Press").
 */
export function mentionsWorkoutExercise(text, exerciseNames) {
  const words = nameTokens(text);
  const pairs = new Set(words.slice(1).map((w, i) => `${words[i]} ${w}`));
  return (exerciseNames || []).some((name) => {
    const tokens = nameTokens(name);
    if (tokens.length === 0) return false;
    if (tokens.length === 1) return tokens[0].length >= 3 && words.includes(tokens[0]);
    return tokens.slice(1).some((t, i) => pairs.has(`${tokens[i]} ${t}`));
  });
}

/**
 * Antwort der KI prüfen und als feste Punkte zusammensetzen (Absprache Jimmy 13.11.):
 *   - Auswahl, Reihenfolge, Wiederholungen müssen da sein (Urteil "ok" oder "hint" + ein Satz), Umfang nur bei "hint";
 *   - nur erlaubte Zahlen, keine fremden Übungen, Hinweise zu Reihenfolge/Wiederholungen nennen eine Übung beim Namen;
 *   - Übungen ohne eingetragene Werte: Die App schreibt den Satz zu den Wiederholungen selbst.
 * Fehlt ein Pflichtpunkt oder ist er ungültig, gibt es keinen Coach-Check (null, dann normale Erste Einordnung).
 * @returns {string|null} Zeilen "- Auswahl: …" usw.
 */
export function sanitizeCoachCheck(raw, data, language = 'de') {
  if (!raw || typeof raw !== 'object') return null;
  const lang = language === 'en' ? 'en' : 'de';
  const allowed = allowedCoachCheckNumbers(data);
  const exercises = data?.exercises || [];
  const names = exercises.map((ex) => ex.name);
  const lowerNames = names.map((n) => n.toLowerCase());
  const unlogged = exercises.filter((ex) => ex.logged === false).map((ex) => ex.name);
  const noneLogged = exercises.length > 0 && unlogged.length === exercises.length;

  const section = (key) => {
    const entry = raw[key];
    if (!entry || typeof entry !== 'object') return null;
    const verdict = entry.verdict === 'hint' ? 'hint' : entry.verdict === 'ok' ? 'ok' : null;
    const text = plainWords(cleanLine(entry.text), lang, names);
    if (!verdict || !text) return null;
    if (!numbersIn(text).every((n) => allowed.has(n))) return null;
    if (mentionsForeignExercise(text, lowerNames)) return null;
    if (NAMELESS_REFERENCE.test(text)) return null;
    if (verdict === 'hint' && NAME_REQUIRED_SECTIONS.has(key) && !mentionsWorkoutExercise(text, names)) return null;
    return { verdict, text };
  };

  const result = {};
  for (const key of SECTIONS) result[key] = section(key);
  // Fehlende Muskelgruppe des Tages (aus dem Katalog berechnet): nennt immer die App selbst - die KI soll sie nicht
  // erwähnen (Prompt). So kann weder ein falsches "ist abgedeckt" noch ein doppelter Satz entstehen.
  const missing = Array.isArray(data?.missing_groups) ? data.missing_groups : [];
  if (result.selection && missing.length) {
    const day = DAY_NAMES[data.workout_type] || '';
    result.selection = { verdict: 'hint', text: `${result.selection.text} ${MISSING_SENTENCE[lang](day, missing.join(', '))}` };
  }
  // Ohne eingetragene Werte gibt es zu Wiederholungen nichts einzuordnen; der Umfang (total_sets zählt nur Sätze mit
  // Werten) wäre schon bei einer Übung ohne Werte zu klein gerechnet
  if (noneLogged) result.reps = null;
  if (unlogged.length) result.volume = null;
  for (const key of REQUIRED_SECTIONS) {
    if (key === 'reps' && noneLogged) continue;
    if (!result[key]) return null;
  }
  if (unlogged.length) {
    const sentence = UNLOGGED[lang](unlogged.slice(0, MAX_UNLOGGED_NAMES).join(', '), unlogged.length > MAX_UNLOGGED_NAMES);
    result.reps = { verdict: 'hint', text: result.reps ? `${result.reps.text} ${sentence}` : sentence };
  }

  const labels = SECTION_LABELS[lang];
  // Ganze Zeilen statt Abschneiden mitten im Satz (Grenze wird bei 4 Zeilen à 260 + App-Satz praktisch nie erreicht)
  const lines = [];
  for (const key of SECTIONS) {
    if (!result[key] || (key === 'volume' && result[key].verdict !== 'hint')) continue;
    const line = `- ${labels[key]}: ${result[key].text}`;
    if ([...lines, line].join('\n').length > MAX_COACH_CHECK_TEXT) break;
    lines.push(line);
  }
  return lines.join('\n');
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
