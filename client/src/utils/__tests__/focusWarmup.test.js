import { describe, it, expect } from 'vitest'
import { findPendingWarmup } from '../focusWarmup.js'

const ex = (rows) => ({ setDetails: rows })
const W = (extra = {}) => ({ isWarmup: true, reps: 10, weight: 20, ...extra })
const S = (extra = {}) => ({ reps: 8, weight: 60, ...extra })

describe('findPendingWarmup (Aufwärmsätze in der Großansicht)', () => {
  it('liefert den ersten Aufwärmsatz mit Nummer und Anzahl', () => {
    expect(findPendingWarmup({ exercise: ex([W(), W(), S(), S()]), exIndex: 2, handled: new Set() }))
      .toEqual({ exIndex: 2, rowIndex: 0, number: 1, total: 2 })
  })

  it('erledigte/übersprungene Sätze werden übergangen, danach null', () => {
    const exercise = ex([W(), W(), S()])
    expect(findPendingWarmup({ exercise, exIndex: 0, handled: new Set(['0:0']) })).toEqual({ exIndex: 0, rowIndex: 1, number: 2, total: 2 })
    expect(findPendingWarmup({ exercise, exIndex: 0, handled: new Set(['0:0', '0:1']) })).toBeNull()
  })

  it('ohne Aufwärmsätze, bei Zeitübungen oder nach dem ersten Arbeitssatz: nichts', () => {
    expect(findPendingWarmup({ exercise: ex([S(), S()]), exIndex: 0, handled: new Set() })).toBeNull()
    expect(findPendingWarmup({ exercise: ex([W(), S()]), exIndex: 0, handled: new Set(), weightMode: false })).toBeNull()
    expect(findPendingWarmup({ exercise: ex([W(), S({ done: true }), S()]), exIndex: 0, handled: new Set() })).toBeNull()
  })

  it('Schlüssel gelten je Übung: gleicher Satzindex in anderer Übung bleibt offen', () => {
    expect(findPendingWarmup({ exercise: ex([W(), S()]), exIndex: 1, handled: new Set(['0:0']) }))
      .toEqual({ exIndex: 1, rowIndex: 0, number: 1, total: 1 })
  })
})
