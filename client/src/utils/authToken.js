// Gemeinsamer Helper zum Abrufen eines Clerk JWT Tokens
// Optional kann clerk/Auth (von @clerk/vue) übergeben werden, andernfalls wird window.Clerk verwendet.
export async function getAuthToken({ clerk, auth, options } = {}) {
  const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE
  const opts = template ? { ...(options || {}), template } : (options || {})
  // 1) useClerk Session (wenn übergeben)
  try {
    const maybe = clerk?.session?.getToken
    if (typeof maybe === 'function') {
      const t = await maybe(opts)
      if (t) return t
    }
  } catch {}
  // 2) window.Clerk Fallback
  try {
    const maybe = window?.Clerk?.session?.getToken
    if (typeof maybe === 'function') {
      const t = await maybe(opts)
      if (t) return t
    }
  } catch {}
  // 3) useAuth (wenn übergeben)
  try {
    const maybe = auth?.getToken
    if (typeof maybe === 'function') {
      const t = await maybe(opts)
      if (t) return t
    }
  } catch {}
  return null
}
