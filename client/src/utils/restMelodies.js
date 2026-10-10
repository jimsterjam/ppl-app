// Töne für das Ende der Satzpause. Ohne Imports, damit der Generator-Skript
// (client/scripts/generate-rest-melodies.mjs) und die Tests ihn direkt laden können.
//
// Eine Quelle für beide Wege:
//   - App im Vordergrund: timerAudio.playRestMelody spielt die Melodie einmal über Web Audio.
//   - App im Hintergrund: der iOS-Wecker (AlarmKit) spielt rest-alarm-<id>.wav (iOS/App/App/), die der
//     Generator aus denselben Noten erzeugt. iOS wiederholt die Datei, bis der Nutzer "Stopp" drückt.
// 'default' hat keine Datei: Im Hintergrund klingt der Standard-Wecker von iOS, in der App der
// bisherige Gong (playWhistleStart).

export const DEFAULT_REST_SOUND = 'default'

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }

/** "A4" -> 440 Hz */
export function noteHz(name) {
  const match = /^([A-G]#?)(\d)$/.exec(String(name))
  if (!match) throw new Error(`Ungültiger Notenname: ${name}`)
  const midi = 12 * (Number(match[2]) + 1) + NOTE_INDEX[match[1]]
  return 440 * 2 ** ((midi - 69) / 12)
}

// Klangfarbe: Obertöne als { mult: Vielfaches der Tonhöhe, amp: Lautstärke, decay: Sekunden bis zum
// Ausklingen (Amplitude fällt wie exp(-3 * t / decay)) }.
const BELL = [
  { mult: 1, amp: 1, decay: 2.6 },
  { mult: 2, amp: 0.5, decay: 1.9 },
  { mult: 2.76, amp: 0.28, decay: 1.3 },
  { mult: 4.1, amp: 0.12, decay: 0.8 },
  { mult: 5.4, amp: 0.06, decay: 0.5 }
]
const CHIME = [
  { mult: 1, amp: 1, decay: 1.5 },
  { mult: 2.4, amp: 0.45, decay: 1.0 },
  { mult: 3.9, amp: 0.2, decay: 0.6 },
  { mult: 5.4, amp: 0.1, decay: 0.4 }
]
const MARIMBA = [
  { mult: 1, amp: 1, decay: 0.7 },
  { mult: 4, amp: 0.35, decay: 0.25 },
  { mult: 9.2, amp: 0.1, decay: 0.1 }
]
const BRIGHT = [
  { mult: 1, amp: 1, decay: 1.0 },
  { mult: 2, amp: 0.4, decay: 0.7 },
  { mult: 3, amp: 0.25, decay: 0.45 }
]

function phrase(names, step, velocities) {
  return names.map((name, i) => ({ at: Math.round(i * step * 1000) / 1000, hz: noteHz(name), vel: velocities?.[i] ?? 1 }))
}

// cycleSec: Länge eines Durchgangs inkl. Pause danach. Der letzte Ton klingt innerhalb des
// Durchgangs aus (wird getestet), damit sich die Wiederholung sauber anschließt.
export const REST_MELODIES = Object.freeze({
  // Drei tiefe Glockenschläge, dann Pause (Wunsch Paul 10.10.)
  deep: Object.freeze({
    timbre: BELL,
    ringSec: 4.5,
    cycleSec: 8,
    notes: phrase(['G3', 'G3', 'G3'], 1.5, [1, 0.9, 0.9])
  }),
  chimes: Object.freeze({
    timbre: CHIME,
    ringSec: 1.8,
    cycleSec: 4.5,
    notes: phrase(['C5', 'E5', 'G5', 'C6', 'G5', 'E5'], 0.4, [1, 0.85, 0.85, 1, 0.8, 0.8])
  }),
  marimba: Object.freeze({
    timbre: MARIMBA,
    ringSec: 0.9,
    cycleSec: 3.6,
    notes: phrase(['A3', 'C4', 'E4', 'A4', 'G4', 'E4', 'C4', 'E4'], 0.3, [1, 0.8, 0.85, 1, 0.85, 0.8, 0.8, 0.9])
  }),
  bright: Object.freeze({
    timbre: BRIGHT,
    ringSec: 1.1,
    cycleSec: 2.6,
    notes: phrase(['G5', 'C6', 'E6', 'G6', 'G5', 'C6', 'E6', 'G6'], 0.18, [0.8, 0.85, 0.9, 1, 0.8, 0.85, 0.9, 1])
  })
})

export const REST_SOUND_IDS = Object.freeze([DEFAULT_REST_SOUND, ...Object.keys(REST_MELODIES)])

/** Gültige ID oder 'default'. */
export function sanitizeRestSound(value) {
  return REST_SOUND_IDS.includes(value) ? value : DEFAULT_REST_SOUND
}

export function getRestMelody(id) {
  return REST_MELODIES[id] || null
}

/** Dateiname des Wecker-Tons im iOS-Projekt; null bei 'default' (dann klingt der iOS-Standard). */
export function alarmSoundFile(id) {
  return REST_MELODIES[id] ? `rest-alarm-${id}.wav` : null
}

/** Länge der Wecker-Datei: so viele ganze Durchgänge, dass es unter ALARM_MAX_SEC bleibt (iOS: < 30 s). */
export const ALARM_MAX_SEC = 28
export function alarmFileSeconds(id) {
  const melody = REST_MELODIES[id]
  if (!melody) return 0
  return Math.floor(ALARM_MAX_SEC / melody.cycleSec) * melody.cycleSec
}

/**
 * Klang als Samples (Mono, -0.85 .. 0.85) - für den Generator der Wecker-Dateien.
 * @param {string} id
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function renderAlarmSamples(id, sampleRate) {
  const melody = REST_MELODIES[id]
  if (!melody) throw new Error(`Unbekannte Melodie: ${id}`)
  const total = Math.round(alarmFileSeconds(id) * sampleRate)
  const buffer = new Float64Array(total)
  const cycles = Math.round(alarmFileSeconds(id) / melody.cycleSec)
  const ringSamples = Math.round(melody.ringSec * sampleRate)
  const attack = 0.004 * sampleRate
  const taper = 0.03 * sampleRate
  for (let c = 0; c < cycles; c += 1) {
    for (const note of melody.notes) {
      const start = Math.round((c * melody.cycleSec + note.at) * sampleRate)
      for (const partial of melody.timbre) {
        const w = 2 * Math.PI * note.hz * partial.mult / sampleRate
        const k = 3 / (partial.decay * sampleRate)
        for (let i = 0; i < ringSamples && start + i < total; i += 1) {
          const env = Math.exp(-k * i) * Math.min(1, i / attack) * Math.min(1, (ringSamples - i) / taper)
          buffer[start + i] += note.vel * partial.amp * env * Math.sin(w * i)
        }
      }
    }
  }
  let peak = 0
  for (const v of buffer) peak = Math.max(peak, Math.abs(v))
  const scale = peak > 0 ? 0.85 / peak : 0
  const out = new Float32Array(total)
  const fade = Math.round(0.05 * sampleRate)
  for (let i = 0; i < total; i += 1) {
    const tail = Math.min(1, (total - 1 - i) / fade)
    out[i] = buffer[i] * scale * tail
  }
  return out
}
