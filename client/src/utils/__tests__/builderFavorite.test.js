// Favorit direkt im Workout-Builder speichern, ohne das Workout zu starten (Absprache Paul 04.11.):
// WorkoutBuilder.vue ruft saveFavoriteWorkout mit Name, Typ, Ziel und den gewählten Übungen auf.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { saveFavoriteWorkout, getFavoritesByType, getFavoriteLimitPerType } from '../workoutFavorites.js'

const lsStore = {}
vi.stubGlobal('localStorage', {
  getItem: (key) => lsStore[key] ?? null,
  setItem: (key, value) => { lsStore[key] = String(value) },
  removeItem: (key) => { delete lsStore[key] },
  clear: () => { for (const k of Object.keys(lsStore)) delete lsStore[k] }
})

beforeEach(() => localStorage.clear())

const builderWorkout = (name = 'Push A') => ({
  name,
  type: 'push',
  goal: 'strength',
  exercises: [
    { exerciseId: 'e1', name: 'Bench Press Barbell', sets: 3, reps: 5, weight: 0, category: 'push', note: '', setDetails: [{ reps: 5, weight: 0 }, { reps: 5, weight: 0 }, { reps: 5, weight: 0 }] }
  ]
})

describe('Favorit aus dem Builder', () => {
  it('speichert Übungen, Typ und Ziel und legt kein Workout an', () => {
    const result = saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push A', workout: builderWorkout() })
    expect(result.success).toBe(true)
    const [fav] = getFavoritesByType('u1', 'push')
    expect(fav.name).toBe('Push A')
    expect(fav.workout.goal).toBe('strength')
    expect(fav.workout.exercises).toHaveLength(1)
    expect(fav.workout.exercises[0].name).toBe('Bench Press Barbell')
    expect(fav.workout.exercises[0].setDetails).toHaveLength(3)
  })

  it('ohne Ziel bleibt das Ziel leer (der Start fragt dann einmal nach)', () => {
    const workout = { ...builderWorkout(), goal: undefined }
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push B', workout })
    expect(getFavoritesByType('u1', 'push')[0].workout.goal).toBeNull()
  })

  it('lehnt ungültige Namen ab und meldet das Limit pro Typ', () => {
    expect(saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push <b>', workout: builderWorkout() }).code).toBe('INVALID_NAME')
    for (let i = 0; i < getFavoriteLimitPerType(); i += 1) {
      expect(saveFavoriteWorkout({ userId: 'u1', type: 'push', name: `Push ${i}`, workout: builderWorkout() }).success).toBe(true)
    }
    expect(saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Zuviel', workout: builderWorkout() }).code).toBe('LIMIT_REACHED')
  })
})
