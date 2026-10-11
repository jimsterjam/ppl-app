import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))

import { useSessionStopwatchStore } from '../sessionStopwatch.js'

// Absprache Paul 11.10.: Warm-up-Start und erster abgehakter Arbeitssatz starten den Gesamttimer (Gym-Zeit),
// aber nur, wenn er noch nicht benutzt wurde.
describe('Gesamttimer: startIfIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
    const storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    })
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('noch nie benutzt: wird gestartet', () => {
    const store = useSessionStopwatchStore()
    expect(store.startIfIdle()).toBe(true)
    expect(store.isRunning).toBe(true)
    expect(store.startedAt).toBe(Date.now())
  })

  it('läuft schon: bleibt unberührt (keine Zeit geht verloren)', () => {
    const store = useSessionStopwatchStore()
    store.start()
    const startedAt = store.startedAt
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(store.startIfIdle()).toBe(false)
    expect(store.startedAt).toBe(startedAt)
    expect(store.isRunning).toBe(true)
  })

  it('pausiert: bleibt pausiert (der Nutzer hat bewusst angehalten)', () => {
    const store = useSessionStopwatchStore()
    store.start()
    vi.advanceTimersByTime(60 * 1000)
    store.stop()
    expect(store.startIfIdle()).toBe(false)
    expect(store.isRunning).toBe(false)
  })

  it('nach Zurücksetzen wieder startbar', () => {
    const store = useSessionStopwatchStore()
    store.start()
    store.reset()
    expect(store.startIfIdle()).toBe(true)
    expect(store.isRunning).toBe(true)
  })
})
