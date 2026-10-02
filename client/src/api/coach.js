import { createResourceApi } from './http'
import { logger } from '@/utils/logger'

const COACH_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_COACH_TIMEOUT_MS || '', 10) || 20000
const api = createResourceApi('coach', { timeout: COACH_TIMEOUT_MS })

/**
 * Stillstand-Diagnose (Pro). Wirft nie - gibt immer einen Status zurück:
 * { status: 'ok', data } | { status: 'locked' } | { status: 'rate_limited', retryAfter } | { status: 'error' }
 */
export async function fetchStagnationDiagnosis(token) {
  try {
    const res = await api.get('/diagnosis', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      validateStatus: (status) => (status >= 200 && status < 300) || [401, 403, 429].includes(status)
    })
    if (res.status === 403) return { status: 'locked' }
    if (res.status === 429) return { status: 'rate_limited', retryAfter: Number(res.data?.retryAfter) || 60 }
    if (res.status === 401) return { status: 'error' }
    return { status: 'ok', data: res.data || {} }
  } catch (error) {
    logger.warn('[coach] Diagnose konnte nicht geladen werden', { message: error?.message })
    return { status: 'error' }
  }
}
