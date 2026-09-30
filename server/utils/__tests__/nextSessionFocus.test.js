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

  test('Kraft: knapp dran vor Halten', () => {
    const focus = buildNextSessionFocus({
      workout: {
        goal: 'strength',
        exercises: [
          { name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 5, 5, 4], 100) }
        ]
      }
    })
    assert.equal(focus.kind, 'close')
    assert.equal(focus.text, 'Nächstes Mal – Barbell High Bar Squat: gleiches Gewicht (100 kg), diesmal fehlte nur 1 Wiederholung. Ziel: 5 Wdh. in jedem Satz.')
  })

  test('Muskelaufbau 8-12: eine Wiederholung mehr', () => {
    const focus = buildNextSessionFocus({
      workout: { goal: 'hypertrophy', exercises: [{ name: 'Beinbeuger liegend', setDetails: sets([12, 12, 11], 40) }] }
    })
    assert.equal(focus.kind, 'climb')
    assert.equal(focus.text, 'Nächstes Mal – Lever Lying Leg Curl: 12 Wdh. pro Satz mit 40 kg versuchen. Bei 12 in allen Sätzen gibt es mehr Gewicht.')
  })

  test('Singles: erst bestätigen, nach zweimal steigern', () => {
    const workout = { goal: 'strength', exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets([1, 1, 1, 1, 1, 1], 140) }] }
    assert.equal(buildNextSessionFocus({ workout }).kind, 'confirm')
    const history = [{ exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets([1, 1, 1, 1, 1, 1], 140) }] }]
    assert.equal(buildNextSessionFocus({ workout, history }).kind, 'increase')
  })

  test('3 Einheiten dasselbe Gewicht ohne Steigerung -> nur Hinweis, keine Senkung', () => {
    const squat = (reps) => ({ exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets(reps, 100) }] })
    const focus = buildNextSessionFocus({
      workout: { goal: 'strength', exercises: squat([5, 5, 4, 4, 3]).exercises },
      history: [squat([5, 5, 5, 4, 4]), squat([5, 5, 4, 4, 4])]
    })
    assert.equal(focus.kind, 'plateau')
    assert.equal(focus.text, 'Hinweis – Barbell High Bar Squat: seit 3 Einheiten bei 100 kg. Ein kleinerer Steigerungsschritt oder etwas längere Pausen können helfen.')
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

describe('Trainingsart je Übung', () => {
  test('Kraft-Workout: Hack Calf Raise auf Muskelaufbau -> Ziel 12; Trap Bar Jumps -> explosiv', () => {
    const focus = buildNextSessionFocus({
      workout: {
        goal: 'strength',
        exercises: [
          { name: 'Hack Calf Raise', trainingType: 'hypertrophy', setDetails: sets([12, 12, 11], 120) }
        ]
      }
    })
    assert.equal(focus.kind, 'climb')
    assert.match(focus.text, /Bei 12 in allen Sätzen/)

    const jumps = buildNextSessionFocus({
      workout: { goal: 'strength', exercises: [{ name: 'Trap Bar Jumps', setDetails: sets([3, 3, 3], 30) }] }
    })
    assert.equal(jumps.kind, 'speed')
  })

  test('eigene Wahl schlägt Automatik: Jumps bewusst auf Kraft gestellt', () => {
    const focus = buildNextSessionFocus({
      workout: { goal: 'strength', exercises: [{ name: 'Trap Bar Jumps', trainingType: 'strength', setDetails: sets([5, 5, 5], 30) }] }
    })
    assert.notEqual(focus?.kind, 'speed')
  })
})

describe('Trainingsart-passende Historie und Übergang 7', () => {
  test('Muskelaufbau unter 8 Wdh. -> nur Hinweis "eher zu schwer"', () => {
    const focus = buildNextSessionFocus({
      workout: { goal: 'hypertrophy', exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets([7, 7, 6], 100) }] }
    })
    assert.equal(focus.kind, 'below')
    assert.match(focus.text, /unter 8 Wdh\. ist 100 kg für Muskelaufbau eher zu schwer/)
  })

  test('Plateau zählt nur Sessions derselben Trainingsart', () => {
    const squat = (reps, goal) => ({ goal, exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets(reps, 100) }] })
    const focus = buildNextSessionFocus({
      workout: { goal: 'strength', exercises: squat([5, 5, 4, 4, 3]).exercises },
      history: [squat([10, 10, 10], 'hypertrophy'), squat([5, 5, 4, 4, 4], 'strength')]
    })
    assert.notEqual(focus.kind, 'plateau')
  })
})
