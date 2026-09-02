/**
 * feedbackRatingService
 *
 * Reine Funktionen für die Bewertungsfunktion des KI-Workout-Feedbacks (Prompt
 * "Bewertungsfunktion für KI-Workout-Feedback"). Keine DB-Zugriffe - die Route
 * (routes/workouts.js) lädt/speichert FeedbackRating/FeedbackQualitySignal und ruft diese
 * Funktionen für Validierung, Status-Übergang und den anonymisierten Signal-Aufbau auf.
 */

export const POSITIVE_REASON_CODES = [
  'PROGRESS_RECOGNIZED',
  'GOOD_RECOMMENDATION',
  'CLEARLY_EXPLAINED',
  'NOTES_CONSIDERED'
];

export const NEGATIVE_REASON_CODES = [
  'INVENTED_INFORMATION',
  'USER_NOTES_IGNORED',
  'EXERCISE_OR_GOAL_MISUNDERSTOOD',
  'PROGRESS_MISJUDGED',
  'RECOMMENDATION_UNSUITABLE',
  'CONTRADICTS_MY_DATA',
  'TOO_GENERIC',
  'OTHER'
];

export const RATING_VALUES = ['helpful', 'not_helpful'];

/**
 * Baut die feedbackVersion aus den bereits vorhandenen Workout-Feldern (ai_generated_at +
 * Modell) - kein neues gespeichertes Feld nötig, muss aber konsistent aus denselben Werten
 * gebildet werden, egal ob beim Erzeugen (POST /:id/ai-analysis) oder späteren Abrufen
 * (GET /feedbacks) berechnet.
 *
 * @param {Object} params
 * @param {Date|string} params.aiGeneratedAt
 * @param {string} [params.model]
 * @returns {string}
 */
export function buildFeedbackVersion({ aiGeneratedAt, model } = {}) {
  const timestamp = aiGeneratedAt ? new Date(aiGeneratedAt).toISOString() : 'unknown';
  return `${model || 'unknown-model'}:${timestamp}`;
}

/**
 * Validiert eine eingehende Bewertungs-Payload. Gibt bei Fehlern eine Liste von
 * Fehlermeldungen zurück (leer = gültig) statt zu werfen, damit die Route selbst
 * entscheidet, wie sie den Fehler beantwortet.
 *
 * @param {Object} payload
 * @param {string} payload.rating
 * @param {string[]} [payload.reasonCodes]
 * @param {string} [payload.correctionText]
 * @returns {string[]} Fehlermeldungen (leer = gültig)
 */
export function validateRatingPayload({ rating, reasonCodes = [], correctionText } = {}) {
  const errors = [];

  if (!RATING_VALUES.includes(rating)) {
    errors.push(`rating muss einer von ${RATING_VALUES.join(', ')} sein`);
  }

  if (reasonCodes && !Array.isArray(reasonCodes)) {
    errors.push('reasonCodes muss ein Array sein');
  } else if (Array.isArray(reasonCodes)) {
    const allowed = rating === 'helpful' ? POSITIVE_REASON_CODES : NEGATIVE_REASON_CODES;
    const unknown = reasonCodes.filter((code) => !allowed.includes(code));
    if (unknown.length > 0) {
      errors.push(`Unbekannte reasonCodes für rating="${rating}": ${unknown.join(', ')}`);
    }
  }

  if (correctionText != null && typeof correctionText !== 'string') {
    errors.push('correctionText muss ein String sein');
  } else if (typeof correctionText === 'string' && correctionText.length > 1000) {
    errors.push('correctionText ist zu lang (max. 1000 Zeichen)');
  }

  return errors;
}

/**
 * Bestimmt den nächsten Status für eine Bewertung.
 * - Neuer Datensatz -> 'active'
 * - Bestehender aktiver/geänderter Datensatz wird erneut gespeichert -> 'edited'
 * - Löschung -> 'deleted' (unabhängig vom vorherigen Status)
 *
 * @param {string|null} previousStatus - Status des bestehenden Dokuments, oder null wenn neu
 * @param {'save'|'delete'} action
 * @returns {'active'|'edited'|'deleted'}
 */
export function nextRatingStatus(previousStatus, action) {
  if (action === 'delete') return 'deleted';
  if (!previousStatus || previousStatus === 'deleted') return 'active';
  return 'edited';
}

/**
 * Bewertungen mit diesem Status zählen für Statistiken/Anzeige als "aktuell gültig".
 * Gelöschte oder ersetzte (durch eine neuere Version überschriebene) Bewertungen fließen
 * NICHT ein (Prompt-Vorgabe).
 *
 * @param {string} status
 * @returns {boolean}
 */
export function isCountedStatus(status) {
  return status === 'active' || status === 'edited';
}

/**
 * Baut den anonymisierten Eintrag für FeedbackQualitySignal aus einer Bewertung. Enthält
 * bewusst NIE userId, feedbackId oder correctionText - siehe Verbotsliste im Prompt und
 * Kommentar in FeedbackQualitySignal.js.
 *
 * @param {Object} rating
 * @param {string} rating.feedbackVersion
 * @param {string} rating.rating
 * @param {string[]} [rating.reasonCodes]
 * @returns {Object}
 */
export function buildQualitySignal({ feedbackVersion, rating, reasonCodes = [] }) {
  return {
    feedbackVersion,
    rating,
    reasonCodes: Array.isArray(reasonCodes) ? [...reasonCodes] : [],
    // Absichtlich noch nicht befüllt - siehe FeedbackQualitySignal.js.
    reportedStatementCategory: null,
    exerciseCategory: null
  };
}

/**
 * Löscht Signale niemals aus der Anonymisierungs-Historie (siehe FeedbackQualitySignal.js) -
 * ein Delete/Edit einer persönlichen Bewertung erzeugt daher KEIN neues Signal für 'delete',
 * nur für eine tatsächliche (neue oder geänderte) Bewertung. Diese Funktion kapselt genau
 * diese Entscheidung, damit die Route sie nicht implizit trifft.
 *
 * @param {'save'|'delete'} action
 * @returns {boolean}
 */
export function shouldWriteQualitySignal(action) {
  return action === 'save';
}

export default {
  POSITIVE_REASON_CODES,
  NEGATIVE_REASON_CODES,
  RATING_VALUES,
  buildFeedbackVersion,
  validateRatingPayload,
  nextRatingStatus,
  isCountedStatus,
  buildQualitySignal,
  shouldWriteQualitySignal
};
