import { describe, it, expect, vi, beforeEach } from 'vitest'

const plugin = { schedule: vi.fn(), cancel: vi.fn() }
let platform = 'ios'
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform },
  registerPlugin: () => plugin
}))
vi.mock('@/utils/diagnosticsLog', () => ({ logDiagnostic: vi.fn() }))

const { scheduleRestAlarm, cancelRestAlarm } = await import('../restAlarm.js')

describe('restAlarm (Brücke zum Swift-Plugin)', () => {
  beforeEach(() => {
    platform = 'ios'
    plugin.schedule.mockReset()
    plugin.cancel.mockReset()
  })

  it('iOS: reicht Zeitpunkt, Texte und Ton an das Plugin', async () => {
    plugin.schedule.mockResolvedValue({ scheduled: true })
    const result = await scheduleRestAlarm({ at: 123, title: 'Pause vorbei', stopLabel: 'Stopp', sound: 'rest-end.wav' })
    expect(plugin.schedule).toHaveBeenCalledWith({ at: 123, title: 'Pause vorbei', stopLabel: 'Stopp', sound: 'rest-end.wav' })
    expect(result.scheduled).toBe(true)
  })

  it('Plugin meldet "denied": scheduled=false mit Grund (Aufrufer nutzt die Mitteilung)', async () => {
    plugin.schedule.mockResolvedValue({ scheduled: false, reason: 'denied' })
    expect(await scheduleRestAlarm({ at: 1, title: 't', stopLabel: 's' })).toMatchObject({ scheduled: false, reason: 'denied' })
  })

  it('Plugin fehlt oder wirft (alter Build): kein Fehler nach außen, scheduled=false', async () => {
    plugin.schedule.mockRejectedValue(new Error('"RestAlarm" plugin is not implemented on ios'))
    const result = await scheduleRestAlarm({ at: 1, title: 't', stopLabel: 's' })
    expect(result).toMatchObject({ scheduled: false, reason: 'plugin-error' })
  })

  it('nicht iOS: das Plugin wird gar nicht angefasst', async () => {
    platform = 'web'
    expect(await scheduleRestAlarm({ at: 1, title: 't', stopLabel: 's' })).toMatchObject({ scheduled: false, reason: 'unsupported' })
    await cancelRestAlarm()
    expect(plugin.schedule).not.toHaveBeenCalled()
    expect(plugin.cancel).not.toHaveBeenCalled()
  })

  it('cancel: ruft das Plugin auf und schluckt Fehler', async () => {
    plugin.cancel.mockRejectedValue(new Error('x'))
    await expect(cancelRestAlarm()).resolves.toBeUndefined()
    expect(plugin.cancel).toHaveBeenCalled()
  })
})
