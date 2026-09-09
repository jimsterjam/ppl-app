import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selectUnanalyzedRatings,
  buildInsightPrompt,
  getInsightSystemPrompt
} from '../../services/feedbackInsightService.js'

// feedbackInsightService.js: Admin-only Analyse-Feature (siehe Kommentar dort + in
// models/FeedbackRating.js zur bewusst freigegebenen Datenschutz-Ausnahme). Getestet werden
// hier nur die reinen Funktionen (keine echten OpenAI-Calls, keine DB) - analog zum
// wrapUserNote-Test.

describe('selectUnanalyzedRatings', () => {
  test('gibt alle Ratings zurück, wenn noch keins in einem früheren Proposal enthalten war', () => {
    const ratings = [{ _id: 'a' }, { _id: 'b' }]
    const result = selectUnanalyzedRatings(ratings, new Set())
    assert.equal(result.length, 2)
  })

  test('filtert bereits analysierte Ratings heraus', () => {
    const ratings = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]
    const result = selectUnanalyzedRatings(ratings, new Set(['a', 'c']))
    assert.deepEqual(result.map((r) => r._id), ['b'])
  })

  test('gibt leeres Array zurück, wenn alle bereits analysiert wurden', () => {
    const ratings = [{ _id: 'a' }, { _id: 'b' }]
    const result = selectUnanalyzedRatings(ratings, new Set(['a', 'b']))
    assert.deepEqual(result, [])
  })

  test('respektiert das limit', () => {
    const ratings = [{ _id: '1' }, { _id: '2' }, { _id: '3' }]
    const result = selectUnanalyzedRatings(ratings, new Set(), 2)
    assert.equal(result.length, 2)
  })

  test('leere/undefined Eingaben crashen nicht', () => {
    assert.deepEqual(selectUnanalyzedRatings(undefined, new Set()), [])
    assert.deepEqual(selectUnanalyzedRatings([], undefined), [])
  })
})

describe('buildInsightPrompt', () => {
  test('enthält weder userId noch feedbackId, auch wenn diese Felder im Objekt vorhanden sind', () => {
    const ratings = [
      { _id: 'x', userId: 'geheime-uid-123', feedbackId: 'workout-abc', rating: 'not_helpful', correctionText: 'War falsch.' }
    ]
    const prompt = buildInsightPrompt(ratings)
    assert.ok(!prompt.includes('geheime-uid-123'))
    assert.ok(!prompt.includes('workout-abc'))
  })

  test('übernimmt Korrekturtext gekürzt und in Anführungszeichen', () => {
    const ratings = [{ rating: 'not_helpful', correctionText: 'Das war nicht hilfreich.' }]
    const prompt = buildInsightPrompt(ratings)
    assert.ok(prompt.includes('"Das war nicht hilfreich."'))
  })

  test('sehr langer Korrekturtext wird gekürzt (mit …)', () => {
    const longText = 'a'.repeat(500)
    const ratings = [{ rating: 'not_helpful', correctionText: longText }]
    const prompt = buildInsightPrompt(ratings)
    assert.ok(prompt.includes('…'))
    assert.ok(!prompt.includes('a'.repeat(500)))
  })

  test('reasonCodes werden aufgelistet, wenn vorhanden', () => {
    const ratings = [{ rating: 'not_helpful', reasonCodes: ['IGNORED_NOTE', 'WRONG_TONE'] }]
    const prompt = buildInsightPrompt(ratings)
    assert.ok(prompt.includes('IGNORED_NOTE'))
    assert.ok(prompt.includes('WRONG_TONE'))
  })

  test('Rating ohne Korrekturtext/reasonCodes erzeugt trotzdem eine gültige Zeile', () => {
    const ratings = [{ rating: 'not_helpful' }]
    const prompt = buildInsightPrompt(ratings)
    assert.ok(prompt.includes('nicht hilfreich'))
  })

  test('leeres Array erzeugt Prompt ohne Crash', () => {
    const prompt = buildInsightPrompt([])
    assert.equal(typeof prompt, 'string')
    assert.ok(prompt.includes('0 anonymisierte'))
  })
})

describe('getInsightSystemPrompt', () => {
  test('fordert explizit valides JSON mit summary und proposalText', () => {
    const prompt = getInsightSystemPrompt()
    assert.ok(prompt.includes('"summary"'))
    assert.ok(prompt.includes('"proposalText"'))
    assert.ok(prompt.toLowerCase().includes('json'))
  })
})
