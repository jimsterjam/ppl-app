import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Kontowechsel auf demselben Gerät (Absprache Jimmy 06.11.2026): Das zweite Konto übernimmt keine Einstellungen des
// ersten, das erste bekommt seine eigenen beim Zurückwechseln wieder.
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => false }, registerPlugin: () => ({}) }))
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: { keepAwake: async () => {}, allowSleep: async () => {}, isSupported: async () => ({ isSupported: false }) } }))
vi.mock('@/utils/restEndSignal', () => ({ scheduleRestEndSignal: async () => {}, cancelRestEndSignal: async () => {}, NOTIFICATION_ID: 1, NOTIFICATION_DELAY_MS: 1200, NOTIFICATION_SOUND: 'x.wav' }))
vi.mock('@/utils/warmupSignal', () => ({ scheduleWarmupNotification: async () => {}, cancelWarmupNotification: async () => {} }))
vi.mock('@/utils/timerAudio', () => ({ ensureAudioUnlocked: async () => {}, clearSignalHistory: () => {}, emitTimerSignal: () => {} }))
vi.mock('@/api/account', () => ({ fetchAccountProfile: async () => ({}), updateAccountProfile: async () => ({}) }))

function installBrowser() {
  const data = new Map([['ppl_user_prefs_migrated_v1', '1']])
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)) },
    removeItem: (k) => { data.delete(k) }
  })
  const attrs = {}
  vi.stubGlobal('document', { documentElement: { setAttribute: (k, v) => { attrs[k] = v } } })
  vi.stubGlobal('navigator', { language: 'de-DE' })
  return { data, attrs }
}

async function setup() {
  vi.resetModules()
  const env = installBrowser()
  setActivePinia(createPinia())
  const [{ applyUserPreferences }, { useThemeStore }, { useSettingsStore }, { useRestTimerStore }, { useWarmupTimerStore }, { useTimerStore }, { createI18nInstance }] = await Promise.all([
    import('../userPreferences.js'), import('@/stores/themeStore'), import('@/stores/settingsStore'),
    import('@/stores/restTimerStore'), import('@/stores/warmupTimerStore'), import('@/stores/timerStore'), import('@/i18n')
  ])
  const stores = { theme: useThemeStore(), settings: useSettingsStore(), restTimer: useRestTimerStore(), warmupTimer: useWarmupTimerStore(), timer: useTimerStore(), i18n: createI18nInstance() }
  const switchTo = (uid) => applyUserPreferences(uid, stores)
  return { ...env, stores, switchTo }
}

describe('Einstellungen pro Konto', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('Konto B übernimmt weder Farbmodus noch Akzent, Sprache, Wochenziel noch Pausen-Einstellungen von Konto A', async () => {
    const { stores, switchTo, attrs } = await setup()
    switchTo('uidA')
    stores.theme.setTheme('light')
    stores.theme.setColorMode('violet')
    stores.settings.setLanguage('en')
    stores.settings.setWeeklyGoal(6)
    stores.restTimer.setSound('bell')
    stores.restTimer.setDuration('strength', 'compound', 240)
    stores.warmupTimer.adjust('cardio', 60)

    switchTo(null)
    expect(stores.theme.theme).toBe('dark')
    expect(attrs['data-theme']).toBe('dark')

    switchTo('uidB')
    expect(stores.theme.theme).toBe('dark')
    expect(stores.theme.colorMode).toBe('lime')
    expect(attrs['data-theme']).toBe('dark')
    expect(attrs['data-accent']).toBe('lime')
    expect(stores.settings.language).toBeNull()
    expect(stores.settings.weeklyGoal).toBe(4)
    expect(stores.restTimer.durations).toEqual({})
    expect(stores.warmupTimer.durations).toEqual({})
    expect(stores.i18n.global.locale.value).toBe('de')
  })

  it('Konto A bekommt beim Zurückwechseln seine eigenen Einstellungen wieder', async () => {
    const { stores, switchTo, attrs } = await setup()
    switchTo('uidA')
    stores.theme.setTheme('light')
    stores.theme.setColorMode('violet')
    stores.settings.setLanguage('en')
    stores.settings.setWeeklyGoal(6)
    stores.restTimer.setDuration('strength', 'compound', 240)
    switchTo('uidB')
    stores.theme.setTheme('dark')
    stores.settings.setWeeklyGoal(3)
    switchTo('uidA')
    expect(stores.theme.theme).toBe('light')
    expect(stores.theme.colorMode).toBe('violet')
    expect(attrs['data-theme']).toBe('light')
    expect(stores.settings.language).toBe('en')
    expect(stores.i18n.global.locale.value).toBe('en')
    expect(stores.settings.weeklyGoal).toBe(6)
    expect(stores.restTimer.durations.strength?.compound).toBe(240)
    switchTo('uidB')
    expect(stores.settings.weeklyGoal).toBe(3)
  })

  it('Änderungen in der Zeit ohne Konto schreiben nichts unter eine UID und nichts geräteweit', async () => {
    const { data, stores, switchTo } = await setup()
    switchTo(null)
    stores.theme.setTheme('light')
    expect([...data.keys()].filter((k) => k === 'theme' || k.startsWith('theme:'))).toEqual([])
  })
})
