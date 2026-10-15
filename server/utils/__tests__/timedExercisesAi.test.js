import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeWorkoutProgression, structureAnalysisForAI, compareTimedExercise, getMeasureMode, calculateExerciseStats } from '../../services/trainingAnalysisService.js'
import OpenAIProvider, { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'
import { calculateExerciseVolume } from '../workoutMetrics.js'

// Absprache Paul 15.10.: Messarten "Zeit halten" und "Wiederholungen in Zeit" - keine kg-Auswertung.
const plank = (secs, date, id) => ({
  _id: id, date, completed: true,
  exercises: [{ name: 'Plank', measureMode: 'time', setDetails: secs.map((s) => ({ durationSeconds: s, done: true })) }]
})
const burpees = (reps, date, id) => ({
  _id: id, date, completed: true,
  exercises: [{ name: 'Burpees', measureMode: 'repsTime', setDetails: reps.map((r) => ({ reps: r, durationSeconds: 30, done: true })) }]
})

test('Messart und Verlauf gegenüber der letzten Session', () => {
  assert.equal(getMeasureMode({ measureMode: 'time' }), 'time')
  assert.equal(getMeasureMode({ measureMode: 'x' }), null)
  assert.equal(compareTimedExercise(plank([45, 45], 'a', 'a').exercises[0], plank([30, 30], 'b', 'b').exercises[0]), 'more')
  assert.equal(compareTimedExercise(plank([20], 'a', 'a').exercises[0], plank([30], 'b', 'b').exercises[0]), 'less')
  assert.equal(compareTimedExercise(burpees([9, 9], 'a', 'a').exercises[0], burpees([9, 9], 'b', 'b').exercises[0]), 'same')
  assert.equal(compareTimedExercise(plank([45], 'a', 'a').exercises[0], null), null)
})

test('Zeit-Übungen zählen nicht in kg-Volumen', () => {
  assert.equal(calculateExerciseVolume(plank([60, 60], 'a', 'a').exercises[0]), 0)
  assert.equal(calculateExerciseVolume(burpees([10], 'a', 'a').exercises[0]), 0)
  assert.ok(calculateExerciseStats(burpees([10], 'a', 'a').exercises[0]).volume === 0)
})

test('KI-Eingabe: measure_mode und time_trend statt kg, Prompt ohne Satzdaten, Regel 30', () => {
  const previous = plank([30, 30], '2026-10-07T10:00:00Z', 'w0')
  const current = plank([45, 45], '2026-10-14T10:00:00Z', 'w1')
  const analyses = analyzeWorkoutProgression(current, [current, previous])
  const structured = structureAnalysisForAI(analyses)
  assert.equal(structured.exercises[0].measure_mode, 'time')
  assert.equal(structured.exercises[0].time_trend, 'more')
  const prompt = new OpenAIProvider({ apiKey: 'test-key' }).buildPrompt(structured)
  assert.match(prompt, /Messart: Zeit halten/)
  assert.match(prompt, /länger gehalten/)
  assert.doesNotMatch(prompt, /Satzdaten|kg ×/)
  assert.match(getCoachSystemPromptText(), /30\. ÜBUNGEN AUF ZEIT/)
})

test('Normale Übung bleibt unverändert (kein measure_mode)', () => {
  const w = { _id: 'w', date: '2026-10-14T10:00:00Z', completed: true, exercises: [{ name: 'Bench', setDetails: [{ reps: 5, weight: 100, done: true }] }] }
  const structured = structureAnalysisForAI(analyzeWorkoutProgression(w, [w]))
  assert.equal('measure_mode' in structured.exercises[0], false)
})
