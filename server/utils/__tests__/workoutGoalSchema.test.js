import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { default: Workout } = await import(join(__dirname, '../../models/Workout.js'))

// Ziel pro Workout (beim Erstellen im Client abgefragt). Ungültige Werte dürfen das Speichern
// nicht scheitern lassen, sondern werden zu null.
describe('Workout.goal', () => {
  test('gültige Ziele werden gespeichert', () => {
    assert.equal(new Workout({ userId: 'u', goal: 'strength' }).goal, 'strength')
    assert.equal(new Workout({ userId: 'u', goal: 'hypertrophy' }).goal, 'hypertrophy')
  })

  test('fehlend oder ungültig -> null', () => {
    assert.equal(new Workout({ userId: 'u' }).goal, null)
    assert.equal(new Workout({ userId: 'u', goal: 'muscle_building' }).goal, null)
  })
})
