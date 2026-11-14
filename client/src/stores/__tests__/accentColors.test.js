import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ACCENT_MODES } from '../themeStore.js'
import { messages } from '../../i18n/index.js'

// Akzentfarben (Absprache Jimmy 14.11.): Jede Farbe braucht dunkle UND helle Regeln in style.css, einen Namen in DE+EN
// und lesbare Schrift auf Knöpfen. Der Test liest die echten Regeln aus style.css - eine neue Farbe ohne Regeln fällt auf.
// Kommentare vorher entfernen: Zeichen wie } darin dürfen die Regeln nicht zerschneiden
const css = readFileSync(fileURLToPath(new URL('../../style.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function block(selectorRegex) {
  const match = css.match(new RegExp(`(?:^|\\n)${selectorRegex}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : null
}
function vars(body) {
  return Object.fromEntries([...body.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}
// Farbe (#rrggbb oder rgba(r, g, b, a)) über einen Untergrund (#rrggbb) legen -> #rrggbb
function over(color, background) {
  const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
  if (!rgba) return color
  const alpha = Number(rgba[4])
  const bg = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16))
  return '#' + [1, 2, 3].map((i, k) => Math.round(Number(rgba[i]) * alpha + bg[k] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
// Lime ist die Grundfarbe: dunkel steht sie im ersten :root-Block, hell im Block [data-theme="light"]; alle anderen
// Farben haben eigene Blöcke, die die Grundwerte überschreiben (Werte, die ein Block nicht nennt, gelten weiter).
const baseDark = vars(block(':root'))
const baseLight = { ...baseDark, ...vars(block('\\[data-theme="light"\\]')) }
const darkRules = (mode) => (mode === 'lime' ? ':root' : block(`:root\\[data-accent="${mode}"\\]`))
const lightRules = (mode) => block(`\\[data-theme="light"\\]\\[data-accent="${mode}"\\]`)
const darkVars = (mode) => (mode === 'lime' ? baseDark : { ...baseDark, ...vars(darkRules(mode)) })
const lightVars = (mode) => ({ ...baseLight, ...vars(lightRules(mode)) })

describe('Akzentfarben', () => {
  it('die gewünschte Auswahl und Reihenfolge', () => {
    expect(ACCENT_MODES).toEqual(['lime', 'ocean', 'violet', 'sunset', 'aqua', 'gold', 'chalk'])
  })

  describe.each(ACCENT_MODES)('%s', (mode) => {
    it('hat Regeln für dunkel und hell', () => {
      expect(darkRules(mode)).toBeTruthy()
      expect(lightRules(mode)).toBeTruthy()
    })
    it('hat einen Namen in Deutsch und Englisch', () => {
      const key = `colorMode${mode[0].toUpperCase()}${mode.slice(1)}`
      expect(messages.de.settings[key]).toBeTruthy()
      expect(messages.en.settings[key]).toBeTruthy()
    })
    it('Schrift auf Knöpfen ist lesbar (>= 4,5:1) in dunkel und hell', () => {
      const dark = darkVars(mode)
      expect(contrast(dark['--accent'], dark['--accent-contrast'])).toBeGreaterThanOrEqual(4.5)
      const light = lightVars(mode)
      expect(contrast(light['--accent'], light['--accent-contrast'])).toBeGreaterThanOrEqual(4.5)
    })
    it('auch --accent-strong (Hover/gedrückt) trägt die Schrift des Knopfs', () => {
      for (const v of [darkVars(mode), lightVars(mode)]) {
        expect(contrast(v['--accent-strong'], v['--accent-contrast'])).toBeGreaterThanOrEqual(4.5)
      }
    })
    it('Akzentfarbe als Text auf dem echten Kartenuntergrund und auf der weichen Fläche (--accent-soft) lesbar', () => {
      for (const v of [darkVars(mode), lightVars(mode)]) {
        const card = v['--card-bg']
        expect(contrast(v['--accent-color'], card)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--accent-color'], over(v['--accent-soft'], card))).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  it('Gegenprobe: eine Farbe ohne Regeln würde auffallen', () => {
    expect(darkRules('pink')).toBeNull()
    expect(lightRules('pink')).toBeNull()
    // und ein zu heller Knopf mit weißer Schrift würde durchfallen
    expect(contrast('#ffc94a', '#ffffff')).toBeLessThan(4.5)
  })
})
