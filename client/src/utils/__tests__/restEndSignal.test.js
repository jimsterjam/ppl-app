import { describe, it, expect, vi } from 'vitest'
import { scheduleRestEndSignal, cancelRestEndSignal, NOTIFICATION_DELAY_MS } from '../restEndSignal.js'

// Pausenende bei gesperrtem Bildschirm: Wecker (AlarmKit, iOS 26) bevorzugt, sonst Mitteilung.
describe('scheduleRestEndSignal', () => {
  const texts = { title: 'Pause vorbei', body: 'Weiter: Bankdrücken', stopLabel: 'Stopp' }
  const at = 5_000_000

  it('Wecker klappt: nur der Wecker, eine frühere Ersatz-Mitteilung wird zurückgenommen', async () => {
    const scheduleAlarm = vi.fn().mockResolvedValue({ scheduled: true })
    const scheduleNotification = vi.fn()
    const cancelNotification = vi.fn()
    const used = await scheduleRestEndSignal(at, texts, { scheduleAlarm, scheduleNotification, cancelNotification })
    expect(used).toBe('alarm')
    expect(scheduleAlarm).toHaveBeenCalledWith({ at: at + NOTIFICATION_DELAY_MS, title: 'Pause vorbei', stopLabel: 'Stopp', sound: undefined })
    expect(scheduleNotification).not.toHaveBeenCalled()
    expect(cancelNotification).toHaveBeenCalled()
  })

  it('gewählte Melodie: ihre Datei geht an den Wecker, ohne Auswahl der iOS-Standardton', async () => {
    const scheduleAlarm = vi.fn().mockResolvedValue({ scheduled: true })
    const deps = { scheduleAlarm, scheduleNotification: vi.fn(), cancelNotification: vi.fn() }
    await scheduleRestEndSignal(at, { ...texts, alarmSound: 'rest-alarm-deep.wav' }, deps)
    expect(scheduleAlarm.mock.calls[0][0].sound).toBe('rest-alarm-deep.wav')
    await scheduleRestEndSignal(at, { ...texts, alarmSound: null }, deps)
    expect(scheduleAlarm.mock.calls[1][0].sound).toBeUndefined()
  })

  it.each([
    ['iOS älter als 26', { scheduled: false, reason: 'unavailable' }],
    ['Erlaubnis verweigert', { scheduled: false, reason: 'denied' }],
    ['Plugin fehlt im Build', { scheduled: false, reason: 'plugin-error' }],
    ['Fehler im Wecker', { scheduled: false, reason: 'error' }]
  ])('%s: Mitteilung mit Ton als Ersatz', async (_label, alarmResult) => {
    const scheduleNotification = vi.fn().mockResolvedValue()
    const used = await scheduleRestEndSignal(at, texts, {
      scheduleAlarm: vi.fn().mockResolvedValue(alarmResult),
      scheduleNotification,
      cancelNotification: vi.fn()
    })
    expect(used).toBe('notification')
    expect(scheduleNotification).toHaveBeenCalledWith(at, 'Pause vorbei', 'Weiter: Bankdrücken')
  })

  it('Wecker und Mitteilung kommen NACH dem Pausenende (Vordergrund nimmt sie vorher zurück)', () => {
    expect(NOTIFICATION_DELAY_MS).toBeGreaterThan(250)
  })
})

describe('cancelRestEndSignal', () => {
  it('nimmt Wecker UND Mitteilung zurück', async () => {
    const cancelAlarm = vi.fn().mockResolvedValue()
    const cancelNotification = vi.fn().mockResolvedValue()
    await cancelRestEndSignal({ cancelAlarm, cancelNotification })
    expect(cancelAlarm).toHaveBeenCalledTimes(1)
    expect(cancelNotification).toHaveBeenCalledTimes(1)
  })
})
