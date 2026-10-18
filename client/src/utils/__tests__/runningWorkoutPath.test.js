import { describe, it, expect } from 'vitest'
import { runningWorkoutPath } from '../activeWorkoutDraft.js'

// Absprache Paul 23.10.: Beim Zurückkehren in die App bei laufendem Workout direkt die Workout-Ansicht zeigen.
describe('runningWorkoutPath', () => {
  it('liefert den Pfad eines laufenden Entwurfs', () => {
    expect(runningWorkoutPath({ workout: { _id: 'draft-123', completed: false } })).toBe('/workouts/draft-123')
    expect(runningWorkoutPath({ workout: { _id: '507f1f77bcf86cd799439011' } })).toBe('/workouts/507f1f77bcf86cd799439011')
  })

  it('nimmt die Bearbeiten-ID bzw. "draft", wenn das Workout keine eigene ID trägt', () => {
    expect(runningWorkoutPath({ workout: {}, editingWorkoutId: 'abc' })).toBe('/workouts/abc')
    expect(runningWorkoutPath({ workout: {} })).toBe('/workouts/draft')
  })

  it('kein Pfad ohne Entwurf, bei abgeschlossenem Workout und bei "Favorit anpassen"', () => {
    expect(runningWorkoutPath(null)).toBeNull()
    expect(runningWorkoutPath({})).toBeNull()
    expect(runningWorkoutPath({ workout: { _id: 'x', completed: true } })).toBeNull()
    expect(runningWorkoutPath({ workout: { _id: 'x', _adjustDraft: true } })).toBeNull()
  })
})
