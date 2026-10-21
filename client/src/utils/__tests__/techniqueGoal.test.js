import { describe, it, expect } from 'vitest'
import { EXERCISE_TRAINING_TYPES, sanitizeExerciseTrainingType, resolveExerciseGoal, getRepTarget, getProgressionStatus, progressionModeFor } from '../weightSuggestion.js'
import { buildSaveReview } from '../saveReview.js'
import { restSecondsFor } from '../restTimerRules.js'

// Absprache Paul 16.10.: Trainingsart "Technik" - keine Wiederholungsziele, keine Vorschläge.
const info = { name: 'Barbell High Bar Squat', name_en: 'barbell high bar squat', category: 'Legs', equipment: 'barbell', equipment_en: 'barbell' }
const sets = (reps, weight = 100) => reps.map((r) => ({ reps: r, weight, done: true }))

describe('Trainingsart Technik', () => {
  it('ist eine wählbare Trainingsart und überstimmt das Workout-Ziel', () => {
    expect(EXERCISE_TRAINING_TYPES).toContain('technique')
    expect(sanitizeExerciseTrainingType('technique')).toBe('technique')
    expect(resolveExerciseGoal(info, 'strength', 'technique')).toBe('technique')
  })

  it('kein Wiederholungsziel, kein Fortschrittszustand, kein Gewichtsvorschlag', () => {
    expect(getRepTarget(info, 'technique')).toBeNull()
    expect(progressionModeFor(info, 'technique')).toBeNull()
    const last = { name: 'Barbell High Bar Squat', setDetails: sets([5, 5, 5, 5, 5]) }
    expect(getProgressionStatus(info, last, 'technique')).toBeNull()
    expect(getProgressionStatus(info, last, 'strength', { previousSessions: [last] })?.state).toBe('increase')
  })

  it('Kurz prüfen: bei Technik keine Wiederholungs-/Gewichtswarnung', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Squat', setDetails: sets([40, 40]) }],
      trackingActive: true,
      getNote: () => 'ok',
      lastSessions: [{ setDetails: sets([5, 5], 100) }],
      repTargets: [null],
      noLoad: [true]
    })
    expect(review.check).toEqual([])
  })

  it('Pausenzeit fällt auf den Standard zurück', () => {
    expect(restSecondsFor('technique', 'compound')).toBe(120)
  })
})

// Absprache Paul 19.10.: Explosiv und Technik sind auch als Workout-Ziel wählbar (Voreinstellung für alle Übungen).
describe('Workout-Ziel Explosiv/Technik', () => {
  const jump = { name: 'Jump Squat', name_en: 'jump squat', category: 'Legs', equipment: 'body weight', equipment_en: 'body weight' }

  it('gilt für alle Übungen, eigene Wahl pro Übung bleibt stärker', () => {
    expect(resolveExerciseGoal(info, 'explosive')).toBe('explosive')
    expect(resolveExerciseGoal(info, 'technique')).toBe('technique')
    expect(resolveExerciseGoal(info, 'technique', 'strength')).toBe('strength')
    expect(resolveExerciseGoal(jump, 'technique')).toBe('technique')
    expect(resolveExerciseGoal(jump, 'strength')).toBe('explosive')
  })

  it('Technik behält die Standardpause (wie Muskelaufbau), Explosiv 120 s', () => {
    expect(restSecondsFor('technique', 'compound')).toBe(restSecondsFor('hypertrophy', 'compound'))
    expect(restSecondsFor('explosive', 'compound')).toBe(120)
  })
})
