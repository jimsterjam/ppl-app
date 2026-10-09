// Fakten kommen vom Code, die KI liefert nur die Einordnung.
//
// User-Reports 04./08.10.: Der KI-Text nannte "auf 27,5 kg gesteigert" (Zahl nicht in den Daten)
// und "Wiederholungen in Satz 7 von 6 auf 5 gesunken" (Backend: 6 -> 6). Eine reine Zahlenprüfung
// reicht nicht: Ziffern wie 5 und 6 kommen in den Daten vor, ob sie zum genannten Satz und zur
// Richtung passen, prüft sie nicht. Deshalb gilt jetzt (siehe FAKTEN-REGEL in
// OpenAIProvider.getCoachSystemPromptText):
//   - Alle Aussagen zu Gewicht, Wiederholungen, Sätzen und Volumen (Zahlen, Satznummern,
//     Richtung der Veränderung) zeigt die App selbst, aus der Satz-Berechnung des Backends
//     (ai_analysis_snapshot -> client/src/utils/deltaSentence.js).
//   - Der KI-Text darf keine solche Aussage enthalten. Diese Datei erzwingt das deterministisch:
//     Zeilen mit Ziffern, Zahlwörtern, Mess-Vokabular oder Richtungswörtern werden entfernt.
//     Was übrig bleibt, ist reine Einschätzung ("läuft", "solide") - die kann keine falsche Zahl
//     und keinen falschen Satz mehr behaupten.

const MEASURE_WORDS = [
  // Deutsch
  'gewicht', 'wiederholung', 'wdh', 'sätze', 'satz', 'satzzahl', 'volumen', 'prozent', 'kilo',
  'kilogramm', 'kg', 'last', 'lasten', 'zusatzgewicht',
  // Englisch
  'weight', 'weights', 'bodyweight', 'rep', 'reps', 'repetition', 'repetitions', 'set', 'sets',
  'volume', 'volumes', 'percent', 'load', 'loads', 'kilos', 'lbs', 'pounds'
];

const DIRECTION_WORDS = [
  // Deutsch (Stämme, per Präfix geprüft)
  'mehr', 'weniger', 'höher', 'niedriger', 'schwerer', 'leichter', 'steiger', 'stieg', 'gestiegen',
  'erhöh', 'reduzier', 'gesunken', 'gesenkt', 'gefallen', 'zugelegt', 'abgenommen', 'rückgang',
  'verbessert', 'verschlechtert', 'unverändert', 'gleichgeblieben', 'konstant',
  // Englisch
  'more', 'fewer', 'less', 'higher', 'lower', 'heavier', 'lighter', 'increas', 'decreas', 'rose',
  'risen', 'dropped', 'fell', 'gained', 'improved', 'declined', 'unchanged'
];

// Zahlwörter (ohne Artikel "ein/eine" - die sind im Deutschen zu häufig; "eine Wiederholung"
// fängt das Mess-Vokabular ab).
const NUMBER_WORDS = [
  'zwei', 'zwo', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf',
  'zwanzig', 'dreißig', 'hundert', 'halb', 'doppelt', 'verdoppelt',
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'twenty', 'hundred', 'half', 'double', 'twice', 'doubled'
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()[\]\\]/g, '\\$&');
}

const WORD_CHAR = 'A-Za-zÄÖÜäöüß';
// Deutsche Mess-Wörter auch als Wortbestandteil ("Körpergewicht", "Zusatzgewicht"). Alle anderen
// (last, set, rep, kg, weight ...) brauchen echte Wortgrenzen, sonst träfe "Belastung", "Reset",
// "Repertoire" oder der Übungsname "Weighted ...".
const SUBSTRING_MEASURE = ['gewicht', 'wiederholung', 'volumen', 'prozent'];
const BOUNDED_MEASURE = MEASURE_WORDS.filter((w) => !SUBSTRING_MEASURE.includes(w));

const MEASURE_SUBSTRING_RE = new RegExp(SUBSTRING_MEASURE.map(escapeRegExp).join('|'), 'i');
const MEASURE_BOUNDED_RE = new RegExp(
  `(?<![${WORD_CHAR}])(?:${BOUNDED_MEASURE.map(escapeRegExp).join('|')})(?![${WORD_CHAR}])`,
  'i'
);
const NUMBER_WORD_RE = new RegExp(
  `(?<![${WORD_CHAR}])(?:${NUMBER_WORDS.map(escapeRegExp).join('|')})(?![${WORD_CHAR}])`,
  'i'
);
// Richtungswörter als Wortanfang (steiger -> steigern/Steigerung/gesteigert braucht 'gesteiger').
const DIRECTION_RE = new RegExp(
  `(?<![${WORD_CHAR}])(?:ge)?(?:${DIRECTION_WORDS.map(escapeRegExp).join('|')})`,
  'i'
);
const DIGIT_RE = /\d/;

/**
 * Warum ist diese Zeile eine (mögliche) Faktenaussage? null = Zeile ist reine Einschätzung.
 * @param {string} line
 * @param {string[]} exerciseNames - Übungsnamen, die vorher entfernt werden ("Weighted Pull-Up"
 *   enthält "weight", "21s Curl" eine Ziffer).
 */
export function findFactClaim(line, exerciseNames = []) {
  let text = String(line ?? '');
  const names = [...new Set((exerciseNames || []).map((n) => String(n || '').trim()).filter((n) => n.length >= 3))]
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    text = text.replace(new RegExp(escapeRegExp(name), 'gi'), ' ');
  }
  if (DIGIT_RE.test(text)) return 'digit';
  if (NUMBER_WORD_RE.test(text)) return 'number_word';
  if (MEASURE_SUBSTRING_RE.test(text) || MEASURE_BOUNDED_RE.test(text)) return 'measure_word';
  if (DIRECTION_RE.test(text)) return 'direction_word';
  return null;
}

const FALLBACK_TEXT = {
  de: 'Deine Auswertung steht oben: Dort siehst du, was sich zur letzten Session verändert hat.',
  en: 'Your summary is above: it shows what changed since your last session.'
};

export function fallbackFeedbackText(language = 'de') {
  return language === 'en' ? FALLBACK_TEXT.en : FALLBACK_TEXT.de;
}

/**
 * Entfernt alle Zeilen des KI-Textes, die eine Faktenaussage enthalten könnten.
 *
 * @param {string} feedbackText - KI-Text
 * @param {{ language?: 'de'|'en', exerciseNames?: string[] }} [options]
 * @returns {{ text: string, droppedLines: number, reasons: string[], allDropped: boolean }}
 *   allDropped = true: nichts blieb übrig, text ist der feste Hinweis (fallbackFeedbackText).
 */
export function sanitizeCoachText(feedbackText, { language = 'de', exerciseNames = [] } = {}) {
  const lines = String(feedbackText ?? '').split('\n');
  const kept = [];
  const reasons = [];
  let droppedLines = 0;
  let contentLines = 0;

  for (const line of lines) {
    if (!line.trim()) {
      kept.push('');
      continue;
    }
    contentLines += 1;
    const reason = findFactClaim(line, exerciseNames);
    if (reason) {
      droppedLines += 1;
      reasons.push(reason);
    } else {
      kept.push(line);
    }
  }

  let text = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Einstieg endete auf ":" und die Aufzählung dahinter wurde entfernt.
  const lastLine = text.split('\n').filter((l) => l.trim()).pop() || '';
  if (/:\s*$/.test(lastLine)) text = text.replace(/:\s*$/, '.');

  if (!text) {
    return { text: fallbackFeedbackText(language), droppedLines, reasons, allDropped: contentLines > 0 };
  }
  return { text, droppedLines, reasons, allDropped: false };
}

function formatNumber(value, language) {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: 2 }).format(Math.abs(value));
}

/**
 * Körpergewicht-Gegenüberstellung als feste Zeile (vorher schrieb die KI sie; Zahlen gehören jetzt
 * dem Code). Reine Fakten, keine Wertung und keine Ursache.
 *
 * @param {Object|null} correlation - Ergebnis von resolveBodyweightCorrelation()
 * @param {'de'|'en'} language
 * @returns {string|null}
 */
export function buildBodyweightFactLine(correlation, language = 'de') {
  if (!correlation || typeof correlation !== 'object') return null;
  const { current_bodyweight_kg: now, bodyweight_change_kg: change, period_days: days, strength_context: ctx } = correlation;
  if (!Number.isFinite(now) || !Number.isFinite(change) || !Number.isFinite(days)) return null;

  const en = language === 'en';
  const dayText = en ? `${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  const sign = change > 0 ? '+' : change < 0 ? '−' : '±';
  const head = en
    ? `Bodyweight: ${sign}${formatNumber(change, language)} kg in ${dayText} (now ${formatNumber(now, language)} kg).`
    : `Körpergewicht: ${sign}${formatNumber(change, language)} kg in ${dayText} (jetzt ${formatNumber(now, language)} kg).`;

  const compared = Number(ctx?.exercises_compared);
  if (!Number.isFinite(compared) || compared <= 0) return head;
  const up = Number(ctx.exercises_with_weight_increase) || 0;
  const down = Number(ctx.exercises_with_weight_decrease) || 0;
  const same = Number(ctx.exercises_stable) || 0;
  const tail = en
    ? ` Training weight this session, ${compared} compared ${compared === 1 ? 'exercise' : 'exercises'}: up in ${up}, down in ${down}, unchanged in ${same}.`
    : ` Trainingsgewicht in dieser Session, ${compared} verglichene ${compared === 1 ? 'Übung' : 'Übungen'}: gestiegen bei ${up}, gesunken bei ${down}, gleich bei ${same}.`;
  return head + tail;
}
