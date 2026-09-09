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

// ---------------------------------------------------------------------------
// Admin-Übersicht: liest gesammeltes App-Feedback (siehe server/routes/feedback.js GET /).
// Geschützt per statischem Schlüssel (Header x-admin-key), NICHT per normalem Firebase-Login -
// bewusst getrennt, da hier userübergreifend gelesen wird. Siehe AdminFeedbackView.vue.
export async function listAppFeedback(adminKey, { category = '', status = '', limit = 100 } = {}) {
  try {
    const params = {}
    if (category) params.category = category
    if (status) params.status = status
    if (limit) params.limit = limit

    const res = await api.get('/', {
      headers: { 'x-admin-key': adminKey },
      params
    })
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    // redirectOnAuth: false - bei falschem/leerem Admin-Schlüssel (401) soll der Nutzer auf der
    // Admin-Seite bleiben und den Schlüssel korrigieren können, statt zur Welcome-Seite
    // weitergeleitet zu werden (das ist kein normaler Firebase-Login-401).
    throw handleAPIError(error, 'Feedback-Übersicht laden', { redirectOnAuth: false })
  }
}
