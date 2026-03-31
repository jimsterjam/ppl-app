import { createResourceApi } from './http'
import { handleAPIError } from './errorHandler'
import { logger } from '@/utils/logger'

const SUBSCRIPTION_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_SUBSCRIPTION_TIMEOUT_MS || '', 10) || 25000
const SUBSCRIPTION_RETRY_DELAY_MS = Number.parseInt(import.meta.env.VITE_SUBSCRIPTION_RETRY_DELAY_MS || '', 10) || 1000
const api = createResourceApi('subscription', { timeout: SUBSCRIPTION_TIMEOUT_MS })

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isLikelyTransportError(error) {
  const code = String(error?.code || '').toUpperCase()
  return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || !error?.response
}

function authConfig(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

export async function fetchSubscriptionStatus(token) {
  try {
    const res = await api.get('/status', authConfig(token))
    return res.data || {}
  } catch (error) {
    if (isLikelyTransportError(error)) {
      try {
        await sleep(SUBSCRIPTION_RETRY_DELAY_MS)
        const retryRes = await api.get('/status', authConfig(token))
        return retryRes.data || {}
      } catch (retryError) {
        if (isLikelyTransportError(retryError)) {
          logger.warn('📡 Subscription API - Netzwerk/Transportproblem, nutze lokalen Fallback', {
            code: retryError?.code || null,
            status: retryError?.response?.status || null
          })
          return {}
        }
        throw handleAPIError(retryError, 'Subscription laden', { showToast: false })
      }
    }

    throw handleAPIError(error, 'Subscription laden', { showToast: false })
  }
}

export async function upgradeSubscriptionRequest(token, payload) {
  try {
    const res = await api.post('/upgrade', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Upgrade durchführen')
  }
}
