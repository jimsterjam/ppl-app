// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({ fetchAccountProfile: vi.fn(), updateAccountProfile: vi.fn() }))
vi.mock('@/api/account', () => api)
const perm = vi.hoisted(() => ({
  getNotificationPermission: vi.fn(),
  ensureNotificationPermission: vi.fn()
}))
vi.mock('@/utils/notificationPermission', () => perm)

import TrainingReminderAsk from '../TrainingReminderAsk.vue'
import { createI18nInstance } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { setActiveUid, __resetUserScopedStorageForTests } from '@/utils/userScopedStorage'
import { wasReminderAsked } from '@/utils/trainingReminder'

let pinia
async function mountAsk(props = {}) {
  const i18n = createI18nInstance()
  i18n.global.locale.value = 'de'
  const wrapper = mount(TrainingReminderAsk, {
    props: { hasTrained: true, uid: 'uid-a', ...props },
    global: { plugins: [pinia, i18n] }
  })
  await flushPromises()
  return wrapper
}
const value = (w) => w.find('.reminder-ask-value strong').text()
const [minus, plus] = [(w) => w.findAll('.reminder-ask-step')[0], (w) => w.findAll('.reminder-ask-step')[1]]

describe('TrainingReminderAsk (Frage nach dem ersten Training)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
    pinia = createPinia()
    setActivePinia(pinia)
    perm.getNotificationPermission.mockReset().mockResolvedValue('prompt')
    perm.ensureNotificationPermission.mockReset().mockResolvedValue('granted')
  })

  it('erscheint erst nach dem ersten Training und nur, wenn iOS Mitteilungen kennt', async () => {
    expect((await mountAsk({ hasTrained: false })).find('.reminder-ask').exists()).toBe(false)
    expect((await mountAsk()).find('.reminder-ask').exists()).toBe(true)
    perm.getNotificationPermission.mockResolvedValue('unsupported')
    expect((await mountAsk()).find('.reminder-ask').exists()).toBe(false)
  })

  it('Vorauswahl: ohne Ziel und Plan 3, mit Plan die Zahl der Plan-Tage, mit eigenem Ziel das Ziel', async () => {
    expect(value(await mountAsk())).toBe('3')
    expect(value(await mountAsk({ planDays: 6 }))).toBe('6')
    useSettingsStore().setWeeklyGoal(9)
    expect(value(await mountAsk({ planDays: 6 }))).toBe('9')
  })

  it('− und + bleiben zwischen 1 und 14', async () => {
    const w = await mountAsk()
    for (let i = 0; i < 5; i += 1) await minus(w).trigger('click')
    expect(value(w)).toBe('1')
    expect(minus(w).attributes('disabled')).toBeDefined()
    for (let i = 0; i < 20; i += 1) await plus(w).trigger('click')
    expect(value(w)).toBe('14')
    expect(plus(w).attributes('disabled')).toBeDefined()
  })

  it('„Erinnerung einschalten“: Zahl wird Wochenziel, Erinnerung an, Frage weg', async () => {
    const w = await mountAsk()
    await plus(w).trigger('click')
    await plus(w).trigger('click')
    await w.find('.reminder-ask-confirm').trigger('click')
    await flushPromises()
    const settings = useSettingsStore()
    expect(settings.weeklyGoal).toBe(5)
    expect(settings.hasExplicitWeeklyGoal).toBe(true)
    expect(settings.trainingReminderEnabled).toBe(true)
    expect(perm.ensureNotificationPermission).toHaveBeenCalledTimes(1)
    expect(wasReminderAsked()).toBe(true)
    expect(w.find('.reminder-ask').exists()).toBe(false)
  })

  it('„Nein, danke“: nichts eingeschaltet, nie wieder fragen', async () => {
    const w = await mountAsk()
    await w.find('.reminder-ask-no').trigger('click')
    expect(useSettingsStore().trainingReminderEnabled).toBe(false)
    expect(perm.ensureNotificationPermission).not.toHaveBeenCalled()
    expect(wasReminderAsked()).toBe(true)
    expect(w.find('.reminder-ask').exists()).toBe(false)
  })

  it('Kontowechsel: die Zahl des vorigen Kontos wird verworfen', async () => {
    const w = await mountAsk()
    await plus(w).trigger('click')
    await plus(w).trigger('click')
    expect(value(w)).toBe('5')
    setActiveUid('uid-b')
    useSettingsStore().reloadPrefsForUser()
    await w.setProps({ uid: 'uid-b' })
    expect(value(w)).toBe('3')
  })
})
