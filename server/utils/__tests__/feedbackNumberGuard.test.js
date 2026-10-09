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

// User-Report 04.10. abends: trotz Sicherung kam "27,5kg" durch - die alte Prüfung ließ jede
// Kommazahl zu, deren auf eine ganze Zahl gerundeter Wert irgendwo in den Daten stand (hier
// z.B. 28 Tage seit der letzten Session).
describe('guardFeedbackNumbers - Report 04.10. abends (drei Übungen)', () => {
  const row = (w) => ({ name: 'Lever T Bar Row', setDetails: sets([[10, w], [10, w], [10, w]]) })
  const fly = (r) => ({ name: 'Reverse Fly Seated Parallel Grip', setDetails: sets([[r, 20], [r, 20], [r, 20]]) })
  const data = () => ({
    ...structureAnalysisForAI([
      analyzeExercise('Weighted Pull-Up', today, last, 28),
      analyzeExercise('Lever T Bar Row', row(42.5), row(40), 28),
      analyzeExercise('Reverse Fly Seated Parallel Grip', fly(12), fly(10), 28)
    ]),
    response_language: 'de'
  })
  const reportText = [
    'Guter Trainingstag!  Kurz zusammengefasst:',
    '',
    '- Weighted Pull-Up: Bei den ersten drei Sätzen hast du 27,5kg genutzt, was eine super Steigerung ist – mehr Wiederholungen in Satz 1.',
    '- Lever T Bar Row: Gewicht in allen Sätzen um 2,5kg erhöht – stabil!',
    '- Reverse Fly Seated Parallel Grip: Tolle Leistung mit 20% mehr Volumen durch zwei Wiederholungen mehr in jedem Satz.'
  ].join('\n')

  test('Text aus dem Report wird zurückgehalten (27,5 kg trotz 28 in den Daten)', () => {
    const result = guardFeedbackNumbers(reportText, data())
    assert.equal(result.withheld, true)
    assert.ok(result.invalidNumbers.includes(27.5))
  })

  test('korrekte Fassung bleibt stehen', () => {
    const text = reportText.replace('27,5kg', '32,5kg')
    const result = guardFeedbackNumbers(text, data())
    assert.equal(result.withheld, false)
  })

  test('kg-Zahl einer anderen Übung zählt nicht (32,5 kg gehört zu den Pull-Ups, nicht zur Row)', () => {
    const text = '- Lever T Bar Row: alle Sätze mit 32,5kg.'
    const result = guardFeedbackNumbers(text, data())
    assert.equal(result.withheld, true)
    assert.deepEqual(result.invalidNumbers, [32.5])
  })

  test('forceWithhold (Verifier konnte Zahlen-Fund nicht korrigieren) hält auch sauberen Text zurück', () => {
    const result = guardFeedbackNumbers('Weighted Pull-Up: gut gemacht.', data(), { forceWithhold: true })
    assert.equal(result.withheld, true)
    assert.equal(result.text, withheldFeedbackText('de'))
  })
})
