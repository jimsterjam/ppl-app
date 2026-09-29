// Regeln für das automatische Nachladen von KI-Feedback (feedbackTracker.js) - ohne Imports,
// damit sie direkt testbar sind.

// Wartezeit vor dem n-ten erneuten Versuch (danach bleibt es beim letzten Wert).
export const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 240_000, 480_000, 600_000]
// Muss zu FEEDBACK_PENDING_FAILED_AFTER_MS auf dem Server passen.
export const GIVE_UP_AFTER_MS = 30 * 60 * 1000
// Server weckt ggf. erst den Relay (bis ~100 s) und generiert dann - großzügig bemessen.
export const REQUEST_TIMEOUT_MS = 150_000

export function nextDelayMs(attempts = 0) {
  return RETRY_DELAYS_MS[Math.min(Math.max(0, attempts), RETRY_DELAYS_MS.length - 1)]
}

/** 'ready' = Feedback da, 'final' = kommt nicht (nicht genug Verlauf, Kontingent), 'retry' = später erneut */
export function classifyFeedbackResponse(data) {
  if (data?.ai_feedback) return 'ready'
  if (data?.feedback_status === 'insufficient_history' || data?.feedback_status === 'quota_limited') return 'final'
  return 'retry'
}

/** Fehler, bei denen ein erneuter Versuch nichts bringt (Workout weg / gehört anderem Konto). */
export function isFinalHttpError(status) {
  // 401 bewusst NICHT: abgelaufenes Token -> beim nächsten Versuch neu holen.
  return status === 400 || status === 403 || status === 404
}

