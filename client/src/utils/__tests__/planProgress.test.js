import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/trainingPlans', () => ({
  fetchTrainingPlansRemote: vi.fn().mockResolvedValue([]),
  pushTrainingPlanRemote: vi.fn().mockResolvedValue({}),
  deleteTrainingPlanRemote: vi.fn().mockResolvedValue(true)
}))
vi.mock('@/api/favoriteWorkouts', () => ({
  fetchFavoriteWorkoutsRemote: vi.fn().mockResolvedValue([]),
  pushFavoriteWorkoutRemote: vi.fn().mockResolvedValue({}),
  deleteFavoriteWorkoutRemote: vi.fn().mockResolvedValue(true)
}))
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null }) }))

import { createTrainingPlan, getTrainingPlans, activateTrainingPlan } from '../trainingPlanStorage.js'
import { saveFavoriteWorkout } from '../workoutFavorites.js'
import { getTodayPlanInfo, getPlanDayInfo, advancePlanAfterWorkout } from '../planProgress.js'

const exercise = { exerciseId: 'ex_0025', name: 'Barbell Bench Press', sets: 3, reps: 10, weight: 0, setDetails: [{ reps: 10, weight: 0 }] }

function addFavorite(name, type = 'push') {
  const result = saveFavoriteWorkout({ userId: 'u1', type, name, workout: { name, type, exercises: [exercise] } })
  return result.favorite
}

describe('planProgress', () => {
  beforeEach(() => {
    const data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k)
    })
  })

  it('ohne Plan: kein Heute-Eintrag', () => {
    expect(getTodayPlanInfo('u1')).toBeNull()
  })

  it('Heute = aktueller Tag des aktiven Plans mit seinem Favoriten', () => {
    const a = addFavorite('Push A')
    const b = addFavorite('Pull A', 'pull')
    createTrainingPlan({ userId: 'u1', name: 'Mein Plan', days: [{ favoriteId: a.id }, { favoriteId: b.id }] })
    const info = getTodayPlanInfo('u1')
    expect(info.plan.name).toBe('Mein Plan')
    expect(info.favorite.id).toBe(a.id)
  })

  it('gelöschter Favorit: Tag bleibt, favorite ist null', () => {
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: 'fav_weg' }] })
    const info = getTodayPlanInfo('u1')
    expect(info.day.favoriteId).toBe('fav_weg')
    expect(info.favorite).toBeNull()
  })

  it('nur der aktive Plan zählt', () => {
    const a = addFavorite('Push A')
    createTrainingPlan({ userId: 'u1', name: 'Eins', days: [{ favoriteId: a.id }] })
    const second = createTrainingPlan({ userId: 'u1', name: 'Zwei', days: [{ favoriteId: a.id }] }).plan
    activateTrainingPlan({ userId: 'u1', planId: second.id })
    expect(getTodayPlanInfo('u1').plan.name).toBe('Zwei')
  })

  it('getPlanDayInfo findet einen beliebigen Tag', () => {
    const a = addFavorite('Push A')
    const b = addFavorite('Pull A', 'pull')
    const plan = createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: a.id }, { favoriteId: b.id }] }).plan
    expect(getPlanDayInfo('u1', plan.id, plan.days[1].id).favorite.id).toBe(b.id)
    expect(getPlanDayInfo('u1', plan.id, 'nope')).toBeNull()
    expect(getPlanDayInfo('u1', 'nope', plan.days[0].id)).toBeNull()
  })

  it('nach dem Speichern rückt der Plan zum Tag nach dem trainierten vor (auch am Ende zum Anfang)', () => {
    const a = addFavorite('Push A')
    const b = addFavorite('Pull A', 'pull')
    const plan = createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: a.id }, { favoriteId: b.id }] }).plan
    advancePlanAfterWorkout({ userId: 'u1', planId: plan.id, planDayId: plan.days[0].id, doneAt: '2026-10-20T10:00:00.000Z' })
    let current = getTrainingPlans('u1')[0]
    expect(current.activeDayIndex).toBe(1)
    expect(current.days[0].lastDoneAt).toBe('2026-10-20T10:00:00.000Z')
    advancePlanAfterWorkout({ userId: 'u1', planId: plan.id, planDayId: plan.days[1].id })
    current = getTrainingPlans('u1')[0]
    expect(current.activeDayIndex).toBe(0)
  })

  it('anderer Tag trainiert: weiter mit dem Tag danach', () => {
    const favs = ['A', 'B', 'C'].map((n) => addFavorite(`Tag ${n}`))
    const plan = createTrainingPlan({ userId: 'u1', name: 'P', days: favs.map((f) => ({ favoriteId: f.id })) }).plan
    advancePlanAfterWorkout({ userId: 'u1', planId: plan.id, planDayId: plan.days[2].id })
    expect(getTrainingPlans('u1')[0].activeDayIndex).toBe(0)
  })

  it('doppelter Aufruf für dasselbe Training ändert nichts weiter', () => {
    const favs = ['A', 'B', 'C'].map((n) => addFavorite(`Tag ${n}`))
    const plan = createTrainingPlan({ userId: 'u1', name: 'P', days: favs.map((f) => ({ favoriteId: f.id })) }).plan
    const args = { userId: 'u1', planId: plan.id, planDayId: plan.days[0].id, doneAt: '2026-10-20T10:00:00.000Z' }
    advancePlanAfterWorkout(args)
    advancePlanAfterWorkout(args)
    expect(getTrainingPlans('u1')[0].activeDayIndex).toBe(1)
  })

  it('unbekannter oder fehlender Plan/Tag: nichts passiert', () => {
    const a = addFavorite('Push A')
    const plan = createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: a.id }, { favoriteId: a.id }] }).plan
    expect(advancePlanAfterWorkout({ userId: 'u1', planId: plan.id, planDayId: 'nope' })).toBeNull()
    expect(advancePlanAfterWorkout({ userId: 'u1', planId: 'nope', planDayId: plan.days[0].id })).toBeNull()
    expect(advancePlanAfterWorkout({ userId: 'u1' })).toBeNull()
    expect(getTrainingPlans('u1')[0].activeDayIndex).toBe(0)
  })
})
