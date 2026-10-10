// Monatsbericht als PDF (A4): dieselben Zahlen, Diagramme und Stillstands-Hinweise wie die Ansicht in der App
// (components/MonthlyReportModal.vue). Gezeichnet mit utils/simplePdf.js - ohne PDF-Paket, die Diagramme sind
// Vektorgrafik. Alle Texte kommen über t() (DE/EN), Übungsnamen über translateName (englisch, wie überall).
import { createPdf, PAGE_A4, wrapText } from '@/utils/simplePdf'
import { buildLineChart, barPercent, summarizeCurve } from '@/utils/reportChart'
import { diagnosisTextKeys } from '@/utils/coachDiagnosisText'
import { compareWithPrevious, conclusionKey, formatNumber, formatReportPeriod } from '@/utils/monthlyReportView'

const MARGIN = 42
const CONTENT_WIDTH = PAGE_A4.width - MARGIN * 2
const FOOTER_Y = PAGE_A4.height - 26
const BOTTOM = PAGE_A4.height - 48

const INK = [0.09, 0.09, 0.1]
const MUTED = [0.42, 0.43, 0.46]
const LINE = [0.82, 0.83, 0.85]
const TILE = [0.95, 0.95, 0.96]
const ACCENT = [0.3, 0.49, 0.06]

/** Dateiname ohne Sonderzeichen, z. B. ppl-monthly-report-2026-10-10.pdf */
export function reportPdfFileName(report) {
  const day = String(report?.periodEnd || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `ppl-monthly-report-${day}.pdf` : 'ppl-monthly-report.pdf'
}

/**
 * @param {{ periodStart: string, periodEnd: string, isExample?: boolean, facts: object }} report
 * @param {{ t: Function, locale: string, translateName?: (name: string) => string, now?: Date }} deps
 * @returns {Uint8Array}
 */
export function buildMonthlyReportPdf(report, { t, locale, translateName = (n) => n, now = new Date() }) {
  const facts = report?.facts || {}
  const pdf = createPdf({ title: t('monthlyReport.modalTitle'), author: 'PPL Fundamentals' })
  let page = pdf.addPage()
  let y = MARGIN

  const newPage = () => {
    page = pdf.addPage()
    y = MARGIN
  }
  const ensure = (height) => {
    if (y + height > BOTTOM) newPage()
  }
  const paragraph = (text, { size = 9, bold = false, color = INK, gap = 3, width = CONTENT_WIDTH, x = MARGIN } = {}) => {
    const lines = wrapText(text, width, size, bold)
    const lineHeight = size * 1.35
    for (const line of lines) {
      ensure(lineHeight)
      page.text(x, y + size, line, { size, bold, color })
      y += lineHeight
    }
    y += gap
  }
  // Überschrift nie allein am Seitenende: gleich genug Platz für den ersten Inhalt mitreservieren.
  const heading = (text, contentHeight = 60) => {
    ensure(28 + contentHeight)
    y += 8
    page.text(MARGIN, y + 12, text, { size: 12, bold: true })
    y += 20
  }

  // Kopf
  page.text(MARGIN, y + 8, 'PPL Fundamentals', { size: 9, bold: true, color: ACCENT })
  page.text(PAGE_A4.width - MARGIN, y + 8, t('monthlyReport.pdfCreated', { date: formatDate(now, locale) }), { size: 8, color: MUTED, align: 'right' })
  y += 22
  page.text(MARGIN, y + 20, t('monthlyReport.modalTitle'), { size: 22, bold: true })
  y += 28
  page.text(MARGIN, y + 12, formatReportPeriod(report.periodStart, report.periodEnd, locale), { size: 12, color: MUTED })
  y += 24

  if (report.isExample) {
    const lines = wrapText(t('monthlyReport.pdfExample'), CONTENT_WIDTH - 20, 9)
    const height = lines.length * 12 + 12
    page.rect(MARGIN, y, CONTENT_WIDTH, height, { fill: [0.99, 0.97, 0.85], stroke: [0.85, 0.75, 0.3], lineWidth: 0.8 })
    lines.forEach((line, i) => page.text(MARGIN + 10, y + 15 + i * 12, line, { size: 9 }))
    y += height + 12
  }

  // Zahlen mit Vergleich zum Vormonat
  const totals = facts.totals || {}
  const previous = facts.previous || null
  const kg = (n) => `${formatNumber(n, locale)} kg`
  const compare = (current, before, format = (n) => String(n)) => {
    const cmp = compareWithPrevious(current, before)
    if (!cmp) return ''
    if (cmp.key === 'same') return t('monthlyReport.compareSame')
    return t(cmp.key === 'more' ? 'monthlyReport.compareMore' : 'monthlyReport.compareFewer', { n: format(cmp.diff) })
  }
  const tiles = [
    { label: t('monthlyReport.statSessions'), value: formatNumber(totals.sessions, locale), note: compare(totals.sessions, previous?.sessions) },
    { label: t('monthlyReport.statSets'), value: formatNumber(totals.sets, locale), note: compare(totals.sets, previous?.sets) },
    { label: t('monthlyReport.statVolume'), value: kg(totals.volumeKg), note: compare(totals.volumeKg, previous?.volumeKg, kg) },
    { label: t('monthlyReport.statBests'), value: formatNumber(totals.personalBests, locale), note: '' }
  ]
  const gap = 8
  const tileWidth = (CONTENT_WIDTH - gap * 3) / 4
  const tileHeight = 62
  ensure(tileHeight + 10)
  tiles.forEach((tile, i) => {
    const x = MARGIN + i * (tileWidth + gap)
    page.rect(x, y, tileWidth, tileHeight, { fill: TILE })
    page.text(x + 8, y + 15, tile.label, { size: 8, color: MUTED })
    page.text(x + 8, y + 33, tile.value, { size: 15, bold: true })
    wrapText(tile.note, tileWidth - 16, 7.5).slice(0, 2).forEach((line, n) => {
      if (line) page.text(x + 8, y + 45 + n * 9, line, { size: 7.5, color: MUTED })
    })
  })
  y += tileHeight + 14

  const conclusion = conclusionKey(facts.conclusion)
  if (conclusion) paragraph(t(`monthlyReport.conclusion_${conclusion}`), { size: 11, bold: true, gap: 6 })

  // Einheiten je Woche
  if (facts.weeks?.length) {
    heading(t('monthlyReport.weeksTitle'), 100)
    const barAreaHeight = 64
    ensure(barAreaHeight + 40)
    const max = Math.max(0, ...facts.weeks.map((w) => Number(w.sessions) || 0))
    const colGap = 14
    const colWidth = (CONTENT_WIDTH - colGap * (facts.weeks.length - 1)) / facts.weeks.length
    facts.weeks.forEach((week, i) => {
      const x = MARGIN + i * (colWidth + colGap)
      const sessions = Number(week.sessions) || 0
      page.rect(x, y + 12, colWidth, barAreaHeight, { fill: TILE })
      const barHeight = barAreaHeight * barPercent(sessions, max) / 100
      page.rect(x, y + 12 + barAreaHeight - barHeight, colWidth, barHeight, { fill: ACCENT })
      page.text(x + colWidth / 2, y + 8, String(sessions), { size: 9, bold: true, align: 'center' })
      page.text(x + colWidth / 2, y + 12 + barAreaHeight + 11, formatReportPeriod(week.start, week.start, locale).split(' – ')[0], { size: 8, color: MUTED, align: 'center' })
    })
    y += barAreaHeight + 30
    paragraph(t('monthlyReport.weeksHint'), { size: 8, color: MUTED })
  }

  // Gewicht je Übung: kleine Diagramme, zwei pro Zeile
  const curves = Array.isArray(facts.exercises) ? facts.exercises : []
  if (curves.length) {
    heading(t('monthlyReport.weightChartTitle'), 160)
    const colGap2 = 16
    const chartWidth = (CONTENT_WIDTH - colGap2) / 2
    const chartHeight = 112
    const blockHeight = chartHeight + 44
    for (let i = 0; i < curves.length; i += 2) {
      ensure(blockHeight)
      for (const [col, curve] of curves.slice(i, i + 2).entries()) {
        drawCurve(curve, MARGIN + col * (chartWidth + colGap2), y, chartWidth, chartHeight)
      }
      y += blockHeight
    }
    paragraph(t('monthlyReport.weightChartHint'), { size: 8, color: MUTED })
  }

  // Stillstand
  heading(t('monthlyReport.stagnationTitle'), 70)
  const stalled = (facts.stagnation?.items || []).map((item) => ({ item, keys: diagnosisTextKeys(item, locale) })).filter((e) => e.keys)
  if (!stalled.length) paragraph(t('monthlyReport.stagnationNone'), { size: 9, color: MUTED })
  for (const { item, keys } of stalled) {
    ensure(70)
    const name = translateName(item.name) || item.name
    page.text(MARGIN, y + 10, name, { size: 10, bold: true })
    if (keys.showWeeks) page.text(PAGE_A4.width - MARGIN, y + 10, t('coachDiagnosis.stalledFor', { weeks: item.weeks }), { size: 8.5, color: MUTED, align: 'right' })
    y += 16
    paragraph(`${t('coachDiagnosis.causeLabel')} ${t(keys.causeKey, keys.params)}`, { size: 9, gap: 2 })
    paragraph(`${t('coachDiagnosis.nextLabel')} ${t(keys.nextKey, keys.params)}`, { size: 9, gap: 8 })
  }

  y += 4
  paragraph(t('monthlyReport.basis'), { size: 8, color: MUTED })

  // Fußzeile auf jeder Seite (jetzt kennen wir die Seitenzahl)
  const total = pdf.pageCount()
  for (let n = 0; n < total; n += 1) {
    const footer = pdf.getPage(n)
    footer.line(MARGIN, FOOTER_Y - 10, PAGE_A4.width - MARGIN, FOOTER_Y - 10, { color: LINE, width: 0.6 })
    footer.text(MARGIN, FOOTER_Y, `PPL Fundamentals · ${t('monthlyReport.modalTitle')} ${formatReportPeriod(report.periodStart, report.periodEnd, locale)}`, { size: 7.5, color: MUTED })
    footer.text(PAGE_A4.width - MARGIN, FOOTER_Y, t('monthlyReport.pdfPage', { n: n + 1, total }), { size: 7.5, color: MUTED, align: 'right' })
  }
  return pdf.toBytes()

  // Ein kleines Liniendiagramm (Kurve einer Übung) in einer Zelle von (x, y) mit Breite width.
  function drawCurve(curve, x, yTop, width, plotHeight) {
    const isReps = curve.metric === 'reps'
    const name = translateName(curve.name) || curve.name
    page.text(x, yTop + 9, isReps ? `${name} (${t('monthlyReport.repsUnit')})` : name, { size: 9, bold: true })
    const top = yTop + 16
    const box = { width, height: plotHeight, left: 34, right: 6, top: 4, bottom: 16 }
    const chart = buildLineChart(curve.points, { periodStart: report.periodStart, periodEnd: report.periodEnd }, box)
    const numberFormat = new Intl.NumberFormat(String(locale).startsWith('de') ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 })
    for (const tick of chart.yTicks) {
      page.line(x + chart.bounds.left, top + tick.y, x + chart.bounds.right, top + tick.y, { color: LINE, width: 0.6, dash: [2, 2] })
      page.text(x + chart.bounds.left - 4, top + tick.y + 2.5, numberFormat.format(tick.value), { size: 7, color: MUTED, align: 'right' })
    }
    page.polyline(chart.dots.map((d) => [x + d.x, top + d.y]), { color: ACCENT, width: 1.8 })
    for (const dot of chart.dots) page.circle(x + dot.x, top + dot.y, 2.2, { fill: ACCENT })
    page.text(x + chart.bounds.left, top + plotHeight - 3, formatReportPeriod(report.periodStart, report.periodStart, locale).split(' – ')[0], { size: 7, color: MUTED })
    page.text(x + chart.bounds.right, top + plotHeight - 3, formatReportPeriod(report.periodEnd, report.periodEnd, locale).split(' – ')[0], { size: 7, color: MUTED, align: 'right' })

    const summary = summarizeCurve(curve.points)
    if (summary) {
      const unit = isReps ? t('monthlyReport.repsUnit') : 'kg'
      const withUnit = (value) => `${numberFormat.format(value)} ${unit}`
      const text = summary.diff === 0
        ? t('monthlyReport.chartUnchanged', { to: withUnit(summary.to) })
        : t('monthlyReport.chartChange', { from: withUnit(summary.from), to: withUnit(summary.to), diff: `${summary.diff > 0 ? '+' : '-'}${numberFormat.format(Math.abs(summary.diff))}` })
      page.text(x, top + plotHeight + 10, text, { size: 8, bold: true })
    }
  }
}

function formatDate(date, locale) {
  return new Intl.DateTimeFormat(String(locale).startsWith('de') ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
