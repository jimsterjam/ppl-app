// Layout-Berechnung für die Diagramme im Monatsbericht (inline SVG, kein Chart-Paket: klein, folgt dem
// Farbschema der App und lässt sich später ohne Umweg drucken/als PDF speichern). Ohne Vue-Imports.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * "Schöne" Achsenwerte (1, 2, 2.5, 5 × 10^n) zwischen min und max.
 * @returns {number[]} aufsteigend, mindestens zwei Werte
 */
export function niceTicks(min, max, count = 3) {
  let lo = Number(min)
  let hi = Number(max)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  if (hi === lo) {
    const pad = Math.max(1, Math.abs(hi) * 0.1)
    lo -= pad
    hi += pad
  }
  const rough = (hi - lo) / Math.max(1, count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) || 10 * magnitude
  const start = Math.floor(lo / step) * step
  const ticks = []
  for (let v = start; v < hi + step - 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks.length >= 2 ? ticks : [start, start + step]
}

/**
 * Liniendiagramm: Punkte in Pixel umrechnen.
 * @param {Array<{ date: string, value: number }>} points
 * @param {{ periodStart: string|Date, periodEnd: string|Date }} range - x-Achse
 * @param {{ width?: number, height?: number, left?: number, right?: number, top?: number, bottom?: number }} [box]
 * @returns {{ path: string, dots: Array<{x:number,y:number,value:number,date:string}>, yTicks: Array<{y:number,value:number}>, bounds: {left:number,right:number,top:number,bottom:number} }}
 */
export function buildLineChart(points, range, box = {}) {
  const { width = 320, height = 160, left = 40, right = 12, top = 12, bottom = 24 } = box
  const start = new Date(range.periodStart).getTime()
  const end = new Date(range.periodEnd).getTime()
  const span = Math.max(MS_PER_DAY, end - start)
  const clean = (Array.isArray(points) ? points : [])
    .map((p) => ({ date: p.date, value: Number(p.value), time: new Date(p.date).getTime() }))
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.time))
    .sort((a, b) => a.time - b.time)

  const bounds = { left, right: width - right, top, bottom: height - bottom }
  if (!clean.length) return { path: '', dots: [], yTicks: [], bounds }

  const ticks = niceTicks(Math.min(...clean.map((p) => p.value)), Math.max(...clean.map((p) => p.value)))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const x = (time) => bounds.left + (Math.min(Math.max(time, start), start + span) - start) / span * (bounds.right - bounds.left)
  const y = (value) => bounds.bottom - (value - yMin) / (yMax - yMin) * (bounds.bottom - bounds.top)
  const round = (n) => Math.round(n * 10) / 10

  const dots = clean.map((p) => ({ x: round(x(p.time)), y: round(y(p.value)), value: p.value, date: p.date }))
  const path = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x} ${d.y}`).join(' ')
  const yTicks = ticks.map((value) => ({ value, y: round(y(value)) }))
  return { path, dots, yTicks, bounds }
}

/** Erster, letzter Wert und Differenz einer Kurve (für die Textzeile unter dem Diagramm). */
export function summarizeCurve(points) {
  const values = (Array.isArray(points) ? points : []).map((p) => Number(p.value)).filter(Number.isFinite)
  if (values.length < 2) return null
  const from = values[0]
  const to = values[values.length - 1]
  return { from, to, diff: Math.round((to - from) * 100) / 100 }
}

/** Balkenhöhe in Prozent (0-100); der größte Wert füllt den Platz, mindestens 4 % bei Wert > 0. */
export function barPercent(value, max) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  if (v <= 0 || m <= 0) return 0
  return Math.max(4, Math.round(v / m * 100))
}
