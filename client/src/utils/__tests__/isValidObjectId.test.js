import { describe, test, expect } from 'vitest'
import { isValidObjectId } from '../workoutHelpers'

// isValidObjectId ist das Sicherheitsnetz gegen den Bug, bei dem eine temporäre offline_-/
// draft-ID (statt einer echten MongoDB-ObjectId) unverändert an /:id/ai-analysis geschickt
// wurde - siehe Kommentar in workoutHelpers.js und main.js (reconcileCallback-Fix).
describe('isValidObjectId', () => {
  test('echte 24-stellige Hex-ObjectId -> true', () => {
    expect(isValidObjectId('6aa4ee36273e241dba70b257')).toBe(true)
  })

  test('Großbuchstaben-Hex ist ebenfalls gültig', () => {
    expect(isValidObjectId('6AA4EE36273E241DBA70B257')).toBe(true)
  })

  test('offline_-ID -> false', () => {
    expect(isValidObjectId('offline_1789140289434_czwvqjx8p')).toBe(false)
  })

  test('draft--ID -> false', () => {
    expect(isValidObjectId('draft-abc123')).toBe(false)
  })

  test('zu kurz/zu lang -> false', () => {
    expect(isValidObjectId('6aa4ee36273e241dba70b25')).toBe(false) // 23 Zeichen
    expect(isValidObjectId('6aa4ee36273e241dba70b2577')).toBe(false) // 25 Zeichen
  })

  test('leer/undefined/null -> false', () => {
    expect(isValidObjectId('')).toBe(false)
    expect(isValidObjectId(undefined)).toBe(false)
    expect(isValidObjectId(null)).toBe(false)
  })

  test('nicht-hex Zeichen -> false', () => {
    expect(isValidObjectId('6aa4ee36273e241dba70b25g')).toBe(false)
  })
})
