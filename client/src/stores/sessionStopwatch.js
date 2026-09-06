import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'

const KEEP_AWAKE_TAG = 'session-stopwatch'

const STORAGE_KEY = 'bro_split_session_stopwatch_v1'

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function savePersistedState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export const useSessionStopwatchStore = defineStore('sessionStopwatch', () => {
  const persisted = loadPersistedState()

  const startedAt = ref(persisted?.startedAt ?? null)
  const pausedAt = ref(persisted?.pausedAt ?? null)
  const pausedTotalMs = ref(persisted?.pausedTotalMs ?? 0)
  const isRunning = ref(persisted?.isRunning ?? false)
  const nowMs = ref(Date.now())

  let rafId = null

  function persistNow() {
    if (!startedAt.value) {
      clearPersistedState()
      return
    }
    savePersistedState({
      startedAt: startedAt.value,
      pausedAt: pausedAt.value,
      pausedTotalMs: pausedTotalMs.value,
      isRunning: isRunning.value
    })
  }

  function startRaf() {
    if (rafId) return
    const loop = () => {
      nowMs.value = Date.now()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
  }

  function stopRaf() {
    if (!rafId) return
    cancelAnimationFrame(rafId)
    rafId = null
  }

  // Falls beim Neustart ein laufender Zustand wiederhergestellt wurde,
  // muss der rAF-Loop wieder anlaufen, sonst bleibt die Anzeige stehen.
  if (isRunning.value && startedAt.value) {
    startRaf()
    acquireKeepAwake(KEEP_AWAKE_TAG)
  }

  const elapsedMs = computed(() => {
    if (!startedAt.value) return 0
    const now = !isRunning.value && pausedAt.value ? pausedAt.value : nowMs.value
    return Math.max(0, now - startedAt.value - pausedTotalMs.value)
  })

  const formattedTime = computed(() => {
    const totalSeconds = Math.floor(elapsedMs.value / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  function start() {
    startedAt.value = Date.now()
    pausedAt.value = null
    pausedTotalMs.value = 0
    isRunning.value = true
    startRaf()
    acquireKeepAwake(KEEP_AWAKE_TAG)
    persistNow()
  }

  function stop() {
    if (!isRunning.value) return
    pausedAt.value = Date.now()
    isRunning.value = false
    stopRaf()
    releaseKeepAwake(KEEP_AWAKE_TAG)
    persistNow()
  }

  function resume() {
    if (isRunning.value || !pausedAt.value) return
    pausedTotalMs.value += Date.now() - pausedAt.value
    pausedAt.value = null
    isRunning.value = true
    startRaf()
    acquireKeepAwake(KEEP_AWAKE_TAG)
    persistNow()
  }

  function reset() {
    stopRaf()
    releaseKeepAwake(KEEP_AWAKE_TAG)
    startedAt.value = null
    pausedAt.value = null
    pausedTotalMs.value = 0
    isRunning.value = false
    nowMs.value = Date.now()
    clearPersistedState()
  }

  function toggleStartStop() {
    if (!startedAt.value) {
      start()
    } else if (isRunning.value) {
      stop()
    } else {
      resume()
    }
  }

  return {
    startedAt,
    pausedAt,
    pausedTotalMs,
    isRunning,
    elapsedMs,
    formattedTime,
    start,
    stop,
    resume,
    reset,
    toggleStartStop
  }
})