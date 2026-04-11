import { describe, it, expect } from 'vitest'
import {
  normalizeWorkoutFingerprint,
  mergeWorkoutLists,
  dedupeWorkoutsForStats
} from '../workoutMerge.js'

// ------------------------------------
// normalizeWorkoutFingerprint
// ------------------------------------
describe('normalizeWorkoutFingerprint', () => {
  it('erzeugt einen stabilen Fingerprint für ein vollständiges Workout', () => {
    const w = {
      date: '2024-01-15',
      name: 'Push Day',
      type: 'push',
      exercises: [
        { setDetails: [{ reps: 10, weight: 100 }, { reps: 8, weight: 110 }] }
      ]
    }
    const fp = normalizeWorkoutFingerprint(w)
    expect(fp).toBe('2024-01-15|push day|push|1|1880')
  })

  it('normalisiert auf Kleinbuchstaben', () => {
    const w = { date: '2024-01-15', name: 'PUSH DAY', type: 'Push', exercises: [] }
    expect(normalizeWorkoutFingerprint(w)).toBe('2024-01-15|push day|push|0|0')
  })

  it('fällt auf leere Werte zurück für fehlendes Workout', () => {
    const fp = normalizeWorkoutFingerprint(undefined)
    expect(fp).toBe('|||0|0')
  })

  it('berechnet Volume aus einfachen sets/reps/weight ohne setDetails', () => {
    const w = {
      date: '2024-02-01',
      name: 'Legs',
      type: 'legs',
      exercises: [{ sets: 3, reps: 12, weight: 80 }]
    }
    const fp = normalizeWorkoutFingerprint(w)
    expect(fp).toContain('2880')
  })
})

// ------------------------------------
// mergeWorkoutLists
// ------------------------------------
describe('mergeWorkoutLists', () => {
  it('Server-Einträge überschreiben lokale Einträge bei gleichem Timestamp', () => {
    const server = [{ _id: 'abc', name: 'Server', updatedAt: '2024-01-01T10:00:00Z' }]
    const local = [{ _id: 'abc', name: 'Local', updatedAt: '2024-01-01T10:00:00Z' }]
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Server')
  })

  it('lokale Einträge gewinnen bei neuerem Timestamp', () => {
    const server = [{ _id: 'abc', name: 'Server', updatedAt: '2024-01-01T09:00:00Z' }]
    const local = [{ _id: 'abc', name: 'Local', updatedAt: '2024-01-01T10:00:00Z' }]
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Local')
  })

  it('offline-erstellte Workouts bleiben immer erhalten', () => {
    const server = []
    const local = [{ _id: 'offline_123', name: 'Offline', _offlineCreated: true }]
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('offline_123')
  })

  it('offline_*-ID-Präfix gilt als offline-erstellt', () => {
    const server = []
    const local = [{ _id: 'offline_abc', name: 'Test' }]
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(1)
  })

  it('Draft overlay-t einen bestehenden Server-Eintrag', () => {
    const server = [{ _id: 'abc', name: 'Final', completed: true }]
    const local = [{ _id: 'abc', name: 'Draft', _isDraft: true, isDraft: true, completed: false }]
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(1)
    expect(result[0]._isDraft).toBe(true)
    expect(result[0].completed).toBe(false)
  })

  it('kombiniert einmalige Server- und lokale IDs', () => {
    const server = [{ _id: 's1', name: 'S1' }]
    const local = [{ _id: 'l1', name: 'L1' }]
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(2)
  })

  it('übergeht Einträge ohne _id', () => {
    const server = [{ name: 'NoId' }]
    const local = []
    const result = mergeWorkoutLists(server, local)
    expect(result).toHaveLength(0)
  })

  it('funktioniert mit null/undefined Inputs', () => {
    expect(mergeWorkoutLists(null, null)).toEqual([])
    expect(mergeWorkoutLists(undefined, undefined)).toEqual([])
  })
})

// ------------------------------------
// dedupeWorkoutsForStats
// ------------------------------------
describe('dedupeWorkoutsForStats', () => {
  it('entfernt Duplikat-IDs', () => {
    const list = [
      { _id: 'a', date: '2024-01-01' },
      { _id: 'a', date: '2024-01-01' }
    ]
    const result = dedupeWorkoutsForStats(list)
    expect(result).toHaveLength(1)
  })

  it('filtert Drafts heraus', () => {
    const list = [
      { _id: 'a', date: '2024-01-01' },
      { _id: 'draft-1', _isDraft: true, date: '2024-01-02' }
    ]
    const result = dedupeWorkoutsForStats(list)
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('a')
  })

  it('funktioniert mit einem leeren Array', () => {
    expect(dedupeWorkoutsForStats([])).toEqual([])
  })

  it('funktioniert mit null', () => {
    expect(dedupeWorkoutsForStats(null)).toEqual([])
  })
})
