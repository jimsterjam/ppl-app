import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/favoriteWorkouts', () => ({
  fetchFavoriteWorkoutsRemote: vi.fn().mockResolvedValue([]),
  pushFavoriteWorkoutRemote: vi.fn().mockResolvedValue({}),
  deleteFavoriteWorkoutRemote: vi.fn().mockResolvedValue(true)
}))
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null }) }))

import { buildSwappedExercise, canSwapExercise, replaceExerciseInFavorite } from '../exerciseSwapApply.js'
import { saveFavoriteWorkout, getFavoritesByType } from '../workoutFavorites.js'

const entry = { _id: 'ex_0576', name_en: 'lever chest press (weight stack)', name: 'Brustpresse', muscleGroup: 'Brust', imageUrl: 'i.jpg', thumbnailUrl: 't.jpg' }
const bench = { exerciseId: 'ex_0025', name: 'bench press barbell', muscleGroup: 'Brust', note: 'Schulter', trainingType: 'strength', restSeconds: 180, setDetails: [{ isWarmup: true, reps: 5, weight: 20 }, { reps: 8, weight: 60 }, { reps: 8, weight: 60 }, { reps: 8, weight: 60 }] }

describe('buildSwappedExercise', () => {
  it('übernimmt die Satzanzahl (ohne Aufwärmsätze), sonst nichts von der alten Übung', () => {
    const result = buildSwappedExercise(bench, entry)
    expect(result.name).toBe('lever chest press (weight stack)')
    expect(result.exerciseId).toBe('ex_0576')
    expect(result.setDetails).toEqual([{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }])
    expect(result.note).toBe('')
    expect(result.trainingType).toBeUndefined()
    expect(result.restSeconds).toBeUndefined()
    expect(result.replacedFrom).toBe('bench press barbell')
  })

  it('ohne Sätze: mindestens einer', () => {
    expect(buildSwappedExercise({ name: 'x' }, entry).setDetails).toHaveLength(1)
  })
})

describe('canSwapExercise', () => {
  it('nur ohne abgehakten Satz', () => {
    expect(canSwapExercise(bench)).toBe(true)
    expect(canSwapExercise({ setDetails: [{ reps: 8, weight: 60, done: true }] })).toBe(false)
    expect(canSwapExercise({ setDetails: [{ reps: 8, weight: 60, done: false }] })).toBe(true)
    expect(canSwapExercise({})).toBe(true)
  })
})

describe('replaceExerciseInFavorite', () => {
  beforeEach(() => {
    const data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k)
    })
  })

  const makeFavorite = () => saveFavoriteWorkout({
    userId: 'u1', type: 'push', name: 'Push A',
    workout: { name: 'Push A', type: 'push', exercises: [
      { exerciseId: 'ex_0025', name: 'bench press barbell', muscleGroup: 'Brust', sets: 4, reps: 10, weight: 0, setDetails: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }] },
      { exerciseId: 'ex_0314', name: 'dumbbell incline bench press', muscleGroup: 'Brust', sets: 3, reps: 10, weight: 0, setDetails: [{ reps: 10, weight: 0 }] }
    ] }
  }).favorite

  it('ersetzt genau die Übung, Reihenfolge und Rest bleiben', () => {
    const fav = makeFavorite()
    const result = replaceExerciseInFavorite({ userId: 'u1', favoriteId: fav.id, oldExercise: bench, entry })
    expect(result).toEqual({ ok: true })
    const saved = getFavoritesByType('u1', 'push')[0]
    expect(saved.workout.exercises.map((e) => e.name)).toEqual(['lever chest press (weight stack)', 'dumbbell incline bench press'])
    expect(saved.workout.exercises[0].setDetails).toHaveLength(4)
    expect(saved.name).toBe('Push A')
  })

  it('Favorit oder Übung nicht gefunden', () => {
    const fav = makeFavorite()
    expect(replaceExerciseInFavorite({ userId: 'u1', favoriteId: 'nope', oldExercise: bench, entry })).toEqual({ ok: false, error: 'favoriteNotFound' })
    expect(replaceExerciseInFavorite({ userId: 'u1', favoriteId: fav.id, oldExercise: { name: 'andere' }, entry })).toEqual({ ok: false, error: 'exerciseNotFound' })
  })
})
