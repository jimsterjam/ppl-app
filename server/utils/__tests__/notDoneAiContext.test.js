import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isExerciseNotDone, collectNotDoneExercises, structureAnalysisForAI, analyzeWorkoutProgression
} from '../../services/trainingAnalysisService.js'
import OpenAIProvider, { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'

// Absprache Paul 13.10.: Nicht gemachte Übungen bleiben gespeichert; die KI bekommt "nicht gemacht" + Notiz, aber keine Zahlen.
const workout = () => ({
  _id: 'w1',
  date: '2026-10-13',
  completed: true,
  exercises: [
    { name: 'Bench Press', weight: 100, reps: 5, setDetails: [{ reps: 5, weight: 100, done: true }, { reps: 5, weight: 100, done: true }] },
    { name: 'Dips', note: 'Schulter tat weh', setDetails: [{ reps: 10, weight: 0, done: false }, { reps: 10, weight: 0, done: false }] },
    { name: 'Row', weight: 60, reps: 8, setDetails: [{ reps: 8, weight: 60, done: true }] }
  ]
})

test('isExerciseNotDone: nur wenn alle Arbeitssätze done:false; Aufwärmsätze und ältere Daten zählen nicht', () => {
  assert.equal(isExerciseNotDone({ setDetails: [{ reps: 5, weight: 50, done: false }] }), true)
  assert.equal(isExerciseNotDone({ setDetails: [{ reps: 5, weight: 20, isWarmup: true }, { reps: 5, weight: 50, done: false }] }), true)
  assert.equal(isExerciseNotDone({ setDetails: [{ reps: 5, weight: 50, done: false }, { reps: 5, weight: 50, done: true }] }), false)
  assert.equal(isExerciseNotDone({ setDetails: [{ reps: 5, weight: 50 }] }), false)
  assert.equal(isExerciseNotDone({ setDetails: [] }), false)
})

test('collectNotDoneExercises: Name, Position und Notiz, ohne Zahlen', () => {
  const list = collectNotDoneExercises(workout())
  assert.equal(list.length, 1)
  assert.equal(list[0].exercise, 'Dips')
  assert.equal(list[0].workoutIndex, 1)
  assert.equal(list[0].note, 'Schulter tat weh')
  assert.equal(list[0].noteContext.session, 'Schulter tat weh')
})

test('Analyse lässt die nicht gemachte Übung aus; KI-Eingabe führt sie in Workout-Reihenfolge ohne Zahlen', () => {
  const w = workout()
  const analyses = analyzeWorkoutProgression(w, [w])
  assert.deepEqual(analyses.map(a => a.exercise), ['Bench Press', 'Row'])
  const structured = structureAnalysisForAI(analyses, { notDoneExercises: collectNotDoneExercises(w) })
  assert.deepEqual(structured.exercises.map(e => e.exercise), ['Bench Press', 'Dips', 'Row'])
  assert.equal(structured.total_exercises_analyzed, 2)
  const dips = structured.exercises[1]
  assert.equal(dips.exercise_not_done, true)
  assert.equal(dips.note, 'Schulter tat weh')
  assert.equal('current_weight' in dips, false)
})

test('Ohne nicht gemachte Übungen bleibt die KI-Eingabe unverändert', () => {
  const w = workout()
  w.exercises.splice(1, 1)
  const analyses = analyzeWorkoutProgression(w, [w])
  const structured = structureAnalysisForAI(analyses)
  assert.deepEqual(structured.exercises.map(e => e.exercise), ['Bench Press', 'Row'])
  assert.equal(structured.exercises.some(e => e.exercise_not_done), false)
})

test('Prompt: Regel 28 vorhanden, nicht gemachte Übung steht ohne Zahlen mit Notiz im Datenblock', () => {
  assert.match(getCoachSystemPromptText(), /28\. NICHT GEMACHTE ÜBUNGEN/)
  const w = workout()
  const structured = structureAnalysisForAI(analyzeWorkoutProgression(w, [w]), { notDoneExercises: collectNotDoneExercises(w) })
  const provider = new OpenAIProvider({ apiKey: 'test-key' })
  const prompt = provider.buildPrompt(structured)
  assert.match(prompt, /Dips[\s\S]*NICHT gemacht/)
  assert.match(prompt, /Schulter tat weh/)
})

test('Prüf-KI kennt nicht gemachte Übungen (Hinweis ist ein Fakt, Zahlen dazu ein Verstoß)', async () => {
  const { getVerifierChecklistText } = await import('../../services/feedbackVerificationService.js')
  assert.match(getVerifierChecklistText(), /exercise_not_done: true/)
})
