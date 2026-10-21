// Freitext-Einstieg ("Was trainierst du heute?"), Schritt 1: Ausgabeschema.
//
// Leitlinien (Absprache Paul):
// - Spiegeln statt Vorgeben: Es steht nur drin, was der Nutzer gesagt hat. Fehlende Zahlen bleiben null (leer, später
//   grau angezeigt) - es werden KEINE Wiederholungen/Gewichte erfunden (siehe Generator: "10 Wdh. / 0 kg" waren ein Fehler).
// - Einzige Ausnahme: die Satzanzahl. Fehlt sie, gilt DEFAULT_SETS und `assumed` enthält "sets" (nur die Anzahl leerer Zeilen).
// - Nichts wird still verworfen: was der Parser nicht versteht, landet in `unresolved` (mit Grund) bzw. setzt `needs_llm`.
// - exercise_id bleibt null. Die Zuordnung zum Übungskatalog macht Schritt 2 (Code), nie ein LLM.

export const MAX_INPUT_LENGTH = 500
export const DEFAULT_SETS = 3

export const LIMITS = Object.freeze({
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  weightKg: { min: 0, max: 1000 },
  durationSeconds: { min: 1, max: 7200 },
  daysPerWeek: { min: 1, max: 7 }
})

export const SPLITS = Object.freeze(['ppl', 'upper_lower', 'bro', 'fullbody', 'custom'])
export const SESSION_TYPES = Object.freeze(['push', 'pull', 'legs', 'fullbody'])

// Gründe in `unresolved` (maschinenlesbar, nicht für die Anzeige gedacht):
//   no_name          Zahlen ohne Übungsnamen
//   unparsed         Text, aus dem kein Übungsname und keine Zahl zu lesen war
//   unit_unsupported Einheit nicht unterstützt (z. B. lbs)
//   out_of_range     Zahl außerhalb des sinnvollen Bereichs (Wert wird verworfen, nicht geraten)
//   input_truncated  Eingabe war länger als MAX_INPUT_LENGTH
//   ambiguous_numbers Zahlen, die sich nicht eindeutig zuordnen lassen (z. B. "8 x 80 kg", "3x8x80"); sie werden nicht übernommen
//   merged_numbers   Zahlen als eigenes Segment standen hinter dem Namen ("Bankdrücken, 3x8, 80kg") und wurden nur über die Reihenfolge zugeordnet
//   ignored_rest     Pausen-Angabe erkannt und bewusst nicht übernommen (kein Ziel der ersten Version)
export const UNRESOLVED_REASONS = Object.freeze(['no_name', 'unparsed', 'unit_unsupported', 'out_of_range', 'input_truncated', 'ambiguous_numbers', 'merged_numbers', 'ignored_rest'])

export function emptyResult() {
  return { split: null, days_per_week: null, sessions: [], unresolved: [], needs_llm: false }
}

export function emptyExercise(rawText = '') {
  return {
    raw_text: rawText,
    exercise_id: null,
    variant: null,
    sets: DEFAULT_SETS,
    reps: null,
    reps_range: null,
    weight_kg: null,
    duration_seconds: null,
    assumed: ['sets']
  }
}

/** Zahl im erlaubten Bereich oder null. */
export function inRange(value, limit) {
  const n = Number(value)
  return Number.isFinite(n) && n >= limit.min && n <= limit.max ? n : null
}
