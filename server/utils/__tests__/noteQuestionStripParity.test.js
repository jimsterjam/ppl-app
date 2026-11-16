import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isQuestionSentence as serverIsQuestion, QUESTION_CUES, extractNoteQuestions } from '../noteQuestions.js'
import { isQuestionToRemove, stripQuestionsFromNote } from '../../../client/src/utils/noteQuestionStrip.js'

// Die App löscht Fragen aus Notizen von Favoriten. Damit nichts verloren geht, was der Server nicht auch als Frage kennt,
// muss alles, was die App entfernt, vom Server als Frage erkannt werden (die App ist strenger, nie weiter).
const SAMPLES = [
  'Schulter tat weh', 'Knie vorsichtig.', 'Pause 3 Minuten.', 'Ist das normal?', 'Warum fällt mir das schwer?',
  'Ich weiß nicht warum es klappt.', 'Kann es sein, dass ich zu schwer trainiere', 'Soll ich steigern', 'Wieso?', 'Nächstes Mal sollte ich langsamer.',
  'Could it be the rest time', 'Keep elbows tucked.', 'Why is this hard', 'Weshalb nur', 'Ob das am Schlaf liegt.', 'Schauen, ob die Hüfte mitmacht.',
  ...QUESTION_CUES.map((cue) => `${cue} so`),
  ...QUESTION_CUES.map((cue) => `Heute ${cue} so`)
]

test('was die App aus einer Favoriten-Notiz entfernt, erkennt der Server auch als Frage', () => {
  for (const sample of SAMPLES) {
    if (isQuestionToRemove(sample)) assert.equal(serverIsQuestion(sample), true, `Server erkennt nicht: "${sample}"`)
  }
})

test('jede Fragewendung der Server-Liste am Satzanfang wird von der App entfernt', () => {
  for (const cue of QUESTION_CUES) {
    assert.equal(stripQuestionsFromNote(`${cue} so`), '', `nicht entfernt: ${cue}`)
  }
})

test('nach dem Entfernen findet der Server in der Notiz keine Frage mehr (Fall mit Fragezeichen)', () => {
  const note = 'Kann es sein, dass die Schulter müde ist? Knie vorsichtig. Warum fällt das schwer?'
  assert.ok(extractNoteQuestions({ exerciseNotes: [{ exercise: 'Bench Press', note }] }).length > 0)
  const stripped = stripQuestionsFromNote(note)
  assert.equal(stripped, 'Knie vorsichtig.')
  assert.equal(extractNoteQuestions({ exerciseNotes: [{ exercise: 'Bench Press', note: stripped }] }).length, 0)
})
