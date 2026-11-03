// Fragen in Trainingsnotizen (Absprache Paul 03.11.): Schreibt ein Nutzer eine Frage zu seinem Training in eine Notiz,
// bekommt er unter dem Feedback eine eigene Antwort ("Deine Frage"). Die Erkennung läuft in drei Stufen:
//   1. extractNoteQuestions(): einfache Prüfung, ob eine Notiz überhaupt eine Frage enthält (Fragezeichen, typische Wendungen).
//   2. Die KI sortiert jede Frage (services/noteQuestionService.js): 'training' | 'health' | 'other'.
//   3. sanitizeNoteAnswers(): harte Prüfung der Antworten. Eine Trainingsantwort muss die Übungen aus dem Workout
//      nennen und darf nur Zahlen aus den Daten enthalten; Antworten mit Arzt-/Therapie-Empfehlung zählen als 'health'.
// Für 'health' und 'other' gibt es keine KI-Antwort: Die App zeigt feste Texte (DE+EN, Client), der Text des Nutzers
// wird dabei nicht wiederholt.

export const MAX_NOTE_QUESTIONS = 2;
export const MAX_QUESTION_LENGTH = 300;
export const MAX_ANSWER_LENGTH = 700;
export const MAX_NOTE_CONTEXT_LENGTH = 400;
export const NOTE_ANSWER_KINDS = Object.freeze(['training', 'health', 'other']);

const QUESTION_CUES = [
  'kann es sein', 'könnte es', 'koennte es', 'liegt es', 'liegt das', 'woran liegt', 'warum', 'wieso', 'weshalb',
  'wie kommt', 'soll ich', 'sollte ich', 'ist es normal', 'ich frage mich', 'ob es', 'ob das', 'ob die', 'ob der',
  'is it possible', 'could it be', 'could this be', 'why ', 'how come', 'should i', 'is it normal', 'i wonder',
  'do you think'
];

function cleanText(value) {
  return String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

function isQuestionSentence(sentence) {
  if (sentence.includes('?')) return true;
  const lower = ` ${sentence.toLowerCase()} `;
  return QUESTION_CUES.some((cue) => lower.includes(` ${cue}`));
}

/**
 * Fragen aus den Notizen DIESER Einheit (Session-/Satz-/Workout-Notizen, nicht die dauerhaften Übungsnotizen).
 * @param {{ exerciseNotes?: Array<{ exercise?: string, note?: string }>, workoutNote?: string }} source
 * @returns {Array<{ id: number, text: string, exercise: string|null, hasQuestionMark: boolean, context: string }>} höchstens MAX_NOTE_QUESTIONS, ohne Duplikate
 */
export function extractNoteQuestions({ exerciseNotes = [], workoutNote = '' } = {}) {
  const entries = [
    ...exerciseNotes.map((entry) => ({ exercise: entry?.exercise || null, note: entry?.note })),
    { exercise: null, note: workoutNote }
  ];
  const questions = [];
  const seen = new Set();
  for (const entry of entries) {
    const text = String(entry.note ?? '');
    if (!text.trim()) continue;
    // Sätze trennen; ein Fragezeichen beendet den Satz, die Frage bleibt mit ihrem Fragezeichen erhalten.
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).map(cleanText).filter(Boolean);
    for (const sentence of sentences) {
      if (!isQuestionSentence(sentence)) continue;
      const trimmed = sentence.slice(0, MAX_QUESTION_LENGTH);
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Restlicher Notiztext (z. B. "Mein Knie tut weh. Soll ich ... steigern?") bleibt als begrenzter Kontext erhalten: Er
      // entscheidet mit darüber, ob es eine Trainings- oder eine Gesundheitsfrage ist.
      const wholeNote = cleanText(text).slice(0, MAX_NOTE_CONTEXT_LENGTH);
      questions.push({
        id: questions.length + 1,
        text: trimmed,
        exercise: entry.exercise,
        hasQuestionMark: trimmed.includes('?'),
        context: wholeNote.toLowerCase() === trimmed.toLowerCase() ? '' : wholeNote
      });
      if (questions.length >= MAX_NOTE_QUESTIONS) return questions;
    }
  }
  return questions;
}

// Antwort empfiehlt Ärzte/Therapeuten o. Ä.: nie ausgeben (Absprache Paul), stattdessen gilt die Frage als 'health'.
const MEDICAL_REFERRAL = new RegExp(
  '(?<![a-zäöüß])(?:' + [
    'arzt', 'ärzt', 'aerzt', 'doktor', 'medizinisch', 'physiotherap', 'orthopäd', 'orthopaed', 'therapeut', 'heilprakt',
    'doctor', 'physician', 'physio', 'therapist', 'medical', 'clinician', 'orthopedic', 'orthopaedic', 'chiropract'
  ].join('|') + ')',
  'i'
);

// Antwort rät zum Umstellen der Übungsreihenfolge: nie ausgeben (Absprache Paul: Reihenfolge ist bewusst gewählt, der
// Tipp wäre keine Lösung). Die Antwort wird verworfen.
const REORDER_ADVICE = new RegExp([
  'umstell', 'vertausch', 'umsortier', 'umordn', 'umgestellt',
  'reihenfolge(?:\\s+\\S+){0,5}?\\s+(?:änder|aender|tausch|wechsel|variier|anpass|verschieb|test|probier)',
  '(?:änder|aender|tausch|wechsel|variier|anpass|verschieb|test|probier)\\S*(?:\\s+\\S+){0,5}?\\s+(?:die |deine |der )?reihenfolge',
  '(?:an|auf)\\s+(?:eine?r?\\s+)?(?:früherer?|späterer?|anderer?|erster?|zweiter?)\\s+(?:stelle|position)',
  '\\b(?:swap|switch|reorder|resequence|rearrange|reshuffle)',
  '(?:change|alter|adjust|vary|test)\\S*(?:\\s+\\S+){0,5}?\\s+(?:the |your )?(?:exercise )?order',
  'order of (?:the |your )?exercises(?:\\s+\\S+){0,5}?\\s+(?:change|swap|switch|vary|differ)',
  '(?:earlier|later|first|sooner) in (?:the|your) (?:workout|session)'
].join('|'), 'i');

function numbersIn(text) {
  return String(text ?? '').match(/\d+(?:[.,]\d+)?/g) || [];
}

const normalizeNumber = (value) => String(value).replace(',', '.').replace(/\.0+$/, '');

/**
 * Antworten der KI prüfen und auf das Speicherformat bringen.
 * @param {Array<{ id?: number, kind?: string, answer?: string }>} rawAnswers - Rohausgabe der KI
 * @param {Array<{ id: number }>} questions - die erkannten Fragen
 * @param {{ exerciseNames?: string[], allowedNumbers?: Set<string> }} context
 * @returns {Array<{ kind: 'training'|'health'|'other', text: string }>} text nur bei 'training'
 */
export function sanitizeNoteAnswers(rawAnswers, questions, { exerciseNames = [], allowedNumbers = new Set() } = {}) {
  if (!Array.isArray(rawAnswers) || !Array.isArray(questions) || questions.length === 0) return [];
  const names = exerciseNames.map((name) => String(name || '').trim().toLowerCase()).filter((name) => name.length >= 3);
  const byId = new Map(rawAnswers.map((entry) => [Number(entry?.id), entry]));
  const result = [];
  for (const question of questions.slice(0, MAX_NOTE_QUESTIONS)) {
    const entry = byId.get(question.id);
    if (!entry) continue;
    let kind = NOTE_ANSWER_KINDS.includes(entry.kind) ? entry.kind : 'other';
    const text = cleanText(entry.answer).slice(0, MAX_ANSWER_LENGTH);
    // "Dazu kann ich hier nichts sagen" nur bei einer echten Frage (mit Fragezeichen): Feststellungen wie "keine
    // Ahnung warum" lösen keine Meldung aus.
    if (kind === 'other' && !question.hasQuestionMark) continue;
    if (kind === 'training') {
      if (MEDICAL_REFERRAL.test(text)) kind = 'health';
      else if (REORDER_ADVICE.test(text)) continue;
      else {
        const lower = text.toLowerCase();
        const mentionsExercise = names.some((name) => lower.includes(name));
        const numbersOk = numbersIn(text).every((n) => allowedNumbers.has(normalizeNumber(n)));
        // Ohne Bezug zu einer Übung dieses Workouts oder mit erfundenen Zahlen: Antwort verwerfen (nichts anzeigen).
        if (!text || !mentionsExercise || !numbersOk) continue;
        result.push({ kind: 'training', text });
        continue;
      }
    }
    result.push({ kind, text: '' });
  }
  return result;
}

/** Gespeicherte Antworten (Mongoose-Setter): nur bekannte Arten, Text nur bei 'training'. */
export function sanitizeStoredNoteAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_NOTE_QUESTIONS).map((entry) => {
    const kind = NOTE_ANSWER_KINDS.includes(entry?.kind) ? entry.kind : 'other';
    return { kind, text: kind === 'training' ? cleanText(entry?.text).slice(0, MAX_ANSWER_LENGTH) : '' };
  }).filter((entry) => entry.kind !== 'training' || entry.text);
}
