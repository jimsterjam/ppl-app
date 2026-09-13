import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeExerciseName,
  levenshteinDistance,
  similarityRatio,
  decideExerciseMatch,
  SIMILARITY_THRESHOLD
} from '../exerciseMatching.js'

describe('normalizeExerciseName', () => {
  test('trimmt, kleinschreibt, vereinheitlicht Binde-/Unterstriche und Leerzeichen', () => {
    assert.equal(normalizeExerciseName('  Kurzhantel-Bankdrücken  '), 'kurzhantel bankdrücken')
    assert.equal(normalizeExerciseName('Bein_Presse'), 'bein presse')
    assert.equal(normalizeExerciseName('Bank   drücken'), 'bank drücken')
  })

  test('undefined/null ergibt leeren String, kein Crash', () => {
    assert.equal(normalizeExerciseName(undefined), '')
    assert.equal(normalizeExerciseName(null), '')
  })
})

describe('levenshteinDistance', () => {
  test('identische Strings haben Distanz 0', () => {
    assert.equal(levenshteinDistance('bankdrücken', 'bankdrücken'), 0)
  })

  test('ein eingefügtes Zeichen ergibt Distanz 1', () => {
    assert.equal(levenshteinDistance('kniebeuge', 'kniebeugen'), 1)
  })

  test('leerer String gegen nicht-leeren String ergibt Distanz = Länge des anderen', () => {
    assert.equal(levenshteinDistance('', 'abc'), 3)
    assert.equal(levenshteinDistance('abc', ''), 3)
  })

  test('komplett verschiedene Strings gleicher Länge', () => {
    assert.equal(levenshteinDistance('abc', 'xyz'), 3)
  })
})

describe('similarityRatio', () => {
  test('identische Namen (nach Normalisierung) ergeben 1', () => {
    assert.equal(similarityRatio('Bankdrücken', 'bankdrücken'), 1)
    assert.equal(similarityRatio('Kurzhantel-Rudern', 'kurzhantel rudern'), 1)
  })

  test('leicht abweichende Varianten liegen deutlich über dem Ähnlichkeits-Schwellenwert', () => {
    const score = similarityRatio('Schrägbankdrücken', 'Bankdrücken')
    assert.ok(score >= SIMILARITY_THRESHOLD, `score=${score} sollte >= ${SIMILARITY_THRESHOLD} sein`)
    assert.ok(score < 1)
  })

  test('komplett unterschiedliche Übungen liegen deutlich unter dem Schwellenwert', () => {
    const score = similarityRatio('Bankdrücken', 'Kreuzheben')
    assert.ok(score < SIMILARITY_THRESHOLD, `score=${score} sollte < ${SIMILARITY_THRESHOLD} sein`)
  })

  test('beide leer ergibt 1 (keine Aussage, aber kein Crash)', () => {
    assert.equal(similarityRatio('', ''), 1)
  })

  test('einer leer, einer nicht -> 0', () => {
    assert.equal(similarityRatio('', 'Bankdrücken'), 0)
  })
})

describe('decideExerciseMatch', () => {
  const existingExercises = [
    { id: 'ex1', names: ['Bankdrücken', 'Bankdrücken', 'Bench Press'] },
    { id: 'ex2', names: ['Kniebeuge', 'Kniebeuge', 'Squat'] },
    { id: 'ex3', names: ['Kreuzheben konventionell', 'Kreuzheben konventionell', 'Conventional Deadlift'] }
  ]

  test('exakter Name (case-insensitive) -> matchType exact', () => {
    const result = decideExerciseMatch('bankdrücken', existingExercises)
    assert.equal(result.matchType, 'exact')
    assert.equal(result.match.id, 'ex1')
    assert.equal(result.score, 1)
  })

  test('exakter Treffer über den englischen Namen -> matchType exact', () => {
    const result = decideExerciseMatch('Bench Press', existingExercises)
    assert.equal(result.matchType, 'exact')
    assert.equal(result.match.id, 'ex1')
  })

  test('ähnlicher, aber nicht identischer Name -> matchType similar, Verweis auf ähnlichste Übung', () => {
    const result = decideExerciseMatch('Schrägbankdrücken', existingExercises)
    assert.equal(result.matchType, 'similar')
    assert.equal(result.match.id, 'ex1')
    assert.ok(result.score < 1 && result.score >= SIMILARITY_THRESHOLD)
  })

  test('komplett neuer, unähnlicher Name -> matchType none, kein Verweis', () => {
    const result = decideExerciseMatch('Kabelzug Face Pull', existingExercises)
    assert.equal(result.matchType, 'none')
    assert.equal(result.match, null)
  })

  test('leere Kandidatenliste -> immer none, kein Crash', () => {
    const result = decideExerciseMatch('Bankdrücken', [])
    assert.equal(result.matchType, 'none')
    assert.equal(result.match, null)
    assert.equal(result.score, 0)
  })

  test('wählt bei mehreren ähnlichen Kandidaten den insgesamt ähnlichsten aus', () => {
    const result = decideExerciseMatch('Kniebeugen', existingExercises)
    assert.equal(result.match.id, 'ex2')
  })
})
