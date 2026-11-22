import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildNextSessionFocus, buildProgressionStates, HOLD_AFTER_LAST_SET_ANSWERS, STRONG_DROP_RATIO, stripAiFocusLines, applyNextSessionFocus, __setFocusCatalogForTests } from '../nextSessionFocus.js'

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
      language: 'de',
      // Dasselbe Schema mit demselben Gewicht schon in der Session davor geschafft -> jetzt steigern.
      history: [{ goal: 'strength', exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 5, 5, 5], 100) }] }]
    })
    assert.equal(focus.kind, 'increase')
    assert.equal(focus.text, 'Nächstes Mal – Barbell High Bar Squat: 102,5 kg probieren.')
  })

  test('Kraft-Schema zum ersten Mal geschafft: festigen statt steigern (DE/EN)', () => {
    const workout = { goal: 'strength', exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 5, 5, 5], 100) }] }
    const de = buildNextSessionFocus({ workout, language: 'de' })
    assert.equal(de.kind, 'confirm')
    assert.equal(de.text, 'Nächstes Mal – Barbell High Bar Squat: 5×5 mit 100 kg noch einmal bestätigen, dann mehr Gewicht.')
    const en = buildNextSessionFocus({ workout, language: 'en' })
    assert.equal(en.text, 'Next time – Barbell High Bar Squat: confirm 5×5 at 100 kg once more, then add weight.')
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
    assert.equal(focus.text, 'Nächstes Mal – Barbell High Bar Squat: gleiches Gewicht (100 kg), diesmal fehlte nur 1 Wiederholung. Ziel: 5 Wdh. in jedem Satz – schaffst du das, ist danach mehr Gewicht dran.')
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

// Fund Jimmy 17.11.: 75 kg -> 40 kg bei der Wadenpresse, trotzdem "42,5 kg probieren".
describe('starker Einbruch gegenüber dem letzten Mal (mindestens 20 %)', () => {
  const calf = (weight) => ({ name: 'Beinbeuger liegend', setDetails: sets([10, 10, 10], weight) })
  const history = (weight) => [{ goal: 'hypertrophy', exercises: [calf(weight)] }]
  const focus = (nowWeight, lastWeight, extra = {}) => buildNextSessionFocus({
    workout: { goal: 'hypertrophy', exercises: [{ ...calf(nowWeight), ...(extra.exercise || {}) }] },
    language: 'de',
    history: history(lastWeight),
    athleteAnswers: extra.answers || new Map()
  })

  test('Schwelle ist 20 %', () => {
    assert.equal(STRONG_DROP_RATIO, 0.2)
  })

  test('ohne Grund: kein Steigern auf dem reduzierten Gewicht, Hinweis auf das frühere Gewicht', () => {
    const f = focus(40, 75)
    assert.equal(f.kind, 'restore')
    assert.match(f.text, /Letztes Mal waren es 75 kg, heute 40 kg/)
    assert.match(f.text, /starte wieder bei 75 kg/)
    assert.doesNotMatch(f.text, /probieren/)
  })

  test('genau 20 % zählt, knapp darunter nicht', () => {
    assert.equal(focus(80, 100).kind, 'restore')
    assert.notEqual(focus(81, 100)?.kind, 'restore')
  })

  test('Gegenprobe: normales Training (kleine Änderung) bleibt unverändert', () => {
    for (const now of [100, 95, 90]) {
      const f = focus(now, 100)
      assert.ok(!f || !['restore', 'rebuild'].includes(f.kind), `nicht bei ${now} kg`)
    }
  })

  test('Gegenprobe: mehr Gewicht als beim letzten Mal ist kein Einbruch', () => {
    const f = focus(100, 60)
    assert.ok(!f || !['restore', 'rebuild'].includes(f.kind))
  })

  test('Gegenprobe: ohne frühere Einheit kein Einbruch', () => {
    const f = buildNextSessionFocus({ workout: { goal: 'hypertrophy', exercises: [calf(40)] }, language: 'de', history: [] })
    assert.ok(!f || !['restore', 'rebuild'].includes(f.kind))
  })

  test('mit Antwort "Absicht" (bewusst) oder "musste anpassen": nicht zurückdrängen, gleiches Gewicht, dann schrittweise', () => {
    for (const answer of ['intended', 'adjusted']) {
      const f = focus(40, 75, { answers: new Map([[0, { topic: 'intent', answer }]]) })
      assert.equal(f.kind, 'rebuild')
      assert.match(f.text, /gleiches Gewicht \(40 kg\), dann Schritt für Schritt wieder steigern/)
      assert.doesNotMatch(f.text, /75 kg/)
    }
  })

  test('Notiz an der Übung zählt wie eine bewusste Entscheidung', () => {
    const f = focus(40, 75, { exercise: { note: 'Knie schonen' } })
    assert.equal(f.kind, 'rebuild')
  })

  test('Gegenprobe: "weiß nicht" ist kein Grund, ebenso eine leere Notiz oder eine Antwort zu einem anderen Thema', () => {
    assert.equal(focus(40, 75, { answers: new Map([[0, { topic: 'intent', answer: 'unsure' }]]) }).kind, 'restore')
    assert.equal(focus(40, 75, { exercise: { note: '   ' } }).kind, 'restore')
    assert.equal(focus(40, 75, { answers: new Map([[0, { topic: 'compare', answer: 'same' }]]) }).kind, 'restore')
  })

  test('Antwort einer anderen Übung gilt nicht für diese', () => {
    assert.equal(focus(40, 75, { answers: new Map([[1, { topic: 'intent', answer: 'intended' }]]) }).kind, 'restore')
  })

  test('englischer Text', () => {
    const f = buildNextSessionFocus({ workout: { goal: 'hypertrophy', exercises: [calf(40)] }, language: 'en', history: history(75) })
    assert.match(f.text, /last time it was 75 kg, today 40 kg/)
  })

  // Muskelaufbau-Workout: Kniebeugen auf 12/12/12 wie beim letzten Mal (steigern), die Wadenübung mit starkem Einbruch.
  const squat12 = (weight) => ({ name: 'Kniebeugen mit der Langhantel', setDetails: sets([12, 12, 12], weight) })
  const withDrop = (extra = {}) => buildNextSessionFocus({
    workout: { goal: 'hypertrophy', exercises: [squat12(100), { ...calf(40), ...extra }] },
    language: 'de',
    history: [{ goal: 'hypertrophy', exercises: [squat12(100), calf(75)] }]
  })

  test('der Einbruch hat Vorrang vor dem Steigern einer anderen Übung', () => {
    assert.equal(withDrop().kind, 'restore')
  })

  test('KI-Zustand: strong_drop statt ready_to_increase; ohne Einbruch weiter ready_to_increase', () => {
    const states = buildProgressionStates({ workout: { goal: 'hypertrophy', exercises: [calf(40)] }, history: history(75) })
    assert.equal(states.get('beinbeuger liegend'), 'strong_drop')
    const normal = buildProgressionStates({ workout: { goal: 'hypertrophy', exercises: [calf(100)] }, history: history(100) })
    assert.notEqual(normal.get('beinbeuger liegend'), 'strong_drop')
  })

  test('KI-Zustand auch mit Absicht-Antwort strong_drop (die Antwort wird über Regel 33 aufgegriffen)', () => {
    const states = buildProgressionStates({ workout: { goal: 'hypertrophy', exercises: [calf(40)] }, history: history(75), athleteAnswers: new Map([[0, { topic: 'intent', answer: 'intended' }]]) })
    assert.equal(states.get('beinbeuger liegend'), 'strong_drop')
  })

  test('Technik-Übung und Übung ohne Last: kein Hinweis auf frühere Gewichte', () => {
    const technique = buildNextSessionFocus({
      workout: { goal: 'technique', exercises: [calf(40)] }, language: 'de',
      history: [{ goal: 'technique', exercises: [calf(75)] }]
    })
    assert.ok(!technique || !['restore', 'rebuild'].includes(technique.kind))
    const timed = buildNextSessionFocus({
      workout: { goal: 'hypertrophy', exercises: [{ ...calf(40), measureMode: 'time' }] }, language: 'de', history: history(75)
    })
    assert.ok(!timed || !['restore', 'rebuild'].includes(timed.kind))
    const states = buildProgressionStates({ workout: { goal: 'technique', exercises: [calf(40)] }, history: [{ goal: 'technique', exercises: [calf(75)] }] })
    assert.notEqual(states.get('beinbeuger liegend'), 'strong_drop')
  })

  test('passende Einheit steht hinter mehreren Einheiten anderer Trainingsart: Einbruch wird trotzdem erkannt', () => {
    const other = (w) => ({ goal: 'strength', exercises: [calf(w)] })
    const f = buildNextSessionFocus({
      workout: { goal: 'hypertrophy', exercises: [calf(40)] }, language: 'de',
      history: [other(80), other(80), other(80), other(80), other(80), { goal: 'hypertrophy', exercises: [calf(75)] }]
    })
    assert.equal(f.kind, 'restore')
    assert.match(f.text, /Letztes Mal waren es 75 kg/)
  })

  test('auch mit Grund (rebuild) hat der Einbruch Vorrang vor dem Steigern einer anderen Übung', () => {
    assert.equal(withDrop({ note: 'Knie schonen' }).kind, 'rebuild')
  })

  test('Gegenprobe: ohne Einbruch steigert die andere Übung wie bisher', () => {
    const f = buildNextSessionFocus({
      workout: { goal: 'hypertrophy', exercises: [squat12(100), calf(70)] },
      language: 'de',
      history: [{ goal: 'hypertrophy', exercises: [squat12(100), calf(75)] }]
    })
    assert.equal(f.kind, 'increase')
  })
})

// F16 Etappe 5b: Antwort "Am Limit" beim letzten Satz -> Gewicht halten statt steigern/bestätigen (nie weniger Gewicht).
describe('Antwort zum letzten Satz steuert "Nächstes Mal"', () => {
  const squat = (weight) => ({ name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 5, 5, 5], weight) })
  const strengthHistory = [{ goal: 'strength', exercises: [squat(100)] }]
  const answer = (value, topic = 'last_set') => new Map([[0, { topic, answer: value }]])
  const run = (workoutExercises, extra = {}) => buildNextSessionFocus({
    workout: { goal: 'strength', exercises: workoutExercises }, language: 'de', history: extra.history ?? strengthHistory, athleteAnswers: extra.answers || new Map()
  })

  test('Liste stimmt mit dem Workout-Kasten (gemeinsame Engine) überein', async () => {
    const { getProgressionEngine } = await import('../nextSessionFocus.js')
    assert.deepEqual([...HOLD_AFTER_LAST_SET_ANSWERS], [...getProgressionEngine().HOLD_AFTER_LAST_SET_ANSWERS])
  })

  test('Konstante: nur "am Limit" (sauber oder wackelig) hält das Gewicht', () => {
    assert.deepEqual([...HOLD_AFTER_LAST_SET_ANSWERS].sort(), ['limit_clean', 'limit_shaky'])
  })

  test('ohne Antwort: steigern (Ausgangslage)', () => {
    assert.equal(run([squat(100)]).kind, 'increase')
  })

  test('am Limit (sauber und wackelig): Steigern wird zum Halten, mit bisherigem Text und Gewicht', () => {
    for (const value of ['limit_clean', 'limit_shaky']) {
      const f = run([squat(100)], { answers: answer(value) })
      assert.equal(f.kind, 'hold', value)
      assert.equal(f.text, 'Nächstes Mal – Barbell High Bar Squat: gleiches Gewicht (100 kg). Ziel: 5 Wdh. in jedem Satz.')
    }
  })

  test('am Limit beim ersten Schaffen (Bestätigen): ebenfalls Halten', () => {
    const f = run([squat(100)], { history: [], answers: answer('limit_clean') })
    assert.equal(f.kind, 'hold')
    assert.equal(run([squat(100)], { history: [] }).kind, 'confirm')
  })

  test('Gegenprobe: "leicht" und "anstrengend, aber noch Luft" ändern nichts', () => {
    for (const value of ['easy', 'hard_air']) assert.equal(run([squat(100)], { answers: answer(value) }).kind, 'increase', value)
  })

  test('Gegenprobe: Antwort eines anderen Themas (Vergleich, Absicht) hält das Gewicht nicht', () => {
    assert.equal(run([squat(100)], { answers: answer('shakier', 'compare') }).kind, 'increase')
    assert.equal(run([squat(100)], { answers: answer('intended', 'intent') }).kind, 'increase')
  })

  test('Gegenprobe: die Antwort gilt nur für ihre Übung (Position im Workout)', () => {
    const other = { name: 'Beinbeuger liegend', setDetails: sets([12, 12, 12], 40) }
    const f = run([squat(100), other], { answers: new Map([[1, { topic: 'last_set', answer: 'limit_clean' }]]) })
    // Antwort gehört zur zweiten Übung: die Kniebeuge steigert weiter
    assert.equal(f.kind, 'increase')
    assert.equal(f.exercise, 'Barbell High Bar Squat')
  })

  test('Gegenprobe: starker Einbruch bleibt starker Einbruch (restore), Halten ersetzt ihn nicht', () => {
    const f = run([squat(70)], { answers: answer('limit_clean') })
    assert.equal(f.kind, 'restore')
  })

  test('Gegenprobe: knapp dran (close) und Aufbau (climb) bleiben unverändert', () => {
    const close = { name: 'Kniebeugen mit der Langhantel', setDetails: sets([5, 5, 5, 5, 4], 100) }
    assert.equal(run([close], { answers: answer('limit_clean') }).kind, 'close')
  })

  test('KI-Zustand bleibt Erfolg (nicht hold_weight = "Ziel nicht erreicht"), auch wenn die Zeile Halten sagt', () => {
    const workout = { goal: 'strength', exercises: [squat(100)] }
    const key = 'kniebeugen mit der langhantel'
    assert.equal(buildProgressionStates({ workout, history: strengthHistory }).get(key), 'ready_to_increase')
    assert.equal(buildProgressionStates({ workout, history: strengthHistory, athleteAnswers: answer('limit_shaky') }).get(key), 'ready_to_increase')
    // erstes Schaffen (Bestätigen): bleibt confirm_once_more
    assert.equal(buildProgressionStates({ workout, history: [], athleteAnswers: answer('limit_clean') }).get(key), 'confirm_once_more')
    assert.equal(buildProgressionStates({ workout, history: strengthHistory, athleteAnswers: answer('easy') }).get(key), 'ready_to_increase')
  })

  test('Muskelaufbau (Bereich): oberes Ende in allen Sätzen + am Limit -> Halten mit Ziel = oberes Ende', () => {
    const curl = { name: 'Beinbeuger liegend', setDetails: sets([12, 12, 12], 40) }
    const f = buildNextSessionFocus({ workout: { goal: 'hypertrophy', exercises: [curl] }, language: 'de', history: [], athleteAnswers: answer('limit_clean') })
    assert.equal(f.kind, 'hold')
    assert.match(f.text, /gleiches Gewicht \(40 kg\)\. Ziel: 12 Wdh\./)
    assert.equal(buildNextSessionFocus({ workout: { goal: 'hypertrophy', exercises: [curl] }, language: 'de', history: [] }).kind, 'increase')
  })

  test('Auswahl: die beantwortete Übung behält ihren Rang und verliert nicht gegen eine andere Übung (Steigern vs. Halten)', () => {
    const other = { name: 'Beinbeuger liegend', setDetails: sets([12, 12, 12], 40) }
    const exercises = [squat(100), other]
    assert.equal(run(exercises).kind, 'increase')
    // Antwort bei der ersten Übung: bliebe Rang 7 (Halten), würde die zweite Übung (Steigern, Rang 1) gewinnen und die
    // Zeile nie Halten zeigen. Mit dem ursprünglichen Rang gewinnt die Kniebeuge und wird als Halten gezeigt.
    const f = run(exercises, { answers: answer('limit_clean') })
    assert.equal(f.exercise, 'Barbell High Bar Squat')
    assert.equal(f.kind, 'hold')
  })

  test('Gegenprobe: eine echte höhere Priorität (Rückbau nach starkem Einbruch) schlägt weiter das Halten', () => {
    const drop = { name: 'Beinbeuger liegend', setDetails: sets([10, 10, 10], 40) }
    const f = run([squat(100), drop], {
      history: [{ goal: 'strength', exercises: [squat(100), { ...drop, setDetails: sets([10, 10, 10], 75) }] }],
      answers: answer('limit_clean')
    })
    assert.equal(f.kind, 'restore')
  })

  test('EN-Text: gleicher Hinweis zum Halten', () => {
    const f = buildNextSessionFocus({ workout: { goal: 'strength', exercises: [squat(100)] }, language: 'en', history: strengthHistory, athleteAnswers: answer('limit_clean') })
    assert.equal(f.text, 'Next time – Barbell High Bar Squat: same weight (100 kg). Goal: 5 reps in every set.')
  })
})
