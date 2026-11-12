import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Copilot-Fund PR 181: Intervall-Timer lief im Hintergrund ab; beim Zurückkehren rief der Takt tickNow() auf und der
// Schlusston kam sofort (verspätet). Signale geben jetzt den geplanten Zeitpunkt (dueAt) mit - emitTimerSignal
// verwirft sie, wenn sie zu spät kämen (timerAudio.test.js).
const signal = vi.hoisted(() => vi.fn())
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: signal, ensureAudioUnlocked: vi.fn(), clearSignalHistory: vi.fn() }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false }, registerPlugin: () => ({}) }))

import { useTimerStore } from '../timerStore.js'

describe('Intervall-Timer: Töne mit geplantem Zeitpunkt (dueAt)', () => {
  let timer
  const T0 = new Date('2026-11-12T12:00:00Z').getTime()
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    setActivePinia(createPinia())
    timer = useTimerStore()
    signal.mockClear()
  })
  afterEach(() => {
    timer.stop()
    vi.useRealTimers()
  })

  const byKind = (kind) => signal.mock.calls.map((c) => c[0]).filter((s) => s.kind === kind)

  it('Ende während die App im Hintergrund war: Schlusston trägt das geplante Ende, nicht "jetzt"', () => {
    timer.start({ mode: 'interval', minutes: 0, seconds: 10, restSeconds: 0, intervals: 1, prepSeconds: 0 })
    timer.stopTick() // Hintergrund: der Takt steht
    vi.setSystemTime(T0 + 60_000) // eine Minute später zurück in der App
    timer.tickNow()
    const [end] = byKind('session-end')
    expect(end.dueAt).toBe(T0 + 10_000)
    expect(Date.now() - end.dueAt).toBeGreaterThan(1500) // -> wird von emitTimerSignal verworfen
  })

  it('Gegenprobe: im Vordergrund pünktlich -> dueAt liegt beim Ende, Ton wird gespielt', () => {
    timer.start({ mode: 'interval', minutes: 0, seconds: 10, restSeconds: 0, intervals: 1, prepSeconds: 0 })
    vi.advanceTimersByTime(10_300)
    const [end] = byKind('session-end')
    expect(end.dueAt).toBe(T0 + 10_000)
    expect(Date.now() - end.dueAt).toBeLessThan(1500)
  })

  it('3-2-1 vor der nächsten Runde: dueAt = Zeitpunkt der jeweiligen Sekunde', () => {
    timer.start({ mode: 'interval', minutes: 0, seconds: 10, restSeconds: 10, intervals: 2, prepSeconds: 0 })
    vi.advanceTimersByTime(20_000)
    const counts = signal.mock.calls.map((c) => c[0]).filter((s) => /^countdown-/.test(s.kind))
    expect(counts.map((s) => [s.kind, s.dueAt])).toEqual([
      ['countdown-3', T0 + 17_000],
      ['countdown-2', T0 + 18_000],
      ['countdown-1', T0 + 19_000]
    ])
  })
})
