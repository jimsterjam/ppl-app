import { describe, it, expect } from 'vitest'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'
import { buildWorkoutBuilderRoute, readWorkoutBuilderRouteState } from '../workoutBuilderFlow.js'
import { sanitizePlanRef } from '../trainingPlan.js'

const workout = (extra = {}) => ({ name: 'Push A', type: 'push', exercises: [{ name: 'Dips', setDetails: [{ reps: 10, weight: 0 }] }], ...extra })

describe('Plan-Verweis am Workout', () => {
  it('sanitizePlanRef: gültige ID bleibt, alles andere wird null', () => {
    expect(sanitizePlanRef(' plan_1_ab ')).toBe('plan_1_ab')
    expect(sanitizePlanRef('')).toBeNull()
    expect(sanitizePlanRef(undefined)).toBeNull()
    expect(sanitizePlanRef('<b>')).toBeNull()
    expect(sanitizePlanRef('a'.repeat(65))).toBeNull()
    expect(sanitizePlanRef({ $ne: 1 })).toBeNull()
  })

  it('Route: Plan und Tag werden nur zusammen durchgereicht', () => {
    const route = buildWorkoutBuilderRoute('push', { planId: 'plan_1', planDayId: 'day_1' })
    expect(route.query.planId).toBe('plan_1')
    expect(route.query.planDayId).toBe('day_1')
    expect(readWorkoutBuilderRouteState(route.query)).toMatchObject({ planId: 'plan_1', planDayId: 'day_1' })
    expect(buildWorkoutBuilderRoute('push', { planId: 'plan_1' }).query.planId).toBeUndefined()
    expect(buildWorkoutBuilderRoute('push', {}).query.planDayId).toBeUndefined()
  })

  it('Route: ungültige IDs aus der URL werden verworfen', () => {
    expect(readWorkoutBuilderRouteState({ planId: '<x>', planDayId: 'day_1' }).planId).toBeNull()
  })

  it('Speichern: Plan und Tag bleiben erhalten', () => {
    const result = normalizeWorkoutForSave({ workout: workout({ planId: 'plan_1', planDayId: 'day_1' }), exerciseNotes: [] })
    expect(result.planId).toBe('plan_1')
    expect(result.planDayId).toBe('day_1')
  })

  it('Speichern: ohne Plan oder mit nur einer Hälfte -> beide null', () => {
    expect(normalizeWorkoutForSave({ workout: workout(), exerciseNotes: [] })).toMatchObject({ planId: null, planDayId: null })
    expect(normalizeWorkoutForSave({ workout: workout({ planId: 'plan_1' }), exerciseNotes: [] })).toMatchObject({ planId: null, planDayId: null })
  })
})
