// Meldung am Ende der Satzpause, wenn die App nicht im Vordergrund ist.
//
//   1. Wecker (AlarmKit, iOS 26+): klingelt auch bei Stumm-Schalter/Fokus/gesperrtem Bildschirm.
//   2. Ersatz: normale Mitteilung mit Ton (iOS < 26, Erlaubnis verweigert, Plugin fehlt).
//
// Beides kommt etwas NACH dem Pausenende (NOTIFICATION_DELAY_MS): Läuft die App im Vordergrund,
// beendet sie die Pause und nimmt Wecker und Mitteilung vorher zurück (cancelRestEndSignal) - sonst
// gäbe es Gong UND Wecker/Mitteilungston gleichzeitig.
import { Capacitor } from '@capacitor/core'
import { cancelRestAlarm, scheduleRestAlarm } from '@/utils/restAlarm'
import { logDiagnostic } from '@/utils/diagnosticsLog'

export const NOTIFICATION_ID = 940001
// Ton der Mitteilung (Datei im iOS-Projekt: ios/App/App/rest-end.wav, als Ressource eingetragen).
export const NOTIFICATION_SOUND = 'rest-end.wav'
// Ton des Weckers (ios/App/App/rest-alarm.wav): tiefer, ausklingender Gong, 3 Schläge, Pause, 3 Schläge ...
// (3 Durchgänge, 24 s; iOS wiederholt die Datei, bis der Nutzer "Stopp" drückt).
export const ALARM_SOUND = 'rest-alarm.wav'
export const NOTIFICATION_DELAY_MS = 1200

async function getLocalNotifications() {
  try {
    const module = await import('@capacitor/local-notifications')
    return module?.LocalNotifications || null
  } catch {
    return null
  }
}

/** Mitteilung für das Pausenende (mit Ton auf iOS). */
export function buildRestNotification(at, title, body, platform = 'web') {
  return {
    id: NOTIFICATION_ID,
    title,
    body,
    schedule: { at: new Date(at + NOTIFICATION_DELAY_MS), allowWhileIdle: true },
    ...(platform === 'ios' ? { sound: NOTIFICATION_SOUND } : {})
  }
}

async function cancelNotification(LocalNotifications) {
  const plugin = LocalNotifications || await getLocalNotifications()
  if (!plugin) return
  try { await plugin.cancel({ notifications: [{ id: NOTIFICATION_ID }] }) } catch {}
}

async function scheduleNotification(at, title, body) {
  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
    const permission = await LocalNotifications.requestPermissions()
    await LocalNotifications.schedule({
      notifications: [buildRestNotification(at, title, body, Capacitor.getPlatform())]
    })
    // Diagnose-Log ("Debug-Log kopieren"): bisher blieben Fehler hier unsichtbar.
    let pending = null
    try { pending = (await LocalNotifications.getPending())?.notifications?.length ?? null } catch {}
    logDiagnostic('rest-notification', { permission: permission?.display, pending })
  } catch (error) {
    logDiagnostic('rest-notification', { error: String(error?.message || error) })
  }
}

/**
 * Wecker (bzw. Ersatz-Mitteilung) für das Pausenende planen; ersetzt einen vorherigen.
 * @param {number} at - Pausenende in ms seit 1970
 * @param {{ title: string, body: string, stopLabel: string }} texts
 * @param {object} [deps] - nur für Tests
 */
export async function scheduleRestEndSignal(at, { title, body, stopLabel }, deps = {}) {
  const alarm = deps.scheduleAlarm || scheduleRestAlarm
  const notify = deps.scheduleNotification || scheduleNotification
  const cancelNote = deps.cancelNotification || cancelNotification
  const result = await alarm({ at: at + NOTIFICATION_DELAY_MS, title, stopLabel, sound: ALARM_SOUND })
  if (result?.scheduled) {
    // Der Wecker übernimmt - eine frühere Ersatz-Mitteilung darf nicht zusätzlich kommen.
    await cancelNote()
    return 'alarm'
  }
  await notify(at, title, body)
  return 'notification'
}

/** Wecker und Mitteilung zurücknehmen (Pause beendet, übersprungen oder abgebrochen). */
export async function cancelRestEndSignal(deps = {}) {
  const cancelAlarm = deps.cancelAlarm || cancelRestAlarm
  const cancelNote = deps.cancelNotification || cancelNotification
  await Promise.all([cancelAlarm(), cancelNote()])
}
