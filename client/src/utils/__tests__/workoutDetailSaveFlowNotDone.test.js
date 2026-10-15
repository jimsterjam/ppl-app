import { describe, it, expect } from 'vitest'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'

const workout = () => ({
  name: 'Push Day',
  type: 'push',
  exercises: [
    { name: 'Bench Press', setDetails: [{ reps: 5, weight: 60, isWarmup: true }, { reps: 5, weight: 100, done: true }, { reps: 5, weight: 100 }] },
    { name: 'Dips', setDetails: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }] }
  ]
})

// Absprache Paul 13.10.: Nichts wird entfernt - gespeichert wird exakt Gemachtes und Nicht-Gemachtes.
describe('Speichern: gemacht / nicht gemacht', () => {
  it('laufendes Workout: alle Sätze bleiben, nicht abgehakte Arbeitssätze sind ausdrücklich done:false', () => {
    const result = normalizeWorkoutForSave({ workout: workout(), exerciseNotes: ['', 'Schulter tat weh'], trackingActive: true })
    expect(result.exercises[0].setDetails).toEqual([
      { reps: 5, weight: 60, isWarmup: true },
      { reps: 5, weight: 100, done: true },
      { reps: 5, weight: 100, done: false }
    ])
    // Ganze Übung nicht gemacht: bleibt mit allen Sätzen und ihrer Notiz erhalten
    expect(result.exercises[1].setDetails).toEqual([{ reps: 10, weight: 0, done: false }, { reps: 10, weight: 0, done: false }])
    expect(result.exercises[1].note).toBe('Schulter tat weh')
    expect(result.exercises).toHaveLength(2)
  })

  it('ohne laufendes Workout (z. B. nachträgliche Bearbeitung): Sätze unverändert', () => {
    const result = normalizeWorkoutForSave({ workout: workout(), exerciseNotes: [] })
    expect(result.exercises[0].setDetails[2]).toEqual({ reps: 5, weight: 100 })
  })
})

describe('Messart wird mitgespeichert', () => {
  it('Zeit-Übung behält measureMode und durationSeconds, normale Übung bekommt kein Feld', () => {
    const result = normalizeWorkoutForSave({
      workout: {
        name: 'Core', type: 'fullbody',
        exercises: [
          { name: 'Plank', measureMode: 'time', setDetails: [{ durationSeconds: 45, done: true }] },
          { name: 'Crunch', setDetails: [{ reps: 15, weight: 0, done: true }] }
        ]
      },
      exerciseNotes: [],
      trackingActive: true
    })
    expect(result.exercises[0].measureMode).toBe('time')
    expect(result.exercises[0].setDetails[0].durationSeconds).toBe(45)
    expect('measureMode' in result.exercises[1]).toBe(false)
  })
})
