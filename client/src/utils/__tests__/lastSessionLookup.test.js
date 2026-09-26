import { describe, it, expect } from 'vitest'
import { prepareHistoryCandidates, findLastSessionExercise } from '../lastSessionLookup.js'

const sets = (weight) => [{ reps: 10, weight }]

describe('prepareHistoryCandidates', () => {
  it('schließt aktuelles Workout, Entwürfe und nicht abgeschlossene Workouts aus, neueste zuerst', () => {
    const history = [
      { _id: 'a', date: '2026-09-01', completed: true, exercises: [] },
      { _id: 'b', date: '2026-09-10', completed: true, exercises: [] },
      { _id: 'current', date: '2026-09-20', completed: false, exercises: [] },
      { _id: 'draft', date: '2026-09-15', isDraft: true, exercises: [] },
      { _id: 'open', date: '2026-09-16', completed: false, exercises: [] }
    ]
    expect(prepareHistoryCandidates(history, 'current').map((w) => w._id)).toEqual(['b', 'a'])
  })

  it('Duplikate derselben ID: neuester Stand gewinnt', () => {
    const history = [
      { _id: 'a', updatedAt: '2026-09-01T10:00:00Z', completed: true, exercises: [{ name: 'X', setDetails: sets(50) }] },
      { _id: 'a', updatedAt: '2026-09-01T12:00:00Z', completed: true, exercises: [{ name: 'X', setDetails: sets(55) }] }
    ]
    const candidates = prepareHistoryCandidates(history, 'other')
    expect(candidates).toHaveLength(1)
    expect(candidates[0].exercises[0].setDetails[0].weight).toBe(55)
  })
})

describe('findLastSessionExercise', () => {
  const candidates = prepareHistoryCandidates([
    { _id: 'new', date: '2026-09-20', completed: true, exercises: [{ name: 'Kniebeugen mit der Langhantel', setDetails: sets(60) }] },
    { _id: 'old', date: '2026-09-10', completed: true, exercises: [{ exerciseId: 'ex1', name: 'Anderer Name', setDetails: sets(55) }] }
  ], 'current')

  it('Abgleich per Name (Groß-/Kleinschreibung egal), neueste Session', () => {
    expect(findLastSessionExercise({ name: 'kniebeugen mit der langhantel' }, candidates)?.setDetails[0].weight).toBe(60)
  })

  it('Abgleich per Übungs-ID', () => {
    expect(findLastSessionExercise({ exerciseId: 'ex1', name: 'Neu benannt' }, candidates)?.setDetails[0].weight).toBe(55)
  })

  it('Übung ohne Arbeitssätze in der Historie zählt nicht', () => {
    const c = prepareHistoryCandidates([
      { _id: 'x', completed: true, exercises: [{ name: 'Y', setDetails: [{ reps: 5, weight: 20, isWarmup: true }] }] }
    ], 'current')
    expect(findLastSessionExercise({ name: 'Y' }, c)).toBeNull()
  })
})
