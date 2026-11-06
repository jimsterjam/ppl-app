// Kontowechsel: Einstellungen des angemeldeten Kontos laden bzw. beim Abmelden auf Standardwerte zurück (Absprache Paul
// 06.11.2026, siehe utils/userScopedStorage.js). Aufgerufen in main.js bei jeder Änderung des Anmeldezustands.
//
// Zusätzlich (Absprache Paul 06.11.2026, zweite Gruppe): Beim Abmelden und beim Wechsel auf ein anderes Konto werden laufende
// Zustände beendet (Pause, Aufwärm-Timer, Übergang, Timer, Stoppuhr; geplante Mitteilungen werden zurückgenommen) und
// geräteweit gemerkte Admin-Schlüssel gelöscht. Bei einem Kaltstart mit demselben Konto passiert nichts davon: dort stellen
// die Stores ihren Stand wieder her.
import { getActiveUid, setActiveUid } from './userScopedStorage'
import { resetKeepAwakeModeCache } from './keepAwakeGuard'

// Im localStorage gemerkter Admin-Schlüssel der Admin-Panels (AdminFeedbackPanel, VerifierAuditPanel, AiInsightsPanel).
export const ADMIN_KEY_STORAGE_KEY = 'admin_feedback_key'

/** Alle laufenden Zustände des bisherigen Kontos beenden. Fehler in einem Store stoppen die anderen nicht. */
export function resetRunningStatesForUserChange({ restTimer, warmupTimer, transitionTimer, timer, stopwatch } = {}) {
  for (const store of [restTimer, warmupTimer, transitionTimer, timer, stopwatch]) {
    try { store?.resetForUserChange?.() } catch { /* ein Fehler darf den Kontowechsel nicht blockieren */ }
  }
}

/** Geräteweit gemerkte Schlüssel entfernen, die nicht zum nächsten Konto gehören dürfen. */
export function clearDeviceSecrets() {
  try { localStorage.removeItem(ADMIN_KEY_STORAGE_KEY) } catch { /* optional */ }
}

/**
 * @param {string|null|undefined} uid angemeldetes Konto, leer = abgemeldet
 * @param {{ theme?: object, settings?: object, restTimer?: object, warmupTimer?: object, transitionTimer?: object, timer?: object, stopwatch?: object, i18n?: object }} stores
 */
export function applyUserPreferences(uid, { theme, settings, restTimer, warmupTimer, transitionTimer, timer, stopwatch, i18n } = {}) {
  const previous = getActiveUid()
  const next = String(uid || '').trim()
  // Abgemeldet oder anderes Konto: erst die laufenden Zustände beenden (solange noch das alte Konto aktiv ist), dann wechseln.
  if (previous && previous !== next) {
    resetRunningStatesForUserChange({ restTimer, warmupTimer, transitionTimer, timer, stopwatch })
    clearDeviceSecrets()
  }
  setActiveUid(uid)
  resetKeepAwakeModeCache()
  theme?.reloadForUser?.()
  settings?.reloadPrefsForUser?.()
  restTimer?.reloadPrefsForUser?.()
  warmupTimer?.reloadPrefsForUser?.()
  timer?.reloadPrefsForUser?.()
  // Sprache des Kontos übernehmen; ohne eigene Wahl gilt die Sprache des Geräts.
  if (i18n) {
    const own = settings?.language
    if (own) {
      if (i18n.global.locale.value !== own) i18n.global.locale.value = own
    } else {
      i18n.global.locale.value = detectDeviceLocale()
    }
  }
}

function detectDeviceLocale() {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'de'
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en'
}
