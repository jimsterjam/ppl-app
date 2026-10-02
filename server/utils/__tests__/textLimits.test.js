import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { clampText, TEXT_LIMITS } from '../textLimits.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { default: Workout } = await import(join(__dirname, '../../models/Workout.js'))

describe('clampText', () => {
  test('null/undefined bleiben unverändert, andere Typen werden Text', () => {
    assert.equal(clampText(null, 10), null)
    assert.equal(clampText(undefined, 10), undefined)
    assert.equal(clampText(12345, 3), '123')
  })

  test('kürzt auf die Länge, ohne Emojis zu zerteilen', () => {
    assert.equal(clampText('abcdef', 3), 'abc')
    assert.equal(clampText('💪💪💪', 2), '💪💪')
    assert.equal(clampText('kurz', 10), 'kurz')
  })

  test('einzeilig: Zeilenumbrüche und Steuerzeichen werden zu einem Leerzeichen', () => {
    assert.equal(clampText('Push\nDay\u0000\u0007X', 50), 'Push Day X')
    assert.equal(clampText('a\u2028b', 50), 'a b')
  })

  test('mehrzeilig: Zeilenumbrüche und Tabs bleiben, andere Steuerzeichen fallen weg', () => {
    assert.equal(clampText('Zeile 1\r\nZeile 2\tok\u0000\u001b', 50, { multiline: true }), 'Zeile 1\nZeile 2\tok')
  })
})

describe('Workout: Freitext-Felder werden beim Speichern begrenzt', () => {
  const long = (n) => 'x'.repeat(n)

  test('neues Workout (create/save)', () => {
    const w = new Workout({
      userId: 'u',
      name: long(500),
      notes: long(5000),
      exercises: [{ name: long(500), note: `Notiz\u0000${long(2000)}`, setDetails: [{ reps: 5, weight: 50, notes: long(1000) }] }]
    })
    assert.equal(w.name.length, TEXT_LIMITS.workoutName)
    assert.equal(w.notes.length, TEXT_LIMITS.workoutNotes)
    assert.equal(w.exercises[0].name.length, TEXT_LIMITS.exerciseName)
    assert.equal(w.exercises[0].note.length, TEXT_LIMITS.exerciseNote)
    assert.ok(!w.exercises[0].note.includes('\u0000'))
    assert.equal(w.exercises[0].setDetails[0].notes.length, TEXT_LIMITS.setNote)
  })

  test('normale Eingaben bleiben unverändert', () => {
    const w = new Workout({ userId: 'u', name: 'Push Day', exercises: [{ name: 'Bench Press', note: 'Schulter ok\nnächstes Mal mehr' }] })
    assert.equal(w.name, 'Push Day')
    assert.equal(w.exercises[0].name, 'Bench Press')
    assert.equal(w.exercises[0].note, 'Schulter ok\nnächstes Mal mehr')
  })

  test('Update ($set wie in PUT /api/workouts/:id) wird ebenfalls begrenzt', () => {
    const query = Workout.findOneAndUpdate(
      { _id: '507f1f77bcf86cd799439011', userId: 'u' },
      { $set: { name: long(500), exercises: [{ name: 'Bench Press', note: long(2000) }] } }
    )
    query._castUpdate(query._update) // Mongoose-Cast ohne Datenbank (wendet Setter an)
    const update = query.getUpdate()
    const set = update.$set || update
    assert.equal(set.name.length, TEXT_LIMITS.workoutName)
    assert.equal(set.exercises[0].note.length, TEXT_LIMITS.exerciseNote)
  })
})
