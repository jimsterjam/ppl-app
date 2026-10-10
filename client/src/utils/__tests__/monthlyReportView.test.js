import { describe, it, expect } from 'vitest'
import { compareWithPrevious, conclusionKey, formatNumber, formatReportPeriod, isUnseen } from '../monthlyReportView.js'
import { buildSampleReport } from '../sampleMonthlyReport.js'
import { diagnosisTextKeys } from '../coachDiagnosisText.js'

describe('monthlyReportView', () => {
  it('Zeitraum: Tag und Monat in der App-Sprache', () => {
    const start = '2026-09-12T10:00:00Z'
    const end = '2026-10-09T10:00:00Z'
    expect(formatReportPeriod(start, end, 'de')).toBe('12. Sept. – 9. Okt.')
    expect(formatReportPeriod(start, end, 'en')).toBe('Sep 12 – Oct 9')
    expect(formatReportPeriod('x', end, 'de')).toBe('')
  })

  it('Zahlen mit Tausendertrennung je Sprache', () => {
    expect(formatNumber(21450, 'de')).toBe('21.450')
    expect(formatNumber(21450, 'en')).toBe('21,450')
  })

  it('Vergleich mit dem Vormonat: mehr, weniger, gleich, ohne Vormonat nichts', () => {
    expect(compareWithPrevious(14, 12)).toEqual({ key: 'more', diff: 2 })
    expect(compareWithPrevious(10, 12)).toEqual({ key: 'fewer', diff: 2 })
    expect(compareWithPrevious(12, 12)).toEqual({ key: 'same', diff: 0 })
    expect(compareWithPrevious(12, null)).toBeNull()
    expect(compareWithPrevious(12, undefined)).toBeNull()
  })

  it('Fazit: nur feste Schlüssel vom Server', () => {
    for (const key of ['more', 'same', 'fewer', 'first']) expect(conclusionKey(key)).toBe(key)
    expect(conclusionKey('<script>')).toBeNull()
    expect(conclusionKey(undefined)).toBeNull()
  })

  it('neu = nie geöffnet', () => {
    expect(isUnseen({ seenAt: null })).toBe(true)
    expect(isUnseen({ seenAt: '2026-10-01T00:00:00Z' })).toBe(false)
    expect(isUnseen(null)).toBe(false)
  })
})

describe('Beispielbericht', () => {
  const now = new Date('2026-10-10T12:00:00Z')
  const sample = buildSampleReport(now)

  it('ist als Beispiel markiert und hat die Struktur der Serverdaten', () => {
    expect(sample.isExample).toBe(true)
    expect(sample.id).toBe('example')
    expect(sample.facts.version).toBe(1)
    expect(sample.facts.days).toBe(28)
    expect(sample.facts.weeks).toHaveLength(4)
    expect(sample.facts.weeks.reduce((sum, w) => sum + w.sessions, 0)).toBe(sample.facts.totals.sessions)
    expect(conclusionKey(sample.facts.conclusion)).not.toBeNull()
  })

  it('Zeitraum endet jetzt und umfasst 28 Tage; Kurvenpunkte liegen darin', () => {
    expect(new Date(sample.periodEnd).getTime()).toBe(now.getTime())
    expect(new Date(sample.periodStart).getTime()).toBe(now.getTime() - 28 * 24 * 60 * 60 * 1000)
    for (const curve of sample.facts.exercises) {
      expect(curve.points.length).toBeGreaterThanOrEqual(2)
      for (const point of curve.points) {
        const t = new Date(point.date).getTime()
        expect(t).toBeGreaterThanOrEqual(new Date(sample.periodStart).getTime())
        expect(t).toBeLessThanOrEqual(now.getTime())
      }
    }
  })

  it('Stillstand-Eintrag lässt sich mit den vorhandenen Diagnose-Texten darstellen', () => {
    for (const item of sample.facts.stagnation.items) {
      expect(diagnosisTextKeys(item, 'de')).not.toBeNull()
    }
  })

  it('Übungsnamen englisch, wie im Übungskatalog (App-Regel)', () => {
    expect(sample.facts.exercises.map((e) => e.name)).toEqual(['Bench Press Barbell', 'Barbell High Bar Squat', 'Pull-Up'])
  })
})
