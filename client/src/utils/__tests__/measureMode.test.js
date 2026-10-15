import { describe, it, expect } from 'vitest'
import { sanitizeMeasureMode, showsReps, showsWeight, showsTime, formatDuration, measureModeField } from '../measureMode.js'

describe('Messart', () => {
  it('unbekannt/fehlend = weight; Felder je Messart', () => {
    expect(sanitizeMeasureMode(undefined)).toBe('weight')
    expect(sanitizeMeasureMode('x')).toBe('weight')
    expect([showsReps('weight'), showsWeight('weight'), showsTime('weight')]).toEqual([true, true, false])
    expect([showsReps('time'), showsWeight('time'), showsTime('time')]).toEqual([false, false, true])
    expect([showsReps('repsTime'), showsWeight('repsTime'), showsTime('repsTime')]).toEqual([true, false, true])
  })
  it('Dauer als Sekunden bzw. m:ss', () => {
    expect(formatDuration(45)).toBe('45')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(600)).toBe('10:00')
    expect(formatDuration(null)).toBe('0')
  })
  it('nur abweichende Messart wird gespeichert', () => {
    expect(measureModeField('weight')).toEqual({})
    expect(measureModeField(undefined)).toEqual({})
    expect(measureModeField('time')).toEqual({ measureMode: 'time' })
  })
})
