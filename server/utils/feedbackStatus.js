// Status eines KI-Feedbacks für den Feedback-Verlauf (GET /workouts/feedbacks).
//
// 'pending' = Analyse angefragt, aber noch nicht fertig (z.B. KI-Relay im Kaltstart auf dem
// Render-Free-Plan). Der Client lädt automatisch nach (client/src/utils/feedbackTracker.js).
// Bleibt es länger als FEEDBACK_PENDING_FAILED_AFTER_MS offen, liefert die Liste 'failed' -
// dann zeigt die App "Konnte gerade nicht erstellt werden" mit "Erneut versuchen".

export const FEEDBACK_PENDING_FAILED_AFTER_MS = 30 * 60 * 1000;

export function resolveListFeedbackStatus(w, now = Date.now()) {
  if (w?.ai_feedback) return 'generated';
  const status = w?.ai_feedback_status || 'none';
  if (status !== 'pending') return status;
  const since = w?.ai_pending_since ? new Date(w.ai_pending_since).getTime() : 0;
  return since && now - since > FEEDBACK_PENDING_FAILED_AFTER_MS ? 'failed' : 'pending';
}
