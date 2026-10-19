import { describe, it, expect } from 'vitest'
import { findPendingWarmup } from '../focusWarmup.js'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'

const ex = (rows) => ({ setDetails: rows })
const W = (extra = {}) => ({ isWarmup: true, reps: 10, weight: 20, ...extra })
const S = (extra = {}) => ({ reps: 8, weight: 60, ...extra })

describe('findPendingWarmup (Aufwärmsätze in der Großansicht)', () => {
  it('liefert den ersten Aufwärmsatz mit Nummer und Anzahl', () => {
    expect(findPendingWarmup({ exercise: ex([W(), W(), S(), S()]), exIndex: 2 }))
      .toEqual({ exIndex: 2, rowIndex: 0, number: 1, total: 2 })
  })

  it('erledigte/übersprungene Sätze (warmupHandled im Entwurf) werden übergangen, danach null', () => {
    expect(findPendingWarmup({ exercise: ex([W({ warmupHandled: true }), W(), S()]), exIndex: 0 }))
      .toEqual({ exIndex: 0, rowIndex: 1, number: 2, total: 2 })
    expect(findPendingWarmup({ exercise: ex([W({ warmupHandled: true }), W({ warmupHandled: true }), S()]), exIndex: 0 })).toBeNull()
  })

  it('ohne Aufwärmsätze, bei Zeitübungen oder nach dem ersten Arbeitssatz: nichts', () => {
    expect(findPendingWarmup({ exercise: ex([S(), S()]), exIndex: 0 })).toBeNull()
    expect(findPendingWarmup({ exercise: ex([W(), S()]), exIndex: 0, weightMode: false })).toBeNull()
    expect(findPendingWarmup({ exercise: ex([W(), S({ done: true }), S()]), exIndex: 0 })).toBeNull()
  })

  it('Beim finalen Speichern wird warmupHandled entfernt', () => {
    const workout = { name: 'Push', type: 'push', date: '2026-10-19', exercises: [{ name: 'Bench', setDetails: [W({ warmupHandled: true }), S({ done: true })] }] }
    const saved = normalizeWorkoutForSave({ workout, sessionStopwatchStore: { elapsedMs: 0 }, trackingActive: true })
    expect(saved.exercises[0].setDetails.some((row) => 'warmupHandled' in row)).toBe(false)
    expect(saved.exercises[0].setDetails[0].isWarmup).toBe(true)
  })
})
