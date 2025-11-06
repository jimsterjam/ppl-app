import { logger } from './logger'

// Gemeinsamer Helper zum Abrufen eines Clerk JWT Tokens
// Optional kann clerk/Auth (von @clerk/vue) übergeben werden, andernfalls wird window.Clerk verwendet.
export async function getAuthToken({ clerk, auth, options } = {}) {
  const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE
  const opts = template ? { ...(options || {}), template } : (options || {})
  
  // Timeout für Demo-Modus
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Auth timeout')), 1000)
  )
  
  try {
    // 1) useClerk Session (wenn übergeben)
    try {
      const maybe = clerk?.session?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t) return t
      }
    } catch {}
    
    // 2) window.Clerk Fallback
    try {
      const maybe = window?.Clerk?.session?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t) return t
      }
    } catch {}
    
    // 3) useAuth (wenn übergeben)
    try {
      const maybe = auth?.getToken
      if (typeof maybe === 'function') {
        const t = await Promise.race([maybe(opts), timeout])
        if (t) return t
      }
    } catch {}
    
    logger.debug('AuthToken: No valid auth found, returning demo token')
    return 'demo-token-for-testing'
  } catch (error) {
    logger.debug('AuthToken: Error or timeout, returning demo token:', error.message)
    return 'demo-token-for-testing'
  }
}
