import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const {
  startOfIsoWeek,
  normalizeCategory,
  calculateExerciseVolume,
  getExerciseBestWeight,
  computeWorkoutMetrics
} = await import(join(__dirname, '../workoutMetrics.js'))

// ------------------------------------
// startOfIsoWeek
// ------------------------------------
describe('startOfIsoWeek', () => {
  test('Montag bleibt Montag', () => {
    const date = new Date('2024-01-15T12:00:00Z') // Montag
    const result = startOfIsoWeek(date)
    assert.equal(result.getUTCDay(), 1) // Montag
    assert.equal(result.getUTCHours(), 0)
  })

  test('Sonntag wird zum vorherigen Montag', () => {
    const date = new Date('2024-01-21T12:00:00Z') // Sonntag
    const result = startOfIsoWeek(date)
    const expected = new Date('2024-01-15T00:00:00Z')
    assert.equal(result.getTime(), expected.getTime())
  })

  test('Mittwoch wird zum vorherigen Montag', () => {
    const date = new Date('2024-01-17T08:00:00Z') // Mittwoch
    const result = startOfIsoWeek(date)
    const expected = new Date('2024-01-15T00:00:00Z')
    assert.equal(result.getTime(), expected.getTime())
  })
})

// ------------------------------------
// normalizeCategory
// ------------------------------------
describe('normalizeCategory', () => {
  test('erkennt "pull"', () => {
    assert.equal(normalizeCategory('pull', null), 'pull')
  })

  test('erkennt "rück" (Deutsch)', () => {
    assert.equal(normalizeCategory('Rücken', null), 'pull')
  })

  test('erkennt "back"', () => {
    assert.equal(normalizeCategory('back day', null), 'pull')
  })

  test('erkennt "legs"', () => {
    assert.equal(normalizeCategory('Legs', null), 'legs')
  })

  test('erkennt "bein" (Deutsch)', () => {
    assert.equal(normalizeCategory('Beine', null), 'legs')
  })

  test('erkennt "core"', () => {
    assert.equal(normalizeCategory('core', null), 'core')
  })

  test('erkennt "cardio"', () => {
    assert.equal(normalizeCategory('Cardio', null), 'cardio')
  })

  test('fällt auf "push" zurück für unbekannte Eingabe', () => {
    assert.equal(normalizeCategory('', null), 'push')
    assert.equal(normalizeCategory(null, null), 'push')
  })

  test('verwendet workoutType als Fallback', () => {
    assert.equal(normalizeCategory(null, 'legs'), 'legs')
  })
})

// ------------------------------------
// calculateExerciseVolume
// ------------------------------------
describe('calculateExerciseVolume', () => {
  test('berechnet Volume aus setDetails', () => {
    const exercise = {
      setDetails: [
        { reps: 10, weight: 100 },
        { reps: 8, weight: 110 }
      ]
    }
    assert.equal(calculateExerciseVolume(exercise), 1880)
  })

  test('überspringt Warmup-Sets', () => {
    const exercise = {
      setDetails: [
        { reps: 10, weight: 60, isWarmup: true },
        { reps: 10, weight: 100 }
      ]
    }
    assert.equal(calculateExerciseVolume(exercise), 1000)
  })

  test('berechnet Volume aus sets/reps/weight ohne setDetails', () => {
    const exercise = { sets: 3, reps: 12, weight: 80 }
    assert.equal(calculateExerciseVolume(exercise), 2880)
  })

  test('gibt 0 zurück für null', () => {
    assert.equal(calculateExerciseVolume(null), 0)
  })

  test('gibt 0 zurück für leere setDetails', () => {
    assert.equal(calculateExerciseVolume({ setDetails: [] }), 0)
  })
})

// ------------------------------------
// getExerciseBestWeight
// ------------------------------------
describe('getExerciseBestWeight', () => {
  test('findet das höchste Gewicht aus setDetails', () => {
    const exercise = {
      weight: 80,
      setDetails: [
        { weight: 80 },
        { weight: 120 },
        { weight: 100 }
      ]
    }
    assert.equal(getExerciseBestWeight(exercise), 120)
  })

  test('überspringt Warmup-Sets bei Best-Weight', () => {
    const exercise = {
      weight: 60,
      setDetails: [
        { weight: 200, isWarmup: true },
        { weight: 100 }
      ]
    }
    assert.equal(getExerciseBestWeight(exercise), 100)
  })

  test('fällt auf exercise.weight zurück ohne setDetails', () => {
    assert.equal(getExerciseBestWeight({ weight: 90 }), 90)
  })

  test('gibt 0 zurück für null', () => {
    assert.equal(getExerciseBestWeight(null), 0)
  })
})

// ------------------------------------
// computeWorkoutMetrics
// ------------------------------------
describe('computeWorkoutMetrics', () => {
  test('berechnet Gesamtvolume', () => {
    const workout = {
      type: 'push',
      exercises: [
        { name: 'Bench Press', sets: 3, reps: 10, weight: 80, category: 'push' },
        { name: 'Squat', sets: 3, reps: 10, weight: 100, category: 'legs' }
      ]
    }
    const metrics = computeWorkoutMetrics(workout)
    assert.equal(metrics.volume, 2400 + 3000)
  })

  test('gibt leere Metrics für null zurück', () => {
    const metrics = computeWorkoutMetrics(null)
    assert.equal(metrics.volume, 0)
    assert.deepEqual(metrics.bestLifts, [])
  })

  test('sammelt bestLifts', () => {
    const workout = {
      type: 'push',
      exercises: [{ name: 'Press', weight: 80, reps: 5, sets: 1 }]
    }
    const metrics = computeWorkoutMetrics(workout)
    assert.equal(metrics.bestLifts.length, 1)
    assert.equal(metrics.bestLifts[0].name, 'Press')
    assert.equal(metrics.bestLifts[0].weight, 80)
  })

  test('gruppiert muscleVolume nach Kategorie', () => {
    const workout = {
      type: 'push',
      exercises: [
        { name: 'Bench', sets: 1, reps: 1, weight: 100, category: 'push' },
        { name: 'Fly', sets: 1, reps: 1, weight: 50, category: 'push' }
      ]
    }
    const metrics = computeWorkoutMetrics(workout)
    assert.equal(metrics.muscleVolume.get('push'), 150)
  })
})
