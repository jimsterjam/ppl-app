import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const {
  normalizeFavoriteType,
  validateFavoritePayload,
  isFavoriteLimitExceeded,
  MAX_FAVORITES_PER_TYPE
} = await import(join(__dirname, '../../services/favoriteWorkoutValidation.js'))

describe('normalizeFavoriteType', () => {
  test('akzeptiert gültige Typen', () => {
    assert.equal(normalizeFavoriteType('push'), 'push')
    assert.equal(normalizeFavoriteType('PULL'), 'pull')
    assert.equal(normalizeFavoriteType(' legs '), 'legs')
  })

  test('lehnt unbekannte/leere Typen ab', () => {
    assert.equal(normalizeFavoriteType('cardio'), null)
    assert.equal(normalizeFavoriteType(''), null)
    assert.equal(normalizeFavoriteType(undefined), null)
  })
})

describe('validateFavoritePayload', () => {
  const validWorkout = { type: 'push', workoutName: 'Push Day', notes: '', exercises: [{ name: 'Bankdrücken' }] }

  test('gültiges Payload -> kein Fehler', () => {
    const err = validateFavoritePayload({ clientId: 'fav_push_1', type: 'push', name: 'Mein Push', workout: validWorkout })
    assert.equal(err, null)
  })

  test('fehlende clientId wird abgelehnt', () => {
    const err = validateFavoritePayload({ type: 'push', name: 'x', workout: validWorkout })
    assert.match(err, /clientId/)
  })

  test('ungültiger type wird abgelehnt', () => {
    const err = validateFavoritePayload({ clientId: 'fav_1', type: 'cardio', name: 'x', workout: validWorkout })
    assert.match(err, /type/)
  })

  test('leerer name wird abgelehnt', () => {
    const err = validateFavoritePayload({ clientId: 'fav_1', type: 'push', name: '   ', workout: validWorkout })
    assert.match(err, /name/)
  })

  test('zu langer name wird abgelehnt', () => {
    const err = validateFavoritePayload({ clientId: 'fav_1', type: 'push', name: 'x'.repeat(61), workout: validWorkout })
    assert.match(err, /60/)
  })

  test('fehlendes workout wird abgelehnt', () => {
    const err = validateFavoritePayload({ clientId: 'fav_1', type: 'push', name: 'x', workout: null })
    assert.match(err, /workout/)
  })

  test('workout ohne exercises-Array wird abgelehnt', () => {
    const err = validateFavoritePayload({ clientId: 'fav_1', type: 'push', name: 'x', workout: { exercises: 'nope' } })
    assert.match(err, /exercises/)
  })
})

describe('isFavoriteLimitExceeded', () => {
  test(`unter dem Limit (${MAX_FAVORITES_PER_TYPE}) ist erlaubt`, () => {
    assert.equal(isFavoriteLimitExceeded(MAX_FAVORITES_PER_TYPE - 1), false)
  })

  test('am Limit ist NICHT mehr erlaubt', () => {
    assert.equal(isFavoriteLimitExceeded(MAX_FAVORITES_PER_TYPE), true)
  })

  test('über dem Limit ist nicht erlaubt', () => {
    assert.equal(isFavoriteLimitExceeded(MAX_FAVORITES_PER_TYPE + 5), true)
  })
})

import { sanitizeFavoriteWorkout } from '../../services/favoriteWorkoutValidation.js';
import { TEXT_LIMITS } from '../textLimits.js';

// Absprache Paul 14.10.: Favoriten speichern die Notiz je Übung mit - serverseitig gekürzt statt abgelehnt.
test('Favorit: Übungsnotiz wird gekürzt und von Steuerzeichen befreit, Rest bleibt unverändert', () => {
  const long = 'a'.repeat(TEXT_LIMITS.exerciseNote + 50);
  const result = sanitizeFavoriteWorkout({
    name: 'Push',
    exercises: [{ name: 'Bench', note: long }, { name: 'Row', note: 'ok\u0000text' }, { name: 'Dips' }]
  });
  assert.equal(result.exercises[0].note.length, TEXT_LIMITS.exerciseNote);
  assert.equal(result.exercises[1].note, 'oktext');
  assert.equal('note' in result.exercises[2], false);
  assert.equal(result.name, 'Push');
  assert.deepEqual(sanitizeFavoriteWorkout(null), null);
});
