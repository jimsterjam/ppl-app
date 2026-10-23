// Übergangs-Stoppuhr (Absprache Paul 24.10.): läuft nach dem letzten Satz einer Übung hoch, bis die nächste
// Übung gestartet wird ("Übergang zur nächsten Übung"). Anders als die Pause kennt sie kein Ziel, keinen Ton und
// keine Mitteilung - wie lange der Wechsel dauert (Gerät besetzt, weiter Weg), weiß vorher niemand.
// Zeitbasis ist der Startzeitpunkt, damit die Zeit bei gesperrtem Display bzw. nach App-Neustart stimmt.
import { defineStore } from 'pinia'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'

const STATE_KEY = 'ppl_transition_timer_v1'
const KEEP_AWAKE_TAG = 'transition-timer'
// Ein Übergang, der länger als das dauert, stammt aus einer vergessenen Sitzung und wird verworfen.
export const TRANSITION_MAX_AGE_MS = 4 * 60 * 60 * 1000
const TICK_MS = 500
let tickHandle = null

export const useTransitionTimerStore = defineStore('transitionTimer', {
  state: () => ({
    startedAt: 0,
    // Index der gerade beendeten Übung; die nächste Übung folgt danach.
    exIndex: -1,
    minimized: false,
    nowMs: Date.now()
  }),
  getters: {
    isActive: (s) => s.startedAt > 0,
    elapsedMs: (s) => (s.startedAt > 0 ? Math.max(0, s.nowMs - s.startedAt) : 0),
    showOverlay() {
      return this.isActive && !this.minimized
    }
  },
  actions: {
    start(exIndex) {
      this.startedAt = Date.now()
      this.nowMs = this.startedAt
      this.exIndex = Number.isInteger(exIndex) ? exIndex : -1
      this.minimized = false
      this.persist()
      this.startTick()
      acquireKeepAwake(KEEP_AWAKE_TAG)
    },
    clear() {
      if (!this.startedAt && !tickHandle) return
      this.startedAt = 0
      this.exIndex = -1
      this.minimized = false
      this.stopTick()
      releaseKeepAwake(KEEP_AWAKE_TAG)
      this.persist()
    },
    minimize() {
      this.minimized = true
    },
    expand() {
      this.minimized = false
    },
    tick() {
      this.nowMs = Date.now()
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
        if (!this.startedAt) { localStorage.removeItem(STATE_KEY); return }
        localStorage.setItem(STATE_KEY, JSON.stringify({ startedAt: this.startedAt, exIndex: this.exIndex }))
      } catch {}
    },
    /** Nach App-Neustart: laufenden Übergang wiederherstellen (zu alte verwerfen). */
    restore() {
      try {
        const saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null')
        const age = saved ? Date.now() - Number(saved.startedAt) : Infinity
        if (!saved || !(saved.startedAt > 0) || age < 0 || age > TRANSITION_MAX_AGE_MS) {
          localStorage.removeItem(STATE_KEY)
          return
        }
        this.startedAt = saved.startedAt
        this.exIndex = Number.isInteger(saved.exIndex) ? saved.exIndex : -1
        this.nowMs = Date.now()
        this.startTick()
        acquireKeepAwake(KEEP_AWAKE_TAG)
      } catch {}
    }
  }
})
