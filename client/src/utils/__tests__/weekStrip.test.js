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
