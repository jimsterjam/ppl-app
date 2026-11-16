import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isQuestionSentence as serverIsQuestion, QUESTION_CUES } from '../noteQuestions.js'
import { isQuestionSentence as clientIsQuestion, stripQuestionsFromNote } from '../../../client/src/utils/noteQuestionStrip.js'

// Die App entfernt Fragen aus Notizen von Favoriten mit derselben Erkennung wie der Server (utils/noteQuestions.js).
test('Fragen-Erkennung in der App und auf dem Server stimmt überein', () => {
  const samples = [
    'Schulter tat weh', 'Knie vorsichtig.', 'Pause 3 Minuten.', 'Ist das normal?', 'Warum fällt mir das schwer',
    'Ich weiß nicht warum es klappt.', 'Kann es sein, dass ich zu schwer trainiere', 'Soll ich steigern', 'Wieso?', '',
    'Could it be the rest time', 'Keep elbows tucked.', 'Why is this hard', 'Weshalb nur', 'Ob das am Schlaf liegt.',
    ...QUESTION_CUES.map((cue) => `Heute ${cue} so`)
  ]
  for (const sample of samples) {
    assert.equal(clientIsQuestion(sample), serverIsQuestion(sample), `Abweichung bei: "${sample}"`)
  }
})

test('jede Wendung der Server-Liste lässt die App die Notiz als Frage erkennen und entfernen', () => {
  for (const cue of QUESTION_CUES) {
    assert.equal(stripQuestionsFromNote(`Heute ${cue} so`), '', `nicht entfernt: ${cue}`)
  }
})
