import { createResourceApi } from './http'
import { handleAPIError } from './errorHandler'

const api = createResourceApi('admin/feedback-insights')

// Admin-only: KI-Analyse negativ bewerteter KI-Trainingsfeedbacks -> Verbesserungsvorschläge
// für den Analyse-System-Prompt (siehe server/routes/adminFeedbackInsights.js). Geschützt per
// Admin-Schlüssel (Header x-admin-key), NICHT per normalem Firebase-Login - analog zu
// api/feedback.js listAppFeedback().

export async function listInsightProposals(adminKey, { status = '', limit = 50 } = {}) {
  try {
    const params = {}
    if (status) params.status = status
    if (limit) params.limit = limit

    const res = await api.get('/', {
      headers: { 'x-admin-key': adminKey },
      params
    })
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Verbesserungsvorschläge laden', { redirectOnAuth: false })
  }
}

export async function analyzeFeedbackInsights(adminKey) {
  try {
    const res = await api.post('/analyze', {}, {
      headers: { 'x-admin-key': adminKey }
    })
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Feedback-Analyse starten', { redirectOnAuth: false })
  }
}

export async function updateInsightProposal(adminKey, id, { status, reviewNote = '' } = {}) {
  try {
    const res = await api.patch(`/${encodeURIComponent(id)}`, { status, reviewNote }, {
      headers: { 'x-admin-key': adminKey }
    })
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Vorschlag aktualisieren', { redirectOnAuth: false })
  }
}
