import { describe, test, expect } from 'vitest'
import { runI18nCheck, loadBaseline, findingId } from '../../../scripts/i18n-check.mjs'

// Deterministischer i18n-Check (siehe scripts/i18n-check.mjs): schlägt fehl, sobald neuer Text
// ohne DE+EN-Übersetzung dazukommt. Bekannte Altlasten stehen in scripts/i18n-baseline.json und
// blockieren nicht - die Liste soll nur schrumpfen.
describe('i18n-Konsistenz', () => {
  test('keine neuen Texte ohne DE+EN-Übersetzung', async () => {
    const findings = await runI18nCheck()
    const baseline = loadBaseline()
    const fresh = findings
      .filter((f) => !baseline.has(findingId(f)))
      .map((f) => `${f.file}${f.line ? `:${f.line}` : ''} [${f.check}] ${f.text}`)

    expect(fresh, `Neue i18n-Funde - bitte übersetzen (Details: node scripts/i18n-check.mjs):\n${fresh.join('\n')}`).toEqual([])
  }, 30000)
})
