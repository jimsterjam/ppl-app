// Trainings-Erinnerung (Absprache Paul 11.11.2026): eine lokale iOS-Mitteilung, wenn die Pause länger wird als geplant
// oder das Wochenziel knapp wird. Reine Funktionen ohne Oberfläche und ohne Capacitor, damit alles testbar ist.
// Planen/Löschen der Mitteilung: utils/trainingReminder.js.
import { localDayKey, startOfWeek, countWeekWorkouts } from './weekStrip'

export const DEFAULT_REMINDER_TIME = '12:30'
/** Vorgaben in den Einstellungen; daneben eine beliebige „Eigene“ Uhrzeit (auch nachts, z. B. Nachtschicht – Paul 11.11.). */
export const REMINDER_TIME_PRESETS = Object.freeze([
  Object.freeze({ key: 'morning', time: '08:00' }),
  Object.freeze({ key: 'midday', time: '12:30' }),
  Object.freeze({ key: 'afternoon', time: '16:00' })
])
/** Pause ohne bekannten Rhythmus (kein Ziel, kein Plan, zu wenig Verlauf). */
export const FALLBACK_GAP_DAYS = 5
/** Trainings pro Woche in der Frage nach dem ersten Training (− / +), wie das Wochenziel in den Einstellungen. */
export const REMINDER_GOAL_MIN = 1
export const REMINDER_GOAL_MAX = 14
/** Minuten im Fenster „Eigene Uhrzeit“. */
export const REMINDER_MINUTE_STEP = 5

const DAY_MS = 24 * 60 * 60 * 1000
/** 'H:MM' oder 'HH:MM' (00:00–23:59) → 'HH:MM'; sonst die Standardzeit. */
export function sanitizeReminderTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return DEFAULT_REMINDER_TIME
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return DEFAULT_REMINDER_TIME
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

/** Lokaler Tag (00:00) plus `days` Tage. */
function addDays(day, days) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days)
}

function dayStart(value) {
  const d = value instanceof Date ? value : new Date(value)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Ganze Kalendertage zwischen zwei lokalen Tagen (Sommerzeit-fest durch Runden). */
function daysBetween(from, to) {
  return Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / DAY_MS)
}

function atTime(day, hhmm) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)))
}

/** Letzter Trainingstag bis einschließlich heute (gleiche Zählweise wie der Wochenstreifen: Entwürfe zählen nicht). */
export function lastTrainingDay(workouts, now = new Date()) {
  const todayKey = localDayKey(now)
  let last = null
  for (const w of workouts || []) {
    if (!w || w.isDraft || w._isDraft) continue
    const raw = w.date || w.updatedAt
    if (!raw) continue
    const day = dayStart(raw)
    if (Number.isNaN(day.getTime()) || localDayKey(day) > todayKey) continue
    if (!last || day > last) last = day
  }
  return last
}

/**
 * Wie oft pro Woche trainiert werden soll. Reihenfolge (Absprache Paul 11.11.): selbst gesetztes Wochenziel, sonst die
 * Tage des aktiven Plans (ein Durchgang pro Woche, höchstens 6), sonst der eigene Rhythmus der letzten 4 vollen Wochen
 * (nur mit mindestens 2 Trainingswochen), sonst null (dann gilt nur die Pause von FALLBACK_GAP_DAYS Tagen).
 * @returns {{ perWeek: number, source: 'goal'|'plan'|'history' } | null}
 */
export function resolveWeeklyRhythm({ explicitGoal = null, planDays = 0, workouts = [], now = new Date() } = {}) {
  const goal = Number.parseInt(explicitGoal, 10)
  if (Number.isFinite(goal) && goal > 0) return { perWeek: Math.min(goal, 14), source: 'goal' }
  const days = Number.parseInt(planDays, 10)
  if (Number.isFinite(days) && days > 0) return { perWeek: Math.min(days, 6), source: 'plan' }
  const weekStart = startOfWeek(now)
  let total = 0
  let weeksWithTraining = 0
  for (let i = 1; i <= 4; i += 1) {
    const count = countWeekWorkouts({ workouts, now: addDays(weekStart, -7 * i) })
    total += count
    if (count > 0) weeksWithTraining += 1
  }
  if (weeksWithTraining < 2) return null
  return { perWeek: Math.min(7, Math.max(1, Math.round(total / 4))), source: 'history' }
}

/** Tage ohne Training, ab denen erinnert wird: 7 ÷ Ziel (aufgerundet) + 1, mindestens 3, höchstens 7. */
export function gapThresholdDays(perWeek) {
  const n = Number(perWeek)
  if (!Number.isFinite(n) || n <= 0) return FALLBACK_GAP_DAYS
  return Math.min(7, Math.max(3, Math.ceil(7 / n) + 1))
}

/**
 * Nächste Erinnerung oder null. Höchstens eine pro Pause: `pauseKey` ist der letzte Trainingstag; wurde für diese
 * Pause schon eine Mitteilung zugestellt (`delivered`), kommt keine weitere. Liegt der Zeitpunkt in der Vergangenheit,
 * wird nichts nachgeholt.
 * @param {object} p
 * @param {Array} p.workouts
 * @param {Date} [p.now]
 * @param {number|null} [p.perWeek] aus resolveWeeklyRhythm, null = unbekannt
 * @param {string} [p.time] 'HH:MM'
 * @param {{ pauseKey: string, at: number }|null} [p.previous] zuletzt geplante Erinnerung
 * @returns {{ at: Date, kind: 'gap'|'goal', pauseKey: string, daysSince: number, remaining: number } | null}
 */
export function planNextReminder({ workouts = [], now = new Date(), perWeek = null, time = DEFAULT_REMINDER_TIME, previous = null } = {}) {
  const last = lastTrainingDay(workouts, now)
  if (!last) return null
  const pauseKey = localDayKey(last)
  if (previous && previous.pauseKey === pauseKey && Number(previous.at) <= now.getTime()) return null
  const hhmm = sanitizeReminderTime(time)
  const today = dayStart(now)
  const trainedToday = daysBetween(last, today) === 0
  const candidates = []

  const gapDay = addDays(last, gapThresholdDays(perWeek))
  candidates.push({ day: gapDay, kind: 'gap', remaining: 0 })

  if (perWeek) {
    const weekStart = startOfWeek(now)
    const sunday = addDays(weekStart, 6)
    const remaining = perWeek - countWeekWorkouts({ workouts, now })
    if (remaining > 0) {
      // Erinnern, wenn die Tage bis Sonntag gerade noch mit einem Tag Luft reichen (Ziel 3, ein Training: Freitag).
      let day = addDays(sunday, -remaining)
      if (day < weekStart) day = weekStart
      const earliest = trainedToday ? addDays(today, 1) : today
      if (day < earliest) day = earliest
      const daysLeft = daysBetween(day, sunday) + 1
      if (daysLeft >= remaining) candidates.push({ day, kind: 'goal', remaining })
    }
  }

  const upcoming = candidates
    .map((c) => ({ ...c, at: atTime(c.day, hhmm) }))
    .filter((c) => c.at.getTime() > now.getTime())
    .sort((a, b) => a.at - b.at)
  const next = upcoming[0]
  if (!next) return null
  return { at: next.at, kind: next.kind, pauseKey, daysSince: daysBetween(last, next.day), remaining: next.remaining }
}
