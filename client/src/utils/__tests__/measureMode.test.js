import { describe, it, expect } from 'vitest'
import { sanitizeMeasureMode, showsReps, showsWeight, showsTime, formatDuration, measureModeField, blankSetForMode, buildAddedExercise } from '../measureMode.js'

describe('Messart', () => {
  it('unbekannt/fehlend = weight; Felder je Messart', () => {
    expect(sanitizeMeasureMode(undefined)).toBe('weight')
    expect(sanitizeMeasureMode('x')).toBe('weight')
    expect([showsReps('weight'), showsWeight('weight'), showsTime('weight')]).toEqual([true, true, false])
    expect([showsReps('time'), showsWeight('time'), showsTime('time')]).toEqual([false, false, true])
    expect([showsReps('repsTime'), showsWeight('repsTime'), showsTime('repsTime')]).toEqual([true, false, true])
  })
  it('Dauer als Sekunden bzw. m:ss', () => {
    expect(formatDuration(45)).toBe('45')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(600)).toBe('10:00')
    expect(formatDuration(null)).toBe('0')
  })
  it('nur abweichende Messart wird gespeichert', () => {
    expect(measureModeField('weight')).toEqual({})
    expect(measureModeField(undefined)).toEqual({})
    expect(measureModeField('time')).toEqual({ measureMode: 'time' })
  })
})

// Fund Jimmy 17.11.: eigene Übung mit Messart "Zeit" zeigte nach dem Hinzufügen zum Workout wieder Gewicht.
describe('Übung zum Workout hinzufügen', () => {
  const custom = (measureMode) => ({ _id: 'c1', name: 'Plank hold', muscleGroup: 'Core', measureMode })
  const add = (entry) => buildAddedExercise(entry, { exerciseId: 'c1', name: 'Plank hold' })

  it('Zeit: Messart wird übernommen, erster Satz ohne Gewicht und ohne erfundene Wiederholungen', () => {
    const ex = add(custom('time'))
    expect(ex.measureMode).toBe('time')
    expect(ex.setDetails).toEqual([{ reps: null, weight: null, durationSeconds: null }])
  })
  it('Wiederholungen in Zeit: Messart wird übernommen', () => {
    expect(add(custom('repsTime')).measureMode).toBe('repsTime')
  })
  it('Gegenprobe: Standardübung (ohne oder mit "weight") bleibt wie bisher, ohne Feld measureMode', () => {
    for (const entry of [custom(undefined), custom('weight'), custom('quatsch')]) {
      const ex = add(entry)
      expect('measureMode' in ex).toBe(false)
      expect(ex.setDetails).toEqual([{ reps: 10, weight: 0 }])
    }
  })
  it('blankSetForMode: Gewicht-Standard bleibt 10 x 0 kg', () => {
    expect(blankSetForMode('weight')).toEqual({ reps: 10, weight: 0 })
  })
})
