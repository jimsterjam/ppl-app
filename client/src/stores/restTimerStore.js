// Pausentimer zwischen Sätzen - bewusst getrennt vom Intervall-Timer (timerStore.js, für Übungen
// auf Zeit). Startet beim Abhaken eines Arbeitssatzes (WorkoutDetailView.vue), zählt die Pause
// herunter und meldet sich am Ende mit Ton und - wenn die App im Hintergrund ist - einer Mitteilung.
// Zeitbasis ist ein fester Endzeitpunkt (endsAt), damit die Pause auch bei gesperrtem Display
// bzw. nach einem App-Neustart korrekt weiterläuft.
import { defineStore } from 'pinia'
import { Capacitor } from '@capacitor/core'
import { emitTimerSignal, ensureAudioUnlocked } from '@/utils/timerAudio'
import { clampRestSeconds, REST_ENDING_MS, REST_STEP_SECONDS, shouldAutoExpandRest } from '@/utils/restTimerRules'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'

const STATE_KEY = 'ppl_rest_timer_state_v1'
const AUTO_KEY = 'ppl_rest_timer_auto_v1'
// Anzeige: groß in der Mitte (Vollbild, Standard) oder nur als Leiste unten.
const FULLSCREEN_KEY = 'ppl_rest_timer_fullscreen_v1'
// Bildschirm bleibt an, solange eine Pause läuft bzw. "Pause vorbei" sichtbar ist.
const KEEP_AWAKE_TAG = 'rest-timer'
const NOTIFICATION_ID = 940001
// Ton der Mitteilung, wenn die App im Hintergrund ist (Datei im iOS-Projekt: ios/App/App/rest-end.wav,
// im Xcode-Projekt als Ressource eingetragen). Ohne `sound` bleibt die Mitteilung auf iOS stumm.
const NOTIFICATION_SOUND = 'rest-end.wav'
// Die Mitteilung kommt etwas NACH dem Pausenende: Läuft die App im Vordergrund, beendet sie die Pause
// und nimmt die Mitteilung zurück (finish -> cancelNotification), bevor sie auslöst - sonst gäbe es
// Gong UND Mitteilungston gleichzeitig.
export const NOTIFICATION_DELAY_MS = 1200
// So lange bleibt "Nächster Satz" nach Ablauf sichtbar.
const FINISHED_VISIBLE_MS = 6000
const TICK_MS = 250
let tickHandle = null

function readAuto() {
  try {
    const raw = localStorage.getItem(AUTO_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

function readFullscreen() {
  try {
    const raw = localStorage.getItem(FULLSCREEN_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

async function getLocalNotifications() {
  try {
    const module = await import('@capacitor/local-notifications')
    return module?.LocalNotifications || null
  } catch {
    return null
  }
}

async function cancelNotification() {
  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return
  try { await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] }) } catch {}
}

/** Mitteilung für das Pausenende (mit Ton auf iOS). Exportiert für Tests. */
export function buildRestNotification(at, title, body, platform = 'web') {
  return {
    id: NOTIFICATION_ID,
    title,
    body,
    schedule: { at: new Date(at + NOTIFICATION_DELAY_MS), allowWhileIdle: true },
    ...(platform === 'ios' ? { sound: NOTIFICATION_SOUND } : {})
  }
}

async function scheduleNotification(at, title, body) {
  const LocalNotifications = await getLocalNotifications()
  if (!LocalNotifications) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
    await LocalNotifications.requestPermissions()
    await LocalNotifications.schedule({
      notifications: [buildRestNotification(at, title, body, Capacitor.getPlatform())]
    })
  } catch {}
}

export const useRestTimerStore = defineStore('restTimer', {
  state: () => ({
    autoStart: readAuto(),
    fullscreen: readFullscreen(),
    // Vollbild für DIESE Pause minimiert (Leiste unten); jede neue Pause startet wieder groß.
    minimized: false,
    // Automatisches Vergrößern bei <= 10 s ist für diese Pause schon passiert.
    autoExpanded: false,
    endsAt: 0,
    durationSec: 0,
    // Dauer beim Start (Standard bzw. gemerkt) - Abweichung zeigt "Für diese Übung merken".
    baseSec: 0,
    exerciseName: '',
    exIndex: -1,
    rowIndex: -1,
    finishedAt: 0,
    nowMs: Date.now(),
    // Texte für die Mitteilung (von der View in App-Sprache übergeben).
    notifyTitle: '',
    notifyBody: ''
  }),
  getters: {
    isRunning: (s) => s.endsAt > 0 && s.finishedAt === 0,
    remainingMs: (s) => (s.endsAt > 0 ? Math.max(0, s.endsAt - s.nowMs) : 0),
    showFinished: (s) => s.finishedAt > 0 && s.nowMs - s.finishedAt < FINISHED_VISIBLE_MS,
    isVisible() {
      return this.isRunning || this.showFinished
    },
    isAdjusted: (s) => s.durationSec !== s.baseSec,
    /** Große Anzeige in der Mitte statt Leiste. */
    showOverlay() {
      return this.isVisible && this.fullscreen && !this.minimized
    }
  },
  actions: {
    setAutoStart(value) {
      this.autoStart = !!value
      try { localStorage.setItem(AUTO_KEY, this.autoStart ? '1' : '0') } catch {}
    },
    setFullscreen(value) {
      this.fullscreen = !!value
      try { localStorage.setItem(FULLSCREEN_KEY, this.fullscreen ? '1' : '0') } catch {}
    },
    /** Vollbild verkleinern - die Pause läuft unverändert als Leiste weiter. */
    minimize() {
      this.minimized = true
    },
    expand() {
      this.minimized = false
    },
    start({ seconds, exerciseName = '', exIndex = -1, rowIndex = -1, notifyTitle = '', notifyBody = '' }) {
      const sec = clampRestSeconds(seconds)
      ensureAudioUnlocked()
      this.durationSec = sec
      this.baseSec = sec
      this.exerciseName = exerciseName
      this.exIndex = exIndex
      this.rowIndex = rowIndex
      this.finishedAt = 0
      this.nowMs = Date.now()
      this.endsAt = this.nowMs + sec * 1000
      this.notifyTitle = notifyTitle
      this.notifyBody = notifyBody
      this.minimized = false
      this.autoExpanded = false
      this.persist()
      this.startTick()
      acquireKeepAwake(KEEP_AWAKE_TAG)
      scheduleNotification(this.endsAt, notifyTitle, notifyBody)
    },
    adjust(deltaSec = REST_STEP_SECONDS) {
      if (!this.isRunning) return
      const remainingSec = Math.ceil(this.remainingMs / 1000)
      const nextRemaining = Math.max(0, remainingSec + deltaSec)
      this.durationSec = clampRestSeconds(this.durationSec + deltaSec)
      this.endsAt = Date.now() + nextRemaining * 1000
      // Pause wieder länger als 10 s (+15): beim erneuten Erreichen darf wieder vergrößert werden.
      if (nextRemaining * 1000 > REST_ENDING_MS) this.autoExpanded = false
      this.persist()
      if (nextRemaining <= 0) this.finish()
      else scheduleNotification(this.endsAt, this.notifyTitle, this.notifyBody)
    },
    skip() {
      this.clear()
    },
    /** Haken wieder entfernt: Pause dieses Satzes abbrechen. */
    stopFor(exIndex, rowIndex) {
      if (this.exIndex === exIndex && this.rowIndex === rowIndex) this.clear()
    },
    finish() {
      if (this.finishedAt) return
      this.finishedAt = Date.now()
      this.endsAt = this.finishedAt
      cancelNotification()
      emitTimerSignal({ eventKey: `rest-end-${this.finishedAt}`, soundEnabled: true, kind: 'round-start' })
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]) } catch {}
      this.persist()
    },
    clear() {
      this.endsAt = 0
      this.finishedAt = 0
      this.durationSec = 0
      this.baseSec = 0
      this.exIndex = -1
      this.rowIndex = -1
      this.minimized = false
      this.autoExpanded = false
      this.stopTick()
      cancelNotification()
      releaseKeepAwake(KEEP_AWAKE_TAG)
      this.persist()
    },
    tick() {
      this.nowMs = Date.now()
      if (this.isRunning && this.remainingMs <= 0) this.finish()
      if (shouldAutoExpandRest({
        minimized: this.minimized,
        fullscreen: this.fullscreen,
        running: this.isRunning,
        remainingMs: this.remainingMs,
        autoExpanded: this.autoExpanded
      })) {
        this.autoExpanded = true
        this.minimized = false
      }
      if (!this.isVisible && this.finishedAt) {
        // "Nächster Satz" wurde lange genug gezeigt.
        this.clear()
      }
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
        if (!this.endsAt) { localStorage.removeItem(STATE_KEY); return }
        localStorage.setItem(STATE_KEY, JSON.stringify({
          endsAt: this.endsAt,
          durationSec: this.durationSec,
          baseSec: this.baseSec,
          exerciseName: this.exerciseName,
          exIndex: this.exIndex,
          rowIndex: this.rowIndex,
          finishedAt: this.finishedAt
        }))
      } catch {}
    },
    /** Nach App-Neustart: laufende Pause wiederherstellen (abgelaufene verwerfen). */
    restore() {
      try {
        const saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null')
        if (!saved || !saved.endsAt || saved.finishedAt || saved.endsAt <= Date.now()) {
          localStorage.removeItem(STATE_KEY)
          return
        }
        Object.assign(this, saved, { nowMs: Date.now() })
        this.startTick()
        acquireKeepAwake(KEEP_AWAKE_TAG)
      } catch {}
    }
  }
})
