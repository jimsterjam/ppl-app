import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { getTimeAdjustedExerciseTarget, getMaxExerciseCount } = await import(join(__dirname, '../exerciseCountTarget.js'))

describe('getTimeAdjustedExerciseTarget', () => {
  test('User-Vorgabe: Kraft bei 60 min max. 4 Übungen', () => {
    assert.equal(getTimeAdjustedExerciseTarget(60, 'strength'), 4)
  })

  test('User-Vorgabe: Muskelaufbau bei 60 min 6 Übungen', () => {
    assert.equal(getTimeAdjustedExerciseTarget(60, 'hypertrophy'), 6)
  })

  test('kürzere Einheiten bekommen weniger Übungen', () => {
    assert.equal(getTimeAdjustedExerciseTarget(30, 'strength'), 3)
    assert.equal(getTimeAdjustedExerciseTarget(30, 'hypertrophy'), 4)
    assert.equal(getTimeAdjustedExerciseTarget(45, 'strength'), 4)
    assert.equal(getTimeAdjustedExerciseTarget(45, 'hypertrophy'), 5)
  })

  test('bis 75 Minuten nicht mehr als 6 (Muskelaufbau) bzw. 4 (Kraft) Übungen; darüber eine mehr', () => {
    assert.equal(getTimeAdjustedExerciseTarget(75, 'hypertrophy'), 6)
    assert.equal(getTimeAdjustedExerciseTarget(75, 'strength'), 4)
    assert.equal(getTimeAdjustedExerciseTarget(90, 'hypertrophy'), 7)
    assert.equal(getTimeAdjustedExerciseTarget(90, 'strength'), 5)
    assert.ok(getTimeAdjustedExerciseTarget(90, 'hypertrophy') > getTimeAdjustedExerciseTarget(75, 'hypertrophy'))
  })

  test('rohe Zielwerte aus dem Request werden korrekt zugeordnet', () => {
    assert.equal(getTimeAdjustedExerciseTarget(60, 'muscle_building'), 6)
    assert.equal(getTimeAdjustedExerciseTarget(60, 'max_strength'), 4)
  })
})

describe('getMaxExerciseCount', () => {
  test('ohne Override gilt die automatische Tabelle', () => {
    assert.equal(getMaxExerciseCount(60, 'strength', null), 4)
    assert.equal(getMaxExerciseCount(60, 'strength', undefined), 4)
  })

  test('manueller Override hat Vorrang', () => {
    assert.equal(getMaxExerciseCount(60, 'strength', 6), 6)
  })

  test('Override wird auf 2-8 begrenzt, ungültige Werte ignoriert', () => {
    assert.equal(getMaxExerciseCount(60, 'strength', 20), 8)
    assert.equal(getMaxExerciseCount(60, 'strength', 1), 2)
    assert.equal(getMaxExerciseCount(60, 'strength', 0), 4)
    assert.equal(getMaxExerciseCount(60, 'strength', 'abc'), 4)
  })
})
