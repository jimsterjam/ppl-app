import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Selbstprüfung PR #187 (Copilot): Wo eine Fläche die Akzentfarbe als Hintergrund hat, darf die Schrift nicht fest weiß
// (#fff/white) sein - auf Lime, Aqua, Gold, Chalk usw. im dunklen Modus wäre sie unlesbar. Richtig ist
// var(--accent-color-contrast) bzw. var(--accent-contrast), die für jede Farbe und jeden Modus passen
// (Kontrast geprüft in accentColors.test.js).
const ACCENT_BG = /background(?:-color)?\s*:\s*[^;]*var\(--accent(?:-color)?(?:-strong)?\)/i
const HARD_WHITE_TEXT = /(?:^|[;\s])color\s*:\s*(?:#fff(?:fff)?|white)\s*(?:;|$)/i

/** Regeln (Selektor + Inhalt) aus Stilen, die Akzent-Hintergrund mit festem Weiß als Schrift verbinden. */
export function findWhiteOnAccent(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const found = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (ACCENT_BG.test(m[2]) && HARD_WHITE_TEXT.test(m[2])) found.push(m[1].trim().split('\n').pop())
  }
  return found
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path)
    return /\.(vue|css)$/.test(name) ? [path] : []
  })
}

describe('Schrift auf Akzentfarbe', () => {
  it('kein festes Weiß auf Akzent-Hintergrund in den Komponenten und Stilen der App', () => {
    const src = fileURLToPath(new URL('../../', import.meta.url))
    const problems = files(src).flatMap((f) => findWhiteOnAccent(readFileSync(f, 'utf8')).map((sel) => `${f.replace(src, '')}: ${sel}`))
    expect(problems).toEqual([])
  })

  it('Gegenproben: der Prüfer erkennt den Fehler, lässt Richtiges und Kommentare durch', () => {
    expect(findWhiteOnAccent('.save-btn { background: var(--accent-color); color: #fff; }')).toEqual(['.save-btn'])
    expect(findWhiteOnAccent('.a { background-color: var(--accent); color: white; }')).toEqual(['.a'])
    expect(findWhiteOnAccent('.ok { background: var(--accent-color); color: var(--accent-color-contrast); }')).toEqual([])
    expect(findWhiteOnAccent('.other { background: #333; color: #fff; }')).toEqual([])
    expect(findWhiteOnAccent('/* .x { background: var(--accent); color: #fff; } */')).toEqual([])
  })
})
