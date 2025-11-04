// Zentrale API-URL-Helfer für Web & Capacitor
// - Im Web (Vite dev/prod) bleibt der Aufruf relativ über /api
// - In Capacitor (iOS/Android) sollte VITE_API_BASE gesetzt sein (z. B. https://api.meinedomain.tld)
//   Dann wird daraus: https://api.meinedomain.tld/api/<resource>

export function apiUrl(resource) {
  const base = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
  const prefix = base ? `${base}/api` : '/api'
  return `${prefix}/${resource}`
}

export function createApiBase(resource) {
  return apiUrl(resource)
}
