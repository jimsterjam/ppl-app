import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { default: Workout } = await import(join(__dirname, '../../models/Workout.js'))

// Plan-Verweis am Workout: gültige IDs bleiben, alles andere wird zu null (kein Speicherfehler).
describe('Workout.planId / planDayId', () => {
  test('gültige IDs werden gespeichert', () => {
    const w = new Workout({ userId: 'u', planId: 'plan_1700000000000_ab12', planDayId: 'day_1700000000000_cd34' })
    assert.equal(w.planId, 'plan_1700000000000_ab12')
    assert.equal(w.planDayId, 'day_1700000000000_cd34')
  })

  test('fehlend -> null', () => {
    const w = new Workout({ userId: 'u' })
    assert.equal(w.planId, null)
    assert.equal(w.planDayId, null)
  })

  test('ungültig (Sonderzeichen, zu lang, kein String) -> null', () => {
    assert.equal(new Workout({ userId: 'u', planId: '<script>' }).planId, null)
    assert.equal(new Workout({ userId: 'u', planId: 'a'.repeat(65) }).planId, null)
    assert.equal(new Workout({ userId: 'u', planDayId: { $ne: 1 } }).planDayId, null)
    assert.equal(new Workout({ userId: 'u', planDayId: '   ' }).planDayId, null)
  })
})
