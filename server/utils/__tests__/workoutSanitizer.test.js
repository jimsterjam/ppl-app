import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const {
  sanitizeWorkoutRequest,
  sanitizeQuickGeneratorRequest,
  getQuickGeneratorMissingInputs
} = await import(join(__dirname, '../workoutSanitizer.js'))

// ------------------------------------
// sanitizeWorkoutRequest
// ------------------------------------
describe('sanitizeWorkoutRequest', () => {
  test('liefert Standardwerte für leeres Objekt', () => {
    const result = sanitizeWorkoutRequest({})
    assert.equal(result.timeAvailable, 45)
    assert.equal(result.experienceLevel, 'intermediate')
    assert.equal(result.intensity, 3)
    assert.equal(result.focus, 'push')
    assert.deepEqual(result.recentWorkouts, null)
  })

  test('übernimmt gültige Werte', () => {
    const result = sanitizeWorkoutRequest({
      timeAvailable: 60,
      experienceLevel: 'advanced',
      intensity: 5,
      focus: 'legs'
    })
    assert.equal(result.timeAvailable, 60)
    assert.equal(result.experienceLevel, 'advanced')
    assert.equal(result.intensity, 5)
  })

  test('schneidet recentWorkouts auf 10 Elemente', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: i }))
    const result = sanitizeWorkoutRequest({ recentWorkouts: many })
    assert.equal(result.recentWorkouts.length, 10)
  })

  test('gibt null zurück für nicht-Array recentWorkouts', () => {
    const result = sanitizeWorkoutRequest({ recentWorkouts: 'invalid' })
    assert.equal(result.recentWorkouts, null)
  })

  test('ersetzt ungültige Zahlen durch Standardwerte', () => {
    const result = sanitizeWorkoutRequest({ timeAvailable: 'abc', intensity: -5 })
    assert.equal(result.timeAvailable, 45)
    assert.equal(result.intensity, 3)
  })
})

// ------------------------------------
// sanitizeQuickGeneratorRequest
// ------------------------------------
describe('sanitizeQuickGeneratorRequest', () => {
  const validBody = {
    durationMinutes: 60,
    goal: 'muscle_building',
    gender: 'male',
    bodyweightKg: 80,
    level: 'intermediate',
    trainingFrequencyPerWeek: 4,
    equipmentMode: 'gym_only',
    requestedType: 'push',
    equipmentAvailability: ['barbell', 'dumbbells']
  }

  test('übernimmt gültige Enum-Werte', () => {
    const result = sanitizeQuickGeneratorRequest(validBody)
    assert.equal(result.goal, 'muscle_building')
    assert.equal(result.level, 'intermediate')
    assert.equal(result.requestedType, 'push')
    assert.equal(result.equipmentMode, 'gym_only')
  })

  test('klemmt durationMinutes auf 20–120', () => {
    assert.equal(sanitizeQuickGeneratorRequest({ ...validBody, durationMinutes: 5 }).durationMinutes, 20)
    assert.equal(sanitizeQuickGeneratorRequest({ ...validBody, durationMinutes: 999 }).durationMinutes, 120)
    assert.equal(sanitizeQuickGeneratorRequest({ ...validBody, durationMinutes: 60 }).durationMinutes, 60)
  })

  test('fällt auf Standardwerte zurück für ungültige Enums', () => {
    const result = sanitizeQuickGeneratorRequest({ ...validBody, goal: 'invalid_goal', level: 'expert' })
    assert.equal(result.goal, 'muscle_building')
    assert.equal(result.level, 'beginner')
  })

  test('filtert ungültige equipmentAvailability-Einträge heraus', () => {
    const result = sanitizeQuickGeneratorRequest({
      ...validBody,
      equipmentAvailability: ['barbell', 'kettle_bells', 'BARBELL', 'none']
    })
    assert.deepEqual(result.equipmentAvailability.sort(), ['barbell', 'none'].sort())
  })

  test('normalisiert performance-Felder auf null wenn nicht gesetzt', () => {
    const result = sanitizeQuickGeneratorRequest(validBody)
    assert.equal(result.performance.bench1RM, null)
    assert.equal(result.performance.squat1RM, null)
  })
})

// ------------------------------------
// getQuickGeneratorMissingInputs
// ------------------------------------
describe('getQuickGeneratorMissingInputs', () => {
  test('meldet alle fehlenden Felder für leeres Objekt', () => {
    const missing = getQuickGeneratorMissingInputs({})
    assert.ok(missing.includes('goal'))
    assert.ok(missing.includes('level'))
    assert.ok(missing.includes('requestedType'))
    assert.ok(missing.includes('equipmentMode'))
    assert.ok(missing.includes('durationMinutes'))
    assert.ok(missing.includes('equipmentAvailability'))
    assert.ok(missing.includes('maxStrictPullups'))
  })

  test('meldet keine Fehler für vollständige Eingabe', () => {
    const body = {
      goal: 'strength',
      level: 'advanced',
      requestedType: 'push',
      equipmentMode: 'gym_only',
      durationMinutes: 45,
      trainingFrequencyPerWeek: 3,
      equipmentAvailability: ['barbell'],
      maxStrictPullups: 10,
      maxStrictDips: 15,
      maxStrictPushups: 30
    }
    const missing = getQuickGeneratorMissingInputs(body)
    assert.equal(missing.length, 0)
  })

  test('verwendet context.trainingFrequencyPerWeek als Fallback', () => {
    const body = {
      goal: 'strength',
      level: 'advanced',
      requestedType: 'push',
      equipmentMode: 'gym_only',
      durationMinutes: 45,
      equipmentAvailability: ['barbell'],
      maxStrictPullups: 10,
      maxStrictDips: 5,
      maxStrictPushups: 20
    }
    const missing = getQuickGeneratorMissingInputs(body, { trainingFrequencyPerWeek: 3 })
    assert.ok(!missing.includes('trainingFrequencyPerWeek'))
  })
})
