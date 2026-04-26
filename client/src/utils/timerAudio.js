/**
 * Web Audio Engine für den Timer.
 * Kapselt AudioContext, Master-Gain-Chain und alle Ton-Synthesen.
 * Enthält eigenen Signal-Dedup-Guard (signalHistory).
 */

let audioContext = null
let audioMasterNode = null
let audioUnlocked = false
const signalHistory = new Map()

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioContext = new Ctx()
  }
  return audioContext
}

export function getAudioMasterNode() {
  const ctx = getAudioContext()
  if (!ctx) return null
  if (audioMasterNode) return audioMasterNode

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 580
  highpass.Q.value = 0.7

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -20
  compressor.knee.value = 16
  compressor.ratio.value = 8
  compressor.attack.value = 0.002
  compressor.release.value = 0.12

  const makeupGain = ctx.createGain()
  makeupGain.gain.value = 1.28

  highpass.connect(compressor)
  compressor.connect(makeupGain)
  makeupGain.connect(ctx.destination)

  audioMasterNode = highpass
  return audioMasterNode
}

export const ensureAudioUnlocked = () => {
  const ctx = getAudioContext()
  if (!ctx) return false
  const unlock = async () => {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      const master = getAudioMasterNode()
      if (!master) return false
      if (!audioUnlocked) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.value = 0.00001
        osc.connect(gain)
        gain.connect(master)
        const now = ctx.currentTime
        osc.start(now)
        osc.stop(now + 0.01)
        audioUnlocked = true
      }
      return true
    } catch {
      return false
    }
  }
  unlock()
  return true
}

export const playBeep = (frequency = 880, durationMs = 250, whenOffsetSec = 0, peakGain = 0.5) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const master = getAudioMasterNode()
  if (!master) return
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const osc3 = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc2.type = 'triangle'
  osc3.type = 'sawtooth'
  osc.frequency.value = frequency
  osc2.frequency.value = Math.max(120, frequency * 1.6)
  osc3.frequency.value = Math.max(160, frequency * 2.2)
  gain.gain.value = 0.0001
  osc.connect(gain)
  osc2.connect(gain)
  osc3.connect(gain)
  gain.connect(master)
  const now = ctx.currentTime + Math.max(0, whenOffsetSec)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.08, peakGain), now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
  osc.start(now)
  osc2.start(now)
  osc3.start(now)
  osc.stop(now + durationMs / 1000)
  osc2.stop(now + durationMs / 1000)
  osc3.stop(now + durationMs / 1000)
}

export const playSiren = (durationMs = 1500) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const master = getAudioMasterNode()
  if (!master) return

  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const osc3 = ctx.createOscillator()
  const gain = ctx.createGain()
  const now = ctx.currentTime
  const durationSec = Math.max(0.2, durationMs / 1000)

  osc.type = 'square'
  osc2.type = 'triangle'
  osc3.type = 'sawtooth'
  osc.frequency.value = 2350
  osc2.frequency.value = 2860
  osc3.frequency.value = 3210
  gain.gain.value = 0.0001
  osc.connect(gain)
  osc2.connect(gain)
  osc3.connect(gain)
  gain.connect(master)

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.62, now + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)
  osc.start(now)
  osc2.start(now)
  osc3.start(now)
  osc.stop(now + durationSec)
  osc2.stop(now + durationSec)
  osc3.stop(now + durationSec)
}

export const playWhistleStart = (durationMs = 1900) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const master = getAudioMasterNode()
  if (!master) return

  const now = ctx.currentTime
  const durationSec = Math.max(1.2, durationMs / 1000)
  const endAt = now + durationSec

  const fundamental = ctx.createOscillator()
  const overtone1 = ctx.createOscillator()
  const overtone2 = ctx.createOscillator()
  const bodyGain = ctx.createGain()
  const strikeGain = ctx.createGain()
  const lowpass = ctx.createBiquadFilter()

  fundamental.type = 'sine'
  overtone1.type = 'triangle'
  overtone2.type = 'triangle'
  fundamental.frequency.value = 196
  overtone1.frequency.value = 392 * 1.18
  overtone2.frequency.value = 392 * 1.82

  lowpass.type = 'lowpass'
  lowpass.frequency.value = 3200
  lowpass.Q.value = 0.7

  bodyGain.gain.value = 0.0001
  strikeGain.gain.value = 0.0001

  fundamental.connect(bodyGain)
  overtone1.connect(bodyGain)
  overtone2.connect(bodyGain)

  const attack = ctx.createOscillator()
  attack.type = 'square'
  attack.frequency.value = 1180
  attack.connect(strikeGain)

  bodyGain.connect(lowpass)
  strikeGain.connect(lowpass)
  lowpass.connect(master)

  strikeGain.gain.setValueAtTime(0.0001, now)
  strikeGain.gain.exponentialRampToValueAtTime(0.42, now + 0.008)
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)

  bodyGain.gain.setValueAtTime(0.0001, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.62, now + 0.03)
  bodyGain.gain.exponentialRampToValueAtTime(0.22, now + 0.34)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, endAt)

  fundamental.start(now)
  overtone1.start(now)
  overtone2.start(now)
  attack.start(now)

  fundamental.stop(endAt)
  overtone1.stop(endAt)
  overtone2.stop(endAt)
  attack.stop(now + 0.12)
}

// ---------------------------------------------------------------------------
// Sub-bass output chain – bypasses the 580 Hz highpass master so deep
// frequencies (Chinese gong fundamental) reach the speakers.
// ---------------------------------------------------------------------------
let audioSubNode = null
function getAudioSubNode() {
  const ctx = getAudioContext()
  if (!ctx) return null
  if (audioSubNode) return audioSubNode
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -22
  compressor.knee.value = 14
  compressor.ratio.value = 6
  compressor.attack.value = 0.003
  compressor.release.value = 0.18
  const gain = ctx.createGain()
  gain.gain.value = 1.3
  compressor.connect(gain)
  gain.connect(ctx.destination)
  audioSubNode = compressor
  return audioSubNode
}

// ---------------------------------------------------------------------------
// Box Gong – metallic boxing-ring bell
// ---------------------------------------------------------------------------
export const playBoxGong = (intensity = 1.0) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const master = getAudioMasterNode()
  if (!master) return
  const now = ctx.currentTime
  const vol = Math.max(0.005, Math.min(1.5, Number(intensity) || 1.0))

  // Strike transient – metallic clang
  const strike = ctx.createOscillator()
  const strikeGain = ctx.createGain()
  strike.type = 'square'
  strike.frequency.setValueAtTime(3200, now)
  strike.frequency.exponentialRampToValueAtTime(1600, now + 0.03)
  strikeGain.gain.setValueAtTime(0.0001, now)
  strikeGain.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.004)
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)
  strike.connect(strikeGain); strikeGain.connect(master)
  strike.start(now); strike.stop(now + 0.08)

  // Ring tone – sustained bell
  const ring = ctx.createOscillator()
  const ring2 = ctx.createOscillator()
  const ringGain = ctx.createGain()
  ring.type = 'sine'; ring2.type = 'triangle'
  ring.frequency.value = 820; ring2.frequency.value = 1680
  ringGain.gain.setValueAtTime(0.0001, now)
  ringGain.gain.exponentialRampToValueAtTime(vol * 0.42, now + 0.01)
  ringGain.gain.exponentialRampToValueAtTime(vol * 0.08, now + 0.3)
  ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
  ring.connect(ringGain); ring2.connect(ringGain); ringGain.connect(master)
  ring.start(now); ring2.start(now); ring.stop(now + 0.95); ring2.stop(now + 0.95)
}

// ---------------------------------------------------------------------------
// Chinese Gong – deep, resonant
// ---------------------------------------------------------------------------
export const playChineseGong = (intensity = 1.0) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime
  const vol = Math.max(0.005, Math.min(1.5, Number(intensity) || 1.0))

  // Deep fundamental – bypass highpass via sub node
  const sub = getAudioSubNode()
  if (sub) {
    const fund = ctx.createOscillator()
    const fund2 = ctx.createOscillator()
    const fundGain = ctx.createGain()
    fund.type = 'sine'; fund2.type = 'triangle'
    fund.frequency.setValueAtTime(110, now)
    fund.frequency.linearRampToValueAtTime(118, now + 0.06)
    fund.frequency.exponentialRampToValueAtTime(106, now + 2.0)
    fund2.frequency.setValueAtTime(220, now)
    fund2.frequency.exponentialRampToValueAtTime(210, now + 2.0)
    fundGain.gain.setValueAtTime(0.0001, now)
    fundGain.gain.exponentialRampToValueAtTime(vol * 0.55, now + 0.018)
    fundGain.gain.exponentialRampToValueAtTime(vol * 0.28, now + 0.4)
    fundGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
    fund.connect(fundGain); fund2.connect(fundGain); fundGain.connect(sub)
    fund.start(now); fund2.start(now); fund.stop(now + 2.3); fund2.stop(now + 2.3)
  }

  // Mid-range shimmer and strike – through master
  const master = getAudioMasterNode()
  if (master) {
    const mid = ctx.createOscillator()
    const mid2 = ctx.createOscillator()
    const midGain = ctx.createGain()
    mid.type = 'triangle'; mid2.type = 'sine'
    mid.frequency.value = 620; mid2.frequency.value = 880
    midGain.gain.setValueAtTime(0.0001, now)
    midGain.gain.exponentialRampToValueAtTime(vol * 0.3, now + 0.012)
    midGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
    mid.connect(midGain); mid2.connect(midGain); midGain.connect(master)
    mid.start(now); mid2.start(now); mid.stop(now + 1.7); mid2.stop(now + 1.7)

    const strikeG = ctx.createOscillator()
    const strikeGainG = ctx.createGain()
    strikeG.type = 'sawtooth'
    strikeG.frequency.setValueAtTime(1200, now)
    strikeG.frequency.exponentialRampToValueAtTime(600, now + 0.04)
    strikeGainG.gain.setValueAtTime(0.0001, now)
    strikeGainG.gain.exponentialRampToValueAtTime(vol * 0.45, now + 0.006)
    strikeGainG.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
    strikeG.connect(strikeGainG); strikeGainG.connect(master)
    strikeG.start(now); strikeG.stop(now + 0.08)
  }
}

// ---------------------------------------------------------------------------
// Bell – clear chime with inharmonic bell-physics partials
// ---------------------------------------------------------------------------
export const playBell = (intensity = 1.0) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const master = getAudioMasterNode()
  if (!master) return
  const now = ctx.currentTime
  const vol = Math.max(0.005, Math.min(1.5, Number(intensity) || 1.0))

  // Bell partials: inharmonic overtone series
  const partials = [
    { freq: 880, gain: 1.0, decay: 1.8 },
    { freq: 1056, gain: 0.6, decay: 1.2 },
    { freq: 1320, gain: 0.4, decay: 0.85 },
    { freq: 1760, gain: 0.25, decay: 0.6 },
    { freq: 2464, gain: 0.15, decay: 0.38 }
  ]
  for (const p of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = p.freq
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(vol * p.gain * 0.38, now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay)
    osc.connect(g); g.connect(master)
    osc.start(now); osc.stop(now + p.decay + 0.05)
  }
  // Strike transient
  const strikeOsc = ctx.createOscillator()
  const strikeGain = ctx.createGain()
  strikeOsc.type = 'triangle'
  strikeOsc.frequency.setValueAtTime(4400, now)
  strikeOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.025)
  strikeGain.gain.setValueAtTime(0.0001, now)
  strikeGain.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.004)
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038)
  strikeOsc.connect(strikeGain); strikeGain.connect(master)
  strikeOsc.start(now); strikeOsc.stop(now + 0.045)
}
export const shouldEmitSignal = (eventKey) => {
  if (!eventKey) return false
  const now = Date.now()
  const prev = signalHistory.get(eventKey)
  if (prev && now - prev < 350) return false
  signalHistory.set(eventKey, now)
  return true
}

export const clearSignalHistory = () => {
  signalHistory.clear()
}

export const emitTimerSignal = ({ eventKey, soundEnabled, soundType = 'box-gong', kind }) => {
  if (!shouldEmitSignal(eventKey)) return

  try {
    if (soundEnabled) {
      ensureAudioUnlocked()
      if (kind === 'round-start') {
        playWhistleStart(1900)
      } else if (kind === 'session-end') {
        playSiren(1200)
      } else if (kind === 'countdown-3') {
        if (soundType === 'box-gong') playBoxGong(0.45)
        else if (soundType === 'chinese-gong') playChineseGong(0.4)
        else if (soundType === 'bell') playBell(0.45)
        else playBeep(900, 160, 0, 0.5)
      } else if (kind === 'countdown-2') {
        if (soundType === 'box-gong') playBoxGong(0.62)
        else if (soundType === 'chinese-gong') playChineseGong(0.57)
        else if (soundType === 'bell') playBell(0.62)
        else playBeep(1120, 160, 0, 0.52)
      } else if (kind === 'countdown-1') {
        if (soundType === 'box-gong') playBoxGong(0.85)
        else if (soundType === 'chinese-gong') playChineseGong(0.75)
        else if (soundType === 'bell') playBell(0.85)
        else playBeep(1360, 170, 0, 0.56)
      }
    }
  } catch {}
}
