import { describe, it, expect, vi } from 'vitest'

// Capacitor-Plugins sind Proxys und werfen auf iOS beim Abruf von `.then`:
// "LocalNotifications.then() is not implemented on ios". Das trat auf, sobald ein Plugin aus einer async-Funktion
// zurückgegeben wurde (Promise-Auflösung prüft auf "thenable"). Dieser Mock verhält sich genauso.
const calls = vi.hoisted(() => ({ cancel: vi.fn(async () => {}), requestPermissions: vi.fn(async () => ({ display: 'granted' })), schedule: vi.fn(async () => {}), getPending: vi.fn(async () => ({ notifications: [] })) }))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') throw new Error('"LocalNotifications.then()" is not implemented on ios')
      return calls[prop] || (async () => {})
    }
  })
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true }, registerPlugin: () => ({}) }))
vi.mock('@/utils/restAlarm', () => ({ cancelRestAlarm: async () => {}, scheduleRestAlarm: async () => ({ scheduled: false, reason: 'unavailable' }) }))
vi.mock('@/utils/diagnosticsLog', () => ({ logDiagnostic: () => {} }))

describe('Plugin wird nie als Promise-Ergebnis zurückgegeben', () => {
  it('Pausenende: Mitteilung zurücknehmen wirft nicht', async () => {
    const { cancelRestEndSignal } = await import('../restEndSignal.js')
    await expect(cancelRestEndSignal({ cancelAlarm: async () => {} })).resolves.toBeUndefined()
    expect(calls.cancel).toHaveBeenCalled()
  })

  it('Pausenende: Ersatz-Mitteilung planen wirft nicht', async () => {
    const { scheduleRestEndSignal } = await import('../restEndSignal.js')
    const used = await scheduleRestEndSignal(5_000_000, { title: 't', body: 'b', stopLabel: 's' })
    expect(used).toBe('notification')
    expect(calls.schedule).toHaveBeenCalled()
  })

  it('Warm-up: planen und zurücknehmen wirft nicht', async () => {
    const warmup = await import('../warmupSignal.js')
    const names = Object.keys(warmup).filter((name) => typeof warmup[name] === 'function' && /^(schedule|cancel)/i.test(name))
    expect(names.length).toBeGreaterThan(0)
    calls.cancel.mockClear()
    for (const name of names) {
      await expect(Promise.resolve(warmup[name](5_000_000, 't', 'b'))).resolves.not.toThrow()
    }
    expect(calls.cancel).toHaveBeenCalled()
  })
})
