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

import { buildSwappedExercise, originalExerciseName } from '../exerciseSwapApply.js'
import { formatWeight } from '../monthlyReportView.js'

describe('Zweiter Tausch behält die ursprüngliche Übung', () => {
  const entry = { _id: 'ex_1', name: 'Cable Fly', muscleGroup: 'Brust' }
  it('erster Tausch: aktuelle Übung', () => {
    expect(buildSwappedExercise({ name: 'Bench Press' }, entry).replacedFrom).toBe('Bench Press')
  })
  it('zweiter Tausch ("nur heute"): bleibt bei der ersten Übung', () => {
    expect(buildSwappedExercise({ name: 'Incline Press', replacedFrom: 'Bench Press', replacedScope: 'today' }, entry).replacedFrom).toBe('Bench Press')
  })
  it('war der erste Tausch im Plan gespeichert, ist die Zwischenübung die geplante', () => {
    expect(originalExerciseName({ name: 'Incline Press', replacedFrom: 'Bench Press', replacedScope: 'plan' })).toBe('Incline Press')
  })
})

describe('Gewicht im Bericht', () => {
  it('82,5 kg und 1,25-kg-Schritte bleiben erhalten', () => {
    expect(formatWeight(82.5, 'de')).toBe('82,5')
    expect(formatWeight(82.5, 'en')).toBe('82.5')
    expect(formatWeight(81.25, 'de')).toBe('81,25')
    expect(formatWeight(80, 'de')).toBe('80')
  })
})
