import { describe, it, expect } from 'vitest'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'

// Übungswechsel (Monatsbericht V1): ursprüngliche Übung und Geltungsbereich werden mit dem Workout gespeichert.
describe('Speichern übernimmt den Übungswechsel', () => {
  const stopwatch = { elapsedMs: 0, startedAt: null }
  const save = (exercise) => normalizeWorkoutForSave({
    workout: { name: 'Push', type: 'push', date: '2026-11-01', exercises: [{ name: 'Incline Press', setDetails: [{ reps: 8, weight: 40 }], ...exercise }] },
    sessionStopwatchStore: stopwatch
  }).exercises[0]

  it('nur heute / im Plan bleiben erhalten', () => {
    expect(save({ replacedFrom: 'Bench Press', replacedScope: 'today' })).toMatchObject({ replacedFrom: 'Bench Press', replacedScope: 'today' })
    expect(save({ replacedFrom: 'Bench Press', replacedScope: 'plan' })).toMatchObject({ replacedScope: 'plan' })
  })

  it('unbekannter Bereich wird nicht gespeichert, Name bleibt', () => {
    const saved = save({ replacedFrom: 'Bench Press', replacedScope: 'evil' })
    expect(saved.replacedFrom).toBe('Bench Press')
    expect('replacedScope' in saved).toBe(false)
  })

  it('ohne Wechsel keine zusätzlichen Felder', () => {
    const saved = save({})
    expect('replacedFrom' in saved).toBe(false)
    expect('replacedScope' in saved).toBe(false)
  })
})
