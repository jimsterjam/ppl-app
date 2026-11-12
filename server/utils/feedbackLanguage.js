// Sprache, in der ein gespeichertes KI-Feedback erzeugt wurde ('de' | 'en'; null = älteres Feedback ohne Angabe).
// Der Client zeigt Vergleichsteil und Coach-Text in dieser Sprache, damit nach einem Wechsel der App-Sprache nichts
// gemischt erscheint (Absprache Jimmy 02.11.).
export function sanitizeFeedbackLanguage(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'de' || v === 'en' ? v : null;
}
