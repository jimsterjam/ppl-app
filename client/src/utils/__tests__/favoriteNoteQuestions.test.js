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

const FAVORITES_KEY = 'bro_split_favorite_workouts_v1'
const QUESTION = 'Kann es sein, dass die Schulter müde ist?'
const workout = (note, notes = '') => ({
  name: 'Push Day', type: 'push', notes,
  exercises: [{ name: 'Bench Press', note, setDetails: [{ reps: 5, weight: 100 }] }]
})

// Absprache Jimmy 16.11.: Fragen in Notizen gelten nur für das Workout, in dem sie stehen - nicht für den Favoriten.
describe('Favoriten nehmen keine Fragen aus Notizen mit', () => {
  it('Speichern: Frage fällt weg, Aussage bleibt', () => {
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: workout(`${QUESTION} Knie vorsichtig.`) })
    expect(getFavoritesByType('u1', 'push')[0].workout.exercises[0].note).toBe('Knie vorsichtig.')
  })

  it('"Speichern + Favorit aktualisieren" (buildStartedFavoriteWorkout): Frage fällt weg', () => {
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: workout('Knie vorsichtig.') })
    const id = getFavoritesByType('u1', 'push')[0].id
    updateFavoriteWorkout({ userId: 'u1', type: 'push', id, name: 'Push Day', workout: buildStartedFavoriteWorkout(workout(`${QUESTION} Knie vorsichtig.`)) })
    expect(getFavoritesByType('u1', 'push')[0].workout.exercises[0].note).toBe('Knie vorsichtig.')
  })

  it('Notiz des ganzen Workouts: auch dort fällt die Frage weg', () => {
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: workout('', `${QUESTION} Heute Fokus auf Technik.`) })
    expect(getFavoritesByType('u1', 'push')[0].workout.notes).toBe('Heute Fokus auf Technik.')
  })

  it('schon gespeicherter Favorit mit Frage in der Notiz: beim Lesen (Start) ohne Frage, Speicher bleibt unverändert', () => {
    const id = 'fav_push_1'
    const raw = {
      u1: { push: [{ id, type: 'push', name: 'Old', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z',
        workout: { type: 'push', notes: QUESTION, exercises: [{ name: 'Bench Press', note: `${QUESTION} Ellbogen eng.`, setDetails: [{ reps: 5, weight: 100 }] }] } }], pull: [], legs: [], fullbody: [] }
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(raw))
    const favorite = getFavoritesByType('u1', 'push')[0]
    expect(favorite.workout.exercises[0].note).toBe('Ellbogen eng.')
    expect(favorite.workout.notes).toBe('Bench Press: Ellbogen eng.')
    expect(JSON.parse(store[FAVORITES_KEY]).u1.push[0].workout.exercises[0].note).toContain('Kann es sein')
  })

  it('Gegenprobe: Notizen ohne Frage bleiben unverändert, ebenso alle anderen Felder', () => {
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: { ...workout('Schulter tat weh'), notes: 'Technik zuerst' } })
    const stored = getFavoritesByType('u1', 'push')[0].workout
    expect(stored.exercises[0].note).toBe('Schulter tat weh')
    expect(stored.notes).toBe('Technik zuerst')
    expect(stored.exercises[0].setDetails).toEqual([{ reps: 5, weight: 100 }])
  })

  it('Gegenprobe: das übergebene Workout (laufende Einheit) wird nicht verändert', () => {
    const live = workout(`${QUESTION} Knie vorsichtig.`)
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: live })
    expect(live.exercises[0].note).toBe(`${QUESTION} Knie vorsichtig.`)
  })

  it('Gegenprobe: Aussagen mit "sollte ich" / "ob die" gehen nicht verloren', () => {
    const note = 'Nächstes Mal sollte ich langsamer absenken. Schauen, ob die Hüfte mitmacht.'
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: workout(note) })
    expect(getFavoritesByType('u1', 'push')[0].workout.exercises[0].note).toBe(note)
  })

  it('Zusammenfassung der Notizen wird aus den bereinigten Übungsnotizen gebaut: die Aussage einer anderen Übung bleibt', () => {
    const started = buildStartedFavoriteWorkout({
      name: 'Push Day', type: 'push',
      exercises: [
        { name: 'Squat', note: 'Knie vorsichtig', setDetails: [{ reps: 5, weight: 100 }] },
        { name: 'Bench Press', note: QUESTION, setDetails: [{ reps: 5, weight: 100 }] }
      ]
    })
    expect(started.exercises.map((e) => e.note)).toEqual(['Knie vorsichtig', ''])
    expect(started.notes).toContain('Knie vorsichtig')
    expect(started.notes).not.toContain('Kann es sein')
  })

  it('Lesen und wieder Speichern (Favorit anpassen): bereinigte Notiz wird gespeichert, Aussagen bleiben', () => {
    const raw = { u1: { push: [{ id: 'fav_push_2', type: 'push', name: 'Old', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z',
      workout: { type: 'push', notes: '', exercises: [{ name: 'Bench Press', note: `${QUESTION} Ellbogen eng.`, setDetails: [{ reps: 5, weight: 100 }] }] } }], pull: [], legs: [], fullbody: [] } }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(raw))
    const favorite = getFavoritesByType('u1', 'push')[0]
    updateFavoriteWorkout({ userId: 'u1', type: 'push', id: favorite.id, name: 'Old', workout: favorite.workout })
    expect(JSON.parse(store[FAVORITES_KEY]).u1.push[0].workout.exercises[0].note).toBe('Ellbogen eng.')
  })

  it('Zusammenfassung nur aus der Frage (alter Favorit): Aussage der Übungsnotiz bleibt beim Lesen und beim Speichern', () => {
    const old = {
      name: 'Push Day', type: 'push', notes: QUESTION,
      exercises: [{ name: 'Bench Press', note: 'Knie vorsichtig.', setDetails: [{ reps: 5, weight: 100 }] }]
    }
    store[FAVORITES_KEY] = JSON.stringify({ u1: { push: [{ id: 'f1', name: 'Push Day', type: 'push', updatedAt: '2026-01-01', workout: old }], pull: [], legs: [], fullbody: [] } })
    expect(getFavoritesByType('u1', 'push')[0].workout.notes).toBe('Bench Press: Knie vorsichtig.')
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Neu', workout: old })
    const saved = getFavoritesByType('u1', 'push').find((f) => f.name === 'Neu')
    expect(saved.workout.notes).toBe('Bench Press: Knie vorsichtig.')
  })

  it('Frage ohne Fragezeichen in der Übungsnotiz: auch die Zusammenfassung enthält sie nach dem Speichern nicht mehr', () => {
    const w = {
      name: 'Push Day', type: 'push', notes: 'Bench Press: Warum fällt mir das schwer',
      exercises: [{ name: 'Bench Press', note: 'Warum fällt mir das schwer', setDetails: [{ reps: 5, weight: 100 }] }]
    }
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: w })
    expect(getFavoritesByType('u1', 'push')[0].workout.notes).toBe('')
    expect(JSON.parse(store[FAVORITES_KEY]).u1.push[0].workout.notes).toBe('')
  })

  it('Gegenprobe: eigenständige Workout-Notiz ohne Frage bleibt, auch wenn Übungsnotizen Fragen hatten', () => {
    const w = {
      name: 'Push Day', type: 'push', notes: 'Heute Fokus auf Technik.',
      exercises: [{ name: 'Bench Press', note: QUESTION, setDetails: [{ reps: 5, weight: 100 }] }]
    }
    saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Push Day', workout: w })
    expect(getFavoritesByType('u1', 'push')[0].workout.notes).toBe('Heute Fokus auf Technik.')
  })
})
