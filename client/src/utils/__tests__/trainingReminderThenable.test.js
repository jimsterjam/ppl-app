import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression (Copilot-Review #174, 11.11.): Capacitor-Plugins sind auf iOS Proxys, deren `.then` wirft. Gibt eine
// async-Funktion das Plugin direkt zurück, scheitert die Promise-Auflösung - die Erinnerung wurde auf dem iPhone nie
// geplant und der Tipp-Listener nie angemeldet. Dieser Mock verhält sich wie iOS (siehe capacitorPluginThenable.test.js).
const calls = vi.hoisted(() => ({
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => {}),
  getPending: vi.fn(async () => ({ notifications: [{ id: 940003, schedule: { at: '2026-11-13T11:30:00.000Z' } }] })),
  addListener: vi.fn(async () => ({ remove: async () => {} }))
}))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') throw new Error('"LocalNotifications.then()" is not implemented on ios')
      return calls[prop] || (async () => {})
    }
  })
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true }, registerPlugin: () => ({}) }))
vi.mock('@/utils/notificationPermission', () => ({ getNotificationPermission: async () => 'granted' }))
vi.mock('@/utils/planProgress', () => ({ getTodayPlanInfo: () => null, planDayTitle: () => '' }))

import { syncTrainingReminder, cancelTrainingReminder, getTrainingReminderDiagnostics, scheduleTrainingReminderTest, startTrainingReminderSync } from '../trainingReminder'
import { setActiveUid, __resetUserScopedStorageForTests } from '../userScopedStorage'

const t = (key) => key
const settings = { trainingReminderEnabled: true, trainingReminderTime: '12:30', weeklyGoal: 3, hasExplicitWeeklyGoal: true }
const workouts = [{ date: new Date(2026, 10, 9, 18).toISOString(), completed: true }]

describe('Trainings-Erinnerung mit iOS-Plugin-Proxy', () => {
  beforeEach(() => {
    const mem = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    })
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
    Object.values(calls).forEach((fn) => fn.mockClear())
  })

  it('plant die Erinnerung (wirft nicht beim Weiterreichen des Plugins)', async () => {
    const at = await syncTrainingReminder({ settings, workouts, t, now: new Date(2026, 10, 9, 19) })
    expect(at).toEqual(new Date(2026, 10, 13, 12, 30))
    expect(calls.schedule).toHaveBeenCalledTimes(1)
  })

  it('löschen, Diagnose und Test-Mitteilung funktionieren', async () => {
    await expect(cancelTrainingReminder()).resolves.toBeUndefined()
    expect(calls.cancel).toHaveBeenCalled()
    const diag = await getTrainingReminderDiagnostics(settings)
    expect(diag.error).toBeUndefined()
    expect(diag.pending).toEqual([{ id: 940003, at: '2026-11-13T11:30:00.000Z' }])
    expect((await scheduleTrainingReminderTest({ t })).ok).toBe(true)
  })

  it('meldet den Tipp-Listener an', async () => {
    startTrainingReminderSync({
      authStore: { uid: 'uid-a' },
      userStore: { workoutsLoaded: false, workouts: [] },
      settingsStore: settings,
      i18n: { global: { t, locale: { value: 'de' } } },
      onTap: () => {}
    })
    await vi.waitFor(() => expect(calls.addListener).toHaveBeenCalledWith('localNotificationActionPerformed', expect.any(Function)))
  })
})
