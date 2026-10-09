import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { isWeightBackedRule1Violation, withoutAverageWeights } from '../../services/feedbackVerificationService.js'

// User-Report 04.10.: Die Prüf-KI meldete "27,5kg" korrekt als falsch, der Fund wurde aber als
// Regel-1-Fund pauschal verworfen.
describe('isWeightBackedRule1Violation', () => {
  test('Regel 1 mit kg-Angabe im Zitat bleibt erhalten', () => {
    assert.equal(isWeightBackedRule1Violation({ rule: 1, quote: 'Bei den ersten drei Sätzen hast du 27,5kg genutzt' }), true)
    assert.equal(isWeightBackedRule1Violation({ rule: 1, quote: 'um 2.5 kg erhöht' }), true)
  })
  test('Regel 1 ohne kg (z.B. Prozent) und andere Regeln: nein', () => {
    assert.equal(isWeightBackedRule1Violation({ rule: 1, quote: '100% mehr Volumen' }), false)
    assert.equal(isWeightBackedRule1Violation({ rule: 4, quote: '27,5kg' }), false)
    assert.equal(isWeightBackedRule1Violation({ rule: 1 }), false)
  })
})

describe('withoutAverageWeights', () => {
  test('entfernt Ø-Gewichte, lässt Satzwerte und Rest unverändert', () => {
    const input = {
      response_language: 'de',
      exercises: [{
        exercise: 'Weighted Pull-Up',
        current_weight: 29.29,
        previous_weight: 28.75,
        current_reps: 36,
        changes: { weight_change_kg: 0.54, volume_change_percent: 4 },
        sets_comparison: [{ set_number: 1, current_weight: 32.5 }]
      }]
    }
    const out = withoutAverageWeights(input)
    const ex = out.exercises[0]
    assert.equal('current_weight' in ex, false)
    assert.equal('previous_weight' in ex, false)
    assert.equal('weight_change_kg' in ex.changes, false)
    assert.equal(ex.changes.volume_change_percent, 4)
    assert.equal(ex.sets_comparison[0].current_weight, 32.5)
    assert.equal(input.exercises[0].current_weight, 29.29) // Original unverändert
  })
})
