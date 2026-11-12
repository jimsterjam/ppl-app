// Rechnet die Timer-Töne aus utils/timerAudio.js offline nach (für die Tondateien des iOS-Plugins TimerSound).
// Gleiche Oszillatoren, Frequenzen, Lautstärke-Verläufe und Filter wie dort; der Kompressor der Web-Audio-Kette
// fehlt, stattdessen werden alle Dateien gemeinsam auf denselben Spitzenpegel gebracht (Lautstärke-Verhältnis
// zwischen den Tönen bleibt erhalten). Nur für den Generator und die Tests, nicht Teil der App.
//
// Bei einer Klangänderung in timerAudio.js hier nachziehen und `node scripts/generate-timer-sounds.mjs` ausführen.
import { REST_MELODIES } from '../src/utils/restMelodies.js'

/** Web-Audio-Automation: [{ t, v, ramp: 'set'|'exp'|'lin' }] -> Wert zur Zeit t (Sekunden ab Tonbeginn). */
function automation(initial, events) {
  const list = [...events].sort((a, b) => a.t - b.t)
  return (t) => {
    let prevT = 0
    let prevV = initial
    for (const e of list) {
      if (t < e.t) {
        if (e.ramp === 'set') return prevV
        const f = (t - prevT) / Math.max(1e-9, e.t - prevT)
        if (e.ramp === 'lin') return prevV + (e.v - prevV) * f
        return prevV * (e.v / prevV) ** f
      }
      prevT = e.t
      prevV = e.v
    }
    return prevV
  }
}
const set = (t, v) => ({ t, v, ramp: 'set' })
const exp = (t, v) => ({ t, v, ramp: 'exp' })
const lin = (t, v) => ({ t, v, ramp: 'lin' })

// PolyBLEP gegen Aliasing (Web Audio erzeugt band-begrenzte Rechteck-/Sägezahn-Wellen)
function blep(p, dp) {
  if (p < dp) { const x = p / dp; return x + x - x * x - 1 }
  if (p > 1 - dp) { const x = (p - 1) / dp; return x * x + x + x + 1 }
  return 0
}
function wave(type, phase, dp) {
  if (type === 'sine') return Math.sin(2 * Math.PI * phase)
  if (type === 'triangle') return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase
  if (type === 'sawtooth') return 2 * phase - 1 - blep(phase, dp)
  // square
  let v = phase < 0.5 ? 1 : -1
  v += blep(phase, dp)
  v -= blep((phase + 0.5) % 1, dp)
  return v
}

/** Biquad nach RBJ; Q wie bei Web Audio für Hoch-/Tiefpass in dB. */
function biquad(type, freq, qDb, sr) {
  const q = 10 ** (qDb / 20)
  const w0 = 2 * Math.PI * freq / sr
  const alpha = Math.sin(w0) / (2 * q)
  const cos = Math.cos(w0)
  const b = type === 'lowpass' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0
  return (x) => {
    const y = (b[0] * x + b[1] * x1 + b[2] * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1; x1 = x; y2 = y1; y1 = y
    return y
  }
}

/**
 * Gruppe = mehrere Oszillatoren in einen Gain-Knoten: { oscs: [{ type, freq: number|events }], gain: events,
 * start, stop, lowpass?: [freq, qDb], bus: 'master'|'sub' }.
 */
function render(groups, seconds, sr) {
  const n = Math.ceil(seconds * sr)
  const master = new Float64Array(n)
  const sub = new Float64Array(n)
  for (const g of groups) {
    const gain = automation(0.0001, g.gain)
    const oscs = g.oscs.map((o) => ({
      type: o.type,
      freq: typeof o.freq === 'number' ? () => o.freq : automation(o.freq[0].v, o.freq),
      phase: 0
    }))
    const lp = g.lowpass ? biquad('lowpass', g.lowpass[0], g.lowpass[1], sr) : null
    const out = g.bus === 'sub' ? sub : master
    const from = Math.round((g.start || 0) * sr)
    const to = Math.min(n, Math.round(g.stop * sr))
    for (let i = from; i < to; i += 1) {
      const t = i / sr
      let s = 0
      for (const o of oscs) {
        const dp = o.freq(t) / sr
        s += wave(o.type, o.phase, dp)
        o.phase = (o.phase + dp) % 1
      }
      s *= gain(t)
      out[i] += lp ? lp(s) : s
    }
  }
  // Master: Hochpass 580 Hz (Q 0.7) -> Kompressor (-20 dB, 8:1, 2 ms / 120 ms) -> x1.28
  // Sub-Zweig ohne Hochpass: Kompressor (-22 dB, 6:1, 3 ms / 180 ms) -> x1.3 (wie getAudioMasterNode/getAudioSubNode)
  const hp = biquad('highpass', 580, 0.7, sr)
  const compMaster = compressor(-20, 8, 0.002, 0.12, sr)
  const compSub = compressor(-22, 6, 0.003, 0.18, sr)
  const mix = new Float64Array(n)
  for (let i = 0; i < n; i += 1) mix[i] = compMaster(hp(master[i])) * 1.28 + compSub(sub[i]) * 1.3
  return mix
}

/** Einfacher Kompressor (Spitzenwert-Hüllkurve, harte Kennlinie) - nähert den Web-Audio-Kompressor an. */
function compressor(thresholdDb, ratio, attack, release, sr) {
  const a = Math.exp(-1 / (attack * sr))
  const r = Math.exp(-1 / (release * sr))
  let env = 0
  return (x) => {
    const level = Math.abs(x)
    env = level > env ? a * env + (1 - a) * level : r * env + (1 - r) * level
    const db = 20 * Math.log10(Math.max(env, 1e-9))
    const over = db - thresholdDb
    const gainDb = over > 0 ? -over * (1 - 1 / ratio) : 0
    return x * 10 ** (gainDb / 20)
  }
}

const vol = (intensity) => Math.max(0.005, Math.min(1.5, Number(intensity) || 1))

function whistle() {
  const end = 1.9
  return render([
    { oscs: [{ type: 'sine', freq: 196 }, { type: 'triangle', freq: 392 * 1.18 }, { type: 'triangle', freq: 392 * 1.82 }],
      gain: [set(0, 0.0001), exp(0.03, 0.62), exp(0.34, 0.22), exp(end, 0.0001)], stop: end, lowpass: [3200, 0.7] },
    { oscs: [{ type: 'square', freq: 1180 }], gain: [set(0, 0.0001), exp(0.008, 0.42), exp(0.11, 0.0001)], stop: 0.12, lowpass: [3200, 0.7] }
  ], end + 0.05, SR)
}

function bell(intensity) {
  const v = vol(intensity)
  const partials = [[880, 1, 1.8], [1056, 0.6, 1.2], [1320, 0.4, 0.85], [1760, 0.25, 0.6], [2464, 0.15, 0.38]]
  return render([
    ...partials.map(([freq, g, decay]) => ({
      oscs: [{ type: 'sine', freq }], gain: [set(0, 0.0001), exp(0.008, v * g * 0.38), exp(decay, 0.0001)], stop: decay + 0.05
    })),
    { oscs: [{ type: 'triangle', freq: [set(0, 4400), exp(0.025, 1760)] }],
      gain: [set(0, 0.0001), exp(0.004, v * 0.4), exp(0.038, 0.0001)], stop: 0.045 }
  ], 1.9, SR)
}

function boxGong(intensity) {
  const v = vol(intensity)
  return render([
    { oscs: [{ type: 'square', freq: [set(0, 3200), exp(0.03, 1600)] }],
      gain: [set(0, 0.0001), exp(0.004, v * 0.5), exp(0.065, 0.0001)], stop: 0.08 },
    { oscs: [{ type: 'sine', freq: 820 }, { type: 'triangle', freq: 1680 }],
      gain: [set(0, 0.0001), exp(0.01, v * 0.42), exp(0.3, v * 0.08), exp(0.9, 0.0001)], stop: 0.95 }
  ], 1.0, SR)
}

function chineseGong(intensity) {
  const v = vol(intensity)
  return render([
    { oscs: [{ type: 'sine', freq: [set(0, 110), lin(0.06, 118), exp(2.0, 106)] }, { type: 'triangle', freq: [set(0, 220), exp(2.0, 210)] }],
      gain: [set(0, 0.0001), exp(0.018, v * 0.55), exp(0.4, v * 0.28), exp(2.2, 0.0001)], stop: 2.3, bus: 'sub' },
    { oscs: [{ type: 'triangle', freq: 620 }, { type: 'sine', freq: 880 }],
      gain: [set(0, 0.0001), exp(0.012, v * 0.3), exp(1.6, 0.0001)], stop: 1.7 },
    { oscs: [{ type: 'sawtooth', freq: [set(0, 1200), exp(0.04, 600)] }],
      gain: [set(0, 0.0001), exp(0.006, v * 0.45), exp(0.07, 0.0001)], stop: 0.08 }
  ], 2.35, SR)
}

function beep(frequency, durationMs, peak) {
  const d = durationMs / 1000
  return render([
    { oscs: [{ type: 'square', freq: frequency }, { type: 'triangle', freq: Math.max(120, frequency * 1.6) }, { type: 'sawtooth', freq: Math.max(160, frequency * 2.2) }],
      gain: [set(0, 0.0001), exp(0.012, Math.max(0.08, peak)), exp(d, 0.0001)], stop: d }
  ], d + 0.03, SR)
}

function siren(durationMs) {
  const d = Math.max(0.2, durationMs / 1000)
  return render([
    { oscs: [{ type: 'square', freq: 2350 }, { type: 'triangle', freq: 2860 }, { type: 'sawtooth', freq: 3210 }],
      gain: [set(0, 0.0001), exp(0.015, 0.62), exp(d, 0.0001)], stop: d }
  ], d + 0.03, SR)
}

/** Wie timerAudio.playRestMelody: einmal, Sub-Zweig, Start nach 20 ms. */
function melody(id) {
  const m = REST_MELODIES[id]
  const ampSum = m.timbre.reduce((sum, p) => sum + p.amp, 0)
  const groups = []
  const start = 0.02
  let last = 0
  for (const note of m.notes) {
    const t0 = start + note.at
    const t1 = t0 + m.ringSec
    last = Math.max(last, t1 + 0.04)
    for (const p of m.timbre) {
      const peak = Math.max(0.0002, 0.5 * note.vel * p.amp / ampSum)
      groups.push({
        oscs: [{ type: 'sine', freq: note.hz * p.mult }],
        gain: [set(t0, 0.0001), lin(t0 + 0.004, peak), exp(t1, Math.max(0.0001, peak * Math.exp(-3 * m.ringSec / p.decay))), lin(t1 + 0.03, 0)],
        start: t0, stop: t1 + 0.04, bus: 'sub'
      })
    }
  }
  return render(groups, last + 0.02, SR)
}

export const SR = 44100

// Zähltöne wie emitTimerSignal (countdown-3/-2/-1 je Klangart), Vorwarnung, Pausenende
const COUNT = {
  boxgong: { 3: () => boxGong(0.45), 2: () => boxGong(0.62), 1: () => boxGong(0.85) },
  chinesegong: { 3: () => chineseGong(0.4), 2: () => chineseGong(0.57), 1: () => chineseGong(0.75) },
  bell: { 3: () => bell(0.45), 2: () => bell(0.62), 1: () => bell(0.85) },
  beep: { 3: () => beep(900, 160, 0.5), 2: () => beep(1120, 160, 0.52), 1: () => beep(1360, 170, 0.56) }
}

/** @returns {Float64Array} Rohsignal (noch nicht normalisiert) */
export function renderTimerSound(file) {
  if (file === 'timer-whistle.wav') return whistle()
  if (file === 'timer-bell-warn.wav') return bell(0.4)
  if (file === 'timer-siren.wav') return siren(1200)
  const count = /^timer-(boxgong|chinesegong|bell|beep)-([123])\.wav$/.exec(file)
  if (count) return COUNT[count[1]][count[2]]()
  const mel = /^timer-melody-(\w+)\.wav$/.exec(file)
  if (mel && REST_MELODIES[mel[1]]) return melody(mel[1])
  throw new Error(`Unbekannte Tondatei: ${file}`)
}
