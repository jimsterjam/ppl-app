// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({ fetchAccountProfile: vi.fn(), updateAccountProfile: vi.fn() }))
vi.mock('@/api/account', () => api)
const perm = vi.hoisted(() => ({ ensureNotificationPermission: vi.fn() }))
vi.mock('@/utils/notificationPermission', () => perm)

import TrainingReminderSettings from '../TrainingReminderSettings.vue'
import { createI18nInstance } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { setActiveUid, __resetUserScopedStorageForTests } from '@/utils/userScopedStorage'

const ITEM_PX = 40
let pinia

async function mountSettings() {
  const i18n = createI18nInstance()
  i18n.global.locale.value = 'de'
  const wrapper = mount(TrainingReminderSettings, {
    global: {
      plugins: [pinia, i18n],
      // Hinweis zur iOS-Erlaubnis ist ein eigener Baustein; Fenster ohne Teleport im Test sichtbar
      stubs: { NotificationHint: true, teleport: true }
    }
  })
  await flushPromises()
  return wrapper
}
const chip = (w, label) => w.findAll('.reminder-chip').find((c) => c.text().includes(label))

describe('TrainingReminderSettings (Einstellungen)', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
    pinia = createPinia()
    setActivePinia(pinia)
    const settings = useSettingsStore()
    settings.switchUser('uid-a')
    settings.reloadPrefsForUser()
    perm.ensureNotificationPermission.mockReset().mockResolvedValue('granted')
  })

  it('Einschalten fragt zuerst iOS und speichert dann', async () => {
    const settings = useSettingsStore()
    let enabledWhenAsked = null
    perm.ensureNotificationPermission.mockImplementation(async () => {
      enabledWhenAsked = settings.trainingReminderEnabled
      return 'granted'
    })
    const w = await mountSettings()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(enabledWhenAsked).toBe(false)
    expect(settings.trainingReminderEnabled).toBe(true)
  })

  it('Vorgaben setzen die Uhrzeit, „Mittags“ ist Standard', async () => {
    const settings = useSettingsStore()
    settings.setTrainingReminderEnabled(true)
    const w = await mountSettings()
    expect(chip(w, 'Mittags').attributes('aria-pressed')).toBe('true')
    await chip(w, 'Morgens').trigger('click')
    expect(settings.trainingReminderTime).toBe('08:00')
    expect(chip(w, 'Morgens').attributes('aria-pressed')).toBe('true')
  })

  it('„Eigene“ öffnet sofort das Fenster; beide Räder werden beim sofortigen Übernehmen gemeinsam gespeichert', async () => {
    const settings = useSettingsStore()
    settings.setTrainingReminderEnabled(true)
    const w = await mountSettings()
    await chip(w, 'Eigene').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    // Beide Räder wischen und ohne zu warten übernehmen (Fund aus dem Review: ein Rad ging verloren)
    w.find('.wheel--hour').element.scrollTop = 2 * ITEM_PX // 02 Uhr: Nachtschicht
    w.find('.wheel--minute').element.scrollTop = 9 * ITEM_PX // 45
    await w.find('.modal-actions .btn.primary').trigger('click')
    await flushPromises()
    expect(settings.trainingReminderTime).toBe('02:45')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(chip(w, 'Eigene').attributes('aria-pressed')).toBe('true')
    expect(chip(w, 'Eigene').text()).toContain('2:45')
  })

  it('Kontowechsel bei offenem Fenster: Fenster zu, nichts ins neue Konto gespeichert', async () => {
    const settings = useSettingsStore()
    settings.setTrainingReminderEnabled(true)
    settings.setTrainingReminderTime('19:15')
    const w = await mountSettings()
    await chip(w, 'Eigene').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(true)

    setActiveUid('uid-b')
    settings.switchUser('uid-b')
    settings.reloadPrefsForUser()
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(settings.trainingReminderTime).toBe('12:30')
    expect(localStorage.getItem('training-reminder-time:uid-b')).toBeNull()
  })
})
