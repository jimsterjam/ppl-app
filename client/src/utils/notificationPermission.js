// Mitteilungs-Erlaubnis (iOS). iOS fragt nur EINMAL: Wurde "Nicht erlauben" getippt, lässt sich das nur noch in den
// iPhone-Einstellungen der App ändern. Diese Datei erkennt den Zustand und öffnet die Einstellungen, damit die App
// (Warm-up-Karte, Pausentimer-Einstellungen) einen Hinweis mit Knopf zeigen kann - Absprache Paul 11.10.
import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'

const DISMISS_KEY = 'ppl_notification_hint_dismissed_v1'

/**
 * @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>}
 *   granted/denied/prompt = Zustand auf dem Gerät; unsupported = Web oder nicht abfragbar (dann kein Hinweis)
 */
export async function getNotificationPermission() {
  try {
    if (!Capacitor.isNativePlatform()) return 'unsupported'
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { display } = await LocalNotifications.checkPermissions()
    if (display === 'granted') return 'granted'
    if (display === 'denied') return 'denied'
    return 'prompt'
  } catch (error) {
    logger.warn('[notificationPermission] Abfrage fehlgeschlagen', { message: error?.message })
    return 'unsupported'
  }
}

/** Hinweis nur, wenn die Erlaubnis verweigert wurde und der Nutzer ihn nicht schon ausgeblendet hat. */
export function shouldShowNotificationHint({ permission, dismissed }) {
  return permission === 'denied' && !dismissed
}

export function isNotificationHintDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

export function dismissNotificationHint() {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
}

/** Öffnet die iPhone-Einstellungen der App (dort: Mitteilungen). @returns {Promise<boolean>} geklappt? */
export async function openAppSettings() {
  try {
    if (!Capacitor.isNativePlatform()) return false
    const { App } = await import('@capacitor/app')
    await App.openUrl({ url: 'app-settings:' })
    return true
  } catch (error) {
    logger.warn('[notificationPermission] Einstellungen konnten nicht geöffnet werden', { message: error?.message })
    return false
  }
}
