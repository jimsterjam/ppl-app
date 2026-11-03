import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractNoteQuestions, sanitizeNoteAnswers, sanitizeStoredNoteAnswers, collectAllowedNumbers,
  MAX_NOTE_QUESTIONS, MAX_QUESTION_LENGTH
} from '../noteQuestions.js'

describe('extractNoteQuestions', () => {
  test('erkennt die Beispielfrage aus einer Übungsnotiz (mit Fragezeichen)', () => {
    const q = extractNoteQuestions({ exerciseNotes: [{ exercise: 'Bench Press', note: 'Schulter müde. Kann es sein, dass die Übung davor mich so ermüdet, dass ich hier nicht steigere?' }] })
    assert.equal(q.length, 1)
    assert.equal(q[0].exercise, 'Bench Press')
    assert.equal(q[0].hasQuestionMark, true)
    assert.match(q[0].text, /^Kann es sein/)
  })

  test('erkennt Fragen ohne Fragezeichen an typischen Wendungen', () => {
    const q = extractNoteQuestions({ workoutNote: 'Ich frage mich ob die Reihenfolge schuld ist' })
    assert.equal(q.length, 1)
    assert.equal(q[0].hasQuestionMark, false)
  })

  test('Feststellungen ohne Frage lösen nichts aus', () => {
    assert.deepEqual(extractNoteQuestions({ exerciseNotes: [{ exercise: 'Squat', note: 'Heute müde, Knie leicht gereizt, vorsichtig trainiert.' }] }), [])
    assert.deepEqual(extractNoteQuestions({}), [])
  })

  test('englische Fragen werden erkannt', () => {
    assert.equal(extractNoteQuestions({ workoutNote: 'Could it be that the first exercise tires me out?' }).length, 1)
  })

  test('höchstens zwei Fragen, ohne Duplikate', () => {
    const q = extractNoteQuestions({
      exerciseNotes: [{ exercise: 'A', note: 'Warum stagniere ich? Warum stagniere ich? Soll ich mehr Pause machen? Wieso tut sich nichts?' }]
    })
    assert.equal(q.length, MAX_NOTE_QUESTIONS)
    assert.equal(new Set(q.map((x) => x.text.toLowerCase())).size, q.length)
  })

  test('Zeichen < und > werden entfernt, sehr lange Fragen gekürzt', () => {
    const q = extractNoteQuestions({ workoutNote: `Warum <b>stagniere</b> ich ${'x'.repeat(500)}?` })
    assert.ok(!/[<>]/.test(q[0].text))
    assert.ok(q[0].text.length <= MAX_QUESTION_LENGTH)
  })
})

describe('sanitizeNoteAnswers', () => {
  const questions = [{ id: 1, text: 'Kann es sein, dass die Übung davor ermüdet?', hasQuestionMark: true }, { id: 2, text: 'Wie wird das Wetter?', hasQuestionMark: true }]
  const ctx = { exerciseNames: ['Barbell Squat', 'Bench Press'], allowedNumbers: collectAllowedNumbers({ sets: 4, weight: 90, reps: 5 }) }

  test('Trainingsantwort mit Bezug zu einer Übung wird übernommen', () => {
    const out = sanitizeNoteAnswers([{ id: 1, kind: 'training', answer: 'Das ist möglich: Barbell Squat kommt vor Bench Press und ermüdet. Teste nächstes Mal die andere Reihenfolge.' }], questions, ctx)
    assert.equal(out.length, 1)
    assert.equal(out[0].kind, 'training')
    assert.match(out[0].text, /Barbell Squat/)
  })

  test('Trainingsantwort ohne Bezug zu einer Übung dieses Workouts wird verworfen', () => {
    assert.deepEqual(sanitizeNoteAnswers([{ id: 1, kind: 'training', answer: 'Allgemein kann Ermüdung eine Rolle spielen.' }], questions, ctx), [])
  })

  test('erfundene Zahlen verwerfen die Antwort, Zahlen aus den Daten sind erlaubt', () => {
    const bad = sanitizeNoteAnswers([{ id: 1, kind: 'training', answer: 'Bench Press hatte 777 kg.' }], questions, ctx)
    assert.deepEqual(bad, [])
    const good = sanitizeNoteAnswers([{ id: 1, kind: 'training', answer: 'Bench Press mit 4 Sätzen à 5 Wiederholungen bei 90 kg.' }], questions, ctx)
    assert.equal(good.length, 1)
  })

  test('Arzt-/Therapie-Empfehlung wird nie ausgegeben: die Frage zählt als Gesundheitsfrage (ohne Text)', () => {
    for (const answer of [
      'Bench Press: Bei Schmerzen solltest du zum Arzt gehen.',
      'Barbell Squat: Ein Physiotherapeut kann das prüfen.',
      'Bench Press: Talk to a doctor about it.'
    ]) {
      const out = sanitizeNoteAnswers([{ id: 1, kind: 'training', answer }], questions, ctx)
      assert.deepEqual(out, [{ kind: 'health', text: '' }], answer)
    }
  })

  test('Gesundheits- und Sonstiges-Fragen haben nie einen KI-Text', () => {
    const out = sanitizeNoteAnswers([
      { id: 1, kind: 'health', answer: 'Das ist ein Muskelfaserriss, nimm Ibuprofen.' },
      { id: 2, kind: 'other', answer: 'Morgen wird es sonnig.' }
    ], questions, ctx)
    assert.deepEqual(out, [{ kind: 'health', text: '' }, { kind: 'other', text: '' }])
  })

  test('"Anderes" nur bei einer echten Frage mit Fragezeichen', () => {
    const q = [{ id: 1, text: 'Ich frage mich ob es morgen regnet', hasQuestionMark: false }]
    assert.deepEqual(sanitizeNoteAnswers([{ id: 1, kind: 'other', answer: '' }], q, ctx), [])
  })

  test('unbekannte Art wird zu "other", HTML-Zeichen werden entfernt, fehlende Einträge übersprungen', () => {
    const out = sanitizeNoteAnswers([{ id: 2, kind: 'quatsch', answer: '<script>x</script>' }], questions, ctx)
    assert.deepEqual(out, [{ kind: 'other', text: '' }])
  })

  test('ungültige Eingaben ergeben eine leere Liste', () => {
    assert.deepEqual(sanitizeNoteAnswers(null, questions, ctx), [])
    assert.deepEqual(sanitizeNoteAnswers([], [], ctx), [])
  })
})

describe('sanitizeStoredNoteAnswers (Mongoose-Setter)', () => {
  test('nur bekannte Arten, Text nur bei training, höchstens zwei Einträge', () => {
    const out = sanitizeStoredNoteAnswers([
      { kind: 'training', text: ' Antwort eins ' },
      { kind: 'health', text: 'darf nicht gespeichert werden' },
      { kind: 'other', text: 'x' }
    ])
    assert.deepEqual(out, [{ kind: 'training', text: 'Antwort eins' }, { kind: 'health', text: '' }])
    assert.ok(!/[<>]/.test(sanitizeStoredNoteAnswers([{ kind: 'training', text: 'a <b>c</b>' }])[0].text))
    assert.deepEqual(sanitizeStoredNoteAnswers('x'), [])
    assert.deepEqual(sanitizeStoredNoteAnswers([{ kind: 'training', text: '' }]), [])
  })
})
