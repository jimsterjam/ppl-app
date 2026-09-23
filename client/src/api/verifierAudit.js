import { createResourceApi } from './http'
import { handleAPIError } from './errorHandler'

const api = createResourceApi('admin/verifier-audit')

// Admin-only: Auswertung des Feedback-Qualitäts-Loops (siehe server/routes/adminVerifierAudit.js).
// Geschützt per Admin-Schlüssel (Header x-admin-key, derselbe localStorage-Schlüssel wie
// AiInsightsPanel.vue) UND per Login: der Server verlangt zusätzlich ein Firebase-ID-Token
// eines Accounts aus ADMIN_UIDS (siehe server/middleware/adminAuth.js requireAdminUid).

function adminHeaders(adminKey, idToken) {
  const headers = { 'x-admin-key': adminKey }
  if (idToken) headers.Authorization = `Bearer ${idToken}`
  return headers
}

export async function listVerifierAuditEntries(adminKey, { mode = '', onlyViolations = false, limit = 50, idToken = null } = {}) {
  try {
    const params = {}
    if (mode) params.mode = mode
    if (onlyViolations) params.onlyViolations = '1'
    if (limit) params.limit = limit

    const res = await api.get('/', {
      headers: adminHeaders(adminKey, idToken),
      params
    })
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Verifier-Protokoll laden', { redirectOnAuth: false })
  }
}

export async function getVerifierAuditSummary(adminKey, { days = 30, idToken = null } = {}) {
  try {
    const res = await api.get('/summary', {
      headers: adminHeaders(adminKey, idToken),
      params: { days }
    })
    return res.data || { periodDays: days, totalRuns: 0, rules: [] }
  } catch (error) {
    throw handleAPIError(error, 'Verifier-Auswertung laden', { redirectOnAuth: false })
  }
}
