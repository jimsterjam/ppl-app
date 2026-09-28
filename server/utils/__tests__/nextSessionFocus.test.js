import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildNextSessionFocus, stripAiFocusLines, applyNextSessionFocus, __setFocusCatalogForTests } from '../nextSessionFocus.js'

__setFocusCatalogForTests([
  { name: 'Kniebeugen mit der Langhantel', name_en: 'barbell high bar squat', category: 'Legs', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } },
  { name: 'Beinbeuger liegend', name_en: 'lever lying leg curl', category: 'Legs', equipment: 'Maschine', aiMetadata: { exerciseType: 'isolation' } },
  { name: 'Speed Kniebeugen', name_en: 'barbell speed squat', category: 'Legs', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
])

const sets = (reps, weight) => reps.map((r) => ({ reps: r, weight, done: true }))

describe('buildNextSessionFocus', () => {
  test('Steigern hat Vorrang: nennt das vorgeschlagene Gewicht (DE)', () => {
    const focus = buildNextSessionFocus({
      workout: {
        goal: 'strength',
        exercises: [
          { name: 'Speed Kniebeugen', setDetails: sets([3, 3, 3], 60) },
          { name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 5, 5, 5], 100) }
        ]
      },
      language: 'de'
    })
    assert.equal(focus.kind, 'increase')
    assert.equal(focus.text, 'Nächstes Mal – Barbell High Bar Squat: 102,5 kg probieren. Schaffst du nicht alle Wiederholungen, bleib dabei, bis es klappt.')
  })

  test('ohne Steigerung: Speed-Übung mit Gewicht -> Tempo als Maßstab (EN)', () => {
    const focus = buildNextSessionFocus({
      workout: {
        goal: 'strength',
        exercises: [
          { name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 4, 4, 3], 100) },
          { name: 'Speed Kniebeugen', setDetails: sets([3, 3, 3], 60) }
        ]
      },
      language: 'en'
    })
    assert.equal(focus.kind, 'speed')
    assert.equal(focus.text, 'Next time – Barbell Speed Squat: if every rep stays fast, add a little weight. If you slow down noticeably on the last reps, keep the weight.')
  })

  test('Knapp dran vor Halten', () => {
    const focus = buildNextSessionFocus({
      workout: {
        goal: 'hypertrophy',
        exercises: [
          { name: 'Kniebeugen mit der Langhantel', setDetails: sets([10, 8, 7], 80) },
          { name: 'Beinbeuger liegend', setDetails: sets([12, 12, 11], 40) }
        ]
      }
    })
    assert.equal(focus.kind, 'close')
    assert.equal(focus.text, 'Nächstes Mal – Lever Lying Leg Curl: gleiches Gewicht (40 kg), diesmal fehlte nur 1 Wiederholung. Ziel: 12 Wdh. in jedem Satz.')
  })

  test('Pyramide / Körpergewicht-Speed-Übung / nichts Passendes -> keine Zeile', () => {
    const focus = buildNextSessionFocus({
      workout: {
        goal: 'hypertrophy',
        exercises: [
          { name: 'Hack Calf Raise', setDetails: [128, 168, 198].map((weight) => ({ reps: 12, weight, done: true })) },
          { name: 'Airflare Power Start', setDetails: sets([5, 5], 0) }
        ]
      }
    })
    assert.equal(focus, null)
  })
})

describe('stripAiFocusLines / applyNextSessionFocus', () => {
  const ai = 'Guter Trainingstag 💪\n- Squat: Gewicht rauf - läuft.\n\nFokus für die nächste Einheit: Überlege, wie du das Gewicht anpasst.'

  test('entfernt KI-Fokus-Zeilen, Übungszeilen bleiben', () => {
    assert.equal(stripAiFocusLines(ai), 'Guter Trainingstag 💪\n- Squat: Gewicht rauf - läuft.')
    assert.equal(stripAiFocusLines('- Squat: nächstes Mal wieder so.'), '- Squat: nächstes Mal wieder so.')
    assert.equal(stripAiFocusLines('Next time: add weight.'), '')
  })

  test('hängt die App-Zeile an, ohne Fokus bleibt nur der bereinigte Text', () => {
    assert.equal(applyNextSessionFocus(ai, { text: 'Nächstes Mal – Squat: 102,5 kg probieren.' }),
      'Guter Trainingstag 💪\n- Squat: Gewicht rauf - läuft.\n\nNächstes Mal – Squat: 102,5 kg probieren.')
    assert.equal(applyNextSessionFocus(ai, null), 'Guter Trainingstag 💪\n- Squat: Gewicht rauf - läuft.')
  })
})
