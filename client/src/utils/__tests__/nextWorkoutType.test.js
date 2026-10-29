import { describe, it, expect } from 'vitest'
import { getNextWorkoutType } from '../nextWorkoutType.js'

describe('getNextWorkoutType', () => {
  it('Push → Pull → Legs → Push', () => {
    expect(getNextWorkoutType('push')).toBe('pull')
    expect(getNextWorkoutType('pull')).toBe('legs')
    expect(getNextWorkoutType('legs')).toBe('push')
  })
  it('ohne Workout oder nach Full Body: Push', () => {
    expect(getNextWorkoutType(null)).toBe('push')
    expect(getNextWorkoutType('fullbody')).toBe('push')
  })
})
