import { createResourceApi } from './http'
import { handleAPIError } from './errorHandler'

const api = createResourceApi('feedback')

function authConfig(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

// Allgemeines App-Feedback (Fehler/Idee/Unklarheit) - siehe server/routes/feedback.js.
// KOMPLETT GETRENNT von der Bewertung einzelner KI-Feedbacks (api/feedbackRatings.js), siehe
// Kommentar dort und im Server-Model AppFeedback.js.
export async function submitAppFeedback(token, { category, text = '', context = null, consentGiven = false }) {
  try {
    const res = await api.post('/', { category, text, context, consentGiven }, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Feedback senden')
  }
}
