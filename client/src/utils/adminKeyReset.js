// Admin-Schlüssel der Admin-Panels (AdminFeedbackPanel, VerifierAuditPanel, AiInsightsPanel): wird bei Abmeldung/Kontowechsel
// aus dem localStorage gelöscht UND in den noch gemounteten Panels geleert, sonst würden sie ihn beim nächsten Laden wieder
// speichern (Absprache Paul 06.11.2026).
import { getCurrentInstance, onUnmounted } from 'vue'

export const ADMIN_KEY_STORAGE_KEY = 'admin_feedback_key'
export const ADMIN_KEY_CLEARED_EVENT = 'ppl-admin-key-cleared'

/** Löscht den gemerkten Schlüssel und teilt es den offenen Panels mit. */
export function clearAdminKey() {
  try { localStorage.removeItem(ADMIN_KEY_STORAGE_KEY) } catch { /* optional */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(ADMIN_KEY_CLEARED_EVENT))
    }
  } catch { /* optional */ }
}

/**
 * Im Panel aufrufen: leert das Eingabefeld, sobald der Schlüssel gelöscht wurde. Gibt die Abmeldefunktion zurück.
 * @param {{ value: string }} keyRef
 */
export function clearAdminKeyRefOnReset(keyRef) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {}
  const handler = () => { keyRef.value = '' }
  window.addEventListener(ADMIN_KEY_CLEARED_EVENT, handler)
  const stop = () => window.removeEventListener(ADMIN_KEY_CLEARED_EVENT, handler)
  if (getCurrentInstance()) onUnmounted(stop)
  return stop
}
