import { computed, onUnmounted, ref } from 'vue'

export function useSessionStopwatch() {
  const startedAt = ref(null)
  const pausedAt = ref(null)
  const pausedTotalMs = ref(0)
  const isRunning = ref(false)
  const nowMs = ref(Date.now())

  let rafId = null

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
  }

  function stop() {
    if (!isRunning.value) return
    pausedAt.value = Date.now()
    isRunning.value = false
    stopRaf()
  }

  function resume() {
    if (isRunning.value || !pausedAt.value) return
    pausedTotalMs.value += Date.now() - pausedAt.value
    pausedAt.value = null
    isRunning.value = true
    startRaf()
  }

  function reset() {
    stopRaf()
    startedAt.value = null
    pausedAt.value = null
    pausedTotalMs.value = 0
    isRunning.value = false
    nowMs.value = Date.now()
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

  onUnmounted(() => {
    stopRaf()
  })

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
}
