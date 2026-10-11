import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  emitTimerSignal: vi.fn(),
  ensureAudioUnlocked: vi.fn(),
  acquireKeepAwake: vi.fn(),
  releaseKeepAwake: vi.fn(),
  scheduleWarmupNotification: vi.fn().mockResolvedValue(undefined),
  cancelWarmupNotification: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: mocks.emitTimerSignal, ensureAudioUnlocked: mocks.ensureAudioUnlocked }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: mocks.acquireKeepAwake, releaseKeepAwake: mocks.releaseKeepAwake }))
vi.mock('@/utils/warmupSignal', () => ({
  scheduleWarmupNotification: mocks.scheduleWarmupNotification,
  cancelWarmupNotification: mocks.cancelWarmupNotification
}))
vi.mock('@/stores/restTimerStore', () => ({ useRestTimerStore: () => ({ soundId: 'chimes' }) }))

import { useWarmupTimerStore } from '../warmupTimerStore.js'

describe('warmupTimerStore', () => {
  let storage
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
    storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    })
    vi.stubGlobal('navigator', { onLine: true })
    setActivePinia(createPinia())
    Object.values(mocks).forEach((fn) => fn.mockClear?.())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('Start: Cardio dauert 5 Minuten, Bildschirm bleibt an, Mitteilung wird geplant', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'cardio', workoutKey: 'w1', notifyTitle: 'Cardio geschafft', notifyBody: 'Weiter mit: Gelenke' })
    expect(store.isRunning).toBe(true)
    expect(store.remainingMs).toBe(5 * 60 * 1000)
    expect(mocks.acquireKeepAwake).toHaveBeenCalledWith('warmup-timer')
    expect(mocks.scheduleWarmupNotification).toHaveBeenCalledWith(store.endsAt, { title: 'Cardio geschafft', body: 'Weiter mit: Gelenke' })
    store.cancel()
  })

  it('Gelenke dauern 2 Minuten', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'joints', workoutKey: 'w1' })
    expect(store.remainingMs).toBe(2 * 60 * 1000)
    store.cancel()
  })

  it('Ohne Timer-Schritt (specific) startet nichts', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'specific', workoutKey: 'w1' })
    expect(store.isActive).toBe(false)
  })

  it('Zeit um: Schritt gilt als fertig, Ton im Vordergrund mit dem gewählten Pausen-Ton, Mitteilung zurückgenommen, Bildschirm frei', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'joints', workoutKey: 'w1' })
    vi.advanceTimersByTime(2 * 60 * 1000 + 500)
    expect(store.isActive).toBe(false)
    expect(store.finished).toEqual([{ step: 'joints', workoutKey: 'w1' }])
    expect(mocks.emitTimerSignal).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rest-end', melodyId: 'chimes', soundEnabled: true }))
    expect(mocks.cancelWarmupNotification).toHaveBeenCalled()
    expect(mocks.releaseKeepAwake).toHaveBeenCalledWith('warmup-timer')
  })

  it('consumeFinished: nur Schritte des eigenen Workouts, danach weg', () => {
    const store = useWarmupTimerStore()
    store.finished = [{ step: 'cardio', workoutKey: 'w1' }, { step: 'cardio', workoutKey: 'w2' }]
    expect(store.consumeFinished('w1')).toEqual(['cardio'])
    expect(store.consumeFinished('w1')).toEqual([])
    expect(store.finished).toEqual([{ step: 'cardio', workoutKey: 'w2' }])
  })

  it('Pause und Weiter: Restzeit bleibt erhalten, Bildschirm darf in der Pause schlafen', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'cardio', workoutKey: 'w1' })
    vi.advanceTimersByTime(60 * 1000)
    store.pause()
    expect(store.isPaused).toBe(true)
    expect(store.remainingMs).toBe(4 * 60 * 1000)
    expect(mocks.releaseKeepAwake).toHaveBeenCalledWith('warmup-timer')
    vi.advanceTimersByTime(10 * 60 * 1000) // Pause dauert lange - nichts läuft ab
    expect(store.finished).toEqual([])
    store.resume()
    expect(store.isRunning).toBe(true)
    expect(store.remainingMs).toBe(4 * 60 * 1000)
    store.cancel()
  })

  it('Es läuft nur ein Timer: ein neuer Start ersetzt den alten', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'cardio', workoutKey: 'w1' })
    store.start({ step: 'joints', workoutKey: 'w1' })
    expect(store.step).toBe('joints')
    vi.advanceTimersByTime(2 * 60 * 1000 + 500)
    expect(store.finished).toEqual([{ step: 'joints', workoutKey: 'w1' }])
  })

  it('Abbrechen: nichts wird abgehakt, Mitteilung weg', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'cardio', workoutKey: 'w1' })
    store.cancel()
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(store.finished).toEqual([])
    expect(store.isActive).toBe(false)
    expect(mocks.cancelWarmupNotification).toHaveBeenCalled()
  })

  it('Neustart der App: laufender Timer wird fortgesetzt, abgelaufener gilt als geschafft (ohne Ton)', () => {
    const first = useWarmupTimerStore()
    first.start({ step: 'cardio', workoutKey: 'w1' })
    first.stopTick()

    setActivePinia(createPinia())
    vi.advanceTimersByTime(60 * 1000)
    const running = useWarmupTimerStore()
    running.restore()
    expect(running.isRunning).toBe(true)
    expect(running.remainingMs).toBe(4 * 60 * 1000)
    running.cancel()

    // erneut starten und die Zeit in der "Hintergrund"-Phase ablaufen lassen
    const again = useWarmupTimerStore()
    again.start({ step: 'cardio', workoutKey: 'w9' })
    again.stopTick()
    setActivePinia(createPinia())
    vi.advanceTimersByTime(6 * 60 * 1000)
    mocks.emitTimerSignal.mockClear()
    const expired = useWarmupTimerStore()
    expired.restore()
    expect(expired.isActive).toBe(false)
    expect(expired.finished).toEqual([{ step: 'cardio', workoutKey: 'w9' }])
    expect(mocks.emitTimerSignal).not.toHaveBeenCalled()
  })
})
