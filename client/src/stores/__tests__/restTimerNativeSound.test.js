import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Meldung 12.11.: Pausen-Gong fehlte auf manchen Geräten bzw. kam erst beim Zurückkehren in die App.
// Auf iOS plant das Plugin TimerSound die Töne einer Pause selbst ein; der JS-Takt spielt dann nichts (sonst doppelt).
const signal = vi.hoisted(() => vi.fn())
const native = vi.hoisted(() => ({
  ready: true,
  scheduleResult: true,
  schedule: null,
  cancel: null,
  volume: 0.5,
  volumeListener: null
}))
vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: signal, ensureAudioUnlocked: vi.fn() }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))
vi.mock('@/utils/restEndSignal', () => ({
  buildRestNotification: vi.fn(),
  NOTIFICATION_DELAY_MS: 0,
  scheduleRestEndSignal: vi.fn().mockResolvedValue(undefined),
  cancelRestEndSignal: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/utils/nativeTimerSound', () => ({
  isNativeTimerSoundReady: () => native.ready,
  probeNativeTimerSound: () => Promise.resolve(native.ready),
  scheduleNativeTimerSounds: (cues) => { native.schedule(cues); return Promise.resolve(native.scheduleResult) },
  cancelNativeTimerSounds: () => { native.cancel(); return Promise.resolve() },
  getMediaVolume: () => Promise.resolve(native.volume),
  onMediaVolumeChange: (cb) => { native.volumeListener = cb; return () => {} }
}))

import { useRestTimerStore, buildRestCues } from '../restTimerStore.js'

describe('Pausentimer: Töne über iOS (Plugin TimerSound)', () => {
  let rest
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'))
    native.ready = true
    native.scheduleResult = true
    native.volume = 0.5
    native.schedule = vi.fn()
    native.cancel = vi.fn()
    setActivePinia(createPinia())
    rest = useRestTimerStore()
    rest.setSound('default')
    signal.mockClear()
  })
  afterEach(() => {
    rest.clear()
    vi.useRealTimers()
  })

  const kinds = () => signal.mock.calls.map((c) => c[0].kind)
  const lastCues = () => native.schedule.mock.calls.at(-1)[0]

  it('Pausenstart plant das Ende mit der gewählten Melodie; der JS-Takt spielt dann nichts', async () => {
    rest.setSound('chimes')
    rest.start({ seconds: 20 })
    await Promise.resolve()
    expect(lastCues()).toEqual([{ key: 'rest-end', file: 'timer-melody-chimes.wav', at: Date.now() + 20_000 }])
    vi.advanceTimersByTime(21_000)
    expect(kinds()).toEqual([])
  })

  it('mit cues: Vorwarnung und 3-2-1 werden mit eingeplant (Glocke), weiterhin kein JS-Ton', async () => {
    rest.start({ seconds: 20 })
    rest.setCues(true)
    await Promise.resolve()
    const end = Date.now() + 20_000
    expect(lastCues().map((c) => [c.key, c.file, c.at])).toEqual([
      ['rest-warn', 'timer-bell-warn.wav', end - 10_000],
      ['countdown-3', 'timer-bell-3.wav', end - 3000],
      ['countdown-2', 'timer-bell-2.wav', end - 2000],
      ['countdown-1', 'timer-bell-1.wav', end - 1000],
      ['rest-end', 'timer-whistle.wav', end]
    ])
    vi.advanceTimersByTime(21_000)
    expect(kinds()).toEqual([])
  })

  it('+15 s plant neu (neuer Endzeitpunkt), Überspringen nimmt die geplanten Töne zurück', async () => {
    rest.start({ seconds: 30 })
    await Promise.resolve()
    vi.advanceTimersByTime(5000)
    rest.adjust(15)
    await Promise.resolve()
    expect(native.schedule).toHaveBeenCalledTimes(2)
    expect(lastCues().at(-1).at).toBe(Date.now() + 40_000)
    rest.skip()
    expect(native.cancel).toHaveBeenCalled()
  })

  it('Gegenprobe: ohne Plugin (Browser, alter Build) spielt der JS-Takt wie bisher, mit geplantem Zeitpunkt', () => {
    native.ready = false
    rest.start({ seconds: 20 })
    rest.setCues(true)
    vi.advanceTimersByTime(20_500)
    expect(native.schedule).not.toHaveBeenCalled()
    expect(kinds()).toEqual(['rest-warn', 'countdown-3', 'countdown-2', 'countdown-1', 'rest-end'])
    const end = signal.mock.calls.at(-1)[0]
    expect(end.dueAt).toBe(new Date('2026-11-12T10:00:20Z').getTime())
  })

  it('Gegenprobe: lehnt iOS das Planen ab (z. B. Datei fehlt im Build), spielt der JS-Takt die Töne', async () => {
    native.scheduleResult = false
    rest.start({ seconds: 20 })
    await Promise.resolve()
    await Promise.resolve()
    vi.advanceTimersByTime(20_500)
    expect(native.cancel).toHaveBeenCalled()
    expect(kinds()).toEqual(['rest-end'])
  })

  it('nur künftige Zeitpunkte werden geplant (kurze Pause: keine Vorwarnung in der Vergangenheit)', () => {
    const now = Date.now()
    const cues = buildRestCues({ endsAt: now + 5000, cues: true, soundId: 'default', now })
    expect(cues.map((c) => c.key)).toEqual(['countdown-3', 'countdown-2', 'countdown-1', 'rest-end'])
    expect(buildRestCues({ endsAt: now - 1, cues: true, soundId: 'default', now })).toEqual([])
  })

  it('Medienlautstärke 0: Hinweis an; Lauter-Taste: Hinweis aus', async () => {
    native.volume = 0
    rest.start({ seconds: 30 })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(rest.mediaMuted).toBe(true)
    native.volumeListener(0.25)
    expect(rest.mediaMuted).toBe(false)
  })

  it('Gegenprobe: Lautstärke unbekannt (kein Plugin) zeigt keinen Hinweis', async () => {
    native.ready = false
    rest.start({ seconds: 30 })
    await Promise.resolve()
    await Promise.resolve()
    expect(rest.mediaVolume).toBe(null)
    expect(rest.mediaMuted).toBe(false)
  })
})
