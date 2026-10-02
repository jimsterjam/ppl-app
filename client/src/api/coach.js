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

/**
 * "Ist so geplant" (planned = true) bzw. Bestätigung zurücknehmen (planned = false).
 * Schickt nur Schlüssel und Ursache aus der Diagnose - keinen freien Text.
 * @returns {Promise<boolean>} true bei Erfolg
 */
export async function setDiagnosisPlanned(token, { key, cause }, planned) {
  try {
    const res = await api.request({
      url: '/diagnosis/ack',
      method: planned ? 'post' : 'delete',
      data: { key, cause },
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return res.status >= 200 && res.status < 300 && res.data?.ok === true
  } catch (error) {
    logger.warn('[coach] "Ist so geplant" konnte nicht gespeichert werden', { status: error?.response?.status || null })
    return false
  }
}
