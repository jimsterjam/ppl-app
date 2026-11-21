// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore, ACCENT_MODES } from '../themeStore.js'
import { CARD_TONES, DEFAULT_CARD_TONE, CARD_TONE_COLORS } from '../../config/cardTones.js'
import { messages } from '../../i18n/index.js'
import { setActiveUid, __resetUserScopedStorageForTests } from '../../utils/userScopedStorage.js'

// Kartenfarben (Absprache Jimmy 21.11.): färben nur Karten und Kacheln (--card-bg, --card-soft; nie --surface-strong, das nutzen unabhängige Bedienelemente), der Seitenhintergrund bleibt. Der Test liest die
// echten Regeln aus style.css und prüft sie gegen config/cardTones.js und gegen ALLE Akzentfarben in dunkel und hell.
const css = readFileSync(resolve(import.meta.dirname, '../../style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function block(selectorRegex) {
  const match = css.match(new RegExp(`(?:^|\\n)${selectorRegex}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : null
}
const vars = (body) => Object.fromEntries([...(body || '').matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
function over(color, background) {
  const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
  if (!rgba) return color
  const alpha = Number(rgba[4])
  const bg = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16))
  return '#' + [1, 2, 3].map((i, k) => Math.round(Number(rgba[i]) * alpha + bg[k] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const baseDark = vars(block(':root'))
const baseLight = { ...baseDark, ...vars(block('\\[data-theme="light"\\]')) }
const accentDark = (mode) => (mode === 'lime' ? baseDark : { ...baseDark, ...vars(block(`:root\\[data-accent="${mode}"\\]`)) })
const accentLight = (mode) => ({ ...baseLight, ...vars(block(`\\[data-theme="light"\\]\\[data-accent="${mode}"\\]`)) })
const toneRules = (tone, side) => vars(block(`:root\\[data-theme="${side}"\\]\\[data-card-tone="${tone}"\\]`))
const SURFACES = ['--card-bg', '--card-soft']
const toneSurfaces = (tone, side) => {
  const base = side === 'dark' ? baseDark : baseLight
  return { ...Object.fromEntries(SURFACES.map((k) => [k, base[k]])), ...toneRules(tone, side) }
}

describe('Kartenfarben', () => {
  it('die gewünschte Auswahl, Graphit ist der Standard', () => {
    expect(CARD_TONES).toEqual(['graphit', 'schwarz', 'nacht', 'wald', 'beere', 'bordeaux', 'petrol', 'schiefer'])
    expect(DEFAULT_CARD_TONE).toBe('graphit')
  })

  describe.each(CARD_TONES)('%s', (tone) => {
    it('hat einen Namen in Deutsch und Englisch', () => {
      const key = `cardTone${tone[0].toUpperCase()}${tone.slice(1)}`
      expect(messages.de.settings[key]).toBeTruthy()
      expect(messages.en.settings[key]).toBeTruthy()
    })

    it('Regeln in style.css stimmen mit config/cardTones.js überein (Graphit: Grundwerte, keine eigene Regel)', () => {
      for (const side of ['dark', 'light']) {
        const s = toneSurfaces(tone, side)
        expect([s['--card-bg'], s['--card-soft']]).toEqual([CARD_TONE_COLORS[tone][side].card, CARD_TONE_COLORS[tone][side].soft])
      }
      if (tone === 'graphit') expect(toneRules('graphit', 'dark')).toEqual({})
      else expect(Object.keys(toneRules(tone, 'dark')).sort()).toEqual([...SURFACES].sort())
    })

    it('jeder Ton hat in style.css je eine Regel für dunkel und hell (Graphit nicht)', () => {
      for (const side of ['dark', 'light']) {
        const rule = block(`:root\\[data-theme="${side}"\\]\\[data-card-tone="${tone}"\\]`)
        if (tone === 'graphit') expect(rule).toBeNull()
        else expect(rule).toBeTruthy()
      }
    })

    it('Gegenprobe: --surface-strong und --bg werden nie überschrieben (unabhängige Bedienelemente bleiben)', () => {
      for (const side of ['dark', 'light']) {
        const keys = Object.keys(toneRules(tone, side))
        expect(keys).not.toContain('--surface-strong')
        expect(keys).not.toContain('--bg')
      }
    })

    it('der Seitenhintergrund bleibt unberührt: nur Karten- und Kachelflächen werden gesetzt', () => {
      for (const side of ['dark', 'light']) {
        for (const key of Object.keys(toneRules(tone, side))) expect(SURFACES).toContain(key)
      }
    })

    it.each(['dark', 'light'])('Schrift und Akzent sind auf allen Flächen lesbar (%s, alle Akzentfarben)', (side) => {
      const surfaces = toneSurfaces(tone, side)
      const base = side === 'dark' ? baseDark : baseLight
      for (const key of SURFACES) {
        expect(contrast(base['--fg'], surfaces[key])).toBeGreaterThanOrEqual(7)
        expect(contrast(base['--muted'], surfaces[key])).toBeGreaterThanOrEqual(4.5)
      }
      for (const mode of ACCENT_MODES) {
        const accent = side === 'dark' ? accentDark(mode) : accentLight(mode)
        for (const key of SURFACES) {
          expect(contrast(accent['--accent-color'], surfaces[key])).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrast(accent['--accent-color'], over(accent['--accent-soft'], surfaces['--card-bg']))).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  it('Gegenprobe: ein Ton ohne Regeln fällt auf', () => {
    expect(block(':root\\[data-theme="dark"\\]\\[data-card-tone="pink"\\]')).toBeNull()
    expect(toneRules('pink', 'dark')).toEqual({})
    // und ein zu heller Dunkel-Ton würde bei heller Schrift durchfallen
    expect(contrast('#9aa3b8', '#6b7080')).toBeLessThan(4.5)
  })
})

describe('Kartenfarbe im Store', () => {
  let storage
  beforeEach(() => {
    storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    })
    __resetUserScopedStorageForTests()
    setActiveUid('uidA')
    setActivePinia(createPinia())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('ohne Wahl: Graphit, Attribut am Dokument gesetzt', () => {
    const theme = useThemeStore()
    expect(theme.cardTone).toBe('graphit')
    theme.applyCurrent()
    expect(document.documentElement.getAttribute('data-card-tone')).toBe('graphit')
  })

  it('Wahl wird gespeichert, angewendet und überlebt Theme- und Akzentwechsel', () => {
    const theme = useThemeStore()
    theme.setCardTone('wald')
    expect(storage.get('theme-card-tone:uidA')).toBe('wald')
    expect(document.documentElement.getAttribute('data-card-tone')).toBe('wald')
    theme.setTheme('light')
    theme.setColorMode('violet')
    expect(document.documentElement.getAttribute('data-card-tone')).toBe('wald')
    expect(theme.cardTone).toBe('wald')
  })

  it('Gegenprobe: ein unbekannter Wert wird zu Graphit', () => {
    const theme = useThemeStore()
    theme.setCardTone('neon')
    expect(theme.cardTone).toBe('graphit')
    expect(document.documentElement.getAttribute('data-card-tone')).toBe('graphit')
  })

  it('Gegenprobe: ein zweites Konto sieht die Wahl des ersten nicht', () => {
    const theme = useThemeStore()
    theme.setCardTone('beere')
    setActiveUid('uidB')
    theme.reloadForUser()
    expect(theme.cardTone).toBe('graphit')
    expect(document.documentElement.getAttribute('data-card-tone')).toBe('graphit')
    setActiveUid('uidA')
    theme.reloadForUser()
    expect(theme.cardTone).toBe('beere')
  })
})
