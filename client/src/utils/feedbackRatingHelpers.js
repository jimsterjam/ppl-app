// Reine Helferfunktionen für AiFeedbackRatingWidget.vue - bewusst als eigenes Modul, damit sie
// ohne Vue-Component-Test-Setup (im Projekt nicht vorhanden) mit Vitest testbar sind.

export const HELPFUL_REASON_CODES = ['PROGRESS_RECOGNIZED', 'GOOD_RECOMMENDATION', 'CLEARLY_EXPLAINED', 'NOTES_CONSIDERED']

export const NOT_HELPFUL_REASON_CODES = [
  'INVENTED_INFORMATION', 'USER_NOTES_IGNORED', 'EXERCISE_OR_GOAL_MISUNDERSTOOD',
  'PROGRESS_MISJUDGED', 'RECOMMENDATION_UNSUITABLE', 'CONTRADICTS_MY_DATA', 'TOO_GENERIC', 'OTHER'
]

export function reasonCodesForRating(rating) {
  return rating === 'helpful' ? HELPFUL_REASON_CODES : NOT_HELPFUL_REASON_CODES
}

// Gibt ein NEUES Array zurück (kein In-Place-Mutate) - an oder abwählen je nachdem, ob der
// Code schon enthalten ist.
export function toggleReasonCode(selected, code) {
  const list = Array.isArray(selected) ? selected : []
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
}

// Bestimmt, ob nach einer erfolgreichen negativen Bewertung mit Korrekturtext die
// Notiz-Zuordnungs-Flow (Übung wählen + Bestätigungsfrage) angestoßen werden soll.
export function shouldOfferExerciseNote({ rating, correctionText, exerciseNames }) {
  const trimmed = String(correctionText || '').trim()
  return rating === 'not_helpful' && trimmed.length > 0 && Array.isArray(exerciseNames) && exerciseNames.length > 0
}
