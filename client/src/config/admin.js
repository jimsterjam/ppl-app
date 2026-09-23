// Accounts, für die interne Admin-Werkzeuge in der App eingeblendet werden (aktuell: das
// Verifier-Protokoll in den Einstellungen). Nur Sichtbarkeit - der eigentliche Schutz liegt auf
// dem Server (Admin-Schlüssel + ADMIN_UIDS, siehe server/middleware/adminAuth.js). Eine
// Firebase-UID ist eine Kennung, kein Geheimnis, und darf deshalb im Client stehen.
// Muss zur Render-Variable ADMIN_UIDS von ppl-app-server passen.
export const ADMIN_UIDS = Object.freeze([
  '6zCFJN4TH3eqm470FiLgGBG337r2' // Paul, Testaccount
])

export function isAdminUid(uid) {
  return Boolean(uid) && ADMIN_UIDS.includes(String(uid))
}
