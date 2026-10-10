// Anzeige-Helfer für den Monatsbericht (Server: server/utils/monthlyReport.js). Ohne Vue-Imports,
// damit direkt testbar. Alle Zahlen kommen fertig vom Server; hier wird nur formatiert.

function localeTag(locale) {
  return String(locale || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
}

/** "12. Sep. – 9. Okt." bzw. "Sep 12 – Oct 9" */
export function formatReportPeriod(startIso, endIso, locale = 'de') {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const fmt = new Intl.DateTimeFormat(localeTag(locale), { day: 'numeric', month: 'short' })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

export function formatNumber(value, locale = 'de') {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 0 }).format(Number(value) || 0)
}

/**
 * Vergleich mit dem Vormonat für eine Kennzahl.
 * @returns {null | { key: 'more'|'fewer'|'same', diff: number }} null = kein Vormonat vorhanden
 */
export function compareWithPrevious(current, previous) {
  if (!previous || !Number.isFinite(Number(previous))) return null
  const diff = Number(current) - Number(previous)
  if (diff > 0) return { key: 'more', diff }
  if (diff < 0) return { key: 'fewer', diff: Math.abs(diff) }
  return { key: 'same', diff: 0 }
}

/** Fazit-Schlüssel vom Server prüfen (nur feste Werte; sonst keine Zeile). */
export function conclusionKey(value) {
  return ['more', 'same', 'fewer', 'first'].includes(value) ? value : null
}

/** Bericht in der Liste "neu"? (nie geöffnet) */
export function isUnseen(report) {
  return !!report && !report.seenAt
}
