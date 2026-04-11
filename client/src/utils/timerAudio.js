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

export const emitTimerSignal = ({ eventKey, soundEnabled, kind }) => {
  if (!shouldEmitSignal(eventKey)) return

  try {
    if (soundEnabled) {
      ensureAudioUnlocked()
      if (kind === 'round-start' || kind === 'session-end') {
        if (kind === 'round-start') {
          playWhistleStart(1900)
        } else {
          playSiren(1200)
        }
      } else if (kind === 'countdown-3') {
        playBeep(900, 160, 0, 0.5)
      } else if (kind === 'countdown-2') {
        playBeep(1120, 160, 0, 0.52)
      } else if (kind === 'countdown-1') {
        playBeep(1360, 170, 0, 0.56)
      }
    }
  } catch {}
}
