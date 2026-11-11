import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({ fetchAccountProfile: vi.fn(), updateAccountProfile: vi.fn() }))
vi.mock('@/api/account', () => api)

import { createI18nInstance } from '@/i18n'
import { buildReminderText, wasReminderAsked, markReminderAsked } from '../trainingReminder'
import { setActiveUid, __resetUserScopedStorageForTests } from '../userScopedStorage'
import { useSettingsStore } from '@/stores/settingsStore'

function useLocalStorageStub() {
  const mem = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  })
}

describe('buildReminderText', () => {
  const i18n = createI18nInstance()
  const t = (...args) => i18n.global.t(...args)

  it('Pause mit Plan-Tag (Deutsch, wie im Mockup)', () => {
    i18n.global.locale.value = 'de'
    expect(buildReminderText({ kind: 'gap', daysSince: 4, remaining: 0 }, { t, planDay: 'Pull A' })).toEqual({
      title: 'Zeit für dein nächstes Training?',
      body: 'Dein letztes war vor 4 Tagen. Heute passt Pull A.'
    })
  })

  it('Ziel knapp, Einzahl und Mehrzahl, ohne Plan (Englisch)', () => {
    i18n.global.locale.value = 'en'
    expect(buildReminderText({ kind: 'goal', daysSince: 2, remaining: 2 }, { t })).toEqual({
      title: '2 more workouts to reach your weekly goal',
      body: 'Today would be a good day.'
    })
    expect(buildReminderText({ kind: 'goal', daysSince: 2, remaining: 1 }, { t }).title).toBe('1 more workout to reach your weekly goal')
  })

  it('Text enthält nur Plan-Tag und Tageszahl (keine Gewichte, keine Namen)', () => {
    i18n.global.locale.value = 'de'
    const { title, body } = buildReminderText({ kind: 'gap', daysSince: 5, remaining: 0 }, { t })
    expect(`${title} ${body}`).not.toMatch(/kg|@/)
  })
})

describe('Einstellungen der Trainings-Erinnerung (pro Konto)', () => {
  beforeEach(() => {
    useLocalStorageStub()
    __resetUserScopedStorageForTests()
    setActivePinia(createPinia())
  })

  it('Standard: aus, 12:30, Wochenziel nicht bewusst gesetzt', () => {
    setActiveUid('uid-a')
    const store = useSettingsStore()
    store.reloadPrefsForUser()
    expect(store.trainingReminderEnabled).toBe(false)
    expect(store.trainingReminderTime).toBe('12:30')
    expect(store.hasExplicitWeeklyGoal).toBe(false)
  })

  it('Werte gehören zum Konto: Konto B sieht die Wahl von Konto A nicht', () => {
    setActiveUid('uid-a')
    const store = useSettingsStore()
    store.reloadPrefsForUser()
    store.setTrainingReminderEnabled(true)
    store.setTrainingReminderTime('08:00')
    store.setWeeklyGoal(3)
    markReminderAsked()
    expect(store.hasExplicitWeeklyGoal).toBe(true)

    setActiveUid('uid-b')
    store.reloadPrefsForUser()
    expect(store.trainingReminderEnabled).toBe(false)
    expect(store.trainingReminderTime).toBe('12:30')
    expect(store.hasExplicitWeeklyGoal).toBe(false)
    expect(wasReminderAsked()).toBe(false)

    setActiveUid('uid-a')
    store.reloadPrefsForUser()
    expect(store.trainingReminderEnabled).toBe(true)
    expect(store.trainingReminderTime).toBe('08:00')
    expect(wasReminderAsked()).toBe(true)
  })

  it('eigene Uhrzeit außerhalb 6:00–21:00 wird geklemmt', () => {
    setActiveUid('uid-a')
    const store = useSettingsStore()
    store.setTrainingReminderTime('22:30')
    expect(store.trainingReminderTime).toBe('21:00')
    store.setTrainingReminderTime('05:00')
    expect(store.trainingReminderTime).toBe('06:00')
  })
})
