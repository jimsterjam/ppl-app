import { storeToRefs } from 'pinia'
import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'

export function useSessionStopwatch() {
  const store = useSessionStopwatchStore()
  const { startedAt, pausedAt, pausedTotalMs, isRunning, elapsedMs, formattedTime } = storeToRefs(store)

  return {
    startedAt,
    pausedAt,
    pausedTotalMs,
    isRunning,
    elapsedMs,
    formattedTime,
    start: store.start,
    stop: store.stop,
    resume: store.resume,
    reset: store.reset,
    toggleStartStop: store.toggleStartStop
  }
}