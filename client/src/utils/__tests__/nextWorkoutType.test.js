import { describe, it, expect } from 'vitest'
import { analyzeRecentTypes, normalizeTileType } from '../nextWorkoutType.js'

const w = (type, day) => ({ type, completed: true, date: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z` })

describe('analyzeRecentTypes', () => {
  it('erkennbarer Rhythmus: nächste Kachel', () => {
    expect(analyzeRecentTypes([w('push', 1), w('pull', 2), w('legs', 3)])).toEqual({ last: 'legs', next: 'push' })
    expect(analyzeRecentTypes([w('legs', 3), w('push', 4), w('pull', 5)])).toEqual({ last: 'pull', next: 'legs' })
  })
  it('willkürliches Training: nur "zuletzt", keine Empfehlung', () => {
    expect(analyzeRecentTypes([w('push', 1), w('legs', 2), w('pull', 3)])).toEqual({ last: 'pull', next: null })
    expect(analyzeRecentTypes([w('push', 1), w('push', 2), w('push', 3)])).toEqual({ last: 'push', next: null })
  })
  it('zu wenig Daten oder Full Body: keine Empfehlung', () => {
    expect(analyzeRecentTypes([w('push', 1), w('pull', 2)])).toEqual({ last: 'pull', next: null })
    expect(analyzeRecentTypes([w('push', 1), w('pull', 2), w('fullbody', 3)])).toEqual({ last: 'fullbody', next: null })
    expect(analyzeRecentTypes([])).toEqual({ last: null, next: null })
  })
  it('Entwürfe und unfertige Workouts zählen nicht; "leg" = legs', () => {
    expect(analyzeRecentTypes([w('push', 1), w('pull', 2), w('leg', 3), { type: 'push', completed: false, date: '2026-10-09' }]).next).toBe('push')
    expect(normalizeTileType('leg')).toBe('legs')
  })
})
