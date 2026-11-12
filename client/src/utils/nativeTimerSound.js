// Timer-Töne direkt über iOS - Brücke zum eigenen Swift-Plugin TimerSound
// (client/ios/App/App/TimerSoundPlugin.swift, registriert in MainViewController.swift).
//
// Warum: siehe utils/timerSoundFiles.js (Web Audio wird von iOS angehalten, Töne fehlten oder kamen verspätet).
// Ist das Plugin nicht da (Browser, alter iOS-Build ohne Plugin), melden alle Funktionen "nicht verfügbar" und die
// Aufrufer bleiben bei Web Audio. Alle Aufrufe fangen Fehler ab.
//
// Das Plugin-Objekt wird nie aus einer async-Funktion zurückgegeben (iOS-Proxy, siehe utils/capacitorPlugin.js).
import { Capacitor, registerPlugin } from '@capacitor/core'
import { logDiagnostic } from '@/utils/diagnosticsLog'

const TimerSound = registerPlugin('TimerSound')

// null = noch nicht geprüft, true/false = Ergebnis von isAvailable()
let available = null
let probing = null

function isIos() {
  try { return Capacitor.getPlatform() === 'ios' } catch { return false }
}

/** Einmal beim App-Start aufrufen; danach liefert isNativeTimerSoundReady() sofort die Antwort. */
export function probeNativeTimerSound() {
  if (available !== null) return Promise.resolve(available)
  if (probing) return probing
  if (!isIos()) {
    available = false
    return Promise.resolve(false)
  }
  // Aufruf in ein Promise packen: fehlt das Plugin, kann der Aufruf auch sofort werfen statt abzulehnen
  probing = new Promise((resolve) => resolve(TimerSound.isAvailable()))
    .then((result) => result?.available === true)
    .catch(() => false)
    .then((ok) => {
      available = ok
      probing = null
      logDiagnostic('timer-sound', { available: ok })
      return ok
    })
  return probing
}

/** Spielt das Plugin die Töne? (false, solange die Prüfung noch läuft) */
export function isNativeTimerSoundReady() {
  return available === true
}

/**
 * Ton sofort spielen.
 * @returns {Promise<{ played: boolean, reason?: string }>} reason 'background': App nicht im Vordergrund - bewusst
 *   still (dann auch NICHT per Web Audio spielen, der Ton käme sonst verspätet beim Zurückkehren)
 */
export async function playNativeTimerSound(file) {
  if (!isNativeTimerSoundReady() || !file) return { played: false, reason: 'unavailable' }
  try {
    const result = await TimerSound.play({ file })
    const played = result?.played === true
    if (!played) logDiagnostic('timer-sound-play', { file, reason: result?.reason || 'not-played' })
    return played ? { played } : { played, reason: result?.reason || 'not-played' }
  } catch (error) {
    logDiagnostic('timer-sound-play', { file, error: String(error?.message || error) })
    return { played: false, reason: 'plugin-error' }
  }
}

/**
 * Töne zeitgenau bei iOS einplanen; ersetzt alle vorher geplanten.
 * @param {Array<{ key: string, file: string, at: number }>} cues - at: ms seit 1970
 * @returns {Promise<boolean>} true = iOS spielt sie (dann nicht zusätzlich per Web Audio spielen)
 */
export async function scheduleNativeTimerSounds(cues) {
  if (!isNativeTimerSoundReady()) return false
  try {
    const result = await TimerSound.schedule({ cues })
    logDiagnostic('timer-sound-schedule', { total: cues.length, scheduled: result?.scheduled ?? null })
    // Nur wenn ALLE Töne eingeplant sind (z. B. fehlt sonst eine Datei im Build): sonst spielt Web Audio
    return result?.scheduled === cues.length
  } catch (error) {
    logDiagnostic('timer-sound-schedule', { error: String(error?.message || error) })
    return false
  }
}

export async function cancelNativeTimerSounds() {
  if (!isNativeTimerSoundReady()) return
  try { await TimerSound.cancel() } catch {}
}

/** Medienlautstärke 0..1, null = unbekannt (kein Plugin). */
export async function getMediaVolume() {
  if (!isNativeTimerSoundReady()) return null
  try {
    const result = await TimerSound.getVolume()
    return typeof result?.volume === 'number' ? result.volume : null
  } catch {
    return null
  }
}

/**
 * Änderungen der Medienlautstärke (Lauter-/Leiser-Tasten).
 * @param {(volume: number) => void} callback
 * @returns {() => void} Abmelden
 */
export function onMediaVolumeChange(callback) {
  if (!isNativeTimerSoundReady()) return () => {}
  let handle = null
  let removed = false
  try {
    Promise.resolve(TimerSound.addListener('volume', (event) => {
      if (typeof event?.volume === 'number') callback(event.volume)
    })).then((h) => {
      handle = h
      if (removed) h?.remove?.()
    }).catch(() => {})
  } catch {}
  return () => {
    removed = true
    try { handle?.remove?.() } catch {}
  }
}

/** Nur für Tests */
export function __resetNativeTimerSoundForTests() {
  available = null
  probing = null
}
