import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeWarmup, WARMUP_STEPS } from '../workoutWarmup.js'
import Workout from '../../models/Workout.js'

describe('sanitizeWarmup', () => {
  test('drei Schritte, nur echte true-Werte zählen', () => {
    assert.deepEqual(WARMUP_STEPS, ['cardio', 'joints', 'specific'])
    assert.deepEqual(sanitizeWarmup({ cardio: true, joints: false, specific: true }), { cardio: true, joints: false, specific: true })
    assert.deepEqual(sanitizeWarmup({ cardio: 'true', joints: 1, specific: 'yes' }), { cardio: false, joints: false, specific: false })
    assert.deepEqual(sanitizeWarmup({}), { cardio: false, joints: false, specific: false })
  })

  test('unbekannte Felder und Freitext werden nie übernommen', () => {
    const clean = sanitizeWarmup({ cardio: true, note: '<script>alert(1)</script>', extra: { a: 1 } })
    assert.deepEqual(Object.keys(clean).sort(), ['cardio', 'joints', 'specific'])
  })

  test('kein Objekt: null (unbekannt)', () => {
    for (const bad of [null, undefined, 'x', 5, [], true]) assert.equal(sanitizeWarmup(bad), null)
  })
})

describe('Workout-Schema: warmup', () => {
  test('ohne Angabe null (alte Workouts)', () => {
    const w = new Workout({ userId: 'u1', name: 'Test' })
    assert.equal(w.warmup, null)
  })

  test('übernimmt nur die drei Booleans', () => {
    const w = new Workout({ userId: 'u1', name: 'Test', warmup: { cardio: true, joints: true, specific: false, evil: 'x' } })
    assert.deepEqual({ ...w.warmup.toObject?.() ?? w.warmup }, { cardio: true, joints: true, specific: false })
  })

  test('Müll im Feld wird zu null und lässt das Speichern nicht scheitern', () => {
    const w = new Workout({ userId: 'u1', name: 'Test', warmup: 'kaputt' })
    assert.equal(w.warmup, null)
    assert.equal(w.validateSync(), undefined)
  })
})
