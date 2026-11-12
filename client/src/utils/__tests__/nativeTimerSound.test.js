import { describe, it, expect, beforeEach, vi } from 'vitest'

// Plugin TimerSound (TimerSoundPlugin.swift) wie auf iOS: ein Proxy, der beim Abruf von `.then` wirft
// (siehe capacitorPluginThenable.test.js). Die Brücke darf das Plugin nie als Promise-Ergebnis weiterreichen.
const env = vi.hoisted(() => ({ platform: 'ios', calls: {}, impl: {} }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => env.platform },
  registerPlugin: () => new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') throw new Error('"TimerSound.then()" is not implemented on ios')
      return (...args) => {
        ;(env.calls[prop] ||= []).push(args)
        const fn = env.impl[prop]
        if (!fn) return Promise.reject(new Error(`"TimerSound.${String(prop)}()" is not implemented on ios`))
        return fn(...args)
      }
    }
  })
}))
vi.mock('@/utils/diagnosticsLog', () => ({ logDiagnostic: () => {} }))

async function fresh() {
  vi.resetModules()
  return import('../nativeTimerSound.js')
}

describe('nativeTimerSound: Brücke zum iOS-Plugin', () => {
  beforeEach(() => {
    env.platform = 'ios'
    env.calls = {}
    env.impl = {
      isAvailable: async () => ({ available: true }),
      play: async () => ({ played: true }),
      schedule: async ({ cues }) => ({ scheduled: cues.length, total: cues.length }),
      cancel: async () => ({}),
      getVolume: async () => ({ volume: 0 }),
      addListener: async () => ({ remove: () => {} })
    }
  })

  it('iOS mit Plugin: bereit nach der Prüfung, spielt und plant ohne zu werfen', async () => {
    const m = await fresh()
    expect(m.isNativeTimerSoundReady()).toBe(false)
    expect(await m.probeNativeTimerSound()).toBe(true)
    expect(m.isNativeTimerSoundReady()).toBe(true)
    expect(await m.playNativeTimerSound('timer-whistle.wav')).toEqual({ played: true })
    expect(env.calls.play[0][0]).toEqual({ file: 'timer-whistle.wav' })
    const cues = [{ key: 'rest-end', file: 'timer-whistle.wav', at: 123 }]
    expect(await m.scheduleNativeTimerSounds(cues)).toBe(true)
    expect(await m.getMediaVolume()).toBe(0)
    await m.cancelNativeTimerSounds()
    expect(env.calls.cancel).toHaveLength(1)
  })

  it('Gegenprobe: alter Build ohne Plugin (Aufruf lehnt ab) -> nicht bereit, nichts wird gespielt', async () => {
    env.impl = {}
    const m = await fresh()
    expect(await m.probeNativeTimerSound()).toBe(false)
    expect((await m.playNativeTimerSound('timer-whistle.wav')).played).toBe(false)
    expect(await m.scheduleNativeTimerSounds([{ key: 'k', file: 'f', at: 1 }])).toBe(false)
    expect(await m.getMediaVolume()).toBe(null)
    expect(env.calls.play).toBeUndefined()
  })

  it('Gegenprobe: Plugin-Methode wirft sofort (statt abzulehnen) -> trotzdem kein Absturz, nicht bereit', async () => {
    env.impl = { isAvailable: () => { throw new Error('boom') } }
    const m = await fresh()
    expect(await m.probeNativeTimerSound()).toBe(false)
  })

  it('Gegenprobe: im Browser wird das Plugin gar nicht gefragt', async () => {
    env.platform = 'web'
    const m = await fresh()
    expect(await m.probeNativeTimerSound()).toBe(false)
    expect(env.calls.isAvailable).toBeUndefined()
  })

  it('App im Hintergrund: Grund "background" wird an den Aufrufer weitergegeben (der dann nicht auf Web Audio ausweicht)', async () => {
    env.impl.play = async () => ({ played: false, reason: 'background' })
    const m = await fresh()
    await m.probeNativeTimerSound()
    expect(await m.playNativeTimerSound('timer-whistle.wav')).toEqual({ played: false, reason: 'background' })
  })

  it('nur teilweise eingeplant (z. B. Datei fehlt) gilt als nicht geplant -> Aufrufer spielt per Web Audio', async () => {
    env.impl.schedule = async () => ({ scheduled: 1, total: 2 })
    const m = await fresh()
    await m.probeNativeTimerSound()
    expect(await m.scheduleNativeTimerSounds([{ key: 'a', file: 'x', at: 1 }, { key: 'b', file: 'y', at: 2 }])).toBe(false)
  })

  it('Lautstärke-Änderungen kommen beim Aufrufer an; Abmelden entfernt den Listener', async () => {
    let listener = null
    const remove = vi.fn()
    env.impl.addListener = async (name, cb) => { listener = cb; return { remove } }
    const m = await fresh()
    await m.probeNativeTimerSound()
    const seen = []
    const off = m.onMediaVolumeChange((v) => seen.push(v))
    await Promise.resolve()
    await Promise.resolve()
    listener({ volume: 0.4 })
    expect(seen).toEqual([0.4])
    off()
    expect(remove).toHaveBeenCalled()
  })
})
