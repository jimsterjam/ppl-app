import { describe, it, expect } from 'vitest'
import { saveFocusState, readFocusState, FOCUS_STATE_MAX_AGE_MS } from '../focusStatePersistence.js'

function memoryStorage() {
  const map = new Map()
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) }
}

describe('focusStatePersistence', () => {
  it('aktive Großansicht wird für dasselbe Workout wiedergefunden', () => {
    const s = memoryStorage()
    saveFocusState(s, { workoutId: 'w1', active: true, minimized: false, now: 1000 })
    expect(readFocusState(s, 'w1', 2000)).toEqual({ minimized: false })
  })

  it('minimierter Zustand bleibt erhalten', () => {
    const s = memoryStorage()
    saveFocusState(s, { workoutId: 'w1', active: true, minimized: true, now: 1000 })
    expect(readFocusState(s, 'w1', 2000)).toEqual({ minimized: true })
  })

  it('anderes Workout: nichts wiederherstellen', () => {
    const s = memoryStorage()
    saveFocusState(s, { workoutId: 'w1', active: true, minimized: false, now: 1000 })
    expect(readFocusState(s, 'w2', 2000)).toBeNull()
  })

  it('Schließen (active=false) löscht den Eintrag', () => {
    const s = memoryStorage()
    saveFocusState(s, { workoutId: 'w1', active: true, minimized: false, now: 1000 })
    saveFocusState(s, { workoutId: 'w1', active: false, minimized: false, now: 1500 })
    expect(readFocusState(s, 'w1', 2000)).toBeNull()
  })

  it('zu alter Eintrag (über 6 Stunden) wird verworfen', () => {
    const s = memoryStorage()
    saveFocusState(s, { workoutId: 'w1', active: true, minimized: false, now: 1000 })
    expect(readFocusState(s, 'w1', 1000 + FOCUS_STATE_MAX_AGE_MS + 1)).toBeNull()
  })

  it('kaputter Eintrag oder fehlender Speicher: null statt Fehler', () => {
    const s = memoryStorage()
    s.setItem('fbe_focus_state_v1', '{kaputt')
    expect(readFocusState(s, 'w1')).toBeNull()
    expect(readFocusState(null, 'w1')).toBeNull()
  })
})
