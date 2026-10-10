import { createResourceApi } from './http'
import { logger } from '@/utils/logger'

const REPORT_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_COACH_TIMEOUT_MS || '', 10) || 20000
const api = createResourceApi('reports', { timeout: REPORT_TIMEOUT_MS })

const OK_STATUS = (status) => (status >= 200 && status < 300) || [401, 403, 404, 429].includes(status)

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Wirft nie. { status: 'ok', data } | { status: 'locked' } | { status: 'not_found' } | { status: 'rate_limited' } | { status: 'error' } */
async function call(method, url, token) {
  try {
    const res = await api.request({ url, method, headers: authHeaders(token), validateStatus: OK_STATUS })
    if (res.status === 403) return { status: 'locked' }
    if (res.status === 404) return { status: 'not_found' }
    if (res.status === 429) return { status: 'rate_limited' }
    if (res.status === 401) return { status: 'error' }
    return { status: 'ok', data: res.data || {} }
  } catch (error) {
    logger.warn('[reports] Anfrage fehlgeschlagen', { url, message: error?.message })
    return { status: 'error' }
  }
}

/** Erzeugt den Monatsbericht, wenn er fällig ist (Server entscheidet). */
export const checkMonthlyReport = (token) => call('post', '/monthly/check', token)
export const listMonthlyReports = (token) => call('get', '/monthly', token)
export const fetchMonthlyReport = (token, id) => call('get', `/monthly/${encodeURIComponent(id)}`, token)
export const markMonthlyReportSeen = (token, id) => call('post', `/monthly/${encodeURIComponent(id)}/seen`, token)
