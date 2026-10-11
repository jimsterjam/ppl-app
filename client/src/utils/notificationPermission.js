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

/**
 * Hinweis, solange Mitteilungen nicht erlaubt sind: 'prompt' (iOS hat noch nie gefragt -> Knopf "Erlauben") oder
 * 'denied' (-> Knopf "Einstellungen öffnen"). Nicht mehr, sobald der Nutzer ihn ausgeblendet hat.
 */
export function shouldShowNotificationHint({ permission, dismissed }) {
  return (permission === 'denied' || permission === 'prompt') && !dismissed
}

/**
 * Ausblenden gilt nur für den Zustand, in dem es getippt wurde: Wer den "Erlauben"-Hinweis ausblendet und später
 * in der iOS-Frage ablehnt, bekommt "Mitteilungen sind aus" trotzdem (Fund Paul 11.10.).
 */
export function isHintDismissedFor(permission) {
  return getDismissedState() === permission
}

/** Löst die iOS-Frage aus (nur wirksam, solange noch nie gefragt wurde). @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>} */
export async function requestNotificationPermission() {
  try {
    if (!Capacitor.isNativePlatform()) return 'unsupported'
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { display } = await LocalNotifications.requestPermissions()
    if (display === 'granted') return 'granted'
    if (display === 'denied') return 'denied'
    return 'prompt'
  } catch (error) {
    logger.warn('[notificationPermission] Anfrage fehlgeschlagen', { message: error?.message })
    return 'unsupported'
  }
}

/** Fragt nur, wenn iOS noch nie gefragt hat (z. B. beim ersten Start eines Timers). Wirft nie. */
export async function ensureNotificationPermission() {
  const permission = await getNotificationPermission()
  return permission === 'prompt' ? requestNotificationPermission() : permission
}

function getDismissedState() {
  try {
    const value = localStorage.getItem(DISMISS_KEY)
    // '1' = älterer Stand (nur "denied" konnte ausgeblendet werden)
    return value === '1' ? 'denied' : value
  } catch { return null }
}

export function isNotificationHintDismissed(permission) {
  return permission ? isHintDismissedFor(permission) : getDismissedState() !== null
}

/** @param {'prompt'|'denied'} permission Zustand, in dem ausgeblendet wurde */
export function dismissNotificationHint(permission = 'denied') {
  try { localStorage.setItem(DISMISS_KEY, permission) } catch {}
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
