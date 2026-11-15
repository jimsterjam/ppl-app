import { describe, it, expect } from 'vitest'
import { planQuestions } from '../postWorkoutQuestionsPlan.js'
import { buildQuestionInput } from '../postWorkoutQuestionsInput.js'

const bench = { name: 'Bankdrücken', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
const catalog = [{ name: 'Bankdrücken', name_en: 'barbell bench press', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }]

const sets = (weight, repsList) => repsList.map((reps) => ({ weight, reps, done: true }))
const workout = (id, date, weight, repsList, extra = {}) => ({
  _id: id, date, completed: true, goal: 'hypertrophy', ...extra,
  exercises: [{ name: bench.name, setDetails: sets(weight, repsList) }]
})
const last = workout('w0', '2026-11-08T10:00:00Z', 80, [10, 10, 10])
// Heute 60 kg statt 80 kg (deutlich weniger): A "Absicht"
const today = workout('w1', '2026-11-15T10:00:00Z', 60, [10, 10, 10])

const base = {
  enabled: true, consentGranted: true, quotaExhausted: false, workout: today, history: [last, today], catalog,
  currentIds: ['w1'], offerTurnOff: false, introSeen: true
}

describe('planQuestions: wann gefragt wird', () => {
  it('fragt bei einem auffälligen Workout (Gewicht deutlich niedriger)', () => {
    const plan = planQuestions(base)
    expect(plan.topics).toHaveLength(1)
    expect(plan.topics[0]).toMatchObject({ topic: 'intent', kind: 'weight_drop', exerciseIndex: 0 })
    expect(plan.phase).toBe('ask')
  })

  it('Phase: Erklärung beim ersten Mal, Angebot zum Ausschalten hat Vorrang', () => {
    expect(planQuestions({ ...base, introSeen: false }).phase).toBe('intro')
    expect(planQuestions({ ...base, introSeen: false, offerTurnOff: true }).phase).toBe('offer')
  })

  it('vergleicht das Workout nicht mit sich selbst (auch unter anderer ID)', () => {
    const input = buildQuestionInput({ workout: today, history: [last, { ...today, _id: 'real-1', id: 'draft-1' }], catalog, currentIds: ['draft-1', 'real-1'] })
    expect(input.exercises[0].recent).toHaveLength(1)
    expect(input.exercises[0].recent[0].setDetails[0].weight).toBe(80)
  })
})

describe('planQuestions: Gegenproben - keine Fragen ohne Feedback', () => {
  it.each([
    ['Schalter aus', { enabled: false }],
    ['keine KI-Einwilligung', { consentGranted: false }],
    ['KI-Kontingent leer', { quotaExhausted: true }],
    ['nachträglich bearbeitet (keine automatische Auswertung)', { edited: true }],
    ['Workout nicht gefunden', { workout: null }]
  ])('%s -> keine Fragen', (_label, override) => {
    expect(planQuestions({ ...base, ...override })).toBeNull()
  })

  it('nichts Auffälliges -> keine Fragen', () => {
    const better = workout('w1', '2026-11-15T10:00:00Z', 82.5, [10, 10, 10])
    expect(planQuestions({ ...base, workout: better, history: [last, better] })).toBeNull()
  })

  it('Workout ohne Verlauf und ohne ausgelassene Übung -> keine Fragen', () => {
    expect(planQuestions({ ...base, history: [today] })).toBeNull()
  })

  it('leere Eingabe wirft nicht', () => {
    expect(planQuestions()).toBeNull()
  })
})

describe('buildQuestionInput', () => {
  it('wirksame Trainingsart: eigene Wahl an der Übung vor dem Workout-Ziel', () => {
    const w = { ...today, goal: 'strength', exercises: [{ ...today.exercises[0], trainingType: 'hypertrophy' }] }
    expect(buildQuestionInput({ workout: w, history: [last], catalog }).exercises[0].goal).toBe('hypertrophy')
    expect(buildQuestionInput({ workout: { ...w, exercises: [{ ...w.exercises[0], trainingType: undefined }] }, history: [last], catalog }).exercises[0].goal).toBe('strength')
  })

  it('Workout ohne Ziel: zuletzt gewähltes Ziel, sonst Muskelaufbau', () => {
    const noGoal = { ...today, goal: undefined }
    expect(buildQuestionInput({ workout: noGoal, fallbackGoal: 'strength' }).workoutGoal).toBe('strength')
    expect(buildQuestionInput({ workout: noGoal }).workoutGoal).toBe('hypertrophy')
  })
})
