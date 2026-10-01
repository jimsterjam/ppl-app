import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { messages } from '../index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FAQ_VIEW = join(__dirname, '../../views/FaqsView.vue')

// Die FAQ-Liste (baseKeys in FaqsView.vue) setzt Titel und Text dynamisch zusammen
// ($t(`faqs.${key}`) / $t(`faqs.${key}Text`)) - der statische i18n-Check sieht diese Keys nicht.
// Fehlt einer, zeigt vue-i18n den Key-String selbst an. Dieser Test prüft beide Sprachen.
function faqKeys() {
  const source = readFileSync(FAQ_VIEW, 'utf-8')
  const match = source.match(/const baseKeys = \[([^\]]*)\]/)
  expect(match, 'baseKeys in FaqsView.vue nicht gefunden').not.toBeNull()
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('FAQ-Einträge', () => {
  const keys = faqKeys()

  test('Liste ist nicht leer und ohne Doppelte', () => {
    expect(keys.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
  })

  for (const locale of ['de', 'en']) {
    test(`jeder Eintrag hat Titel und Text (${locale})`, () => {
      const faqs = messages[locale].faqs
      for (const key of keys) {
        expect(typeof faqs[key], `${locale}: faqs.${key} fehlt`).toBe('string')
        expect(faqs[key].trim(), `${locale}: faqs.${key} leer`).not.toBe('')
        expect(typeof faqs[`${key}Text`], `${locale}: faqs.${key}Text fehlt`).toBe('string')
        expect(faqs[`${key}Text`].trim(), `${locale}: faqs.${key}Text leer`).not.toBe('')
      }
    })

    test(`keine Markdown-Sternchen im Text (${locale})`, () => {
      // Die FAQ zeigt reinen Text - **fett** würde mit Sternchen erscheinen.
      const faqs = messages[locale].faqs
      for (const key of keys) {
        expect(faqs[`${key}Text`], `${locale}: faqs.${key}Text`).not.toMatch(/\*\*/)
      }
    })
  }
})
