import { describe, it, expect } from 'vitest'
import { niceTicks, buildLineChart, summarizeCurve, barPercent } from '../reportChart.js'

describe('niceTicks', () => {
  it('runde Werte, die den Bereich umfassen', () => {
    const ticks = niceTicks(70, 80)
    expect(ticks[0]).toBeLessThanOrEqual(70)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(80)
    expect(ticks.every((v) => Number.isFinite(v))).toBe(true)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
  })

  it('gleicher Wert überall: trotzdem eine Achse mit Abstand', () => {
    const ticks = niceTicks(8, 8)
    expect(ticks[0]).toBeLessThan(8)
    expect(ticks[ticks.length - 1]).toBeGreaterThan(8)
  })

  it('ungültige Eingaben brechen nicht', () => {
    expect(niceTicks(NaN, 5)).toEqual([0, 1])
  })
})

describe('buildLineChart', () => {
  const range = { periodStart: '2026-09-12T00:00:00Z', periodEnd: '2026-10-10T00:00:00Z' }
  const points = [
    { date: '2026-09-14T00:00:00Z', value: 70 },
    { date: '2026-09-28T00:00:00Z', value: 75 },
    { date: '2026-10-08T00:00:00Z', value: 80 }
  ]

  it('Punkte liegen im Zeichenbereich, später = weiter rechts, schwerer = weiter oben', () => {
    const chart = buildLineChart(points, range)
    expect(chart.dots).toHaveLength(3)
    for (const dot of chart.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(chart.bounds.left)
      expect(dot.x).toBeLessThanOrEqual(chart.bounds.right)
      expect(dot.y).toBeGreaterThanOrEqual(chart.bounds.top)
      expect(dot.y).toBeLessThanOrEqual(chart.bounds.bottom)
    }
    expect(chart.dots[0].x).toBeLessThan(chart.dots[2].x)
    expect(chart.dots[0].y).toBeGreaterThan(chart.dots[2].y)
    expect(chart.path.startsWith('M')).toBe(true)
    expect(chart.path.match(/L/g)).toHaveLength(2)
  })

  it('unsortierte und ungültige Punkte werden bereinigt', () => {
    const chart = buildLineChart([points[2], { date: 'x', value: 5 }, { date: points[0].date, value: 'abc' }, points[0]], range)
    expect(chart.dots.map((d) => d.value)).toEqual([70, 80])
  })

  it('ohne Punkte: leeres Ergebnis', () => {
    expect(buildLineChart([], range)).toMatchObject({ path: '', dots: [], yTicks: [] })
    expect(buildLineChart(null, range).dots).toEqual([])
  })

  it('Gewichtsachse deckt alle Werte ab', () => {
    const chart = buildLineChart(points, range)
    const values = chart.yTicks.map((t) => t.value)
    expect(Math.min(...values)).toBeLessThanOrEqual(70)
    expect(Math.max(...values)).toBeGreaterThanOrEqual(80)
  })
})

describe('summarizeCurve', () => {
  it('erster, letzter Wert und Differenz', () => {
    expect(summarizeCurve([{ value: 70 }, { value: 75 }, { value: 80 }])).toEqual({ from: 70, to: 80, diff: 10 })
    expect(summarizeCurve([{ value: 80 }, { value: 77.5 }])).toEqual({ from: 80, to: 77.5, diff: -2.5 })
  })
  it('weniger als zwei Punkte: keine Zusammenfassung', () => {
    expect(summarizeCurve([{ value: 1 }])).toBeNull()
    expect(summarizeCurve(undefined)).toBeNull()
  })
})

describe('barPercent', () => {
  it('größter Wert = 100 %, kleiner Wert mind. 4 %, 0 = leer', () => {
    expect(barPercent(4, 4)).toBe(100)
    expect(barPercent(2, 4)).toBe(50)
    expect(barPercent(1, 100)).toBe(4)
    expect(barPercent(0, 4)).toBe(0)
    expect(barPercent(3, 0)).toBe(0)
  })
})
