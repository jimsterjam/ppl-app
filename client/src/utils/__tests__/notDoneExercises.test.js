import { describe, it, expect } from 'vitest'
import { isExerciseNotDone, getNotDoneExercises } from '../notDoneExercises.js'

describe('nicht gemachte Übungen', () => {
  it('nur wenn alle Arbeitssätze done:false sind', () => {
    expect(isExerciseNotDone({ setDetails: [{ done: false }, { done: false }] })).toBe(true)
    expect(isExerciseNotDone({ setDetails: [{ isWarmup: true }, { done: false }] })).toBe(true)
    expect(isExerciseNotDone({ setDetails: [{ done: false }, { done: true }] })).toBe(false)
    expect(isExerciseNotDone({ setDetails: [{ reps: 5 }] })).toBe(false) // ältere Daten
    expect(isExerciseNotDone({ setDetails: [] })).toBe(false)
    expect(isExerciseNotDone(null)).toBe(false)
  })

  it('liefert Name und Notiz', () => {
    const workout = { exercises: [
      { name: 'Bench Press', setDetails: [{ done: true }] },
      { name: 'Dips', note: '  Schulter tat weh ', setDetails: [{ done: false }] },
      { name: 'Row', setDetails: [{ done: false }] }
    ] }
    expect(getNotDoneExercises(workout)).toEqual([{ name: 'Dips', note: 'Schulter tat weh' }, { name: 'Row', note: '' }])
    expect(getNotDoneExercises(undefined)).toEqual([])
  })
})
