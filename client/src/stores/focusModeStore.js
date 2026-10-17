import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { emitTimerSignal, ensureAudioUnlocked } from '@/utils/timerAudio'

// Fokus-Modus im laufenden Workout (Absprache Paul 19.10.): Großansicht, die Satz für Satz durch das Workout führt.
// Dieser Store hält nur den Zustand der Ansicht (aktiv/minimiert) und den Satz-Timer für Zeitübungen
// (z. B. Plank 120 s). Die Pause zwischen den Sätzen bleibt im restTimerStore.
export const useFocusModeStore = defineStore('focusMode', () => {
  const active = ref(false)
  const minimized = ref(false)

  // Satz-Timer (Zeitübungen): gehört zu genau einem Satz (`timerKey` = "exIndex:rowIndex").
  const timerKey = ref('')
  const durationSec = ref(0)
  const endsAt = ref(0)
  const pausedRemainingMs = ref(0)
  const finishedKey = ref('')
  const nowMs = ref(Date.now())
  let tickId = null

  const visible = computed(() => active.value && !minimized.value)
  const timerRunning = computed(() => endsAt.value > 0)
  const timerStarted = computed(() => endsAt.value > 0 || pausedRemainingMs.value > 0)
  const remainingMs = computed(() => {
    if (endsAt.value > 0) return Math.max(0, endsAt.value - nowMs.value)
    return pausedRemainingMs.value
  })

  function stopTick() {
    if (tickId) {
      clearInterval(tickId)
      tickId = null
    }
  }

  function tick() {
    nowMs.value = Date.now()
    if (endsAt.value > 0 && nowMs.value >= endsAt.value) finishTimer()
  }

  function startTick() {
    nowMs.value = Date.now()
    if (tickId) return
    tickId = setInterval(tick, 250)
  }

  function finishTimer() {
    const key = timerKey.value
    endsAt.value = 0
    pausedRemainingMs.value = 0
    stopTick()
    finishedKey.value = key
    emitTimerSignal({ eventKey: `set-end-${key}-${Date.now()}`, soundEnabled: true, kind: 'rest-end' })
  }

  function open() {
    active.value = true
    minimized.value = false
  }

  function minimize() {
    minimized.value = true
  }

  function expand() {
    if (active.value) minimized.value = false
  }

  function close() {
    active.value = false
    minimized.value = false
    clearTimer()
  }

  function startTimer(key, seconds) {
    const sec = Math.max(1, Math.round(Number(seconds) || 0))
    ensureAudioUnlocked()
    timerKey.value = String(key)
    durationSec.value = sec
    pausedRemainingMs.value = 0
    finishedKey.value = ''
    nowMs.value = Date.now()
    endsAt.value = nowMs.value + sec * 1000
    startTick()
  }

  function pauseTimer() {
    if (endsAt.value <= 0) return
    pausedRemainingMs.value = Math.max(0, endsAt.value - Date.now())
    endsAt.value = 0
    stopTick()
  }

  function resumeTimer() {
    if (endsAt.value > 0 || pausedRemainingMs.value <= 0) return
    nowMs.value = Date.now()
    endsAt.value = nowMs.value + pausedRemainingMs.value
    pausedRemainingMs.value = 0
    startTick()
  }

  /** Zeit während des Satzes anpassen (+/- Sekunden). Mindestens 1 s Restzeit bleibt. */
  function adjustTimer(deltaSec) {
    const delta = Math.round(Number(deltaSec) || 0) * 1000
    if (endsAt.value > 0) {
      endsAt.value = Math.max(Date.now() + 1000, endsAt.value + delta)
      durationSec.value = Math.max(1, durationSec.value + Math.round(delta / 1000))
      nowMs.value = Date.now()
    } else if (pausedRemainingMs.value > 0) {
      pausedRemainingMs.value = Math.max(1000, pausedRemainingMs.value + delta)
      durationSec.value = Math.max(1, durationSec.value + Math.round(delta / 1000))
    }
  }

  function clearTimer() {
    stopTick()
    timerKey.value = ''
    durationSec.value = 0
    endsAt.value = 0
    pausedRemainingMs.value = 0
    finishedKey.value = ''
  }

  function consumeFinished() {
    const key = finishedKey.value
    finishedKey.value = ''
    return key
  }

  return {
    active, minimized, visible,
    timerKey, durationSec, finishedKey, timerRunning, timerStarted, remainingMs,
    open, minimize, expand, close,
    startTimer, pauseTimer, resumeTimer, adjustTimer, clearTimer, consumeFinished, tick
  }
})
