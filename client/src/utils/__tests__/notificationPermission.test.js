import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isNative: vi.fn(),
  checkPermissions: vi.fn(),
  openUrl: vi.fn()
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNative } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { checkPermissions: mocks.checkPermissions } }))
vi.mock('@capacitor/app', () => ({ App: { openUrl: mocks.openUrl } }))
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } }))

import {
  getNotificationPermission, shouldShowNotificationHint, openAppSettings,
  dismissNotificationHint, isNotificationHintDismissed
} from '../notificationPermission.js'

// Absprache Paul 11.10.: iOS fragt nur einmal. Wer "Nicht erlauben" getippt hat, bekommt in der App einen Hinweis
// mit Knopf zu den iPhone-Einstellungen.
describe('Mitteilungs-Erlaubnis', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Web: nicht abfragbar, kein Hinweis', async () => {
    mocks.isNative.mockReturnValue(false)
    expect(await getNotificationPermission()).toBe('unsupported')
    expect(mocks.checkPermissions).not.toHaveBeenCalled()
  })

  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['prompt', 'prompt'],
    ['prompt-with-rationale', 'prompt']
  ])('iOS: display=%s -> %s', async (display, expected) => {
    mocks.isNative.mockReturnValue(true)
    mocks.checkPermissions.mockResolvedValue({ display })
    expect(await getNotificationPermission()).toBe(expected)
  })

  it('Fehler bei der Abfrage: kein Hinweis statt Absturz', async () => {
    mocks.isNative.mockReturnValue(true)
    mocks.checkPermissions.mockRejectedValue(new Error('boom'))
    expect(await getNotificationPermission()).toBe('unsupported')
  })

  it('Hinweis nur bei verweigerter Erlaubnis und solange nicht ausgeblendet', () => {
    expect(shouldShowNotificationHint({ permission: 'denied', dismissed: false })).toBe(true)
    expect(shouldShowNotificationHint({ permission: 'denied', dismissed: true })).toBe(false)
    for (const permission of ['granted', 'prompt', 'unsupported']) {
      expect(shouldShowNotificationHint({ permission, dismissed: false })).toBe(false)
    }
  })

  it('Ausblenden wird gemerkt', () => {
    expect(isNotificationHintDismissed()).toBe(false)
    dismissNotificationHint()
    expect(isNotificationHintDismissed()).toBe(true)
  })

  it('Einstellungen öffnen: iOS springt in die App-Einstellungen, Web tut nichts', async () => {
    mocks.isNative.mockReturnValue(true)
    mocks.openUrl.mockResolvedValue(undefined)
    expect(await openAppSettings()).toBe(true)
    expect(mocks.openUrl).toHaveBeenCalledWith({ url: 'app-settings:' })

    mocks.isNative.mockReturnValue(false)
    mocks.openUrl.mockClear()
    expect(await openAppSettings()).toBe(false)
    expect(mocks.openUrl).not.toHaveBeenCalled()
  })

  it('Einstellungen öffnen schlägt fehl: false statt Fehler', async () => {
    mocks.isNative.mockReturnValue(true)
    mocks.openUrl.mockRejectedValue(new Error('nope'))
    expect(await openAppSettings()).toBe(false)
  })
})
