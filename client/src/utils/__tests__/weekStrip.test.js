import { describe, it, expect } from 'vitest'
import { buildWeekDays, countWeekWorkouts, startOfWeek, localDayKey } from '../weekStrip.js'

// Mittwoch, 29.10.2025 (Woche: Mo 27.10. bis So 02.11.)
const now = new Date(2025, 9, 29, 12, 0, 0)
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString()

describe('Wochenstreifen', () => {
  it('Woche beginnt am Montag, auch wenn heute Sonntag ist', () => {
    expect(localDayKey(startOfWeek(now))).toBe('2025-10-27')
    expect(localDayKey(startOfWeek(new Date(2025, 10, 2, 9)))).toBe('2025-10-27')
    expect(localDayKey(startOfWeek(new Date(2025, 9, 27, 0, 1)))).toBe('2025-10-27')
  })

  it('sieben Tage, Montag zuerst, heute markiert, Wochentage in der App-Sprache', () => {
    const days = buildWeekDays({ workouts: [], now, locale: 'de' })
    expect(days.map((d) => d.key)).toEqual(['2025-10-27', '2025-10-28', '2025-10-29', '2025-10-30', '2025-10-31', '2025-11-01', '2025-11-02'])
    expect(days.filter((d) => d.isToday).map((d) => d.key)).toEqual(['2025-10-29'])
    expect(days[0].label).toBe('Mo')
    expect(buildWeekDays({ workouts: [], now, locale: 'en' })[0].label).toBe('Mon')
  })

  it('Trainingstage bekommen einen Haken, Entwürfe und andere Wochen nicht', () => {
    const workouts = [
      { date: at(2025, 10, 27) },
      { date: at(2025, 10, 29, 23) },
      { date: at(2025, 10, 28), isDraft: true },
      { date: at(2025, 10, 28), _isDraft: true },
      { date: at(2025, 10, 20) },
      { date: at(2025, 11, 3) }
    ]
    const done = buildWeekDays({ workouts, now }).filter((d) => d.done).map((d) => d.key)
    expect(done).toEqual(['2025-10-27', '2025-10-29'])
  })

  it('ungültige oder fehlende Daten werden ignoriert', () => {
    const days = buildWeekDays({ workouts: [null, {}, { date: 'kaputt' }], now })
    expect(days.some((d) => d.done)).toBe(false)
  })

  it('countWeekWorkouts zählt nur diese Woche ohne Entwürfe', () => {
    const workouts = [{ date: at(2025, 10, 27) }, { date: at(2025, 10, 29) }, { date: at(2025, 10, 29), isDraft: true }, { date: at(2025, 10, 26) }, { date: at(2025, 11, 3) }]
    expect(countWeekWorkouts({ workouts, now })).toBe(2)
    expect(countWeekWorkouts({ workouts: [], now })).toBe(0)
  })
})

import { countWeekStreak } from '../weekStrip.js'

describe('Wochenserie', () => {
  // Heute Mi 29.10.2025; Wochen: 27.10. (laufend), 20.10., 13.10., 06.10.
  const week = (mondayDay, count, month = 10) => Array.from({ length: count }, (_, i) => ({ date: at(2025, month, mondayDay + (i % 7)) }))

  it('keine Workouts: keine Serie', () => {
    expect(countWeekStreak({ workouts: [], goal: 3, now })).toBe(0)
  })

  it('zählt aufeinanderfolgende Wochen mit erreichtem Ziel; laufende Woche zählt erst, wenn das Ziel erreicht ist', () => {
    const past = [...week(20, 3), ...week(13, 3), ...week(6, 3)]
    expect(countWeekStreak({ workouts: past, goal: 3, now })).toBe(3)
    expect(countWeekStreak({ workouts: [...past, ...week(27, 2)], goal: 3, now })).toBe(3)
    expect(countWeekStreak({ workouts: [...past, ...week(27, 3)], goal: 3, now })).toBe(4)
  })

  it('eine verpasste Woche beendet die Serie', () => {
    const workouts = [...week(20, 3), ...week(6, 3)]
    expect(countWeekStreak({ workouts, goal: 3, now })).toBe(1)
  })

  it('letzte Woche verfehlt (Ziel nicht erreicht): keine Serie, auch wenn die Woche davor gut war', () => {
    expect(countWeekStreak({ workouts: [...week(20, 2), ...week(13, 4)], goal: 3, now })).toBe(0)
  })

  it('Entwürfe und ungültige Daten zählen nicht; Ziel wird auf mindestens 1 gesetzt', () => {
    const workouts = [{ date: at(2025, 10, 20), isDraft: true }, { date: 'kaputt' }, null, { date: at(2025, 10, 21) }]
    expect(countWeekStreak({ workouts, goal: 1, now })).toBe(1)
    expect(countWeekStreak({ workouts, goal: 0, now })).toBe(1)
    expect(countWeekStreak({ workouts, goal: 2, now })).toBe(0)
  })

  it('Jahreswechsel: Woche vom 29.12. bis 04.01. zählt als eine Woche', () => {
    const jan = new Date(2026, 0, 6, 12)
    const workouts = [{ date: at(2025, 12, 29) }, { date: at(2026, 1, 2) }, { date: at(2026, 1, 5) }]
    expect(countWeekStreak({ workouts, goal: 2, now: jan })).toBe(1)
    expect(countWeekStreak({ workouts: [...workouts, { date: at(2026, 1, 6) }], goal: 2, now: jan })).toBe(2)
  })
})
