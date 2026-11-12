import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const signal = vi.hoisted(() => vi.fn())
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: signal, ensureAudioUnlocked: vi.fn() }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))
vi.mock('@/utils/restEndSignal', () => ({
  buildRestNotification: vi.fn(),
  NOTIFICATION_DELAY_MS: 0,
  scheduleRestEndSignal: vi.fn().mockResolvedValue(undefined),
  cancelRestEndSignal: vi.fn().mockResolvedValue(undefined)
}))

import { useRestTimerStore } from '../restTimerStore.js'

// Absprache Jimmy 20.10.: Vor Zeitübungen Ton bei 10 s und Zähltöne 3-2-1 vor dem Pausenende.
describe('Pausentimer: Töne vor dem Ende', () => {
  let rest
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'))
    setActivePinia(createPinia())
    rest = useRestTimerStore()
    signal.mockClear()
  })
  afterEach(() => {
    rest.clear()
    vi.useRealTimers()
  })

  const kinds = () => signal.mock.calls.map((c) => c[0].kind)

  it('ohne cues bleibt es still bis zum Ende', () => {
    rest.start({ seconds: 30 })
    vi.advanceTimersByTime(29_000)
    expect(kinds()).toEqual([])
  })

  it('mit cues: einmal Vorwarnung, dann 3-2-1, dann Pausenende', () => {
    rest.start({ seconds: 20 })
    rest.cues = true
    vi.advanceTimersByTime(20_500)
    expect(kinds()).toEqual(['rest-warn', 'countdown-3', 'countdown-2', 'countdown-1', 'rest-end'])
  })

  it('Überspringen beendet die Pause ohne weitere Töne und setzt cues zurück', () => {
    rest.start({ seconds: 30 })
    rest.cues = true
    vi.advanceTimersByTime(21_000)
    rest.skip()
    vi.advanceTimersByTime(10_000)
    // Nur die Vorwarnung (bei 10 s) kam vor dem Überspringen; danach bleibt es still.
    expect(kinds()).toEqual(['rest-warn'])
    expect(rest.cues).toBe(false)
  })
})

// Pausenende-Gong darf nicht verloren gehen, wenn die App im Hintergrund war (Timer liefen nicht): beim Zurückkehren
// kommt genau ein Gong, danach nichts mehr.
describe('Pausentimer: Gong nach Hintergrund', () => {
  let rest
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'))
    setActivePinia(createPinia())
    rest = useRestTimerStore()
    signal.mockClear()
  })
  afterEach(() => {
    rest.clear()
    vi.useRealTimers()
  })

  it('Zeit lief weiter, Ticks blieben aus: der erste Tick danach löst genau einen Gong aus', () => {
    rest.start({ seconds: 30 })
    // Hintergrund: Uhr läuft, aber kein Timer feuert (Systemzeit springt, Timer werden nicht abgearbeitet).
    vi.setSystemTime(new Date('2026-10-20T10:02:00Z'))
    vi.advanceTimersByTime(300)
    vi.advanceTimersByTime(5_000)
    const ends = signal.mock.calls.filter((c) => c[0].kind === 'rest-end')
    expect(ends).toHaveLength(1)
    expect(ends[0][0].soundEnabled).toBe(true)
  })

  it('jede neue Pause bekommt einen eigenen Gong (eindeutiger Schlüssel, nicht vom Dedup geschluckt)', () => {
    rest.start({ seconds: 30 })
    vi.advanceTimersByTime(31_000)
    rest.clear()
    vi.advanceTimersByTime(400)
    rest.start({ seconds: 30 })
    vi.advanceTimersByTime(31_000)
    const keys = signal.mock.calls.filter((c) => c[0].kind === 'rest-end').map((c) => c[0].eventKey)
    expect(keys).toHaveLength(2)
    expect(new Set(keys).size).toBe(2)
  })
})
