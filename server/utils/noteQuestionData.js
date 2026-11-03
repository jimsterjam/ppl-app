// Begrenzter Datensatz für die Beantwortung von Fragen in Notizen (services/noteQuestionService.js). Statt
// structuredAnalysis zu serialisieren und abzuschneiden (frühere Übungen frisst das Budget, Notizen und eigene Übungsnamen
// gelangen ungekapselt in den Prompt), entsteht der Datensatz hier aus den Zahlenfeldern:
//   - ALLE Übungen in Reihenfolge mit wenigen Zahlen (Position, Sätze, Wiederholungen, Gewicht, Vorwert, Trend),
//   - mehr Details nur für die Übungen, nach denen gefragt wurde,
//   - keine Freitexte außer dem (neutralisierten, auf 60 Zeichen gekürzten) Übungsnamen. Notizen kommen nicht hinein.
// Die erlaubten Zahlen für die Antwortprüfung stammen ausschließlich aus den Zahlenwerten dieses Datensatzes.

const MAX_NAME_LENGTH = 60;
const MAX_SET_COMPARISON = 8;
const PROGRESSIONS = new Set(['positive', 'negative', 'stable', 'first_session']);

export function safeExerciseName(name) {
  return String(name ?? '').replace(/[<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

// Nur Zahlenwerte (verschachtelt), keine Texte - für sets_comparison u. Ä.
function numericOnly(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.map(numericOnly).filter((entry) => entry !== undefined);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, numericOnly(entry)])
      .filter(([, entry]) => entry !== undefined && !(Array.isArray(entry) && entry.length === 0));
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

/**
 * @param {object} structuredAnalysis
 * @param {Array<{ exercise?: string|null }>} questions
 * @param {Array<{ exercise?: string, exerciseNameForAI?: string }>} [aliases] - Originalname -> Name in den Daten (englisch)
 */
export function buildNoteQuestionData(structuredAnalysis, questions = [], aliases = []) {
  const aliasByName = new Map(aliases
    .filter((entry) => entry?.exercise)
    .map((entry) => [String(entry.exercise).trim().toLowerCase(), safeExerciseName(entry.exerciseNameForAI || entry.exercise).toLowerCase()]));
  const asked = new Set(questions
    .map((q) => String(q?.exercise ?? '').trim().toLowerCase())
    .filter(Boolean)
    .flatMap((key) => [key, aliasByName.get(key)])
    .filter(Boolean));

  const list = Array.isArray(structuredAnalysis?.exercises) ? structuredAnalysis.exercises : [];
  const exercises = list.map((ex, index) => {
    const name = safeExerciseName(ex?.exercise);
    const entry = {
      position: index + 1,
      name,
      sets: num(ex?.current_sets),
      reps: num(ex?.current_reps),
      weight_kg: num(ex?.current_weight),
      previous_sets: num(ex?.previous_sets),
      previous_reps: num(ex?.previous_reps),
      previous_weight_kg: num(ex?.previous_weight),
      progression: PROGRESSIONS.has(ex?.progression) ? ex.progression : undefined
    };
    if (asked.has(name.toLowerCase())) {
      const changes = ex?.changes || {};
      Object.assign(entry, {
        top_set_weight_kg: num(changes.top_set_weight_kg),
        previous_top_set_weight_kg: num(changes.previous_top_set_weight_kg),
        weight_change_kg: num(changes.weight_change_kg),
        reps_change: num(changes.reps_change),
        sets_change: num(changes.sets_change),
        volume_change_percent: num(changes.volume_change_percent),
        sets_comparison: Array.isArray(ex?.sets_comparison)
          ? numericOnly(ex.sets_comparison.slice(0, MAX_SET_COMPARISON))
          : undefined,
        progression_state: /^[a-z_]{1,40}$/.test(String(ex?.progression_state ?? '')) ? ex.progression_state : undefined
      });
    }
    return compact(entry);
  });
  return { exercise_count: exercises.length, exercises };
}

/** Alle Zahlenwerte (nicht Texte, nicht Feldnamen) eines Datensatzes als normalisierte Zeichenketten. */
export function collectNumericValues(value, into = new Set()) {
  if (typeof value === 'number' && Number.isFinite(value)) into.add(String(value).replace(/\.0+$/, ''));
  else if (Array.isArray(value)) value.forEach((entry) => collectNumericValues(entry, into));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectNumericValues(entry, into));
  return into;
}
