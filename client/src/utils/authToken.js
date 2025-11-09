import { logger } from './logger'

// Token-Cache um wiederholte Clerk-Aufrufe zu vermeiden
let cachedToken = null
let cacheExpiry = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten
const OFFLINE_BACKOFF = 30 * 1000 // 30 Sekunden Pause bei Offline-Fehler
let lastOfflineError = 0

// Gemeinsamer Helper zum Abrufen eines Clerk JWT Tokens
// Optional kann clerk/Auth (von @clerk/vue) übergeben werden, andernfalls wird window.Clerk verwendet.
export async function getAuthToken({ clerk, auth, options } = {}) {
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
  
  const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE
  const opts = template ? { ...(options || {}), template } : (options || {})
  
  // Timeout für Clerk Token-Abruf (reduziert auf 2s)
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Auth timeout')), 2000)
  )
  
  try {
    let token = null
    
    // 1) useClerk Session (wenn übergeben)
    try {
      const maybe = clerk?.session?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t && t !== 'demo-token-for-testing') {
          token = t
          logger.debug('✅ AuthToken: Token via clerk.session erhalten')
        }
      }
    } catch (err) {
      // Bei Netzwerkfehler, markiere Offline-Status
      if (err.message?.includes('ERR_INTERNET_DISCONNECTED') || err.message?.includes('Network')) {
        lastOfflineError = Date.now()
        logger.debug('🔌 AuthToken: Offline erkannt - pausiere Token-Abrufe')
      } else {
        logger.debug('⚠️ AuthToken: clerk.session.getToken fehlgeschlagen:', err.message)
      }
    }
    
    // 2) window.Clerk Fallback (nur wenn noch kein Token)
    if (!token) {
      try {
        const maybe = window?.Clerk?.session?.getToken
        if (typeof maybe === 'function') {
          const t = await Promise.race([maybe(opts), timeout])
          if (t && t !== 'demo-token-for-testing') {
            token = t
            logger.debug('✅ AuthToken: Token via window.Clerk erhalten')
          }
        }
      } catch (err) {
        if (err.message?.includes('ERR_INTERNET_DISCONNECTED') || err.message?.includes('Network')) {
          lastOfflineError = Date.now()
        } else {
          logger.debug('⚠️ AuthToken: window.Clerk.getToken fehlgeschlagen:', err.message)
        }
      }
    }
    
    // 3) useAuth Fallback (nur wenn noch kein Token)
    if (!token) {
      try {
        const maybe = auth?.getToken
        if (typeof maybe === 'function') {
          const t = await Promise.race([maybe(opts), timeout])
          if (t && t !== 'demo-token-for-testing') {
            token = t
            logger.debug('✅ AuthToken: Token via auth.getToken erhalten')
          }
        }
      } catch (err) {
        if (err.message?.includes('ERR_INTERNET_DISCONNECTED') || err.message?.includes('Network')) {
          lastOfflineError = Date.now()
        } else {
          logger.debug('⚠️ AuthToken: auth.getToken fehlgeschlagen:', err.message)
        }
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
