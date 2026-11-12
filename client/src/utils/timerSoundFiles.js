// Welche Tondatei im iOS-Paket zu welchem Timer-Signal gehört. Ohne Imports, damit Generator und Tests
// sie direkt laden können.
//
// Hintergrund (Meldung 12.11.: auf manchen Geräten fehlte der Pausen-Gong bzw. kam erst beim Zurückkehren in die App):
// Die Töne entstehen in der App sonst per Web Audio in der Web-Ansicht. iOS stoppt diesen Audio-Kanal nach
// Hintergrund, Anruf, Musik anderer Apps oder Bluetooth-Wechsel und lässt ihn erst nach einer Berührung wieder
// starten; in der Zwischenzeit gespielte Töne stauen sich und kommen gesammelt beim Zurückkehren.
// Auf iOS spielt deshalb das eigene Plugin TimerSound (TimerSoundPlugin.swift) diese Dateien direkt über iOS ab.
// Die Dateien erzeugt `node scripts/generate-timer-sounds.mjs` (cd client) aus denselben Klangangaben wie
// utils/timerAudio.js - nicht von Hand ändern.

const COUNT_STYLES = Object.freeze({ 'box-gong': 'boxgong', 'chinese-gong': 'chinesegong', bell: 'bell' })
const MELODY_IDS = Object.freeze(['deep', 'chimes', 'marimba', 'bright'])

/** Dateiname einer Pausenende-Melodie (einmal gespielt, nicht die Wecker-Datei). */
export function melodySoundFile(id) {
  return MELODY_IDS.includes(id) ? `timer-melody-${id}.wav` : null
}

/**
 * @param {{ kind: string, soundType?: string, melodyId?: string|null }} signal - wie emitTimerSignal
 * @returns {string|null} Dateiname im App-Paket, null = kein Ton dafür vorhanden (dann Web Audio)
 */
export function timerSoundFile({ kind, soundType = 'box-gong', melodyId = null } = {}) {
  if (kind === 'round-start') return 'timer-whistle.wav'
  if (kind === 'rest-end') return melodySoundFile(melodyId) || 'timer-whistle.wav'
  if (kind === 'rest-warn') return 'timer-bell-warn.wav'
  if (kind === 'session-end') return 'timer-siren.wav'
  const count = /^countdown-([123])$/.exec(String(kind || ''))
  if (count) return `timer-${COUNT_STYLES[soundType] || 'beep'}-${count[1]}.wav`
  return null
}

/** Alle Dateien, die der Generator erzeugt und die im iOS-Projekt eingetragen sein müssen. */
export const TIMER_SOUND_FILES = Object.freeze([
  'timer-whistle.wav',
  'timer-bell-warn.wav',
  'timer-siren.wav',
  ...['boxgong', 'chinesegong', 'bell', 'beep'].flatMap((style) => [1, 2, 3].map((n) => `timer-${style}-${n}.wav`)),
  ...MELODY_IDS.map((id) => `timer-melody-${id}.wav`)
])
