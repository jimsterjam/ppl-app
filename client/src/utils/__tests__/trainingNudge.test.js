import { describe, it, expect } from 'vitest'
import {
  sanitizeReminderTime,
  resolveWeeklyRhythm,
  gapThresholdDays,
  planNextReminder,
  lastTrainingDay,
  DEFAULT_REMINDER_TIME,
  FALLBACK_GAP_DAYS
} from '../trainingNudge'

// Woche ab Montag, 9. November 2026 (lokale Zeit)
const at = (day, h = 12, m = 0) => new Date(2026, 10, day, h, m)
const workout = (day, extra = {}) => ({ date: at(day, 18).toISOString(), completed: true, ...extra })

describe('sanitizeReminderTime', () => {
  it('nimmt gültige Zeiten im Bereich 6:00 bis 21:00', () => {
    expect(sanitizeReminderTime('12:30')).toBe('12:30')
    expect(sanitizeReminderTime('8:00')).toBe('08:00')
    expect(sanitizeReminderTime('21:00')).toBe('21:00')
  })
  it('klemmt außerhalb des Bereichs und fällt bei Unsinn auf die Standardzeit zurück', () => {
    expect(sanitizeReminderTime('05:10')).toBe('06:00')
    expect(sanitizeReminderTime('23:45')).toBe('21:00')
    expect(sanitizeReminderTime('25:00')).toBe(DEFAULT_REMINDER_TIME)
    expect(sanitizeReminderTime('abc')).toBe(DEFAULT_REMINDER_TIME)
    expect(sanitizeReminderTime(null)).toBe(DEFAULT_REMINDER_TIME)
  })
})

describe('gapThresholdDays', () => {
  it('2× → 5, 3× → 4, ab 4× → 3 Tage, ohne Rhythmus 5', () => {
    expect(gapThresholdDays(2)).toBe(5)
    expect(gapThresholdDays(3)).toBe(4)
    expect(gapThresholdDays(4)).toBe(3)
    expect(gapThresholdDays(6)).toBe(3)
    expect(gapThresholdDays(1)).toBe(7)
    expect(gapThresholdDays(null)).toBe(FALLBACK_GAP_DAYS)
  })
})

describe('resolveWeeklyRhythm', () => {
  it('selbst gesetztes Ziel vor Plan vor Verlauf', () => {
    expect(resolveWeeklyRhythm({ explicitGoal: 3, planDays: 6 })).toEqual({ perWeek: 3, source: 'goal' })
    expect(resolveWeeklyRhythm({ planDays: 4 })).toEqual({ perWeek: 4, source: 'plan' })
    expect(resolveWeeklyRhythm({ planDays: 9 })).toEqual({ perWeek: 6, source: 'plan' })
  })
  it('Verlauf: Durchschnitt der letzten 4 vollen Wochen, erst ab 2 Trainingswochen', () => {
    const now = at(11)
    // Vorwochen ab 2.11., 26.10., 19.10., 12.10.
    const two = [new Date(2026, 10, 3), new Date(2026, 10, 5), new Date(2026, 9, 27), new Date(2026, 9, 29)]
      .map((d) => ({ date: d.toISOString() }))
    expect(resolveWeeklyRhythm({ workouts: two, now })).toEqual({ perWeek: 1, source: 'history' })
    const one = [{ date: new Date(2026, 10, 3).toISOString() }]
    expect(resolveWeeklyRhythm({ workouts: one, now })).toBeNull()
  })
})

describe('lastTrainingDay', () => {
  it('ignoriert Entwürfe und Tage in der Zukunft', () => {
    const last = lastTrainingDay([workout(9), workout(10, { _isDraft: true }), workout(20)], at(11))
    expect(last.getDate()).toBe(9)
  })
})

describe('planNextReminder', () => {
  it('ohne Training keine Erinnerung', () => {
    expect(planNextReminder({ workouts: [], now: at(9), perWeek: 3 })).toBeNull()
  })

  it('Mockup-Fall: Ziel 3, Training Montag, sonst nichts → Freitag 12:30 (4 Tage Pause, Ziel noch erreichbar)', () => {
    const r = planNextReminder({ workouts: [workout(9)], now: at(9, 19), perWeek: 3, time: '12:30' })
    // Wochenziel: noch 2 offen → Erinnerung, wenn 3 Tage übrig sind = Freitag; Pause: Montag + 4 = Freitag
    expect(r.at).toEqual(at(13, 12, 30))
    expect(r.daysSince).toBe(4)
    expect(r.pauseKey).toBe('2026-11-09')
  })

  it('Pause länger als üblich ohne Rhythmus: nach 5 Tagen', () => {
    const r = planNextReminder({ workouts: [workout(9)], now: at(9, 19), perWeek: null, time: '08:00' })
    expect(r.kind).toBe('gap')
    expect(r.at).toEqual(at(14, 8, 0))
    expect(r.daysSince).toBe(5)
  })

  it('Ziel 3 mit Training Mo/Mi/Fr: in dieser Woche keine Ziel-Erinnerung, die Pause übers Wochenende bleibt unter der Schwelle', () => {
    const workouts = [workout(9), workout(11), workout(13)]
    const r = planNextReminder({ workouts, now: at(13, 19), perWeek: 3 })
    // nächste Erinnerung frühestens Dienstag der Folgewoche (Freitag + 4), nicht am Wochenende
    expect(r.kind).toBe('gap')
    expect(r.at).toEqual(at(17, 12, 30))
  })

  it('Ziel knapp: Ziel 3, ein Training Dienstag → Freitag (Ziel-Fall vor Pause-Fall)', () => {
    const r = planNextReminder({ workouts: [workout(10)], now: at(11, 9), perWeek: 3 })
    expect(r.kind).toBe('goal')
    expect(r.remaining).toBe(2)
    expect(r.at).toEqual(at(13, 12, 30))
  })

  it('Ziel nicht mehr erreichbar: keine Ziel-Erinnerung (und die Pause-Erinnerung wäre schon vorbei)', () => {
    // Ziel 5, ein Training Montag, heute Samstag: 4 offen, nur 2 Tage übrig; Pause-Schwelle 3 Tage = Donnerstag
    expect(planNextReminder({ workouts: [workout(9)], now: at(14, 9), perWeek: 5 })).toBeNull()
  })

  it('nie nachträglich: Zeitpunkt heute schon vorbei → nichts für heute', () => {
    // Freitag 12:30 (Pause und Ziel) ist vorbei, die App wurde erst um 15 Uhr geöffnet
    expect(planNextReminder({ workouts: [workout(9)], now: at(13, 15), perWeek: 3, time: '12:30' })).toBeNull()
  })

  it('höchstens eine pro Pause: schon zugestellt → keine weitere', () => {
    const previous = { pauseKey: '2026-11-09', at: at(13, 12, 30).getTime() }
    expect(planNextReminder({ workouts: [workout(9)], now: at(14, 9), perWeek: 3, previous })).toBeNull()
  })

  it('neue Pause nach einem Training: wieder eine Erinnerung', () => {
    const previous = { pauseKey: '2026-11-09', at: at(13, 12, 30).getTime() }
    const r = planNextReminder({ workouts: [workout(9), workout(14)], now: at(14, 19), perWeek: 3, previous })
    expect(r.pauseKey).toBe('2026-11-14')
  })

  it('heute trainiert: keine Erinnerung mehr für heute', () => {
    const r = planNextReminder({ workouts: [workout(13)], now: at(13, 9), perWeek: 3, time: '12:30' })
    expect(r.at.getDate()).not.toBe(13)
  })

  it('Uhrzeit wird übernommen', () => {
    const r = planNextReminder({ workouts: [workout(9)], now: at(9, 19), perWeek: 3, time: '16:00' })
    expect(r.at).toEqual(at(13, 16, 0))
  })
})
