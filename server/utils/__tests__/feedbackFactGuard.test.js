import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { findFactClaim, sanitizeCoachText, fallbackFeedbackText, buildBodyweightFactLine } from '../feedbackFactGuard.js'
import {
  analyzeWorkoutProgression,
  structureAnalysisForAI,
  resolveRepsSetChanges,
  resolveSatzgenauWeightChange
} from '../../services/trainingAnalysisService.js'
import { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'

// Fakten kommen vom Code, die KI liefert nur die Einordnung (siehe feedbackFactGuard.js).
// Auslöser: Reports vom 04. und 08.10. (Weighted Pull-Ups) - die KI erfand "27,5 kg gesteigert" und
// "Wiederholungen in Satz 7 von 6 auf 5 gesunken" (Backend: 6 -> 6).

describe('findFactClaim: Zeilen mit Faktenaussage werden erkannt', () => {
  const claims = [
    // echte Fehlertexte aus den Reports
    'Weighted Pull-Up: Gewicht in den letzten beiden Sätzen um 2,5kg gesteigert, Wiederholungen in Satz 7 von 6 auf 5 gesunken - das zeigt, dass du nah an deiner Grenze warst.',
    'Du hast dich bei den Pull-Ups auf 27,5 kg gesteigert.',
    'Im letzten Satz hast du eine Wiederholung weniger gemacht.',
    // Ziffern, Zahlwörter
    '- Kniebeugen: 5 saubere 💪',
    '- Kniebeugen: zwei Mal sauber',
    'Seit drei Einheiten gleich.',
    // Satzbezug / Mess-Vokabular
    '- Bankdrücken: im zweiten Satz stark',
    '- Bankdrücken: die Sätze liefen gut',
    '- Rudern: Zusatzgewicht passt',
    '- Rudern: das Körpergewicht ist gestiegen',
    '- Rudern: die Wiederholungen passen',
    '- Rudern: Wdh. passen',
    '- Rudern: das Volumen passt',
    '- Rudern: die Last passt',
    // Richtungswörter
    '- Rudern: da geht noch mehr',
    '- Rudern: du hast dich gesteigert',
    '- Rudern: klare Steigerung',
    '- Rudern: ist gesunken',
    '- Rudern: unverändert',
    '- Rudern: schwerer als sonst',
    // Englisch
    '- Rows: increased a bit',
    '- Rows: 5 reps in the last set',
    '- Rows: you lifted more',
    '- Rows: nice weight',
    '- Rows: the sets went well',
    '- Rows: two good ones',
    '- Rows: unchanged'
  ]
  for (const line of claims) {
    test(`erkannt: ${line.slice(0, 60)}`, () => {
      assert.ok(findFactClaim(line), `sollte als Faktenaussage erkannt werden: ${line}`)
    })
  }
})

describe('findFactClaim: reine Einschätzung bleibt erhalten', () => {
  const fine = [
    'Guter Trainingstag 💪 Kurz eingeordnet:',
    'Solide Einheit, da läuft was 👍',
    '- Weighted Pull-Up: läuft rund 👍',
    '- Bankdrücken: da kommst du an deine Grenze.',
    '- Kniebeugen: Konsolidierung auf gutem Niveau, bleib dran.',
    '- Rudern: sauber durchgezogen, weiter so 💪',
    'Heute eher ein verhaltener Tag - das passiert.',
    'Nice session 💪 Quick take:',
    '- Rows: solid work, you are close to your limit.',
    '- Deadlift: steady, keep it going 🔥',
    'Deine Notiz erklärt das, daher keine Wertung.'
  ]
  for (const line of fine) {
    test(`bleibt: ${line.slice(0, 60)}`, () => {
      assert.equal(findFactClaim(line), null, `sollte NICHT als Faktenaussage gelten: ${line}`)
    })
  }

  test('Übungsnamen mit Mess-Wörtern/Ziffern lösen nichts aus ("Weighted", "21s")', () => {
    assert.equal(findFactClaim('- Weighted Pull-Up: läuft rund 👍', ['Weighted Pull-Up']), null)
    assert.equal(findFactClaim('- 21s Curl: läuft rund', ['21s Curl']), null)
    // ohne Namensliste würde "21s" als Ziffer erkannt
    assert.equal(findFactClaim('- 21s Curl: läuft rund', []), 'digit')
    // "Weighted" ist kein Mess-Wort (nur "weight"/"weights")
    assert.equal(findFactClaim('- Weighted Pull-Ups: läuft rund 👍', []), null)
  })

  test('Wortgrenzen: "Belastung", "Reset", "Repertoire" sind keine Mess-Wörter', () => {
    assert.equal(findFactClaim('Gute Belastungssteuerung heute.'), null)
    assert.equal(findFactClaim('Ein Reset tut gut.'), null)
    assert.equal(findFactClaim('Dein Repertoire wächst.'), null)
  })
})

describe('sanitizeCoachText', () => {
  const names = ['Weighted Pull-Up', 'Barbell Row']

  test('Report 08.10.: falsche Satzaussage fliegt raus, Einschätzung bleibt', () => {
    const text = [
      'Guter Trainingstag 💪 Kurz eingeordnet:',
      '- Weighted Pull-Up: Gewicht in den letzten beiden Sätzen um 2,5kg gesteigert, Wiederholungen in Satz 7 von 6 auf 5 gesunken - das zeigt, dass du nah an deiner Grenze warst.',
      '- Barbell Row: läuft rund 👍'
    ].join('\n')
    const result = sanitizeCoachText(text, { language: 'de', exerciseNames: names })
    assert.equal(result.droppedLines, 1)
    assert.equal(result.allDropped, false)
    assert.ok(!/von 6 auf 5/.test(result.text))
    assert.ok(!/\d/.test(result.text))
    assert.ok(result.text.includes('Barbell Row: läuft rund'))
    assert.ok(result.text.includes('Guter Trainingstag'))
  })

  test('Report 04.10.: "auf 27,5 kg gesteigert" wird entfernt', () => {
    const result = sanitizeCoachText('Pull-Ups: du hast dich auf 27,5 kg gesteigert.\nSolide Einheit 👍', { language: 'de' })
    assert.ok(!result.text.includes('27'))
    assert.ok(result.text.includes('Solide Einheit'))
  })

  test('Einstieg endet auf ":" und die Aufzählung wurde entfernt -> Punkt statt Doppelpunkt', () => {
    const result = sanitizeCoachText('Guter Tag 💪 Kurz eingeordnet:\n- Row: 5 Wdh. mehr', { language: 'de' })
    assert.equal(result.text, 'Guter Tag 💪 Kurz eingeordnet.')
  })

  test('alles entfernt -> fester Hinweis in der App-Sprache, allDropped=true', () => {
    const de = sanitizeCoachText('Im letzten Satz 1 Wiederholung weniger.', { language: 'de' })
    assert.equal(de.allDropped, true)
    assert.equal(de.text, fallbackFeedbackText('de'))
    const en = sanitizeCoachText('You did 1 rep less in the last set.', { language: 'en' })
    assert.equal(en.text, fallbackFeedbackText('en'))
    assert.notEqual(fallbackFeedbackText('de'), fallbackFeedbackText('en'))
    assert.ok(!/\d/.test(fallbackFeedbackText('de') + fallbackFeedbackText('en')))
  })

  test('leerer KI-Text -> fester Hinweis, aber nicht "allDropped"', () => {
    const result = sanitizeCoachText('', { language: 'de' })
    assert.equal(result.text, fallbackFeedbackText('de'))
    assert.equal(result.allDropped, false)
  })

  test('sauberer Text bleibt unverändert', () => {
    const text = 'Solide Einheit 💪 Kurz eingeordnet:\n- Barbell Row: läuft rund 👍'
    const result = sanitizeCoachText(text, { language: 'de', exerciseNames: names })
    assert.equal(result.text, text)
    assert.equal(result.droppedLines, 0)
  })

  test('Ausgabe enthält nie Ziffern, egal was die KI schreibt', () => {
    const wild = [
      'Super 5 von 5!', '- Row: 32,5 kg', '- Row: +2,5 kg im letzten Satz', 'Wdh. 6 -> 5', 'Seit 3 Einheiten gleich',
      'Heute war es zwei Mal anders', 'Pull-Ups: 100% Einsatz', 'läuft 💪'
    ].join('\n')
    const result = sanitizeCoachText(wild, { language: 'de' })
    assert.ok(!/\d/.test(result.text))
  })
})

describe('Fakten kommen vom Code: Pull-Up-Beispiel 08.10.', () => {
  const sets = (list) => list.map(([reps, weight]) => ({ reps, weight, isWarmup: false, done: true }))
  const workout = (id, date, list) => ({
    _id: id, date, createdAt: date, completed: true,
    exercises: [{ name: 'Weighted Pull-Up', setDetails: sets(list) }]
  })
  const last = workout('a', '2026-10-04T08:00:00Z', [[5, 32.5], [5, 32.5], [5, 32.5], [5, 30], [5, 30], [5, 25], [6, 22.5]])
  const today = workout('b', '2026-10-08T08:00:00Z', [[5, 32.5], [5, 32.5], [5, 32.5], [5, 30], [5, 30], [5, 27.5], [6, 25]])
  const [analysis] = analyzeWorkoutProgression(today, [today, last])

  test('Backend: Wiederholungen in KEINEM Satz verändert, Gewicht nur in Satz 6 und 7 (+2,5)', () => {
    assert.deepEqual(resolveRepsSetChanges(analysis.setsComparison), [])
    const weight = resolveSatzgenauWeightChange(analysis.setsComparison, 0)
    assert.equal(weight.scope, 'partial')
    assert.deepEqual(weight.setNumbers, [6, 7])
    assert.equal(weight.weightChangeKg, 2.5)
  })

  test('resolveRepsSetChanges nennt genau die Sätze mit Änderung, neue Sätze zählen nicht', () => {
    const changes = resolveRepsSetChanges([
      { set_number: 1, reps_change: 1, is_new_set: false },
      { set_number: 2, reps_change: 0, is_new_set: false },
      { set_number: 3, reps_change: -1, is_new_set: false },
      { set_number: 4, current_reps: 5, is_new_set: true }
    ])
    assert.deepEqual(changes, [{ set_number: 1, change: 1 }, { set_number: 3, change: -1 }])
  })

  test('der falsche KI-Satz aus dem Report würde komplett entfernt', () => {
    const wrong = '- Weighted Pull-Up: Gewicht in den letzten beiden Sätzen um 2,5kg gesteigert, Wiederholungen in Satz 7 von 6 auf 5 gesunken - das zeigt, dass du nah an deiner Grenze warst.'
    assert.ok(findFactClaim(wrong, ['Weighted Pull-Up']))
  })

  test('Prompt enthält keine Zahlen/Satzaussagen mehr aus dem Strukturierten Datensatz für die KI-Ausgabe', () => {
    const structured = structureAnalysisForAI([analysis])
    assert.equal(structured.exercises[0].sets_comparison.length, 7)
  })
})

describe('Prompt: FAKTEN-REGEL steht drin, alte Satz-Anweisungen sind weg', () => {
  const prompt = getCoachSystemPromptText()

  test('FAKTEN-REGEL ganz oben, mit Verbotsliste', () => {
    assert.ok(prompt.includes('FAKTEN-REGEL (höchste Priorität'))
    assert.ok(prompt.indexOf('FAKTEN-REGEL') < prompt.indexOf('KRITISCHE REGELN'))
    for (const word of ['KEINE Ziffern', 'Satznummern', 'Wiederholung(en)', 'gleich']) {
      assert.ok(prompt.includes(word), `fehlt: ${word}`)
    }
  })

  test('die frühere Anweisung, satzgenaue Zahlen zu nennen, ist entfernt', () => {
    assert.ok(!prompt.includes('Nenne Gewichts-/Wiederholungsänderungen ausschließlich anhand der Sätze-Liste'))
    assert.ok(!prompt.includes('im\n     zweiten Satz 2,5kg mehr'))
    assert.ok(!prompt.includes('Gewicht rauf, Wiederholungen stabil'))
    assert.ok(!prompt.includes('4 von 5'))
  })

  test('Körpergewicht schreibt die App (feste Zeile), nicht die KI', () => {
    assert.ok(prompt.includes('die App ergänzt dazu selbst eine'))
    assert.ok(!prompt.includes('Nenne beide Fakten NEBENEINANDER'))
  })
})

describe('buildBodyweightFactLine', () => {
  const correlation = {
    current_bodyweight_kg: 82.5,
    previous_bodyweight_kg: 80.5,
    bodyweight_change_kg: 2,
    period_days: 6,
    strength_context: { exercises_compared: 5, exercises_with_weight_increase: 3, exercises_with_weight_decrease: 0, exercises_stable: 2 }
  }

  test('Deutsch: nur Fakten, keine Wertung', () => {
    assert.equal(
      buildBodyweightFactLine(correlation, 'de'),
      'Körpergewicht: +2 kg in 6 Tagen (jetzt 82,5 kg). Trainingsgewicht in dieser Session, 5 verglichene Übungen: gestiegen bei 3, gesunken bei 0, gleich bei 2.'
    )
  })

  test('Englisch', () => {
    assert.equal(
      buildBodyweightFactLine(correlation, 'en'),
      'Bodyweight: +2 kg in 6 days (now 82.5 kg). Training weight this session, 5 compared exercises: up in 3, down in 0, unchanged in 2.'
    )
  })

  test('negative Änderung, ein Tag, keine verglichenen Übungen', () => {
    const line = buildBodyweightFactLine({ ...correlation, bodyweight_change_kg: -1.5, period_days: 1, strength_context: { exercises_compared: 0 } }, 'de')
    assert.equal(line, 'Körpergewicht: −1,5 kg in 1 Tag (jetzt 82,5 kg).')
  })

  test('ohne Daten keine Zeile', () => {
    assert.equal(buildBodyweightFactLine(null, 'de'), null)
    assert.equal(buildBodyweightFactLine({}, 'de'), null)
  })
})
