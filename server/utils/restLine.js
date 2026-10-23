// Sammelzeile für die übrigen Übungen ("Der Rest lief stabil ...") - von der App statt von der KI.
//
// User-Report (21.10.): Die KI hängte die Zeile fast immer an, auch wenn es gar keinen "Rest" gab (z. B. nur eine
// Übung im Workout). Jetzt schreibt die KI sie nicht mehr (Prompt), die App ergänzt sie nur, wenn es wirklich
// weitere Übungen mit Vorher-Vergleich gibt, die im Text nicht vorkamen UND alle davon unverändert (stable) waren.
// Gab es unerwähnte Rückgänge, steht lieber keine Zeile da als eine falsche Behauptung.

const AI_REST_LINE = /^\s*(?:[-•*]\s*)?(?:\*\*)?\s*(?:der rest\b|der übrige\b|die übrigen\b|die restlichen\b|alles andere\b|the rest\b|everything else\b|the remaining\b|all other\b)/i;

const TEXTS = {
  de: 'Der Rest lief stabil, die Details siehst du oben.',
  en: 'The rest stayed steady, the details are above.'
};

/** Entfernt Sammelzeilen, die die KI trotz Prompt-Regel geschrieben hat. */
export function stripAiRestLines(text) {
  if (!text) return text;
  return String(text)
    .split('\n')
    .filter((line) => !AI_REST_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isMentioned(text, analysis) {
  const haystack = String(text || '').toLowerCase();
  return [analysis?.exercise, analysis?.exerciseNameForAI]
    .map((name) => String(name || '').trim().toLowerCase())
    .filter(Boolean)
    .some((name) => haystack.includes(name));
}

/**
 * @param {string} text - KI-Text (ohne Sammelzeile)
 * @param {Array} exerciseAnalyses - Ergebnis von analyzeWorkoutProgression()
 * @param {'de'|'en'} language
 * @returns {string|null}
 */
export function buildRestLine(text, exerciseAnalyses, language = 'de') {
  const unmentioned = (Array.isArray(exerciseAnalyses) ? exerciseAnalyses : [])
    // Nur Übungen mit Vorher-Vergleich: bei der ersten Session gibt es nichts, was "stabil lief".
    .filter((ex) => ex?.previous && ex.progression !== 'first_session')
    .filter((ex) => !isMentioned(text, ex));
  if (!unmentioned.length) return null;
  // Nur wenn ALLE unerwähnten Übungen wirklich unverändert waren (User-Report 24.10.: "Der Rest lief stabil" stand
  // unter fast jedem Feedback). Verbesserte Übungen (positive) als "stabil" zu bezeichnen ist falsch, und der
  // Vergleich jeder Übung steht ohnehin oben in der Delta-Liste - die Zeile ist nur für unauffällige Übungen da.
  if (unmentioned.some((ex) => ex.progression !== 'stable')) return null;
  return TEXTS[language === 'en' ? 'en' : 'de'];
}

/** Entfernt KI-Sammelzeilen und hängt die App-eigene an (falls berechtigt). */
export function applyRestLine(text, { exerciseAnalyses, language = 'de' } = {}) {
  const base = stripAiRestLines(text);
  const line = buildRestLine(base, exerciseAnalyses, language);
  if (!line) return base;
  return base ? `${base}\n\n${line}` : line;
}
