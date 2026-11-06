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
    const result = await cancelRestEndSignal({ cancelAlarm: async () => {} })
    expect(result).toBeUndefined()
    expect(calls.cancel).toHaveBeenCalled()
  })

  it('Pausenende: Ersatz-Mitteilung planen wirft nicht', async () => {
    const { scheduleRestEndSignal } = await import('../restEndSignal.js')
    const used = await scheduleRestEndSignal(5_000_000, { title: 't', body: 'b', stopLabel: 's' })
    expect(used).toBe('notification')
    expect(calls.schedule).toHaveBeenCalled()
  })

  it('Warm-up: planen wirft nicht und übergibt die Mitteilung an das Plugin', async () => {
    const { scheduleWarmupNotification } = await import('../warmupSignal.js')
    calls.schedule.mockClear()
    const result = await scheduleWarmupNotification(5_000_000, { title: 'Cardio geschafft', body: 'Weiter mit: Gelenke aufwärmen' })
    expect(result).toBeUndefined()
    expect(calls.schedule).toHaveBeenCalledTimes(1)
    const [{ notifications }] = calls.schedule.mock.calls[0]
    expect(notifications[0]).toMatchObject({ title: 'Cardio geschafft', body: 'Weiter mit: Gelenke aufwärmen' })
  })

  it('Warm-up: zurücknehmen wirft nicht und ruft das Plugin auf', async () => {
    const { cancelWarmupNotification } = await import('../warmupSignal.js')
    calls.cancel.mockClear()
    const result = await cancelWarmupNotification()
    expect(result).toBeUndefined()
    expect(calls.cancel).toHaveBeenCalledTimes(1)
  })
})
