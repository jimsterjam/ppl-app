// /src/stores/timerStore.js
import { defineStore } from 'pinia'
import { KeepAwake } from '@capacitor-community/keep-awake'
import {
  ensureAudioUnlocked,
  clearSignalHistory,
  emitTimerSignal
} from '@/utils/timerAudio'

const TICK_MS = 250
const TIMER_STATE_KEY = 'timer_state_v1'
const TIMER_SETTINGS_KEY = 'timer_settings_v1'
const TIMER_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const TIMER_NOTIFICATION_BASE_ID = 930000
const MAX_TIMER_NOTIFICATION_IDS = 120
let tickHandle = null
let keepAwakeEnabled = false
let lastPersistAt = 0
let appIsActive = true
let scheduledNotificationAt = 0
let lastRoundStartSignalKey = null
let lastSessionEndSignalKey = null
let lastWorkPhaseKey = null
let lastPhaseKey = null
let lastIntervalPhaseState = null

const readPersistedTimerState = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const savedAt = Number(parsed.savedAt || 0)
    if (!Number.isFinite(savedAt) || savedAt <= 0) return null
    if (Date.now() - savedAt > TIMER_STATE_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

const readPersistedTimerSettings = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TIMER_SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const getLocalNotifications = async () => {
  try {
    const module = await import('@capacitor/local-notifications')
    return module?.LocalNotifications || null
  } catch {
    return null
  }
}

const getTimerNotificationIdList = () => {
  return Array.from({ length: MAX_TIMER_NOTIFICATION_IDS }, (_, idx) => ({
    id: TIMER_NOTIFICATION_BASE_ID + idx + 1
  }))
}

const cancelTimerNotifications = async () => {
  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return
  try {
    await LocalNotifications.cancel({ notifications: getTimerNotificationIdList() })
  } catch {}
}

const scheduleTimerNotifications = async (storeState) => {
  if (appIsActive) return
  if (!storeState || storeState.status !== 'running' || !storeState.startedAt) return
  if (String(storeState?.config?.mode || 'interval') !== 'interval') return

  const now = Date.now()
  const startedAt = Number(storeState.startedAt || 0)
  const elapsed = Math.max(0, now - startedAt - Number(storeState.pausedTotalMs || 0))
  const workMs = (Number(storeState?.config?.minutes || 0) * 60 + Number(storeState?.config?.seconds || 0)) * 1000
  const restMs = Number(storeState?.config?.restSeconds || 0) * 1000
  const intervals = Math.max(1, Number(storeState?.config?.intervals || 1))
  const totalMs = (workMs + restMs) * intervals - restMs
  if (!Number.isFinite(totalMs) || totalMs <= 0) return

  const remainingMs = Math.max(0, totalMs - elapsed)
  if (remainingMs <= 0) return
  if (Math.abs(scheduledNotificationAt - (now + remainingMs)) < 1200) return

  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return

  try {
    await cancelTimerNotifications()
    await LocalNotifications.requestPermissions()

    const notifications = []
    let nextId = TIMER_NOTIFICATION_BASE_ID + 1
    const cycleMs = workMs + restMs

    for (let roundIdx = 0; roundIdx < intervals; roundIdx += 1) {
      const roundStartAt = startedAt + roundIdx * cycleMs
      if (roundStartAt <= now + 250) continue

      for (const value of [3, 2, 1]) {
        const at = roundStartAt - value * 1000
        if (at <= now + 250) continue
        notifications.push({
          id: nextId,
          title: 'Timer',
          body: `${value}`,
          schedule: { at: new Date(at), allowWhileIdle: true }
        })
        nextId += 1
      }

      // Mehrfaches Signal simuliert einen langen, klaren Startton im Hintergrund.
      const roundStartOffsets = [0, 500, 1000]
      for (const offset of roundStartOffsets) {
        const at = roundStartAt + offset
        if (at <= now + 250) continue
        notifications.push({
          id: nextId,
          title: 'Timer',
          body: `Runde ${roundIdx + 1} startet jetzt`,
          schedule: { at: new Date(at), allowWhileIdle: true }
        })
        nextId += 1
      }

      if (nextId - TIMER_NOTIFICATION_BASE_ID >= MAX_TIMER_NOTIFICATION_IDS - 4) break
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications })
    }

    scheduledNotificationAt = now + remainingMs
  } catch {}
}

const setKeepAwake = async (enabled) => {
  if (typeof window === 'undefined') return
  if (keepAwakeEnabled === enabled) return
  keepAwakeEnabled = enabled
  try {
    if (enabled) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {}
}

const DEFAULT_CONFIG = {
  mode: 'interval',
  // hours entfernt
  minutes: 0,
  seconds: 30,
  prepSeconds: 0,
  restSeconds: 15,
  intervals: 1,
  countDirection: 'down',
  countdown: true,
  countdownSoundType: 'box-gong',
  speechEnabled: false,
  speechLocale: 'de-DE'
}

const INITIAL_CONFIG = {
  ...DEFAULT_CONFIG,
  ...(readPersistedTimerSettings() || {})
}

export const useTimerStore = defineStore('timer', {
  state: () => ({
    config: { ...INITIAL_CONFIG },
    status: 'idle',
    miniVisible: true,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    nowMs: Date.now(),
    countdownOverlayNumber: null,
    countdownOverlayVariant: null,
    countdownOverlayKey: 0,
    countdownLastSecond: null,
    prepLastSecond: null,
    startFlashUntil: null,
    debugRestoreLastCallAt: 0,
    debugRestoreSource: '',
    debugRestoreFoundState: false,
    debugRestoreWasActive: false,
    debugPersistLastAt: 0,
    debugPersistSource: ''
  }),
  getters: {
    isActive: (s) => s.status === 'running' || s.status === 'paused' || s.status === 'armed' || s.status === 'completed',
    isRunning: (s) => s.status === 'running',
    isPaused: (s) => s.status === 'paused',
    isArmed: (s) => s.status === 'armed',
    isCompleted: (s) => s.status === 'completed',
    isRunningLike: (s) => s.status === 'running' || s.status === 'paused',
    mode: (s) => (String(s?.config?.mode || 'interval') === 'stopwatch' ? 'stopwatch' : 'interval'),
    isStopwatchMode() {
      return this.mode === 'stopwatch'
    },
    isIntervalMode() {
      return this.mode === 'interval'
    },
    countDirection: (s) => (String(s?.config?.countDirection || 'down') === 'up' ? 'up' : 'down'),
    isCountDown() {
      return this.countDirection === 'down'
    },
    workMs: (s) => ((s.config.minutes * 60 + s.config.seconds) * 1000),
    restMs: (s) => s.config.restSeconds * 1000,
    stopwatchStartMs() {
      return Math.max(0, (Number(this.config.minutes || 0) * 60 + Number(this.config.seconds || 0)) * 1000)
    },
    elapsedMs: (s) => {
      if (!s.startedAt) return 0
      const now = s.status === 'paused' && s.pausedAt ? s.pausedAt : s.nowMs
      return Math.max(0, now - s.startedAt - s.pausedTotalMs)
    },
    phaseInfo(state) {
      if (!state.startedAt) return { intervalIndex: 1, intervalTotal: Math.max(1, state.config.intervals), isRest: false, phaseElapsed: 0, phaseDuration: 0 }
      const now = state.status === 'paused' && state.pausedAt ? state.pausedAt : state.nowMs
      const elapsed = Math.max(0, now - state.startedAt - state.pausedTotalMs)
      const mode = String(state?.config?.mode || 'interval')
      if (mode === 'stopwatch') {
        const startMs = Math.max(0, (Number(state?.config?.minutes || 0) * 60 + Number(state?.config?.seconds || 0)) * 1000)
        const isDown = String(state?.config?.countDirection || 'down') !== 'up'
        const phaseElapsed = isDown ? Math.min(startMs, elapsed) : elapsed
        const phaseDuration = isDown ? startMs : 0
        return { intervalIndex: 1, intervalTotal: 1, isRest: false, phaseElapsed, phaseDuration }
      }
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
      if (this.isStopwatchMode) {
        if (this.isCountDown) {
          return Math.max(0, this.stopwatchStartMs - this.elapsedMs)
        }
        return this.stopwatchStartMs + this.elapsedMs
      }
      const { phaseElapsed, phaseDuration } = this.phaseInfo
      return this.config.countdown ? Math.max(0, phaseDuration - phaseElapsed) : phaseElapsed
    },
    progressPercent() {
      if (this.isStopwatchMode) {
        if (!this.isCountDown || this.stopwatchStartMs <= 0) return 0
        return Math.min(100, (this.elapsedMs / this.stopwatchStartMs) * 100)
      }
      const { phaseElapsed, phaseDuration } = this.phaseInfo
      return phaseDuration ? (phaseElapsed / phaseDuration) * 100 : 0
    }
  },
  actions: {
    saveSettings(source = 'unknown') {
      if (typeof window === 'undefined') return false
      try {
        localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(this.config || {}))
        this.debugPersistLastAt = Date.now()
        this.debugPersistSource = `settings:${source}`
        return true
      } catch {
        return false
      }
    },
    setAppActive(isActive) {
      appIsActive = Boolean(isActive)
      if (appIsActive) {
        scheduledNotificationAt = 0
        cancelTimerNotifications()
      } else if (this.isRunning) {
        scheduleTimerNotifications(this)
      }
    },
    showMini() {
      this.miniVisible = true
      this.persistState(false, 'showMini')
    },
    hideMini() {
      this.miniVisible = false
      this.persistState(false, 'hideMini')
    },
    persistState(force = false, source = 'unknown') {
      if (typeof window === 'undefined') return false
      const now = Date.now()
      if (!force && now - lastPersistAt < 1000) return false
      lastPersistAt = now
      try {
        localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({
          savedAt: now,
          config: this.config,
          status: this.status,
          miniVisible: this.miniVisible,
          startedAt: this.startedAt,
          pausedAt: this.pausedAt,
          pausedTotalMs: this.pausedTotalMs
        }))
        this.debugPersistLastAt = now
        this.debugPersistSource = source
        return true
      } catch {
        return false
      }
    },
    restoreState(source = 'unknown') {
      this.debugRestoreLastCallAt = Date.now()
      this.debugRestoreSource = source
      const parsed = readPersistedTimerState()
      if (!parsed) {
        this.debugRestoreFoundState = false
        this.debugRestoreWasActive = false
        return false
      }

      const allowedStatus = ['idle', 'armed', 'running', 'paused', 'completed']
      const status = allowedStatus.includes(parsed.status) ? parsed.status : 'idle'
      this.config = { ...DEFAULT_CONFIG, ...(parsed.config || {}) }
      this.saveSettings('restoreState')
      this.status = status
      this.miniVisible = parsed.miniVisible !== false
      this.startedAt = Number.isFinite(Number(parsed.startedAt)) ? Number(parsed.startedAt) : null
      this.pausedAt = Number.isFinite(Number(parsed.pausedAt)) ? Number(parsed.pausedAt) : null
      this.pausedTotalMs = Number.isFinite(Number(parsed.pausedTotalMs)) ? Number(parsed.pausedTotalMs) : 0
      this.nowMs = Date.now()

      this.countdownOverlayNumber = null
      this.countdownOverlayVariant = null
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      lastRoundStartSignalKey = null
      lastSessionEndSignalKey = null
      lastWorkPhaseKey = null
      lastPhaseKey = null
      lastIntervalPhaseState = null
      clearSignalHistory()
      lastSessionEndSignalKey = null

      if (this.status === 'running' && this.startedAt) {
        this.startTick()
        setKeepAwake(true)
        this.tickNow()
        if (!appIsActive) scheduleTimerNotifications(this)
      } else {
        this.stopTick()
        setKeepAwake(this.status === 'paused')
        if (appIsActive) cancelTimerNotifications()
      }

      this.debugRestoreFoundState = true
      this.debugRestoreWasActive = this.isActive
      return this.isActive
    },
    unlockAudio() {
      ensureAudioUnlocked()
    },
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
      cfg.countDirection = String(cfg?.countDirection || 'down') === 'up' ? 'up' : 'down'
      cfg.countdown = String(cfg?.mode || 'interval') === 'interval'
        ? true
        : cfg.countDirection !== 'up'
      this.config = cfg
      this.saveSettings('start')
      const workMs = this.workMs
      const restMs = this.restMs
      const intervals = Math.max(1, cfg.intervals)
      const totalMs = (workMs + restMs) * intervals - restMs
      if (this.isIntervalMode && totalMs <= 0) {
        setKeepAwake(false)
        return false
      }
      this.status = 'running'
      this.showMini()
      const now = Date.now()
      // const prepMs = Math.max(0, Number(cfg.prepSeconds || 0)) * 1000
      const prepMs = this.isStopwatchMode ? 0 : Math.max(0, Number(cfg.prepSeconds || 0)) * 1000
      const startDelayMs = Number.isFinite(prepMs) ? prepMs : 0
      this.startedAt = now + startDelayMs
      this.pausedAt = null
      this.pausedTotalMs = 0
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      lastRoundStartSignalKey = null
      lastSessionEndSignalKey = null
      lastWorkPhaseKey = null
      lastPhaseKey = null
      lastIntervalPhaseState = null
      clearSignalHistory()
      ensureAudioUnlocked()
      this.setCountdownOverlay(null)
      setKeepAwake(true)
      this.startTick()
      this.persistState(true, 'start')
      if (!appIsActive) scheduleTimerNotifications(this)
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
      lastRoundStartSignalKey = null
      lastSessionEndSignalKey = null
      lastWorkPhaseKey = null
      lastPhaseKey = null
      lastIntervalPhaseState = null
      clearSignalHistory()
      setKeepAwake(true)
      this.persistState(true, 'pause')
      cancelTimerNotifications()
    },
    resume() {
      if (!this.startedAt) { this.start(); return }
      if (!this.isPaused || !this.pausedAt) return
      const resumeAt = Date.now()
      const pausedDuration = Math.max(0, resumeAt - this.pausedAt)

      // If pause happened during prep (startedAt in the future), shift the prep window forward
      // so the remaining prep time continues visibly after resume.
      if (this.startedAt && this.pausedAt < this.startedAt) {
        this.startedAt += pausedDuration
      } else {
        this.pausedTotalMs += pausedDuration
      }

      this.pausedAt = null
      this.status = 'running'
      this.showMini()
      clearSignalHistory()
      lastIntervalPhaseState = null
      setKeepAwake(true)
      this.startTick()
      this.persistState(true, 'resume')
      if (!appIsActive) scheduleTimerNotifications(this)
    },
    stop() {
      this.stopTick()
      this.status = 'idle'
      this.showMini()
      this.setCountdownOverlay(null)
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      lastRoundStartSignalKey = null
      lastSessionEndSignalKey = null
      lastWorkPhaseKey = null
      lastPhaseKey = null
      lastIntervalPhaseState = null
      clearSignalHistory()
      setKeepAwake(false)
      this.persistState(true, 'stop')
      cancelTimerNotifications()
    },
    complete() {
      this.stopTick()
      this.status = 'completed'
      this.showMini()
      this.setCountdownOverlay(null)
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      lastWorkPhaseKey = null
      lastPhaseKey = null
      lastIntervalPhaseState = null
      clearSignalHistory()
      setKeepAwake(false)
      this.persistState(true, 'complete')
      cancelTimerNotifications()
    },
    reset() {
      this.stop()
      this.startedAt = null
      this.pausedAt = null
      this.pausedTotalMs = 0
      setKeepAwake(false)
      this.persistState(true, 'reset')
    },
    prepare(config = null) {
      const cfg = config ? { ...DEFAULT_CONFIG, ...config } : this.config
      this.config = cfg
      this.saveSettings('prepare')
      this.stopTick()
      this.status = 'armed'
      this.showMini()
      this.startedAt = null
      this.pausedAt = null
      this.pausedTotalMs = 0
      this.nowMs = Date.now()
      this.setCountdownOverlay(null)
      this.countdownLastSecond = null
      this.prepLastSecond = null
      this.startFlashUntil = null
      lastRoundStartSignalKey = null
      lastSessionEndSignalKey = null
      lastWorkPhaseKey = null
      lastPhaseKey = null
      lastIntervalPhaseState = null
      clearSignalHistory()
      setKeepAwake(false)
      this.persistState(true, 'prepare')
      cancelTimerNotifications()
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

      if (this.isStopwatchMode) {
        if (this.startedAt && this.nowMs < this.startedAt) {
          const remainingPrep = Math.ceil((this.startedAt - this.nowMs) / 1000)
          const safeRemaining = Math.max(0, remainingPrep)
          if (safeRemaining >= 1 && safeRemaining <= 3) {
            this.setCountdownOverlay(safeRemaining, 'prep')
            if (safeRemaining !== this.prepLastSecond) {
              emitTimerSignal({
                eventKey: `sw-prep-countdown:${safeRemaining}:${this.startedAt || 0}`,
                soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
                soundType: this.config.countdownSoundType || 'box-gong',
                kind: `countdown-${safeRemaining}`
              })
            }
          } else if (this.countdownOverlayVariant === 'prep') {
            this.setCountdownOverlay(null)
          }
          this.prepLastSecond = safeRemaining
          this.countdownLastSecond = null
          return
        }

        const direction = this.countDirection
        const startMs = this.stopwatchStartMs
        const stopwatchElapsed = this.elapsedMs
        const swKey = `${this.startedAt || 0}:${direction}:${startMs}`

        if (stopwatchElapsed <= TICK_MS + 30 && lastRoundStartSignalKey !== swKey) {
          emitTimerSignal({
            eventKey: `sw-start:${swKey}`,
            soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
            soundType: this.config.countdownSoundType || 'box-gong',
            kind: 'round-start'
          })
          lastRoundStartSignalKey = swKey
        }

        if (direction === 'down' && startMs > 0) {
          const remainingMs = Math.max(0, startMs - stopwatchElapsed)
          const remainingSeconds = Math.ceil(remainingMs / 1000)

          if (remainingSeconds > 0 && remainingSeconds <= 3 && remainingSeconds !== this.countdownLastSecond) {
            this.setCountdownOverlay(remainingSeconds)
            emitTimerSignal({
              eventKey: `sw-countdown:${swKey}:${remainingSeconds}`,
              soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
              soundType: this.config.countdownSoundType || 'box-gong',
              kind: `countdown-${remainingSeconds}`
            })
            this.countdownLastSecond = remainingSeconds
          } else if (remainingSeconds > 3) {
            this.setCountdownOverlay(null)
            this.countdownLastSecond = null
          }

          if (stopwatchElapsed >= startMs) {
            if (lastSessionEndSignalKey !== swKey) {
              emitTimerSignal({
                eventKey: `sw-session-end:${swKey}`,
                soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
                soundType: this.config.countdownSoundType || 'box-gong',
                kind: 'session-end'
              })
              lastSessionEndSignalKey = swKey
            }
            this.complete()
            return
          }
        } else {
          this.setCountdownOverlay(null)
          this.countdownLastSecond = null
        }

        if (!(direction === 'down' && startMs > 0 && stopwatchElapsed >= Math.max(0, startMs - 3000))) {
          this.setCountdownOverlay(null)
        }
        this.prepLastSecond = null
        this.startFlashUntil = null
        this.persistState(false, 'tickNow-stopwatch')
        if (!appIsActive) scheduleTimerNotifications(this)
        return
      }

      if (this.startedAt && this.nowMs < this.startedAt) {
        const remainingPrep = Math.ceil((this.startedAt - this.nowMs) / 1000)
        const safeRemaining = Math.max(0, remainingPrep)
        if (safeRemaining >= 1 && safeRemaining <= 3) {
          this.setCountdownOverlay(safeRemaining, 'prep')
          if (safeRemaining !== this.prepLastSecond) {
            emitTimerSignal({
              eventKey: `prep:${safeRemaining}:${this.startedAt || 0}`,
              soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
              soundType: this.config.countdownSoundType || 'box-gong',
              kind: `countdown-${safeRemaining}`
            })
          }
        } else if (this.countdownOverlayVariant === 'prep') {
          this.setCountdownOverlay(null)
        }
        this.prepLastSecond = safeRemaining
        this.countdownLastSecond = null
        return
      }

      if (this.prepLastSecond !== null) {
        this.startFlashUntil = null
        if (this.countdownOverlayVariant === 'prep' || this.countdownOverlayVariant === 'start') {
          this.setCountdownOverlay(null)
        }
      }
      this.prepLastSecond = null

      const { phaseElapsed, phaseDuration } = this.phaseInfo
      const intervalKey = `${this.phaseInfo.intervalIndex}:${this.phaseInfo.isRest ? 'rest' : 'work'}`
      const isWorkPhase = !this.phaseInfo.isRest
      const phaseKey = `${intervalKey}:${Math.floor(phaseElapsed / 250)}`
      const phaseState = `${this.phaseInfo.intervalIndex}:${this.phaseInfo.isRest ? 'rest' : 'work'}`
      const isWorkPhaseStartWindow = isWorkPhase && phaseElapsed <= TICK_MS + 120

      if (lastPhaseKey !== phaseKey) {
        lastPhaseKey = phaseKey
      }

      if (lastIntervalPhaseState !== phaseState) {
        if (isWorkPhase) {
          if (isWorkPhaseStartWindow && lastRoundStartSignalKey !== intervalKey) {
            emitTimerSignal({
              eventKey: `phase-start:${phaseState}:${this.startedAt || 0}`,
              soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
              soundType: this.config.countdownSoundType || 'box-gong',
              kind: 'round-start'
            })
          }
          lastRoundStartSignalKey = intervalKey
        }
        lastIntervalPhaseState = phaseState
      }

      if (isWorkPhase) {
        lastWorkPhaseKey = intervalKey
      }

      // 3-2-1 vor jeder naechsten Active-Phase:
      // - mit Restzeit: am Ende der Restphase
      // - ohne Restzeit: am Ende der Work-Phase (wenn eine weitere Runde folgt)
      const hasNextRound = this.phaseInfo.intervalIndex < this.phaseInfo.intervalTotal
      const inRestCountdownWindow = this.phaseInfo.isRest && phaseDuration > 0
      const inNoRestWorkCountdownWindow = isWorkPhase && this.restMs <= 0 && hasNextRound && phaseDuration > 0
      const shouldRunRoundCountdown = inRestCountdownWindow || inNoRestWorkCountdownWindow

      if (shouldRunRoundCountdown) {
        const remainingSeconds = Math.ceil(Math.max(0, phaseDuration - phaseElapsed) / 1000)
        if (remainingSeconds > 0 && remainingSeconds <= 3 && remainingSeconds !== this.countdownLastSecond) {
          this.setCountdownOverlay(remainingSeconds)
          emitTimerSignal({
            eventKey: inNoRestWorkCountdownWindow
              ? `countdown:norest:${this.phaseInfo.intervalIndex}:${remainingSeconds}`
              : `countdown:${intervalKey}:${remainingSeconds}`,
            soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
            soundType: this.config.countdownSoundType || 'box-gong',
            kind: `countdown-${remainingSeconds}`
          })
          this.countdownLastSecond = remainingSeconds
        } else if (remainingSeconds > 3) {
          this.setCountdownOverlay(null)
          this.countdownLastSecond = null
        }
      } else {
        this.setCountdownOverlay(null)
        this.countdownLastSecond = null
      }

      const totalTime = (this.workMs + this.restMs) * Math.max(1, this.config.intervals) - this.restMs
      if (this.elapsedMs >= totalTime) {
        const sessionEndKey = `${this.startedAt || 0}:${totalTime}`
        if (lastSessionEndSignalKey !== sessionEndKey) {
          emitTimerSignal({
            eventKey: `session-end:${sessionEndKey}`,
            soundEnabled: String(this.config.countdownSoundType ?? 'box-gong') !== 'none',
            soundType: this.config.countdownSoundType || 'box-gong',
            kind: 'session-end'
          })
          lastSessionEndSignalKey = sessionEndKey
        }
        this.complete()
        return
      }
      this.persistState(false, 'tickNow')
      if (!appIsActive) scheduleTimerNotifications(this)
    },
    
  }
})