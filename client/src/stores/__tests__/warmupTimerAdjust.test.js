import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  scheduleWarmupNotification: vi.fn().mockResolvedValue(undefined),
  cancelWarmupNotification: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: vi.fn(), ensureAudioUnlocked: vi.fn() }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))
vi.mock('@/utils/warmupSignal', () => ({
  scheduleWarmupNotification: mocks.scheduleWarmupNotification,
  cancelWarmupNotification: mocks.cancelWarmupNotification
}))
vi.mock('@/stores/restTimerStore', () => ({ useRestTimerStore: () => ({ soundId: 'chimes' }) }))

import { useWarmupTimerStore } from '../warmupTimerStore.js'
import { clampWarmupSeconds, sanitizeWarmupDurations, WARMUP_MAX_SECONDS, WARMUP_MIN_SECONDS } from '../../utils/warmupPlan.js'

// Absprache Paul 14.10.: Die Warm-up-Zeiten sind nur eine Empfehlung - ±15 s, die Wahl wird gemerkt.
describe('Warm-up-Zeit anpassen', () => {
  let storage
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
    storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    })
    vi.stubGlobal('navigator', { onLine: true })
    setActivePinia(createPinia())
    Object.values(mocks).forEach((fn) => fn.mockClear())
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('Empfehlung ohne eigene Wahl: Cardio 5 Min., Gelenke 2 Min.', () => {
    const store = useWarmupTimerStore()
    expect(store.secondsFor('cardio')).toBe(300)
    expect(store.secondsFor('joints')).toBe(120)
  })

  it('vor dem Start ±15 s: Zeit wird gemerkt, der Start nutzt sie, ein neuer Store findet sie wieder', () => {
    const store = useWarmupTimerStore()
    store.adjust('cardio', 15); store.adjust('cardio', 15)
    expect(store.secondsFor('cardio')).toBe(330)
    store.start({ step: 'cardio', workoutKey: 'w1' })
    expect(store.durationSec).toBe(330)
    setActivePinia(createPinia())
    expect(useWarmupTimerStore().secondsFor('cardio')).toBe(330)
    expect(useWarmupTimerStore().secondsFor('joints')).toBe(120)
  })

  it('laufender Timer: Ende verschiebt sich, Mitteilung wird neu geplant, Zeit wird gemerkt', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'joints', workoutKey: 'w1' })
    vi.advanceTimersByTime(30_000)
    const endBefore = store.endsAt
    mocks.scheduleWarmupNotification.mockClear()
    store.adjust('joints', 15)
    expect(store.endsAt).toBe(endBefore + 15_000)
    expect(store.durationSec).toBe(135)
    expect(store.secondsFor('joints')).toBe(135)
    expect(mocks.scheduleWarmupNotification).toHaveBeenCalledTimes(1)
    store.adjust('joints', -15)
    expect(store.endsAt).toBe(endBefore)
  })

  it('pausiert: Restzeit ändert sich um 15 s', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'cardio', workoutKey: 'w1' })
    vi.advanceTimersByTime(60_000)
    store.pause()
    const left = store.pausedRemainingMs
    store.adjust('cardio', -15)
    expect(store.pausedRemainingMs).toBe(left - 15_000)
    expect(store.isPaused).toBe(true)
  })

  it('Verkürzen unter die verbleibende Zeit beendet den Schritt', () => {
    const store = useWarmupTimerStore()
    store.start({ step: 'joints', workoutKey: 'w1', seconds: 60 })
    vi.advanceTimersByTime(50_000)
    store.adjust('joints', -15)
    expect(store.isActive).toBe(false)
    expect(store.finished).toEqual([{ step: 'joints', workoutKey: 'w1' }])
  })

  it('Grenzen: mindestens 15 s, höchstens 30 Min.; unbekannter Schritt wird ignoriert', () => {
    const store = useWarmupTimerStore()
    for (let i = 0; i < 40; i += 1) store.adjust('joints', -15)
    expect(store.secondsFor('joints')).toBe(WARMUP_MIN_SECONDS)
    for (let i = 0; i < 200; i += 1) store.adjust('cardio', 15)
    expect(store.secondsFor('cardio')).toBe(WARMUP_MAX_SECONDS)
    store.adjust('specific', 15)
    expect(store.durations.specific).toBeUndefined()
  })

  it('clampWarmupSeconds / sanitizeWarmupDurations', () => {
    expect(clampWarmupSeconds(1)).toBe(15)
    expect(clampWarmupSeconds(99999)).toBe(1800)
    expect(clampWarmupSeconds('abc')).toBe(15)
    expect(sanitizeWarmupDurations({ cardio: 400, joints: -5, specific: 60, x: 1 })).toEqual({ cardio: 400 })
    expect(sanitizeWarmupDurations(null)).toEqual({})
  })
})
