import { logger } from './logger'
import { useFirebaseAuth } from './firebaseAuth'

// Token-Cache um wiederholte Firebase-Aufrufe zu vermeiden
let cachedToken = null
let cacheExpiry = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten
const OFFLINE_BACKOFF = 30 * 1000 // 30 Sekunden Pause bei Offline-Fehler
let lastOfflineError = 0

// Gemeinsamer Helper zum Abrufen eines Firebase JWT Tokens
export async function getAuthToken({ options } = {}) {
  // Wenn offline und kürzlich fehlgeschlagen, nicht erneut versuchen
  if (!navigator.onLine || (Date.now() - lastOfflineError < OFFLINE_BACKOFF)) {
    logger.debug('⚠️ AuthToken: Offline oder kürzlicher Fehler - überspringe Abruf')
    return cachedToken || null
  }

  // Cached Token zurückgeben wenn noch gültig
  if (cachedToken && Date.now() < cacheExpiry) {
    logger.debug('✅ AuthToken: Verwende gecachten Token')
    return cachedToken
  }

  // Timeout für Firebase Token-Abruf (erhöht auf 4s)
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Auth timeout')), 4000)
  )

  try {
    let token = null

    // Firebase Token holen
    try {
      const { getIdToken } = useFirebaseAuth()
      const t = await Promise.race([getIdToken(), timeout])
      if (t) {
        token = t
        logger.debug('✅ AuthToken: Token via Firebase erhalten')
      }
    } catch (err) {
      // Bei Netzwerkfehler, markiere Offline-Status
      if (err.message?.includes('ERR_INTERNET_DISCONNECTED') || err.message?.includes('Network') || err.message?.includes('timeout')) {
        lastOfflineError = Date.now()
        logger.debug('🔌 AuthToken: Offline erkannt - pausiere Token-Abrufe')
      } else {
        logger.debug('⚠️ AuthToken: Firebase getIdToken fehlgeschlagen:', err.message)
      }
    }

    // Token cachen wenn erfolgreich
    if (token) {
      cachedToken = token
      cacheExpiry = Date.now() + CACHE_DURATION
      logger.debug('💾 AuthToken: Token gecacht für 5 Minuten')
      return token
    }

    // Kein Token verfügbar (offline oder nicht eingeloggt)
    logger.debug('⚠️ AuthToken: Kein gültiger Token verfügbar')
    return cachedToken || null // Gib alten Cache zurück falls vorhanden
  } catch (error) {
    logger.error('❌ AuthToken: Unerwarteter Fehler:', error.message)
    return cachedToken || null
  }
}

// Helper zum manuellen Löschen des Token-Cache (z.B. bei Logout)
export function clearTokenCache() {
  cachedToken = null
  cacheExpiry = 0
  lastOfflineError = 0
  logger.debug('🧹 AuthToken: Cache gelöscht')
}
