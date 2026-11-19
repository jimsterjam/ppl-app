import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Fund Jimmy 19.11.: Der Hinweis "Ersetzt - statt {Name}" unter einer getauschten Übung wurde senkrecht (Zeichen für Zeichen)
// dargestellt. Der Übungskopf ist ein Raster mit einer schmalen 56-px-Spalte für das Vorschaubild; `.ex-text` löst sich per
// `display: contents` auf, seine Kinder sind direkte Rasterelemente. Ohne `grid-column` setzt der Browser ein Element in die nächste
// freie Zelle, und das ist die schmale Spalte. Layout rechnet happy-dom nicht - im echten Browser (Chromium, 375 px) gemessen:
// vorher 56 px breit und 75 px hoch, nachher 343 px breit und eine Zeile. Dieser Test hält die Regel im Quelltext fest.
const source = readFileSync(new URL('../../views/WorkoutDetailView.vue', import.meta.url), 'utf8')
const style = source.slice(source.lastIndexOf('<style'))

function fullWidthSelectors() {
  const rule = style.match(/([^{}]*)\{\s*grid-column:\s*1\s*\/\s*-1;\s*\}/g) || []
  return rule.flatMap((block) => block.split('{')[0].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((selector) => selector.trim()))
}

describe('Übungskopf: Zeilen unter dem Titel über die ganze Breite', () => {
  it('Hinweis "Ersetzt", Beschreibung und 1RM-Feld haben grid-column 1 / -1', () => {
    const selectors = fullWidthSelectors()
    for (const selector of ['.ex-info .ex-replaced', '.ex-info .ex-description', '.ex-info .one-rep-max-field']) {
      expect(selectors, selector).toContain(selector)
    }
  })

  it('Gegenprobe: der Kopf ist weiter ein Raster mit schmaler Bildspalte, und .ex-text bleibt display: contents', () => {
    expect(style).toMatch(/\.ex-info \{ display: grid; grid-template-columns: 56px minmax\(0, 1fr\)/)
    expect(style).toMatch(/\.ex-text \{ display: contents; \}/)
  })

  it('jedes direkte Kind von .ex-text mit Klasse hat eine Rasterangabe (Titelzeile, Metazeile, Hinweis, Beschreibung, 1RM)', () => {
    const block = source.slice(source.indexOf('<div class="ex-text">'), source.indexOf('class="media-overlay"'))
    const children = [...block.matchAll(/\n {18}<(?:div|p)[^>]*class="([\w-]+)"/g)].map((m) => m[1])
    expect(children).toEqual(expect.arrayContaining(['ex-title-row', 'ex-meta-row', 'ex-replaced', 'ex-description', 'one-rep-max-field']))
    const placed = [...fullWidthSelectors(), '.ex-title-row', '.ex-meta-row']
    for (const name of children) expect(placed.some((selector) => selector.endsWith(`.${name}`)), `.${name}`).toBe(true)
  })
})
