import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import { messages } from '@/i18n'
import { buildMonthlyReportPdf, reportPdfFileName } from '../monthlyReportPdf.js'
import { buildSampleReport } from '../sampleMonthlyReport.js'

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')

function translator(locale) {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages, missingWarn: false, fallbackWarn: false, linkKey: '$:' })
  return i18n.global.t
}

const NOW = new Date('2026-10-10T12:00:00Z')

describe('Monatsbericht als PDF', () => {
  it('Dateiname aus dem Ende des Zeitraums, ohne Sonderzeichen', () => {
    expect(reportPdfFileName({ periodEnd: '2026-10-10T12:00:00.000Z' })).toBe('ppl-monthly-report-2026-10-10.pdf')
    expect(reportPdfFileName({ periodEnd: '../x' })).toBe('ppl-monthly-report.pdf')
    expect(reportPdfFileName(null)).toBe('ppl-monthly-report.pdf')
  })

  it.each(['de', 'en'])('%s: Beispielbericht wird ein gültiges PDF mit den Abschnitten', (locale) => {
    const t = translator(locale)
    const sample = buildSampleReport(NOW)
    const bytes = buildMonthlyReportPdf(sample, { t, locale, now: NOW })
    const text = latin1(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    // Abschnitte stehen im PDF (Text in Klammern, Umlaute als Oktalcode)
    expect(text).toContain(`(${t('monthlyReport.modalTitle')}) Tj`)
    expect(text).toContain(`(${t('monthlyReport.weeksTitle')}) Tj`)
    expect(text).toContain(`(${t('monthlyReport.stagnationTitle').replace('ß', '\\337')}) Tj`)
    // als Beispiel gekennzeichnet
    expect(text).toContain(t('monthlyReport.pdfExample').split(' –')[0])
    // Fußzeile mit Seitenzahl
    expect(text).toContain(t('monthlyReport.pdfPage', { n: 1, total: (text.match(/\/Type \/Page /g) || []).length }))
  })

  it('echter Bericht (kein Beispiel): ohne Beispiel-Hinweis', () => {
    const t = translator('de')
    const real = { ...buildSampleReport(NOW), isExample: false, id: 'abc' }
    const text = latin1(buildMonthlyReportPdf(real, { t, locale: 'de', now: NOW }))
    expect(text).not.toContain('Beispielbericht mit erfundenen Daten')
  })

  it('viele Übungen und Stillstände: läuft über mehrere Seiten, alle xref-Offsets stimmen', () => {
    const t = translator('de')
    const sample = buildSampleReport(NOW)
    const curve = sample.facts.exercises[0]
    sample.facts.exercises = Array.from({ length: 8 }, (_, i) => ({ ...curve, key: `k${i}`, name: `Übung ${i}` }))
    const item = sample.facts.stagnation.items[0]
    sample.facts.stagnation.items = Array.from({ length: 3 }, (_, i) => ({ ...item, key: `s${i}`, name: `Stillstand ${i}` }))
    const text = latin1(buildMonthlyReportPdf(sample, { t, locale: 'de', now: NOW }))
    const pages = (text.match(/\/Type \/Page /g) || []).length
    expect(pages).toBeGreaterThanOrEqual(2)
    expect(text).toContain(`/Count ${pages}`)

    const xrefStart = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1])
    const entries = text.slice(xrefStart).split('\n').filter((line) => /^\d{10} 00000 n $/.test(line))
    entries.forEach((line, index) => {
      const offset = Number(line.slice(0, 10))
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`)
    })
  })

  it('leere Daten (keine Kurven, kein Stillstand) brechen nicht', () => {
    const t = translator('en')
    const report = { periodStart: '2026-09-12T00:00:00Z', periodEnd: '2026-10-10T00:00:00Z', facts: { totals: {}, exercises: [], weeks: [], stagnation: { items: [] } } }
    const text = latin1(buildMonthlyReportPdf(report, { t, locale: 'en', now: NOW }))
    expect(text).toContain(t('monthlyReport.stagnationNone'))
  })
})
