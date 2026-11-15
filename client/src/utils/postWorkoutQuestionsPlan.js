// Entscheidet, OB und WIE nach dem Training gefragt wird (Backlog F16, Absprache Jimmy 14.11.): Keine Fragen ohne Feedback.
// Reine Funktion - alles, was von Konto, Einwilligung und Gerät abhängt, kommt als Parameter herein (testbar).
import { detectQuestionTopics } from '@/utils/postWorkoutQuestions'
import { buildQuestionInput } from '@/utils/postWorkoutQuestionsInput'

/**
 * @param {object} p
 * @param {boolean} p.enabled - Schalter in den Einstellungen
 * @param {boolean} p.consentGranted - KI-Einwilligung vorhanden (aktuelle Version)
 * @param {boolean} p.quotaExhausted - KI-Kontingent leer (es gäbe kein Feedback)
 * @param {boolean} [p.edited] - nachträglich bearbeitetes Workout: keine automatische Auswertung, also keine Fragen
 * @param {object|null} p.workout - das gespeicherte Workout
 * @param {Array} p.history
 * @param {Array} p.catalog
 * @param {string[]} [p.currentIds]
 * @param {string} [p.fallbackGoal]
 * @param {boolean} p.offerTurnOff - mehrmals in Folge übersprungen: Ausschalten anbieten
 * @param {boolean} p.introSeen - Erklärung schon gezeigt
 * @returns {null | { topics: Array, phase: 'offer'|'intro'|'ask' }}
 */
export function planQuestions({
  enabled, consentGranted, quotaExhausted, edited = false, workout, history = [], catalog = [], currentIds = [],
  fallbackGoal = '', offerTurnOff = false, introSeen = false
} = {}) {
  if (!enabled || !consentGranted || quotaExhausted || edited || !workout) return null
  const topics = detectQuestionTopics(buildQuestionInput({ workout, history, catalog, currentIds, fallbackGoal }))
  if (!topics.length) return null
  return { topics, phase: offerTurnOff ? 'offer' : introSeen ? 'ask' : 'intro' }
}
