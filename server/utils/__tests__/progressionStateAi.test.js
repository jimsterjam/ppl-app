import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProgressionStates, buildNextSessionFocus } from '../nextSessionFocus.js'
import { analyzeWorkoutProgression, structureAnalysisForAI } from '../../services/trainingAnalysisService.js'
import OpenAIProvider, { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'
import { getVerifierChecklistText, RULE_LABELS } from '../../services/feedbackVerificationService.js'

// Absprache Paul 14.10.: Mehr Gewicht, vier Sätze à 5 und im fünften nur 4 = "knapp dran" = motivierender Fortschritt,
// nicht "zwar mehr Gewicht, aber eine Wiederholung weniger".
const session = (weight, reps, date, id) => ({
  _id: id, date, completed: true, goal: 'strength',
  exercises: [{ name: 'Bench Press', setDetails: reps.map((r) => ({ reps: r, weight, done: true })) }]
})
const last = session(60, [5, 5, 5, 5, 5], '2026-10-07T10:00:00Z', 'w0')
const current = session(62.5, [5, 5, 5, 5, 4], '2026-10-14T10:00:00Z', 'w1')

test('Fortschrittszustand: 4×5 + 4 mit mehr Gewicht ist "almost_there"', () => {
  const states = buildProgressionStates({ workout: current, history: [last] })
  assert.equal(states.get('bench press'), 'almost_there')
})

test('Alle Sätze geschafft = ready_to_increase, deutlich verfehlt = hold_weight', () => {
  const firstTime = session(62.5, [5, 5, 5, 5, 5], '2026-10-14T10:00:00Z', 'w2')
  assert.equal(buildProgressionStates({ workout: firstTime, history: [last] }).get('bench press'), 'confirm_once_more')
  const earlier = session(62.5, [5, 5, 5, 5, 5], '2026-10-07T10:00:00Z', 'w0b')
  assert.equal(buildProgressionStates({ workout: firstTime, history: [earlier] }).get('bench press'), 'ready_to_increase')
  assert.equal(buildProgressionStates({ workout: session(62.5, [5, 5, 3, 3, 3], '2026-10-14T10:00:00Z', 'w3'), history: [last] }).get('bench press'), 'hold_weight')
})

test('KI-Eingabe und Prompt tragen den Zustand; Regel 29 verbietet "zwar ... aber"', () => {
  const analyses = analyzeWorkoutProgression(current, [current, last])
  const states = buildProgressionStates({ workout: current, history: [last] })
  const structured = structureAnalysisForAI(analyses, { progressionStates: states })
  assert.equal(structured.exercises[0].progression_state, 'almost_there')
  const prompt = new OpenAIProvider({ apiKey: 'test-key' }).buildPrompt(structured)
  assert.match(prompt, /Fortschrittszustand \(App-Logik, verbindlich[^)]*\):\*\* almost_there/)
  const system = getCoachSystemPromptText()
  assert.match(system, /29\. FORTSCHRITT ERKENNEN/)
  assert.match(system, /VERBOTEN ist das Muster "zwar \.\.\., aber \.\.\."/)
})

test('Ohne Zustand bleibt die KI-Eingabe unverändert', () => {
  const analyses = analyzeWorkoutProgression(current, [current, last])
  const structured = structureAnalysisForAI(analyses)
  assert.equal('progression_state' in structured.exercises[0], false)
})

test('"Nächstes Mal"-Zeile bei knapp dran nennt den Plan', () => {
  const focus = buildNextSessionFocus({ workout: current, history: [last] })
  assert.equal(focus.kind, 'close')
  assert.match(focus.text, /schaffst du das, ist danach mehr Gewicht dran/)
  const en = buildNextSessionFocus({ workout: current, history: [last], language: 'en' })
  assert.match(en.text, /more weight is next/)
})

test('Prüf-KI kennt Regel 24', () => {
  assert.match(getVerifierChecklistText(), /24\. Fortschrittszustand/)
  assert.ok(RULE_LABELS[24])
})
