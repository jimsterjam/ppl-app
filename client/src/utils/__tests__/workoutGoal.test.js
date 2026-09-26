import { describe, it, expect } from 'vitest'
import { sanitizeWorkoutGoal } from '../workoutGoal.js'
import { buildWorkoutBuilderRoute, readWorkoutBuilderRouteState } from '../workoutBuilderFlow.js'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'

describe('sanitizeWorkoutGoal', () => {
  it('lässt nur gültige Ziele durch', () => {
    expect(sanitizeWorkoutGoal('strength')).toBe('strength')
    expect(sanitizeWorkoutGoal(' Hypertrophy ')).toBe('hypertrophy')
    expect(sanitizeWorkoutGoal('muscle_building')).toBeNull()
    expect(sanitizeWorkoutGoal(undefined)).toBeNull()
  })
})

describe('Ziel wird vom Dashboard bis zum Workout durchgereicht', () => {
  it('Builder-Route trägt das Ziel in der Query, ungültige Werte fallen weg', () => {
    expect(buildWorkoutBuilderRoute('legs', { goal: 'strength' }).query).toEqual({ type: 'legs', goal: 'strength' })
    expect(buildWorkoutBuilderRoute('legs', { goal: 'quatsch' }).query).toEqual({ type: 'legs' })
  })

  it('readWorkoutBuilderRouteState liest das Ziel', () => {
    expect(readWorkoutBuilderRouteState({ type: 'push', goal: 'hypertrophy' }).goal).toBe('hypertrophy')
    expect(readWorkoutBuilderRouteState({ type: 'push' }).goal).toBeNull()
  })

  it('Speichern übernimmt das Ziel des Workouts (alte Workouts ohne Ziel -> null)', () => {
    const base = { name: 'Leg Day', type: 'legs', date: '2026-09-26', exercises: [] }
    const stopwatch = { elapsedMs: 0, startedAt: null }
    expect(normalizeWorkoutForSave({ workout: { ...base, goal: 'strength' }, sessionStopwatchStore: stopwatch }).goal).toBe('strength')
    expect(normalizeWorkoutForSave({ workout: base, sessionStopwatchStore: stopwatch }).goal).toBeNull()
  })
})
