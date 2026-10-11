// Mitteilung am Ende eines Warm-up-Timers, wenn die App nicht im Vordergrund ist (Absprache Paul 11.10.:
// normale Mitteilung mit Ton, kein Wecker - der Wecker (AlarmKit) gehört dem Pausentimer und kennt nur einen
// Platz). Eigene Mitteilungs-ID, damit sie sich nicht mit der Pausen-Mitteilung (940001) in die Quere kommt.
// Wie beim Pausentimer kommt sie etwas NACH dem Ende (NOTIFICATION_DELAY_MS): Läuft die App im Vordergrund,
// beendet sie den Schritt vorher und nimmt die Mitteilung zurück.
// Normale Mitteilungen gehorchen Stumm-Schalter und Fokus - dann kommt sie ohne Ton.
import { Capacitor } from '@capacitor/core'
import { NOTIFICATION_DELAY_MS, NOTIFICATION_SOUND } from '@/utils/restEndSignal'
import { logDiagnostic } from '@/utils/diagnosticsLog'

export const WARMUP_NOTIFICATION_ID = 940002

async function getLocalNotifications() {
  try {
    const module = await import('@capacitor/local-notifications')
    return module?.LocalNotifications || null
  } catch {
    return null
  }
}

/** Mitteilung für das Ende eines Schritts (mit Ton auf iOS). */
export function buildWarmupNotification(at, title, body, platform = 'web') {
  return {
    id: WARMUP_NOTIFICATION_ID,
    title,
    body,
    schedule: { at: new Date(at + NOTIFICATION_DELAY_MS), allowWhileIdle: true },
    ...(platform === 'ios' ? { sound: NOTIFICATION_SOUND } : {})
  }
}

/** Planen; ersetzt eine vorherige Warm-up-Mitteilung. Wirft nie. */
export async function scheduleWarmupNotification(at, { title, body }) {
  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return
  try {
    // Erst die Erlaubnis (fragt iOS nur beim ersten Mal), dann aufräumen - ein Fehler beim Aufräumen darf sie nicht verhindern.
    const permission = await LocalNotifications.requestPermissions()
    try { await LocalNotifications.cancel({ notifications: [{ id: WARMUP_NOTIFICATION_ID }] }) } catch {}
    await LocalNotifications.schedule({ notifications: [buildWarmupNotification(at, title, body, Capacitor.getPlatform())] })
    logDiagnostic('warmup-notification', { permission: permission?.display })
  } catch (error) {
    logDiagnostic('warmup-notification', { error: String(error?.message || error) })
  }
}

export async function cancelWarmupNotification() {
  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return
  try { await LocalNotifications.cancel({ notifications: [{ id: WARMUP_NOTIFICATION_ID }] }) } catch {}
}
