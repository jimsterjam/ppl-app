import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const {
  buildFeedbackVersion,
  validateRatingPayload,
  nextRatingStatus,
  isCountedStatus,
  buildQualitySignal,
  shouldWriteQualitySignal,
  POSITIVE_REASON_CODES,
  NEGATIVE_REASON_CODES
} = await import(join(__dirname, '../../services/feedbackRatingService.js'))

describe('buildFeedbackVersion', () => {
  test('kombiniert Modell und ISO-Zeitstempel', () => {
    const version = buildFeedbackVersion({ aiGeneratedAt: '2026-08-30T10:00:00.000Z', model: 'gpt-4o-mini' })
    assert.equal(version, 'gpt-4o-mini:2026-08-30T10:00:00.000Z')
  })

  test('fällt auf Platzhalter zurück, wenn Felder fehlen', () => {
    const version = buildFeedbackVersion({})
    assert.equal(version, 'unknown-model:unknown')
  })
})

describe('validateRatingPayload', () => {
  test('gültige "helpful"-Bewertung mit passenden reasonCodes -> keine Fehler', () => {
    const errors = validateRatingPayload({ rating: 'helpful', reasonCodes: ['GOOD_RECOMMENDATION'] })
    assert.deepEqual(errors, [])
  })

  test('gültige "not_helpful"-Bewertung mit passenden reasonCodes -> keine Fehler', () => {
    const errors = validateRatingPayload({ rating: 'not_helpful', reasonCodes: ['INVENTED_INFORMATION', 'TOO_GENERIC'] })
    assert.deepEqual(errors, [])
  })

  test('ungültiger rating-Wert wird abgelehnt', () => {
    const errors = validateRatingPayload({ rating: 'sort_of' })
    assert.ok(errors.some(e => e.includes('rating muss einer von')))
  })

  test('reasonCode aus der jeweils anderen Liste wird abgelehnt (helpful-Code bei not_helpful)', () => {
    const errors = validateRatingPayload({ rating: 'not_helpful', reasonCodes: ['GOOD_RECOMMENDATION'] })
    assert.ok(errors.some(e => e.includes('Unbekannte reasonCodes')))
  })

  test('zu langer correctionText wird abgelehnt', () => {
    const errors = validateRatingPayload({ rating: 'helpful', correctionText: 'x'.repeat(1001) })
    assert.ok(errors.some(e => e.includes('zu lang')))
  })

  test('fehlendes correctionText ist gültig (optional)', () => {
    const errors = validateRatingPayload({ rating: 'helpful' })
    assert.deepEqual(errors, [])
  })
})

describe('nextRatingStatus', () => {
  test('neue Bewertung (kein vorheriger Status) -> active', () => {
    assert.equal(nextRatingStatus(null, 'save'), 'active')
  })

  test('vorher gelöschte Bewertung erneut gespeichert -> active (nicht edited)', () => {
    assert.equal(nextRatingStatus('deleted', 'save'), 'active')
  })

  test('vorher aktive Bewertung erneut gespeichert -> edited', () => {
    assert.equal(nextRatingStatus('active', 'save'), 'edited')
  })

  test('vorher bereits editierte Bewertung erneut gespeichert -> bleibt edited', () => {
    assert.equal(nextRatingStatus('edited', 'save'), 'edited')
  })

  test('löschen setzt immer deleted, unabhängig vom vorherigen Status', () => {
    assert.equal(nextRatingStatus('active', 'delete'), 'deleted')
    assert.equal(nextRatingStatus('edited', 'delete'), 'deleted')
  })
})

describe('isCountedStatus', () => {
  test('active und edited zählen', () => {
    assert.equal(isCountedStatus('active'), true)
    assert.equal(isCountedStatus('edited'), true)
  })

  test('deleted zählt nicht', () => {
    assert.equal(isCountedStatus('deleted'), false)
  })
})

describe('buildQualitySignal', () => {
  test('enthält niemals userId/feedbackId/correctionText, nur die erlaubten Felder', () => {
    const signal = buildQualitySignal({
      feedbackVersion: 'gpt-4o-mini:2026-08-30T10:00:00.000Z',
      rating: 'not_helpful',
      reasonCodes: ['INVENTED_INFORMATION']
    })
    assert.deepEqual(Object.keys(signal).sort(), [
      'exerciseCategory', 'feedbackVersion', 'rating', 'reasonCodes', 'reportedStatementCategory'
    ].sort())
    assert.equal(signal.reportedStatementCategory, null)
    assert.equal(signal.exerciseCategory, null)
    assert.ok(!('userId' in signal))
    assert.ok(!('feedbackId' in signal))
    assert.ok(!('correctionText' in signal))
  })

  test('reasonCodes wird kopiert, nicht referenziert (Mutation des Originals wirkt sich nicht aus)', () => {
    const original = ['TOO_GENERIC']
    const signal = buildQualitySignal({ feedbackVersion: 'v1', rating: 'not_helpful', reasonCodes: original })
    original.push('OTHER')
    assert.deepEqual(signal.reasonCodes, ['TOO_GENERIC'])
  })
})

describe('shouldWriteQualitySignal', () => {
  test('bei save wird ein Signal geschrieben', () => {
    assert.equal(shouldWriteQualitySignal('save'), true)
  })

  test('bei delete wird KEIN neues Signal geschrieben (Anonymisierungs-Historie bleibt stehen)', () => {
    assert.equal(shouldWriteQualitySignal('delete'), false)
  })
})

describe('Reason-Code-Listen', () => {
  test('positive und negative Listen überschneiden sich nicht', () => {
    const overlap = POSITIVE_REASON_CODES.filter(code => NEGATIVE_REASON_CODES.includes(code))
    assert.deepEqual(overlap, [])
  })
})
