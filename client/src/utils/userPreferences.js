// Kontowechsel: Einstellungen des angemeldeten Kontos laden bzw. beim Abmelden auf Standardwerte zurück (Absprache Paul
// 06.11.2026, siehe utils/userScopedStorage.js). Aufgerufen in main.js bei jeder Änderung des Anmeldezustands.
import { setActiveUid } from './userScopedStorage'
import { resetKeepAwakeModeCache } from './keepAwakeGuard'

/**
 * @param {string|null|undefined} uid angemeldetes Konto, leer = abgemeldet
 * @param {{ theme?: object, settings?: object, restTimer?: object, warmupTimer?: object, timer?: object, i18n?: object }} stores
 */
export function applyUserPreferences(uid, { theme, settings, restTimer, warmupTimer, timer, i18n } = {}) {
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

