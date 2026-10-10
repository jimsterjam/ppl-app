// Pausentimer zwischen Sätzen - bewusst getrennt vom Intervall-Timer (timerStore.js, für Übungen
// auf Zeit). Startet beim Abhaken eines Arbeitssatzes (WorkoutDetailView.vue), zählt die Pause
// herunter und meldet sich am Ende mit Ton und - wenn die App im Hintergrund ist - einer Mitteilung.
// Zeitbasis ist ein fester Endzeitpunkt (endsAt), damit die Pause auch bei gesperrtem Display
// bzw. nach einem App-Neustart korrekt weiterläuft.
import { defineStore } from 'pinia'
import { emitTimerSignal, ensureAudioUnlocked } from '@/utils/timerAudio'
import { clampRestSeconds, REST_ENDING_MS, REST_STEP_SECONDS, sanitizeRestOverrides, shouldAutoExpandRest } from '@/utils/restTimerRules'
import { alarmSoundFile, sanitizeRestSound } from '@/utils/restMelodies'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'
import { scheduleRestEndSignal, cancelRestEndSignal } from '@/utils/restEndSignal'

// Weiterhin hier exportiert (Tests/Aufrufer): Mitteilung und Verzögerung leben in utils/restEndSignal.js
export { buildRestNotification, NOTIFICATION_DELAY_MS } from '@/utils/restEndSignal'

const STATE_KEY = 'ppl_rest_timer_state_v1'
// Ton am Pausenende (Melodie-ID, utils/restMelodies.js) und eigene Standard-Pausen je Ziel/Übungsart.
const SOUND_KEY = 'ppl_rest_timer_sound_v1'
const DURATIONS_KEY = 'ppl_rest_timer_durations_v1'
// Bildschirm bleibt an, solange eine Pause läuft bzw. "Pause vorbei" sichtbar ist.
const KEEP_AWAKE_TAG = 'rest-timer'
// So lange bleibt "Nächster Satz" nach Ablauf sichtbar.
const FINISHED_VISIBLE_MS = 6000
const TICK_MS = 250
let tickHandle = null

function readSound() {
  try {
    return sanitizeRestSound(localStorage.getItem(SOUND_KEY))
  } catch {
    return sanitizeRestSound(null)
  }
}

function readDurations() {
  try {
    return sanitizeRestOverrides(JSON.parse(localStorage.getItem(DURATIONS_KEY) || 'null'))
  } catch {
    return {}
  }
}

export const useRestTimerStore = defineStore('restTimer', {
  state: () => ({
    // Immer an (Absprache Paul 10.10.): Pause startet beim Abhaken eines Satzes und erscheint groß in
    // der Mitte; verkleinern/überspringen geht während der Pause. Frühere Schalter-Werte im Gerät
    // (ppl_rest_timer_auto_v1 / _fullscreen_v1) werden bewusst nicht mehr gelesen.
    autoStart: true,
    fullscreen: true,
    soundId: readSound(),
    // Eigene Standard-Pausen: { strength: { compound: 200 }, ... } - nur gesetzte Werte.
    durations: readDurations(),
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
    notifyBody: '',
    alarmStopLabel: ''
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
    setSound(id) {
      this.soundId = sanitizeRestSound(id)
      try { localStorage.setItem(SOUND_KEY, this.soundId) } catch {}
    },
    /** Eigene Standard-Pause setzen; value = null/Standardwert entfernt den eigenen Wert. */
    setDuration(goal, type, value) {
      const next = sanitizeRestOverrides({
        ...this.durations,
        [goal]: { ...this.durations?.[goal], [type]: value == null ? null : clampRestSeconds(value) }
      })
      this.durations = next
      try { localStorage.setItem(DURATIONS_KEY, JSON.stringify(next)) } catch {}
    },
    resetDurations() {
      this.durations = {}
      try { localStorage.removeItem(DURATIONS_KEY) } catch {}
    },
    /** Vollbild verkleinern - die Pause läuft unverändert als Leiste weiter. */
    minimize() {
      this.minimized = true
    },
    expand() {
      this.minimized = false
    },
    start({ seconds, exerciseName = '', exIndex = -1, rowIndex = -1, notifyTitle = '', notifyBody = '', alarmStopLabel = '' }) {
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
      this.alarmStopLabel = alarmStopLabel
      this.minimized = false
      this.autoExpanded = false
      this.persist()
      this.startTick()
      acquireKeepAwake(KEEP_AWAKE_TAG)
      this.scheduleEndSignal()
    },
    /** Wecker (bzw. Ersatz-Mitteilung) für das Pausenende - nur relevant, wenn die App nicht vorn ist. */
    scheduleEndSignal() {
      scheduleRestEndSignal(this.endsAt, {
        title: this.notifyTitle,
        body: this.notifyBody,
        stopLabel: this.alarmStopLabel,
        alarmSound: alarmSoundFile(this.soundId)
      }).catch(() => {})
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
      else this.scheduleEndSignal()
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
      cancelRestEndSignal().catch(() => {})
      emitTimerSignal({ eventKey: `rest-end-${this.finishedAt}`, soundEnabled: true, kind: 'rest-end', melodyId: this.soundId })
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
      cancelRestEndSignal().catch(() => {})
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
