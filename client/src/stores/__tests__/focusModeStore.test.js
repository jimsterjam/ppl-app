import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const signal = vi.hoisted(() => vi.fn())
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: signal, ensureAudioUnlocked: vi.fn() }))

import { useFocusModeStore } from '../focusModeStore.js'

// Fokus-Modus (Absprache Paul 19.10.): Ansicht minimieren darf den Satz-Timer nicht beenden.
describe('Fokus-Modus: Ansicht und Satz-Timer', () => {
  let store
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T10:00:00Z'))
    setActivePinia(createPinia())
    store = useFocusModeStore()
    signal.mockClear()
  })
  afterEach(() => {
    store.close()
    vi.useRealTimers()
  })

  it('öffnen, minimieren und wieder öffnen', () => {
    expect(store.visible).toBe(false)
    store.open()
    expect(store.visible).toBe(true)
    store.minimize()
    expect(store.active).toBe(true)
    expect(store.visible).toBe(false)
    store.expand()
    expect(store.visible).toBe(true)
  })

  it('Minimieren beendet den laufenden Satz-Timer nicht, Schließen schon', () => {
    store.open()
    store.startTimer('1:0', 120)
    store.minimize()
    vi.advanceTimersByTime(30_000)
    expect(store.timerRunning).toBe(true)
    expect(Math.round(store.remainingMs / 1000)).toBe(90)
    store.close()
    expect(store.timerStarted).toBe(false)
  })

  it('läuft ab, meldet den Satz einmal und spielt ein Signal', () => {
    store.open()
    store.startTimer('2:1', 10)
    vi.advanceTimersByTime(10_500)
    expect(store.timerRunning).toBe(false)
    expect(store.consumeFinished()).toBe('2:1')
    expect(store.consumeFinished()).toBe('')
    expect(signal).toHaveBeenCalledTimes(1)
  })

  it('anhalten, weiter und Zeit anpassen', () => {
    store.startTimer('0:0', 60)
    vi.advanceTimersByTime(20_000)
    store.pauseTimer()
    expect(store.timerRunning).toBe(false)
    expect(Math.round(store.remainingMs / 1000)).toBe(40)
    store.adjustTimer(15)
    expect(Math.round(store.remainingMs / 1000)).toBe(55)
    vi.advanceTimersByTime(5_000)
    expect(Math.round(store.remainingMs / 1000)).toBe(55)
    store.resumeTimer()
    vi.advanceTimersByTime(5_000)
    expect(Math.round(store.remainingMs / 1000)).toBe(50)
    store.adjustTimer(-300)
    expect(store.remainingMs).toBeGreaterThanOrEqual(1000)
  })
})
