import { createResourceApi, resolveServerMediaUrl } from './http'
import { handleAPIError } from './errorHandler'
import { logger } from '@/utils/logger'

const PROFILE_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_PROFILE_TIMEOUT_MS || '', 10) || 25000
const PROFILE_RETRY_DELAY_MS = Number.parseInt(import.meta.env.VITE_PROFILE_RETRY_DELAY_MS || '', 10) || 1000
const api = createResourceApi('account', { timeout: PROFILE_TIMEOUT_MS })

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

function normalizeProfileData(data) {
  if (!data) return {}
  const out = { ...data }
  if (out.avatarUrl) out.avatarUrl = resolveServerMediaUrl(out.avatarUrl)
  return out
}

// Bug-Fix (User-Report: Einführungsguide startet manchmal ungefragt neu): war bisher nur 1
// Retry nach 1s - ein etwas länger anhaltender Netzwerkaussetzer beim App-Start (z.B. Wechsel
// WLAN/Mobilfunk) reichte, um in den {}-Fallback zu fallen. onboardingStore.syncFromServer()
// wertete das bisher fälschlich als "Onboarding nicht abgeschlossen" für Nutzer, die es längst
// abgeschlossen hatten. Zwei Retries mit steigendem Abstand (1s, 2s) statt nur einem senken die
// Wahrscheinlichkeit, dass ein rein transienter Aussetzer überhaupt bis zum Fallback durchschlägt.
const PROFILE_RETRY_DELAYS_MS = [PROFILE_RETRY_DELAY_MS, PROFILE_RETRY_DELAY_MS * 2]

export async function fetchAccountProfile(token) {
  let lastError = null
  for (let attempt = 0; attempt <= PROFILE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await api.get('/profile', authConfig(token))
      return normalizeProfileData(res.data)
    } catch (error) {
      lastError = error
      if (!isLikelyTransportError(error)) {
        throw handleAPIError(error, 'Profil laden')
      }
      const delay = PROFILE_RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) {
        await sleep(delay)
      }
    }
  }

  logger.warn('📡 Account API - Profil Netzwerk/Transportproblem, nutze lokalen Fallback', {
    code: lastError?.code || null,
    status: lastError?.response?.status || null,
    attempts: PROFILE_RETRY_DELAYS_MS.length + 1
  })
  return {}
}

export async function updateAccountProfile(token, payload) {
  try {
    const res = await api.put('/profile', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Profil speichern')
  }
}

export async function uploadProfileAvatar(token, file) {
  try {
    const form = new FormData()
    form.append('image', file)
    const res = await api.post('/profile/avatar', form, authConfig(token))
    return normalizeProfileData(res.data)
  } catch (error) {
    throw handleAPIError(error, 'Profilbild hochladen')
  }
}

// ---------------------------
// Onboarding-Status (siehe server/routes/account.js onboarding/*)
// ---------------------------

export async function completeOnboarding(token) {
  try {
    const res = await api.post('/onboarding/complete', {}, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Onboarding abschließen')
  }
}

export async function skipOnboarding(token) {
  try {
    const res = await api.post('/onboarding/skip', {}, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Onboarding überspringen')
  }
}

export async function restartOnboarding(token) {
  try {
    const res = await api.post('/onboarding/restart', {}, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Einführungsguide erneut starten')
  }
}

export async function dismissOnboardingHint(token, hintId) {
  try {
    const res = await api.post('/onboarding/dismiss-hint', { hintId }, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Hinweis ausblenden')
  }
}

// ---------------------------
// Datenexport (DSGVO Art. 15/20, siehe server/routes/account.js GET /export)
// ---------------------------

export async function exportAccountData(token) {
  try {
    const res = await api.get('/export', authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Daten exportieren')
  }
}

