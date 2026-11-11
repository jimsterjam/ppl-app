import { describe, it, expect, beforeEach, vi } from 'vitest'

const ln = vi.hoisted(() => ({ cancel: vi.fn(), schedule: vi.fn(), addListener: vi.fn() }))
const perm = vi.hoisted(() => ({ getNotificationPermission: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }))
vi.mock('@/utils/notificationPermission', () => perm)
vi.mock('@/utils/planProgress', () => ({ getTodayPlanInfo: () => null, planDayTitle: () => '' }))

import { syncTrainingReminder, cancelTrainingReminder, TRAINING_REMINDER_ID } from '../trainingReminder'
import { setActiveUid, readPref, writePref, __resetUserScopedStorageForTests } from '../userScopedStorage'

const t = (key, named) => `${key}${named ? JSON.stringify(named) : ''}`
const monday = (h = 19) => new Date(2026, 10, 9, h, 0)
const workouts = [{ date: new Date(2026, 10, 9, 18).toISOString(), completed: true }]
const settings = (extra = {}) => ({
  trainingReminderEnabled: true,
  trainingReminderTime: '12:30',
  weeklyGoal: 3,
  hasExplicitWeeklyGoal: true,
  ...extra
})

describe('syncTrainingReminder', () => {
  beforeEach(() => {
    const mem = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    })
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
    Object.values(ln).forEach((fn) => fn.mockReset())
    perm.getNotificationPermission.mockReset().mockResolvedValue('granted')
  })

  it('plant mit eigener ID zur berechneten Zeit und merkt sich die Pause pro Konto', async () => {
    const at = await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })
    expect(at).toEqual(new Date(2026, 10, 13, 12, 30))
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: TRAINING_REMINDER_ID }] })
    const [{ notifications }] = ln.schedule.mock.calls[0]
    expect(notifications[0].id).toBe(TRAINING_REMINDER_ID)
    expect(notifications[0].schedule.at).toEqual(at)
    expect(JSON.parse(readPref('training-reminder-last')).pauseKey).toBe('2026-11-09')
  })

  it('ausgeschaltet: nur löschen, nichts planen, offene Erinnerung vergessen', async () => {
    writePref('training-reminder-last', JSON.stringify({ pauseKey: '2026-11-09', at: new Date(2026, 10, 13, 12, 30).getTime() }))
    expect(await syncTrainingReminder({ settings: settings({ trainingReminderEnabled: false }), workouts, t, now: monday() })).toBeNull()
    expect(ln.cancel).toHaveBeenCalled()
    expect(ln.schedule).not.toHaveBeenCalled()
    expect(readPref('training-reminder-last')).toBeNull()
  })

  it('ohne Erlaubnis: nichts planen', async () => {
    perm.getNotificationPermission.mockResolvedValue('denied')
    expect(await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })).toBeNull()
    expect(ln.schedule).not.toHaveBeenCalled()
  })

  it('Kontowechsel während der Berechnung: kein Text des alten Kontos für das neue', async () => {
    perm.getNotificationPermission.mockImplementation(async () => { setActiveUid('uid-b'); return 'granted' })
    expect(await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })).toBeNull()
    expect(ln.schedule).not.toHaveBeenCalled()
    expect(readPref('training-reminder-last', 'uid-b')).toBeNull()
  })

  it('Abmelden vergisst eine noch nicht zugestellte Erinnerung (zählt nicht als zugestellt)', async () => {
    await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })
    await cancelTrainingReminder({ forgetFor: 'uid-a' })
    expect(readPref('training-reminder-last', 'uid-a')).toBeNull()
  })
})
