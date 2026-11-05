import { describe, it, expect, vi } from 'vitest'
import { undoRestSet } from '../undoRestSet.js'

const exercises = () => [
  { setDetails: [{ reps: 5, done: true }, { reps: 5, done: true }, { reps: 5, done: false }] },
  { setDetails: [{ reps: 8, done: false }] }
]
const isDone = (row) => row.done === true

describe('Letzten Satz zurücknehmen (Pause)', () => {
  it('nimmt den Haken des Satzes zurück, zu dem die Pause gehört', () => {
    const ex = exercises()
    const toggle = vi.fn((row) => { row.done = !row.done })
    const clearRest = vi.fn()
    expect(undoRestSet({ exercises: ex, exIndex: 0, rowIndex: 1, isDone, toggle, clearRest })).toBe('undone')
    expect(toggle).toHaveBeenCalledWith(ex[0].setDetails[1], 0, 1)
    expect(ex[0].setDetails[1].done).toBe(false)
    expect(ex[0].setDetails[0].done).toBe(true) // andere Sätze bleiben
    expect(clearRest).not.toHaveBeenCalled() // das Beenden der Pause übernimmt toggleRowDone
  })

  it('Satz schon offen oder unbekannt: nur die Pause beenden, nichts umschalten', () => {
    for (const [exIndex, rowIndex] of [[0, 2], [5, 0], [0, 9], [-1, -1]]) {
      const toggle = vi.fn()
      const clearRest = vi.fn()
      expect(undoRestSet({ exercises: exercises(), exIndex, rowIndex, isDone, toggle, clearRest })).toBe('cleared')
      expect(toggle).not.toHaveBeenCalled()
      expect(clearRest).toHaveBeenCalledTimes(1)
    }
  })

  it('ohne Übungsliste kein Fehler', () => {
    const clearRest = vi.fn()
    expect(undoRestSet({ exercises: undefined, exIndex: 0, rowIndex: 0, isDone, toggle: vi.fn(), clearRest })).toBe('cleared')
    expect(clearRest).toHaveBeenCalled()
  })
})
