import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { findWorkoutsAffectedByDeletion } = await import(join(__dirname, '../../services/trainingAnalysisService.js'))

describe('findWorkoutsAffectedByDeletion', () => {
  test('findet ein späteres Workout, das eine gemeinsame Übung mit dem gelöschten Workout hat', () => {
    const deleted = { exercises: [{ name: 'Bankdrücken' }, { name: 'Butterfly' }] }
    const candidates = [
      { _id: 'w1', exercises: [{ name: 'Bankdrücken' }] },
      { _id: 'w2', exercises: [{ name: 'Kniebeugen' }] }
    ]
    const result = findWorkoutsAffectedByDeletion(deleted, candidates)
    assert.deepEqual(result.map(w => w._id), ['w1'])
  })

  test('Übungsname-Vergleich ist case-insensitive und trimmt Leerzeichen', () => {
    const deleted = { exercises: [{ name: '  Bankdrücken  ' }] }
    const candidates = [{ _id: 'w1', exercises: [{ name: 'BANKDRÜCKEN' }] }]
    const result = findWorkoutsAffectedByDeletion(deleted, candidates)
    assert.deepEqual(result.map(w => w._id), ['w1'])
  })

  test('gelöschtes Workout ohne Übungen -> keine Kandidaten betroffen (leeres Array, kein Crash)', () => {
    const result = findWorkoutsAffectedByDeletion({ exercises: [] }, [{ _id: 'w1', exercises: [{ name: 'Bankdrücken' }] }])
    assert.deepEqual(result, [])
  })

  test('keine Kandidaten -> leeres Ergebnis', () => {
    const deleted = { exercises: [{ name: 'Bankdrücken' }] }
    assert.deepEqual(findWorkoutsAffectedByDeletion(deleted, []), [])
    assert.deepEqual(findWorkoutsAffectedByDeletion(deleted, null), [])
  })

  test('mehrere betroffene Kandidaten werden alle zurückgegeben', () => {
    const deleted = { exercises: [{ name: 'Kreuzheben' }] }
    const candidates = [
      { _id: 'w1', exercises: [{ name: 'Kreuzheben' }] },
      { _id: 'w2', exercises: [{ name: 'Kreuzheben' }, { name: 'Klimmzüge' }] },
      { _id: 'w3', exercises: [{ name: 'Klimmzüge' }] }
    ]
    const result = findWorkoutsAffectedByDeletion(deleted, candidates)
    assert.deepEqual(result.map(w => w._id), ['w1', 'w2'])
  })

  test('robust gegenüber fehlenden/undefinierten exercises-Feldern', () => {
    const deleted = { exercises: [{ name: 'Bankdrücken' }] }
    const candidates = [{ _id: 'w1' }, { _id: 'w2', exercises: null }, { _id: 'w3', exercises: [{}] }]
    assert.deepEqual(findWorkoutsAffectedByDeletion(deleted, candidates), [])
  })
})
