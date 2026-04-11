import { logger } from './logger'
import { useFirebaseAuth } from './firebaseAuth'
import { useAuthStore } from '@/stores/authStore'

// Token-Cache um wiederholte Firebase-Aufrufe zu vermeiden
let cachedToken = null
let cacheExpiry = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten
const OFFLINE_BACKOFF = 30 * 1000 // 30 Sekunden Pause bei Offline-Fehler
let lastOfflineError = 0

function parseTokenExpMs(token) {
  if (!token || typeof token !== 'string') return 0
  const parts = token.split('.')
  if (parts.length < 2) return 0
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    const json = JSON.parse(decoded)
    return typeof json.exp === 'number' ? json.exp * 1000 : 0
  } catch {
    return 0
  }
}

function isTokenUsable(token, skewMs = 30 * 1000) {
  const expMs = parseTokenExpMs(token)
  if (!expMs) return Boolean(token)
  return Date.now() + skewMs < expMs
}

function updateTokenCache(token) {
  if (!token) return
  const expMs = parseTokenExpMs(token)
  const fallbackExp = Date.now() + CACHE_DURATION
  cacheExpiry = expMs ? Math.min(expMs - 30 * 1000, fallbackExp) : fallbackExp
  if (cacheExpiry <= Date.now()) {
    cacheExpiry = Date.now() + 60 * 1000
  }
  cachedToken = token
}

function getStoreTokenFallback() {
  try {
    const authStore = useAuthStore()
    const token = authStore?.idToken || null
    if (token && isTokenUsable(token)) {
      logger.debug('✅ AuthToken: Verwende Fallback aus authStore')
      updateTokenCache(token)
      return token
    }
    return null
  } catch {
    return null
  }
}

// Gemeinsamer Helper zum Abrufen eines Firebase JWT Tokens
export async function getAuthToken({ options } = {}) {
  // Wenn offline und kürzlich fehlgeschlagen, nicht erneut versuchen
  if (!navigator.onLine || (Date.now() - lastOfflineError < OFFLINE_BACKOFF)) {
    logger.debug('⚠️ AuthToken: Offline oder kürzlicher Fehler - überspringe Abruf')
    if (cachedToken && isTokenUsable(cachedToken)) {
      return cachedToken
    }
    return getStoreTokenFallback()
  }

  // Cached Token zurückgeben wenn noch gültig
  if (cachedToken && Date.now() < cacheExpiry && isTokenUsable(cachedToken)) {
    logger.debug('✅ AuthToken: Verwende gecachten Token')
    return cachedToken
  }

  const timeoutPromise = (ms) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Auth timeout (${ms}ms)`)), ms)
  )

  try {
    let token = null

    // Firebase Token holen (normal)
    try {
      const { getIdToken } = useFirebaseAuth()
      const t = await Promise.race([getIdToken(false), timeoutPromise(8000)])
      if (t) {
        token = t
        logger.debug('✅ AuthToken: Token via Firebase erhalten')
      }
    } catch (err) {
      // Nur bei klaren Netzwerkfehlern Backoff setzen
      if (err.message?.includes('ERR_INTERNET_DISCONNECTED') || err.message?.includes('Network request failed')) {
        lastOfflineError = Date.now()
        logger.debug('🔌 AuthToken: Offline erkannt - pausiere Token-Abrufe')
      } else {
        logger.debug('⚠️ AuthToken: Firebase getIdToken fehlgeschlagen:', err.message)
      }
    }

    // Fallback: erzwungener Refresh
    if (!token) {
      try {
        const { getIdToken } = useFirebaseAuth()
        const refreshed = await Promise.race([getIdToken(true), timeoutPromise(12000)])
        if (refreshed) {
          token = refreshed
          logger.debug('✅ AuthToken: Token via Force-Refresh erhalten')
        }
      } catch (err) {
        if (err.message?.includes('ERR_INTERNET_DISCONNECTED') || err.message?.includes('Network request failed')) {
          lastOfflineError = Date.now()
          logger.debug('🔌 AuthToken: Offline erkannt beim Force-Refresh')
        } else {
          logger.debug('⚠️ AuthToken: Force-Refresh fehlgeschlagen:', err.message)
        }
      }
    }

    // Letzter Fallback: bereits gesetzter Store-Token
    if (!token) {
      token = getStoreTokenFallback()
    }

    // Token cachen wenn erfolgreich
    if (token && isTokenUsable(token)) {
      updateTokenCache(token)
      logger.debug('💾 AuthToken: Token gecacht')
      return token
    }

    // Kein Token verfügbar (offline oder nicht eingeloggt)
    logger.debug('⚠️ AuthToken: Kein gültiger Token verfügbar')
    return null
  } catch (error) {
    logger.error('❌ AuthToken: Unerwarteter Fehler:', error.message)
    if (cachedToken && isTokenUsable(cachedToken)) return cachedToken
    return getStoreTokenFallback()
  }
}

// Helper zum manuellen Löschen des Token-Cache (z.B. bei Logout)
export function clearTokenCache() {
  cachedToken = null
  cacheExpiry = 0
  lastOfflineError = 0
  logger.debug('🧹 AuthToken: Cache gelöscht')
}

/**
 * Liest die Firebase UID (user_id / uid / sub) direkt aus einem JWT-Token,
 * ohne einen Netzwerkaufruf zu machen.
 */
export function parseUidFromToken(token) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  const parts = raw.split('.')
  if (parts.length < 2) return ''
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    const json = JSON.parse(decoded)
    return String(json?.user_id || json?.uid || json?.sub || '').trim()
  } catch {
    return ''
  }
}
