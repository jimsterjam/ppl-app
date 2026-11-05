import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: vi.fn(), ensureAudioUnlocked: vi.fn() }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))
vi.mock('@/utils/restEndSignal', () => ({
  buildRestNotification: vi.fn(),
  NOTIFICATION_DELAY_MS: 0,
  scheduleRestEndSignal: vi.fn().mockResolvedValue(undefined),
  cancelRestEndSignal: vi.fn().mockResolvedValue(undefined)
}))

import { useRestTimerStore } from '../restTimerStore.js'

// Die Pause merkt sich, zu welchem Satz sie gehört: Grundlage für "Letzten Satz zurücknehmen" (undoRestSet).
beforeEach(() => {
  const data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  })
  setActivePinia(createPinia())
})

describe('Pausentimer: Zuordnung zum Satz', () => {
  it('merkt Übung und Satz; Haken zurück beendet genau diese Pause', () => {
    const rest = useRestTimerStore()
    rest.start({ seconds: 90, exerciseName: 'Bench Press', exIndex: 0, rowIndex: 1 })
    expect(rest.exIndex).toBe(0)
    expect(rest.rowIndex).toBe(1)
    rest.stopFor(2, 0) // anderer Satz: Pause bleibt
    expect(rest.isVisible).toBe(true)
    rest.stopFor(0, 1)
    expect(rest.isVisible).toBe(false)
    expect(rest.exIndex).toBe(-1)
  })
})
