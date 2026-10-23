import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/keepAwakeGuard', () => ({
  acquireKeepAwake: vi.fn(),
  releaseKeepAwake: vi.fn()
}))

import { useTransitionTimerStore, TRANSITION_MAX_AGE_MS } from '../transitionTimerStore.js'

describe('transitionTimerStore', () => {
  beforeEach(() => {
    const data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k)
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T10:00:00Z'))
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('zählt ab dem Start hoch und endet mit clear()', () => {
    const store = useTransitionTimerStore()
    expect(store.isActive).toBe(false)
    store.start(2)
    expect(store.isActive).toBe(true)
    expect(store.exIndex).toBe(2)
    vi.advanceTimersByTime(47_000)
    expect(store.elapsedMs).toBeGreaterThanOrEqual(46_500)
    expect(store.elapsedMs).toBeLessThanOrEqual(47_500)
    store.clear()
    expect(store.isActive).toBe(false)
    expect(store.elapsedMs).toBe(0)
  })

  it('Verkleinern stoppt die Zeit nicht', () => {
    const store = useTransitionTimerStore()
    store.start(0)
    store.minimize()
    expect(store.showOverlay).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(store.elapsedMs).toBeGreaterThanOrEqual(9_500)
    store.expand()
    expect(store.showOverlay).toBe(true)
  })

  it('restore stellt einen laufenden Übergang wieder her', () => {
    const first = useTransitionTimerStore()
    first.start(1)
    vi.advanceTimersByTime(30_000)
    setActivePinia(createPinia())
    const second = useTransitionTimerStore()
    expect(second.isActive).toBe(false)
    second.restore()
    expect(second.isActive).toBe(true)
    expect(second.exIndex).toBe(1)
    expect(second.elapsedMs).toBeGreaterThanOrEqual(29_500)
  })

  it('restore verwirft zu alte Einträge', () => {
    const first = useTransitionTimerStore()
    first.start(1)
    first.stopTick()
    vi.setSystemTime(Date.now() + TRANSITION_MAX_AGE_MS + 1000)
    setActivePinia(createPinia())
    const second = useTransitionTimerStore()
    second.restore()
    expect(second.isActive).toBe(false)
  })
})
