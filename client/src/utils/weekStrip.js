// Wochenstreifen im Dashboard (Absprache Paul 29.10.): die Tage der aktuellen Woche (Montag bis Sonntag) mit Haken für
// Tage, an denen trainiert wurde. Reine Funktionen, damit sie ohne Oberfläche testbar sind.

const pad = (n) => String(n).padStart(2, '0')

/** Lokales Datum als 'JJJJ-MM-TT' (nicht UTC: ein Training um 23 Uhr zählt für diesen Tag). */
export function localDayKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Montag 00:00 der Woche, in der `now` liegt (lokale Zeit). */
export function startOfWeek(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

/** Entwürfe zählen nicht; alles andere mit gültigem Datum ist ein Trainingstag. */
function trainedDayKeys(workouts) {
  const keys = new Set()
  for (const w of workouts || []) {
    if (!w || w.isDraft || w._isDraft) continue
    const key = localDayKey(w.date || w.updatedAt || 0)
    if (key && (w.date || w.updatedAt)) keys.add(key)
  }
  return keys
}

/**
 * @returns {Array<{ key: string, label: string, done: boolean, isToday: boolean }>} sieben Tage, Montag zuerst
 */
export function buildWeekDays({ workouts = [], now = new Date(), locale = 'de' } = {}) {
  const start = startOfWeek(now)
  const todayKey = localDayKey(now)
  const trained = trainedDayKeys(workouts)
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = localDayKey(day)
    return { key, label: formatter.format(day).replace('.', ''), done: trained.has(key), isToday: key === todayKey }
  })
}

/** Anzahl Trainingstage in dieser Woche (für „x von y Einheiten diese Woche“). */
export function countWeekWorkouts({ workouts = [], now = new Date() } = {}) {
  const start = startOfWeek(now).getTime()
  const end = start + 7 * 24 * 60 * 60 * 1000
  return (workouts || []).filter((w) => {
    if (!w || w.isDraft || w._isDraft) return false
    const time = new Date(w.date || w.updatedAt || 0).getTime()
    return time >= start && time < end
  }).length
}
