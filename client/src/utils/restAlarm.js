// Wecker am Pausenende (AlarmKit, iOS 26+) - Brücke zum eigenen Swift-Plugin RestAlarm
// (client/ios/App/App/RestAlarmPlugin.swift, registriert in MainViewController.swift).
//
// Der Wecker klingelt wie der der Uhr-App, auch bei Stumm-Schalter, Fokus und gesperrtem Bildschirm
// (normale Mitteilungen werden dort von iOS unterdrückt). Alle Aufrufe fangen Fehler ab und liefern
// ein Ergebnis - klappt der Wecker nicht, nutzt der Aufrufer die normale Mitteilung als Ersatz.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { logDiagnostic } from '@/utils/diagnosticsLog'

const RestAlarm = registerPlugin('RestAlarm')

function isIos() {
  try { return Capacitor.getPlatform() === 'ios' } catch { return false }
}

/**
 * @param {{ at: number, title: string, stopLabel: string, sound?: string }} options - at: Zeitpunkt in ms seit 1970
 * @returns {Promise<{ scheduled: boolean, reason?: string, message?: string }>}
 */
export async function scheduleRestAlarm({ at, title, stopLabel, sound }) {
  if (!isIos()) return { scheduled: false, reason: 'unsupported' }
  try {
    const result = await RestAlarm.schedule({ at, title, stopLabel, sound })
    const scheduled = result?.scheduled === true
    if (!scheduled) logDiagnostic('rest-alarm', { scheduled, reason: result?.reason, message: result?.message })
    return { scheduled, reason: result?.reason, message: result?.message }
  } catch (error) {
    // z.B. Plugin nicht im Build (alter Build ohne Swift-Plugin) - kein Fehler für den Nutzer.
    logDiagnostic('rest-alarm', { scheduled: false, reason: 'plugin-error', message: String(error?.message || error) })
    return { scheduled: false, reason: 'plugin-error', message: String(error?.message || error) }
  }
}

export async function cancelRestAlarm() {
  if (!isIos()) return
  try { await RestAlarm.cancel() } catch {}
}
