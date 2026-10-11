// Timer der Warm-up-Karte (Cardio 5 Min., Gelenke 2 Min.) - Absprache Paul 11.10.
// Zeitbasis ist ein fester Endzeitpunkt (endsAt), damit der Timer auch bei gesperrtem Display bzw. nach einem
// App-Neustart stimmt (wie stores/restTimerStore.js). Es läuft immer nur EIN Warm-up-Timer.
//
// Ist die Zeit um, merkt sich der Store den Schritt als "fertig" (finished). Die Karte (WarmupCard.vue) hakt ihn
// dann im Workout ab - auch wenn der Nutzer zwischendurch eine andere Seite offen hatte. Ohne App im Vordergrund
// kommt eine Mitteilung (utils/warmupSignal.js), im Vordergrund der Ton wie beim Pausentimer.
// Der Bildschirm bleibt an, solange ein Timer läuft (keepAwakeGuard, wie bei den anderen Timern).
import { defineStore } from 'pinia'
import { emitTimerSignal, ensureAudioUnlocked } from '@/utils/timerAudio'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'
import { scheduleWarmupNotification, cancelWarmupNotification } from '@/utils/warmupSignal'
import { WARMUP_TIMER_SECONDS } from '@/utils/warmupPlan'
import { useRestTimerStore } from '@/stores/restTimerStore'

const STATE_KEY = 'ppl_warmup_timer_v1'
const KEEP_AWAKE_TAG = 'warmup-timer'
const TICK_MS = 250
let tickHandle = null

const IDLE = Object.freeze({
  step: '',
  endsAt: 0,
  durationSec: 0,
  pausedRemainingMs: 0,
  workoutKey: '',
  notifyTitle: '',
  notifyBody: ''
})

export const useWarmupTimerStore = defineStore('warmupTimer', {
  state: () => ({
    ...IDLE,
    nowMs: Date.now(),
    // Abgelaufene Schritte, die die Karte noch abhaken muss: [{ step, workoutKey }]
    finished: []
  }),
  getters: {
    isRunning: (s) => s.endsAt > 0,
    isPaused: (s) => s.endsAt === 0 && s.pausedRemainingMs > 0,
    isActive: (s) => s.endsAt > 0 || s.pausedRemainingMs > 0,
    remainingMs(s) {
      if (s.endsAt > 0) return Math.max(0, s.endsAt - s.nowMs)
      return s.pausedRemainingMs
    }
  },
  actions: {
    /**
     * @param {{ step: 'cardio'|'joints', workoutKey: string, notifyTitle?: string, notifyBody?: string, seconds?: number }} options
     */
    start({ step, workoutKey = '', notifyTitle = '', notifyBody = '', seconds }) {
      const sec = Number(seconds) > 0 ? Math.round(Number(seconds)) : WARMUP_TIMER_SECONDS[step]
      if (!sec) return
      ensureAudioUnlocked()
      this.cancel()
      this.step = step
      this.workoutKey = String(workoutKey)
      this.durationSec = sec
      this.pausedRemainingMs = 0
      this.notifyTitle = notifyTitle
      this.notifyBody = notifyBody
      this.nowMs = Date.now()
      this.endsAt = this.nowMs + sec * 1000
      this.persist()
      this.startTick()
      acquireKeepAwake(KEEP_AWAKE_TAG)
      this.scheduleNotification()
    },
    pause() {
      if (!this.isRunning) return
      this.pausedRemainingMs = Math.max(1000, this.endsAt - Date.now())
      this.endsAt = 0
      this.stopTick()
      cancelWarmupNotification().catch(() => {})
      releaseKeepAwake(KEEP_AWAKE_TAG)
      this.persist()
    },
    resume() {
      if (!this.isPaused) return
      this.nowMs = Date.now()
      this.endsAt = this.nowMs + this.pausedRemainingMs
      this.pausedRemainingMs = 0
      this.persist()
      this.startTick()
      acquireKeepAwake(KEEP_AWAKE_TAG)
      this.scheduleNotification()
    },
    /** Abbrechen ohne Abhaken (z. B. Schritt von Hand abgehakt oder das Workout beginnt). */
    cancel() {
      this.reset()
      this.stopTick()
      cancelWarmupNotification().catch(() => {})
      releaseKeepAwake(KEEP_AWAKE_TAG)
      this.persist()
    },
    reset() {
      Object.assign(this, IDLE)
    },
    scheduleNotification() {
      scheduleWarmupNotification(this.endsAt, { title: this.notifyTitle, body: this.notifyBody }).catch(() => {})
    },
    /** Zeit abgelaufen: Schritt als fertig merken, Ton im Vordergrund. `silent` = beim Wiederherstellen nach Neustart. */
    finish({ silent = false } = {}) {
      if (!this.step) return
      this.finished = [...this.finished, { step: this.step, workoutKey: this.workoutKey }]
      this.reset()
      this.stopTick()
      cancelWarmupNotification().catch(() => {})
      releaseKeepAwake(KEEP_AWAKE_TAG)
      if (!silent) {
        let melodyId = null
        try { melodyId = useRestTimerStore().soundId } catch {}
        emitTimerSignal({ eventKey: `warmup-end-${Date.now()}`, soundEnabled: true, kind: 'rest-end', melodyId })
        try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]) } catch {}
      }
      this.persist()
    },
    /** Fertige Schritte dieses Workouts holen (und aus dem Store nehmen). */
    consumeFinished(workoutKey) {
      const key = String(workoutKey)
      const mine = this.finished.filter((entry) => entry.workoutKey === key).map((entry) => entry.step)
      if (mine.length) {
        this.finished = this.finished.filter((entry) => entry.workoutKey !== key)
        this.persist()
      }
      return mine
    },
    tick() {
      this.nowMs = Date.now()
      if (this.isRunning && this.remainingMs <= 0) this.finish()
    },
    startTick() {
      if (tickHandle) return
      tickHandle = setInterval(() => this.tick(), TICK_MS)
    },
    stopTick() {
      if (!tickHandle) return
      clearInterval(tickHandle)
      tickHandle = null
    },
    persist() {
      try {
        const hasState = this.endsAt > 0 || this.pausedRemainingMs > 0 || this.finished.length > 0
        if (!hasState) { localStorage.removeItem(STATE_KEY); return }
        localStorage.setItem(STATE_KEY, JSON.stringify({
          step: this.step,
          endsAt: this.endsAt,
          durationSec: this.durationSec,
          pausedRemainingMs: this.pausedRemainingMs,
          workoutKey: this.workoutKey,
          notifyTitle: this.notifyTitle,
          notifyBody: this.notifyBody,
          finished: this.finished
        }))
      } catch {}
    },
    /** Nach App-Neustart: Timer fortsetzen; war die Zeit schon um, gilt der Schritt als geschafft (Mitteilung kam ja). */
    restore() {
      if (this.isActive || this.finished.length) return
      try {
        const saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null')
        if (!saved) return
        this.finished = Array.isArray(saved.finished)
          ? saved.finished.filter((e) => e && typeof e.step === 'string' && typeof e.workoutKey === 'string')
          : []
        if (saved.step && saved.endsAt > 0) {
          Object.assign(this, {
            step: saved.step,
            endsAt: saved.endsAt,
            durationSec: saved.durationSec,
            workoutKey: saved.workoutKey,
            notifyTitle: saved.notifyTitle || '',
            notifyBody: saved.notifyBody || '',
            nowMs: Date.now()
          })
          if (saved.endsAt <= Date.now()) {
            this.finish({ silent: true })
          } else {
            this.startTick()
            acquireKeepAwake(KEEP_AWAKE_TAG)
          }
        } else if (saved.step && saved.pausedRemainingMs > 0) {
          Object.assign(this, {
            step: saved.step,
            pausedRemainingMs: saved.pausedRemainingMs,
            durationSec: saved.durationSec,
            workoutKey: saved.workoutKey,
            notifyTitle: saved.notifyTitle || '',
            notifyBody: saved.notifyBody || ''
          })
        }
      } catch {}
    }
  }
})
