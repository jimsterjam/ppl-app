import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

import { saveFavoriteWorkout, updateFavoriteWorkout, getFavoritesByType, buildStartedFavoriteWorkout } from '../workoutFavorites.js'

const store = {}
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] }
})
beforeEach(() => { for (const k of Object.keys(store)) delete store[k] })

// Absprache Paul 14.10.: Ein Favorit bildet die letzte Session ab - inklusive der Notizen je Übung.
describe('Favoriten speichern Notizen mit', () => {
  const saved = () => ({
    name: 'Push Day',
    type: 'push',
    exercises: [
      { name: 'Bench Press', note: 'Schulter tat weh', setDetails: [{ reps: 5, weight: 100, done: true }, { reps: 5, weight: 100, done: false }] },
      { name: 'Dips', note: '', setDetails: [{ reps: 10, weight: 0, done: false }] }
    ]
  })

  it('"Speichern + Favorit aktualisieren": Notiz je Übung bleibt im Favoriten, alle Sätze ohne done-Flags', () => {
    const created = saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: { name: 'Push Day', type: 'push', exercises: [{ name: 'Bench Press', note: 'alt', setDetails: [{ reps: 5, weight: 90 }] }] } })
    expect(created.success).toBe(true)
    const favoriteId = getFavoritesByType('u1', 'push')[0].id

    const result = updateFavoriteWorkout({ userId: 'u1', type: 'push', id: favoriteId, name: 'Push Day', workout: buildStartedFavoriteWorkout(saved()) })
    expect(result.success).toBe(true)
    const exercises = getFavoritesByType('u1', 'push')[0].workout.exercises
    expect(exercises.map((e) => e.note)).toEqual(['Schulter tat weh', ''])
    expect(exercises[0].setDetails).toEqual([{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }])
  })

  it('Mapping enthält die Notiz auch bei fehlendem Wert als leeren Text', () => {
    const payload = buildStartedFavoriteWorkout({ name: 'X', type: 'push', exercises: [{ name: 'Row', setDetails: [{ reps: 8, weight: 50 }] }] })
    expect(payload.exercises[0].note).toBe('')
    expect(buildStartedFavoriteWorkout(null).exercises).toEqual([])
  })
})
