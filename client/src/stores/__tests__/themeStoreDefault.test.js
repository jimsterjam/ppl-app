import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../themeStore.js'

// Absprache Paul 12.10.: Erstinstallation = dunkel + Lime, egal was das iPhone eingestellt hat.
describe('Theme-Standard bei Erstinstallation', () => {
  let store
  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    })
    // System steht auf "hell" - darf keinen Einfluss haben
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    setActivePinia(createPinia())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('nichts gespeichert: dark + lime', () => {
    const theme = useThemeStore()
    expect(theme.theme).toBe('dark')
    expect(theme.colorMode).toBe('lime')
  })

  it('gespeicherte Wahl des Nutzers bleibt erhalten', () => {
    store.set('theme', 'light')
    store.set('theme-accent', 'ocean')
    const theme = useThemeStore()
    expect(theme.theme).toBe('light')
    expect(theme.colorMode).toBe('ocean')
  })
})
