import { describe, it, expect } from 'vitest'
import { buildLocalAthleteAnswers } from '../athleteAnswersLocal.js'

const workout = { exercises: [{ name: 'Squat' }, { name: 'Curl' }, { name: 'Row' }] }

describe('buildLocalAthleteAnswers', () => {
  it('baut Einträge in der Form des Servers, der Übungsname kommt vom Workout', () => {
    const out = buildLocalAthleteAnswers(workout, [{ topic: 'last_set', exerciseIndex: 1, answer: 'limit_clean', exercise: 'Fremd' }])
    expect(out).toEqual([{ topic: 'last_set', exercise: 'Curl', exerciseIndex: 1, answer: 'limit_clean', reason: null, variant: null }])
  })

  it('Grund und Variante bleiben erhalten', () => {
    const out = buildLocalAthleteAnswers(workout, [
      { topic: 'intent', exerciseIndex: 0, answer: 'intended', reason: 'deload' },
      { topic: 'compare', exerciseIndex: 1, answer: 'same', variant: 'less' }
    ])
    expect(out[0].reason).toBe('deload')
    expect(out[1].variant).toBe('less')
  })

  it('Gegenprobe: höchstens zwei, je Übung ein Thema, ungültige Positionen und Werte werden verworfen', () => {
    const out = buildLocalAthleteAnswers(workout, [
      { topic: 'last_set', exerciseIndex: 0, answer: 'easy' },
      { topic: 'compare', exerciseIndex: 0, answer: 'same' },
      { topic: 'last_set', exerciseIndex: 9, answer: 'easy' },
      { topic: 'last_set', exerciseIndex: '1', answer: 'easy' },
      { topic: 5, exerciseIndex: 1, answer: 'easy' },
      { topic: 'last_set', exerciseIndex: 1, answer: 'hard_air' },
      { topic: 'last_set', exerciseIndex: 2, answer: 'easy' }
    ])
    expect(out.map((e) => e.exerciseIndex)).toEqual([0, 1])
  })

  it('Gegenprobe: ohne Workout oder ohne Antworten leer', () => {
    expect(buildLocalAthleteAnswers(null, [{ topic: 'last_set', exerciseIndex: 0, answer: 'easy' }])).toEqual([])
    expect(buildLocalAthleteAnswers(workout, null)).toEqual([])
  })
})
