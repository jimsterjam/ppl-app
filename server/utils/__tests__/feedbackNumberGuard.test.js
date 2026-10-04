import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { guardFeedbackNumbers, withheldFeedbackText } from '../feedbackNumberGuard.js'
import { analyzeExercise, structureAnalysisForAI } from '../../services/trainingAnalysisService.js'

// Pull-Up-Beispiel vom 04.10. (User-Report): KI schrieb "auf 27,5 kg gesteigert" - die Zahl
// kommt in den Daten nicht vor.
const sets = (list) => list.map(([reps, weight]) => ({ reps, weight, isWarmup: false }))
const last = { name: 'Weighted Pull-Up', setDetails: sets([[4, 32.5], [5, 31.25], [5, 30], [5, 30], [5, 30], [5, 25], [6, 22.5]]) }
const today = { name: 'Weighted Pull-Up', setDetails: sets([[5, 32.5], [5, 32.5], [5, 32.5], [5, 30], [5, 30], [5, 25], [6, 22.5]]) }
const structured = (language) => ({
  ...structureAnalysisForAI([analyzeExercise('Weighted Pull-Up', today, last, 5)]),
  response_language: language
})

describe('guardFeedbackNumbers', () => {
  test('erfundene Zahl (27,5 kg) -> KI-Text wird nicht ausgeliefert', () => {
    const result = guardFeedbackNumbers('Weighted Pull-Up: du hast dich auf 27,5 kg gesteigert.', structured('de'))
    assert.equal(result.withheld, true)
    assert.deepEqual(result.invalidNumbers, [27.5])
    assert.equal(result.text, withheldFeedbackText('de'))
  })

  test('korrekte Zahlen (Satz 2 +1,25 kg, Satz 3 +2,5 kg) -> Text bleibt unverändert', () => {
    const text = 'Weighted Pull-Up: Satz 2 +1,25 kg, Satz 3 +2,5 kg auf 32,5 kg, Satz 1 mit 5 statt 4 Wdh.'
    const result = guardFeedbackNumbers(text, structured('de'))
    assert.equal(result.withheld, false)
    assert.equal(result.text, text)
  })

  test('Ersatztext in der App-Sprache, ohne Zahlen', () => {
    const en = guardFeedbackNumbers('You went up to 27.5 kg.', structured('en'))
    assert.equal(en.text, withheldFeedbackText('en'))
    assert.notEqual(withheldFeedbackText('en'), withheldFeedbackText('de'))
    assert.equal(/\d/.test(withheldFeedbackText('de')), false)
    assert.equal(/\d/.test(withheldFeedbackText('en')), false)
  })
})
