import { createResourceApi } from './http'
import { handleAPIError } from './errorHandler'

const api = createResourceApi('admin/verifier-audit')

// Admin-only: Auswertung des Feedback-Qualitäts-Loops (siehe server/routes/adminVerifierAudit.js).
// Geschützt per Admin-Schlüssel (Header x-admin-key), analog zu api/feedback.js und
// api/feedbackInsights.js - nutzt denselben localStorage-Schlüssel (siehe AiInsightsPanel.vue).

export async function listVerifierAuditEntries(adminKey, { mode = '', onlyViolations = false, limit = 50 } = {}) {
  try {
    const params = {}
    if (mode) params.mode = mode
    if (onlyViolations) params.onlyViolations = '1'
    if (limit) params.limit = limit

    const res = await api.get('/', {
      headers: { 'x-admin-key': adminKey },
      params
    })
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Verifier-Protokoll laden', { redirectOnAuth: false })
  }
}

export async function getVerifierAuditSummary(adminKey, { days = 30 } = {}) {
  try {
    const res = await api.get('/summary', {
      headers: { 'x-admin-key': adminKey },
      params: { days }
    })
    return res.data || { periodDays: days, totalRuns: 0, rules: [] }
  } catch (error) {
    throw handleAPIError(error, 'Verifier-Auswertung laden', { redirectOnAuth: false })
  }
}
