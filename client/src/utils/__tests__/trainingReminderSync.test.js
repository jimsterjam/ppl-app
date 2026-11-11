import { describe, it, expect, beforeEach, vi } from 'vitest'

const ln = vi.hoisted(() => ({ cancel: vi.fn(), schedule: vi.fn(), addListener: vi.fn() }))
const perm = vi.hoisted(() => ({ getNotificationPermission: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }))
vi.mock('@/utils/notificationPermission', () => perm)
vi.mock('@/utils/planProgress', () => ({ getTodayPlanInfo: () => null, planDayTitle: () => '' }))

import { syncTrainingReminder, cancelTrainingReminder, workoutsSignature, scheduleTrainingReminderTest, readTrainingReminderDiag, TRAINING_REMINDER_ID, TRAINING_REMINDER_TEST_ID } from '../trainingReminder'
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
    // Ton aus dem App-Bundle (ohne Ton blieb die Mitteilung auf dem iPhone stumm, Paul 11.11.)
    expect(notifications[0].sound).toBe('training-reminder.wav')
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

  it('ohne Erlaubnis: nichts planen und eine offene Erinnerung vergessen (nicht zugestellt)', async () => {
    writePref('training-reminder-last', JSON.stringify({ pauseKey: '2026-11-09', at: new Date(2026, 10, 13, 12, 30).getTime() }))
    perm.getNotificationPermission.mockResolvedValue('denied')
    expect(await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })).toBeNull()
    expect(ln.schedule).not.toHaveBeenCalled()
    expect(readPref('training-reminder-last')).toBeNull()
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

describe('Diagnose der Trainings-Erinnerung', () => {
  const diags = () => readTrainingReminderDiag().syncs
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

  it('schreibt den Grund jedes Laufs ins Diagnose-Log (geplant mit Zeitpunkt, sonst warum nicht)', async () => {
    await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })
    await syncTrainingReminder({ settings: settings({ trainingReminderEnabled: false }), workouts, t, now: monday() })
    perm.getNotificationPermission.mockResolvedValue('denied')
    await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })
    const [scheduled, disabled, noPerm] = diags()
    expect(scheduled).toMatchObject({ result: 'scheduled', kind: 'gap', perWeek: 3, rhythm: 'goal', lastTrainingDay: '2026-11-09', time: '12:30' })
    expect(disabled.result).toBe('disabled')
    expect(noPerm).toMatchObject({ result: 'no-permission', permission: 'denied' })
  })

  it('schon zugestellt in dieser Pause: Grund „nothing-due“ mit der gemerkten Pause', async () => {
    writePref('training-reminder-last', JSON.stringify({ pauseKey: '2026-11-09', at: new Date(2026, 10, 10, 12, 30).getTime() }))
    expect(await syncTrainingReminder({ settings: settings(), workouts, t, now: new Date(2026, 10, 11, 9) })).toBeNull()
    expect(diags()[0]).toMatchObject({ result: 'nothing-due', previous: { pauseKey: '2026-11-09' } })
  })

  it('Test-Mitteilung: eigene ID, ändert die gemerkte Pause nicht', async () => {
    const result = await scheduleTrainingReminderTest({ t, seconds: 60 })
    expect(result.ok).toBe(true)
    expect(ln.schedule.mock.calls[0][0].notifications[0].id).toBe(TRAINING_REMINDER_TEST_ID)
    expect(ln.schedule.mock.calls[0][0].notifications[0].sound).toBe('training-reminder.wav')
    expect(readPref('training-reminder-last')).toBeNull()
    expect(readTrainingReminderDiag().tests).toHaveLength(1)
    expect(readTrainingReminderDiag().syncs).toHaveLength(0)
  })

  it('Diagnose gehört zum Konto: Konto B sieht die Läufe von Konto A nicht, nichts im geräteweiten Log', async () => {
    await syncTrainingReminder({ settings: settings(), workouts, t, now: monday() })
    expect(readTrainingReminderDiag().syncs).toHaveLength(1)
    setActiveUid('uid-b')
    expect(readTrainingReminderDiag().syncs).toHaveLength(0)
    expect(localStorage.getItem('bro_split_load_diagnostics_v1')).toBeNull()
  })
})

describe('workoutsSignature', () => {
  it('erkennt ein verschobenes älteres Training bei gleicher Anzahl', () => {
    const a = [{ date: '2026-11-02T18:00:00.000Z' }, { date: '2026-11-09T18:00:00.000Z' }]
    const b = [{ date: '2026-11-10T18:00:00.000Z' }, { date: '2026-11-09T18:00:00.000Z' }]
    expect(workoutsSignature(a)).not.toBe(workoutsSignature(b))
  })
  it('Entwürfe zählen nicht', () => {
    const base = [{ date: '2026-11-09T18:00:00.000Z' }]
    expect(workoutsSignature([...base, { date: '2026-11-10T18:00:00.000Z', _isDraft: true }])).toBe(workoutsSignature(base))
  })
})
