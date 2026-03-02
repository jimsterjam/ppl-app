// /src/stores/timerStore.js
import { defineStore } from 'pinia'
import { KeepAwake } from '@capacitor-community/keep-awake'

const TICK_MS = 250
let tickHandle = null
let audioContext = null
let keepAwakeEnabled = false

const setKeepAwake = async (enabled) => {
  if (typeof window === 'undefined') return
  if (keepAwakeEnabled === enabled) return
  keepAwakeEnabled = enabled
  try {
    if (enabled) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {}
}

const getAudioContext = () => {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioContext = new Ctx()
  }
  return audioContext
}

const playBeep = (frequency = 880, durationMs = 250) => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.value = 0.12
  osc.connect(gain)
  gain.connect(ctx.destination)
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
  osc.start(now)
  osc.stop(now + durationMs / 1000)
}

const DEFAULT_CONFIG = {
  // hours entfernt
  minutes: 0,
  seconds: 30,
  prepSeconds: 0,
  restSeconds: 15,
  intervals: 1,
  countdown: true,
  countdownSound: true,
  speechEnabled: false,
  speechLocale: 'de-DE',
  vibration: false
}

export const useTimerStore = defineStore('timer', {
  state: () => ({
    config: { ...DEFAULT_CONFIG },
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    nowMs: Date.now(),
    countdownOverlayNumber: null,
    countdownOverlayVariant: null,
    countdownOverlayKey: 0,
    countdownLastSecond: null,
    prepLastSecond: null,
    startFlashUntil: null
  }),
  getters: {
    isActive: (s) => s.status === 'running' || s.status === 'paused',
    isRunning: (s) => s.status === 'running',
    isPaused: (s) => s.status === 'paused',
    workMs: (s) => ((s.config.minutes * 60 + s.config.seconds) * 1000),
    restMs: (s) => s.config.restSeconds * 1000,
    elapsedMs: (s) => {
      if (!s.startedAt) return 0
      const now = s.status === 'paused' && s.pausedAt ? s.pausedAt : s.nowMs
      return Math.max(0, now - s.startedAt - s.pausedTotalMs)
    },
    phaseInfo(state) {
      if (!state.startedAt) return { intervalIndex: 1, intervalTotal: Math.max(1, state.config.intervals), isRest: false, phaseElapsed: 0, phaseDuration: 0 }
      const now = state.status === 'paused' && state.pausedAt ? state.pausedAt : state.nowMs
      const elapsed = Math.max(0, now - state.startedAt - state.pausedTotalMs)
      const work = this.workMs
      const rest = this.restMs
      const intervals = Math.max(1, state.config.intervals)
      if (work <= 0) return { intervalIndex: 1, intervalTotal: intervals, isRest: false, phaseElapsed: 0, phaseDuration: 0 }
      const cycle = work + rest
      const intervalIndex = Math.min(intervals - 1, Math.floor(elapsed / cycle))
      const offset = elapsed - intervalIndex * cycle
      const isRest = offset >= work && intervalIndex < intervals - 1 && rest > 0
      const phaseElapsed = isRest ? Math.min(rest, offset - work) : Math.min(work, offset)
      const phaseDuration = isRest ? rest : work
      return { intervalIndex: intervalIndex + 1, intervalTotal: intervals, isRest, phaseElapsed, phaseDuration }
    },
    displayMs() {
      const { phaseElapsed, phaseDuration } = this.phaseInfo
      return this.config.countdown ? Math.max(0, phaseDuration - phaseElapsed) : phaseElapsed
    },
    progressPercent() {
      const { phaseElapsed, phaseDuration } = this.phaseInfo
      return phaseDuration ? (phaseElapsed / phaseDuration) * 100 : 0
    }
  },
  actions: {
    unlockAudio() {},
    unlockSpeech() {},
    cancelSpeech() {},
    ttsBackend() { return 'none' },
    setCountdownOverlay(value, variant = null) {
      if (this.countdownOverlayNumber === value && this.countdownOverlayVariant === variant) return
      this.countdownOverlayNumber = value
      this.countdownOverlayVariant = variant
      this.countdownOverlayKey += 1
    },
    start(config = null) {
      const cfg = config ? { ...DEFAULT_CONFIG, ...config } : this.config
      this.config = cfg
      const workMs = this.workMs
      const restMs = this.restMs
      const intervals = Math.max(1, cfg.intervals)
      const totalMs = (workMs + restMs) * intervals - restMs
      if (totalMs <= 0) {
        setKeepAwake(false)
        return false
      }
      this.status = 'running'
      const now = Date.now()
      const prepMs = Math.max(0, Number(cfg.prepSeconds || 0)) * 1000
      const startDelayMs = Number.isFinite(prepMs) ? prepMs : 0
      this.startedAt = now + startDelayMs
      this.pausedAt = null
      this.pausedTotalMs = 0
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      this.setCountdownOverlay(null)
      setKeepAwake(true)
      this.startTick()
      return true
    },
    pause() {
      if (!this.isRunning) return
      this.pausedAt = Date.now()
      this.status = 'paused'
      this.stopTick()
      this.setCountdownOverlay(null)
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      setKeepAwake(true)
    },
    resume() {
      if (!this.startedAt) { this.start(); return }
      if (!this.isPaused || !this.pausedAt) return
      this.pausedTotalMs += Date.now() - this.pausedAt
      this.pausedAt = null
      this.status = 'running'
      setKeepAwake(true)
      this.startTick()
    },
    stop() {
      this.stopTick()
      this.status = 'idle'
      this.setCountdownOverlay(null)
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      setKeepAwake(false)
    },
    reset() {
      this.stop()
      this.startedAt = null
      this.pausedAt = null
      this.pausedTotalMs = 0
      setKeepAwake(false)
    },
    prepare(config = null) {
      const cfg = config ? { ...DEFAULT_CONFIG, ...config } : this.config
      this.config = cfg
      this.stopTick()
      this.status = 'paused'
      this.startedAt = null
      this.pausedAt = null
      this.pausedTotalMs = 0
      this.nowMs = Date.now()
      this.setCountdownOverlay(null)
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      setKeepAwake(false)
      return true
    },
    startTick() {
      this.stopTick()
      tickHandle = setInterval(() => this.tickNow(), TICK_MS)
    },
    stopTick() {
      if (tickHandle) clearInterval(tickHandle)
      tickHandle = null
    },
    tickNow() {
      if (!this.isRunning) return
      this.nowMs = Date.now()
      if (this.startedAt && this.nowMs < this.startedAt) {
        const remainingPrep = Math.ceil((this.startedAt - this.nowMs) / 1000)
        const safeRemaining = Math.max(0, remainingPrep)
        if (safeRemaining <= 3) {
          this.setCountdownOverlay(safeRemaining, 'prep')
          if (
            this.config.countdownSound &&
            safeRemaining !== this.prepLastSecond
          ) {
            playBeep(2660, 120)
          }
        } else if (this.countdownOverlayVariant === 'prep') {
          this.setCountdownOverlay(null)
        }
        this.prepLastSecond = safeRemaining
        this.countdownLastSecond = null
        return
      }
      if (this.prepLastSecond !== null && this.prepLastSecond <= 3) {
        this.startFlashUntil = this.nowMs 
        this.setCountdownOverlay('WORKOUT', 'start')
      }
      if (this.startFlashUntil && this.nowMs < this.startFlashUntil) {
        return
      }
      if (this.startFlashUntil && this.nowMs >= this.startFlashUntil) {
        this.startFlashUntil = null
        if (this.countdownOverlayVariant === 'start') {
          this.setCountdownOverlay(null)
        }
      }
      this.prepLastSecond = null
      const { phaseElapsed, phaseDuration } = this.phaseInfo
      if (this.config.countdown) {
        const remainingSeconds = Math.ceil(Math.max(0, phaseDuration - phaseElapsed) / 1000)
        if (remainingSeconds > 0 && remainingSeconds <= 3 && remainingSeconds !== this.countdownLastSecond) {
          this.setCountdownOverlay(remainingSeconds)
          if (this.config.countdownSound) playBeep(820, 120)
          this.countdownLastSecond = remainingSeconds
        } else if (remainingSeconds === 0 && this.countdownLastSecond !== 0) {
          // Nach 3-2-1: langer Beep, kein Text/Overlay
          if (this.config.countdownSound) playBeep(1200, 800)
          this.setCountdownOverlay(null)
          this.countdownLastSecond = 0
        } else if (remainingSeconds > 3) {
          this.setCountdownOverlay(null)
          this.countdownLastSecond = null
        }
      }
      const totalTime = (this.workMs + this.restMs) * Math.max(1, this.config.intervals) - this.restMs
      if (this.elapsedMs >= totalTime) this.stop()
    },
    
  }
})