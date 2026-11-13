import { describe, it, expect } from 'vitest'
import { decideFavoriteAsk, sameExercises, sanitizeWorkoutOrigin } from '../favoriteAsk.js'
import { normalizeWorkoutForSave } from '../workoutDetailSaveFlow.js'

// Absprache Jimmy 13.11.: Beim ersten Speichern eines selbst zusammengestellten oder generierten Workouts fragt die App,
// ob es als Favorit gemerkt werden soll.
const ex = (name, exerciseId) => ({ name, exerciseId, setDetails: [{ reps: 10, weight: 20 }] })
const base = (extra = {}) => ({ type: 'push', origin: 'manual', completed: false, exercises: [ex('Bench', 'ex_1'), ex('Dips', 'ex_2')], ...extra })

describe('Favorit-Frage beim Speichern', () => {
  it('selbst zusammengestellt und generiert: fragen', () => {
    expect(decideFavoriteAsk({ workout: base() })).toBe('ask')
    expect(decideFavoriteAsk({ workout: base({ origin: 'generated' }) })).toBe('ask')
  })

  it('Gegenproben: aus Favorit, aus Plan, Favorit-Anpassen, schon gespeichert (Bearbeiten), alte Workouts, leer', () => {
    expect(decideFavoriteAsk({ workout: base(), fromFavorite: true })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base({ origin: 'favorite' }) })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base({ origin: 'plan' }) })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base({ planId: 'plan_1' }) })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base(), favoriteAdjust: true })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base({ completed: true }) })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base({ origin: null }) })).toBe('skip')
    expect(decideFavoriteAsk({ workout: base({ exercises: [] }) })).toBe('skip')
    expect(decideFavoriteAsk({ workout: null })).toBe('skip')
  })

  it('Gegenprobe: gleicher Favorit existiert schon (gleiche Übungen, gleiche Reihenfolge) -> nicht fragen', () => {
    const favorites = [{ workout: { exercises: [ex('Bench Press', 'ex_1'), ex('Dips', 'ex_2')] } }]
    expect(decideFavoriteAsk({ workout: base(), favorites })).toBe('skip')
    // andere Reihenfolge = anderes Workout -> fragen
    const swapped = [{ workout: { exercises: [ex('Dips', 'ex_2'), ex('Bench', 'ex_1')] } }]
    expect(decideFavoriteAsk({ workout: base(), favorites: swapped })).toBe('ask')
  })

  it('Limit erreicht: Hinweis statt Frage', () => {
    const favorites = Array.from({ length: 10 }, (_, i) => ({ workout: { exercises: [ex(`X${i}`, `x_${i}`)] } }))
    expect(decideFavoriteAsk({ workout: base(), favorites, limit: 10 })).toBe('limit')
    expect(decideFavoriteAsk({ workout: base(), favorites: favorites.slice(0, 9), limit: 10 })).toBe('ask')
  })

  it('Vergleich der Übungen: über die Katalog-ID, sonst den Namen', () => {
    expect(sameExercises([ex('A', 'ex_1')], [ex('anders', 'ex_1')])).toBe(true)
    expect(sameExercises([{ name: 'Eigene Übung' }], [{ name: ' eigene übung ' }])).toBe(true)
    expect(sameExercises([], [])).toBe(false)
  })

  it('Herkunft wird beim Speichern mitgeschickt; unbekannte Werte werden null', () => {
    expect(normalizeWorkoutForSave({ workout: base({ origin: 'generated' }), exerciseNotes: [] }).origin).toBe('generated')
    expect(normalizeWorkoutForSave({ workout: base({ origin: 'hack' }), exerciseNotes: [] }).origin).toBe(null)
    expect(sanitizeWorkoutOrigin('plan')).toBe('plan')
  })
})

describe('Herkunft: App und Server kennen dieselben Werte', () => {
  it('gleiche Liste wie server/utils/coachCheck.js', async () => {
    const server = await import('../../../../server/utils/coachCheck.js')
    for (const value of [...server.WORKOUT_ORIGINS, 'x', null]) {
      expect(sanitizeWorkoutOrigin(value)).toBe(server.sanitizeWorkoutOrigin(value))
    }
  })
})
