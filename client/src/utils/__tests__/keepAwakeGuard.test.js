import { describe, it, expect, beforeEach, vi } from 'vitest'

const plugin = vi.hoisted(() => ({ keepAwake: vi.fn().mockResolvedValue(), allowSleep: vi.fn().mockResolvedValue() }))
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: plugin }))

import {
  acquireKeepAwake, releaseKeepAwake, setKeepAwakeMode, getKeepAwakeMode, getActiveKeepAwakeTags
} from '../keepAwakeGuard.js'

describe('keepAwakeGuard: Einstellung "Display im Training"', () => {
  beforeEach(async () => {
    const mem = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    })
    vi.stubGlobal('window', {})
    for (const tag of getActiveKeepAwakeTags()) await releaseKeepAwake(tag)
    plugin.keepAwake.mockClear()
    plugin.allowSleep.mockClear()
  })

  it('Standard "workout": alles hält das Display wach, Freigabe aller Tags erlaubt Schlaf', async () => {
    expect(getKeepAwakeMode()).toBe('workout')
    await acquireKeepAwake('session-stopwatch')
    expect(plugin.keepAwake).toHaveBeenCalled()
    await releaseKeepAwake('session-stopwatch')
    expect(plugin.allowSleep).toHaveBeenCalledTimes(1)
  })

  it('Tag bleibt aktiv, solange ein anderer noch läuft (kein Schlaf dazwischen)', async () => {
    await acquireKeepAwake('rest-timer')
    await acquireKeepAwake('session-stopwatch')
    await releaseKeepAwake('rest-timer')
    expect(plugin.allowSleep).not.toHaveBeenCalled()
  })

  it('"rest": Gesamt-Stoppuhr hält nicht wach, Pausentimer schon', async () => {
    await setKeepAwakeMode('rest')
    await acquireKeepAwake('session-stopwatch')
    expect(plugin.keepAwake).not.toHaveBeenCalled()
    await acquireKeepAwake('rest-timer')
    expect(plugin.keepAwake).toHaveBeenCalledTimes(1)
    await releaseKeepAwake('rest-timer')
    expect(plugin.allowSleep).toHaveBeenCalledTimes(1)
  })

  it('"off": nur Speichern/KI-Feedback halten kurz wach', async () => {
    await setKeepAwakeMode('off')
    await acquireKeepAwake('session-stopwatch')
    await acquireKeepAwake('rest-timer')
    expect(plugin.keepAwake).not.toHaveBeenCalled()
    await acquireKeepAwake('workout-save')
    expect(plugin.keepAwake).toHaveBeenCalledTimes(1)
  })

  it('Moduswechsel während das Workout läuft wirkt sofort', async () => {
    await acquireKeepAwake('session-stopwatch')
    await setKeepAwakeMode('off')
    expect(plugin.allowSleep).toHaveBeenCalledTimes(1)
    await setKeepAwakeMode('workout')
    expect(plugin.keepAwake).toHaveBeenCalledTimes(2)
  })

  it('ungültiger Modus wird ignoriert', async () => {
    await setKeepAwakeMode('quatsch')
    expect(getKeepAwakeMode()).toBe('workout')
  })
})
