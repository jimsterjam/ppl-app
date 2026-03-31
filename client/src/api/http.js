// Zentrale API-URL-Helfer für Web & Capacitor
// - Im Web (Vite dev/prod) bleibt der Aufruf relativ über /api
// - In Capacitor (iOS/Android) sollte VITE_API_BASE gesetzt sein (z. B. https://api.meinedomain.tld)
//   Dann wird daraus: https://api.meinedomain.tld/api/<resource>

import axios from 'axios';

function normalizeBase(base = '') {
  return String(base || '').trim().replace(/\/$/, '')
}

function isRetryableTransportError(error) {
  const status = Number(error?.response?.status || 0)
  const code = String(error?.code || '').toUpperCase()
  return status === 0 || [408, 425, 429, 500, 502, 503, 504].includes(status) || code === 'ERR_NETWORK' || code === 'ECONNABORTED' || !error?.response
}

function uniq(values = []) {
  const out = []
  for (const value of values) {
    if (!value || out.includes(value)) continue
    out.push(value)
  }
  return out
}

function getConfiguredApiPrefixes() {
  const primary = normalizeBase(import.meta.env?.VITE_API_BASE || '')
  const fallbackRaw = String(import.meta.env?.VITE_API_BASE_FALLBACKS || '')
  const fallbacks = fallbackRaw
    .split(',')
    .map(normalizeBase)
    .filter(Boolean)

  const bases = uniq([primary, ...fallbacks].filter(Boolean))
  if (bases.length === 0) return ['/api']
  return bases.map((base) => `${base}/api`)
}

const API_PREFIXES = getConfiguredApiPrefixes()

function createFallbackAxios(baseCandidates, config = {}) {
  const candidates = Array.isArray(baseCandidates) && baseCandidates.length > 0
    ? baseCandidates
    : ['/api']

  const stickyEnabled = String(import.meta.env?.VITE_API_BASE_STICKY_ENABLED || '1').trim() !== '0'
  const stickyKey = `bro_split_api_base_idx:${candidates.join('|')}`
  let preferredIndex = 0

  if (stickyEnabled && typeof sessionStorage !== 'undefined') {
    try {
      const stored = Number(sessionStorage.getItem(stickyKey) || 0)
      if (Number.isFinite(stored) && stored >= 0 && stored < candidates.length) {
        preferredIndex = stored
      }
    } catch {}
  }

  const setPreferredIndex = (index) => {
    const safe = Math.max(0, Math.min(Number(index) || 0, candidates.length - 1))
    preferredIndex = safe
    if (stickyEnabled && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(stickyKey, String(safe))
      } catch {}
    }
  }

  const instance = axios.create({
    baseURL: candidates[0],
    withCredentials: true,
    ...config
  })

  instance.interceptors.request.use((req) => {
    if (!req) return req
    const hasIndex = Number.isFinite(Number(req.__apiBaseIndex))
    const index = hasIndex ? Number(req.__apiBaseIndex) : preferredIndex
    const safeIndex = Math.max(0, Math.min(index, candidates.length - 1))
    req.__apiBaseIndex = safeIndex
    req.baseURL = candidates[safeIndex]
    return req
  })

  instance.interceptors.response.use(
    (response) => {
      const usedIndex = Number(response?.config?.__apiBaseIndex || 0)
      if (Number.isFinite(usedIndex)) {
        setPreferredIndex(usedIndex)
      }
      return response
    },
    async (error) => {
      const req = error?.config
      if (!req || !isRetryableTransportError(error)) throw error

      const currentIndex = Number(req.__apiBaseIndex || 0)
      const nextIndex = currentIndex + 1
      if (nextIndex >= candidates.length) throw error

      req.__apiBaseIndex = nextIndex
      req.baseURL = candidates[nextIndex]
      return instance.request(req)
    }
  )

  return instance
}

export function apiUrl(resource, index = 0) {
  const safeIndex = Math.max(0, Math.min(Number(index) || 0, API_PREFIXES.length - 1))
  return `${API_PREFIXES[safeIndex]}/${resource}`
}

export function apiUrls(resource) {
  return API_PREFIXES.map((prefix) => `${prefix}/${resource}`)
}

export const http = createFallbackAxios(API_PREFIXES, { withCredentials: true })

export function createResourceApi(resource, options = {}) {
  const resourceUrls = apiUrls(resource)
  return createFallbackAxios(resourceUrls, options)
}

export function createApiBase(resource) {
  return apiUrl(resource)
}
