import { describe, it, expect } from 'vitest'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'

// Das Warm-up (drei Haken) wird mit dem Workout gespeichert und später im Monatsbericht ausgewertet.
describe('Speichern übernimmt das Warm-up', () => {
  const base = { name: 'Push Day', type: 'push', date: '2026-10-11', exercises: [] }
  const stopwatch = { elapsedMs: 0, startedAt: null }
  const save = (workout) => normalizeWorkoutForSave({ workout, sessionStopwatchStore: stopwatch })

  it('abgehakte und nicht abgehakte Schritte bleiben erhalten', () => {
    expect(save({ ...base, warmup: { cardio: true, joints: false, specific: true } }).warmup)
      .toEqual({ cardio: true, joints: false, specific: true })
  })

  it('Karte gezeigt, nichts abgehakt = übersprungen (alles false, nicht null)', () => {
    expect(save({ ...base, warmup: { cardio: false, joints: false, specific: false } }).warmup)
      .toEqual({ cardio: false, joints: false, specific: false })
  })

  it('Workout ohne Karte (ältere Daten): null', () => {
    expect(save(base).warmup).toBeNull()
    expect(save({ ...base, warmup: 'kaputt' }).warmup).toBeNull()
  })

  it('nur die drei Haken, nie Fremdfelder', () => {
    const saved = save({ ...base, warmup: { cardio: true, note: 'x', evil: { a: 1 } } }).warmup
    expect(Object.keys(saved).sort()).toEqual(['cardio', 'joints', 'specific'])
  })
})
