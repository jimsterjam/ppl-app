// Sprache eines gespeicherten KI-Feedbacks. Der Server merkt sie sich seit neuem (ai_feedback_language); bei älteren
// Einträgen wird sie am Text erkannt. Vergleichsteil und Coach-Text erscheinen in dieser Sprache, damit nach einem
// Wechsel der App-Sprache nichts gemischt wird (Absprache Paul 02.11.).
const DE_WORDS = new Set([
  'der', 'die', 'das', 'und', 'mit', 'nicht', 'bei', 'mehr', 'weniger', 'satz', 'sätze', 'wdh', 'heute', 'nächstes',
  'mal', 'gewicht', 'ganz', 'ist', 'dein', 'deine', 'du', 'hast', 'für', 'auf', 'ein', 'eine', 'zu', 'aber', 'noch',
  'oder', 'wenn', 'wie', 'sehr', 'gut', 'training', 'übung', 'steigerung', 'fortschritte', 'weiter', 'sauber'
])
const EN_WORDS = new Set([
  'the', 'and', 'with', 'not', 'more', 'less', 'set', 'sets', 'reps', 'today', 'next', 'time', 'weight', 'is', 'your',
  'you', 'have', 'for', 'on', 'a', 'to', 'of', 'in', 'but', 'still', 'or', 'if', 'how', 'very', 'good', 'workout',
  'exercise', 'progress', 'keep', 'going', 'clean', 'session', 'great'
])

/** @returns {'de'|'en'|null} null, wenn der Text zu kurz oder nicht eindeutig ist */
export function detectTextLanguage(text) {
  const words = String(text || '').toLowerCase().match(/[a-zäöüß]+/g) || []
  if (words.length < 4) return null
  let de = 0
  let en = 0
  for (const w of words) {
    if (DE_WORDS.has(w)) de += 1
    if (EN_WORDS.has(w)) en += 1
    if (/[äöüß]/.test(w)) de += 1
  }
  if (de === en) return null
  return de > en ? 'de' : 'en'
}

/**
 * Sprache dieses Feedbacks: gespeicherte Angabe, sonst am Text erkannt, sonst die App-Sprache.
 * @param {{ ai_feedback_language?: string|null, ai_feedback?: string }} item
 * @param {string} fallback - App-Sprache ('de' | 'en')
 */
export function resolveFeedbackLanguage(item, fallback = 'de') {
  const stored = String(item?.ai_feedback_language || '').toLowerCase()
  if (stored === 'de' || stored === 'en') return stored
  return detectTextLanguage(item?.ai_feedback) || (String(fallback).toLowerCase().startsWith('en') ? 'en' : 'de')
}
