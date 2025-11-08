import { logger } from './logger'

// Gemeinsamer Helper zum Abrufen eines Clerk JWT Tokens
// Optional kann clerk/Auth (von @clerk/vue) übergeben werden, andernfalls wird window.Clerk verwendet.
export async function getAuthToken({ clerk, auth, options } = {}) {
  const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE
  const opts = template ? { ...(options || {}), template } : (options || {})
  
  // Timeout für Clerk Token-Abruf (längere Timeout für bessere Stabilität)
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Auth timeout')), 3000)
  )
  
  try {
    // 1) useClerk Session (wenn übergeben)
    try {
      const maybe = clerk?.session?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t && t !== 'demo-token-for-testing') {
          logger.debug('✅ AuthToken: Token via clerk.session erhalten')
          return t
        }
      }
    } catch (err) {
      logger.debug('⚠️ AuthToken: clerk.session.getToken fehlgeschlagen:', err.message)
    }
    
    // 2) window.Clerk Fallback
    try {
      const maybe = window?.Clerk?.session?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t && t !== 'demo-token-for-testing') {
          logger.debug('✅ AuthToken: Token via window.Clerk erhalten')
          return t
        }
      }
    } catch (err) {
      logger.debug('⚠️ AuthToken: window.Clerk.getToken fehlgeschlagen:', err.message)
    }
    
    // 3) useAuth (wenn übergeben)
    try {
      const maybe = auth?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t && t !== 'demo-token-for-testing') {
          logger.debug('✅ AuthToken: Token via auth.getToken erhalten')
          return t
        }
      }
    } catch (err) {
      logger.debug('⚠️ AuthToken: auth.getToken fehlgeschlagen:', err.message)
    }
    
    // Kein Token verfügbar (offline oder nicht eingeloggt)
    logger.warn('⚠️ AuthToken: Kein gültiger Token verfügbar')
    return null
  } catch (error) {
    logger.error('❌ AuthToken: Unerwarteter Fehler:', error.message)
    return null
  }
}
