import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TEXT_LIMITS, normalizeMuscleGroup } from '../textLimits.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { default: CustomExercise } = await import(join(__dirname, '../../models/CustomExercise.js'))

// Absprache Paul 23.10.: Bei "Sonstiges" darf eine eigene Kategorie als Text eingegeben werden.
describe('Eigene Übung: Kategorie als Freitext', () => {
  test('bekannte Gruppe und eigene Kategorie bleiben erhalten', () => {
    assert.equal(new CustomExercise({ userId: 'u', name: 'X', muscleGroup: 'chest' }).muscleGroup, 'chest')
    assert.equal(new CustomExercise({ userId: 'u', name: 'X', muscleGroup: 'Nacken' }).muscleGroup, 'Nacken')
  })

  test('wird auf 24 Zeichen gekürzt, Steuerzeichen und < > entfernt', () => {
    const e = new CustomExercise({ userId: 'u', name: 'X', muscleGroup: `<b>Nacken\u0000</b>${'x'.repeat(100)}` })
    assert.equal(e.muscleGroup.length <= TEXT_LIMITS.muscleGroup, true)
    assert.ok(!e.muscleGroup.includes('<') && !e.muscleGroup.includes('>') && !e.muscleGroup.includes('\u0000'))
  })

  test('leer wird zu "other"', () => {
    assert.equal(new CustomExercise({ userId: 'u', name: 'X', muscleGroup: '   ' }).muscleGroup, 'other')
  })

  test('normalizeMuscleGroup (auch für PUT /api/custom-exercises/:id) kürzt und bereinigt', () => {
    assert.equal(normalizeMuscleGroup('y'.repeat(200)).length, TEXT_LIMITS.muscleGroup)
    assert.equal(normalizeMuscleGroup(undefined), 'other')
    assert.equal(normalizeMuscleGroup('<Nacken>'), 'Nacken')
  })
})
