import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { isWorkoutEditWindowExpired, getWorkoutEditWindowHours } = await import(
  join(__dirname, '../workoutEditWindow.js')
)

// Regressionstests für das nachträgliche Bearbeitungsfenster abgeschlossener Workouts
// (siehe PUT /:id in routes/workouts.js). Dieser Bereich war zwischenzeitlich als komplette
// Hartsperre implementiert (jedes Bearbeiten eines abgeschlossenen Workouts wurde immer
// abgelehnt) - das war ein Missverständnis der Anforderung und wurde auf ein 24h-Zeitfenster
// korrigiert. Diese Tests decken beide Fehlerrichtungen ab: fälschlich blockieren UND
// fälschlich erlauben.
describe('isWorkoutEditWindowExpired', () => {
  const ONE_HOUR_MS = 60 * 60 * 1000

  test('Workout ist noch nicht abgeschlossen -> niemals "expired" (normale Bearbeitung bleibt möglich)', () => {
    const result = isWorkoutEditWindowExpired({ completed: false, completedAt: null })
    assert.equal(result.expired, false)
    assert.equal(result.deadline, null)
  })

  test('Workout ohne completedAt (Altbestand von vor Einführung des Felds) -> nicht blockieren', () => {
    const result = isWorkoutEditWindowExpired({ completed: true, completedAt: null })
    assert.equal(result.expired, false)
    assert.equal(result.deadline, null)
  })

  test('abgeschlossen vor 1h, Fenster 24h -> noch innerhalb des Fensters, nicht expired', () => {
    const now = Date.now()
    const completedAt = new Date(now - 1 * ONE_HOUR_MS)
    const result = isWorkoutEditWindowExpired({ completed: true, completedAt }, { windowHours: 24, now })
    assert.equal(result.expired, false)
    assert.equal(result.windowHours, 24)
  })

  test('abgeschlossen vor genau 24h und 1ms, Fenster 24h -> abgelaufen', () => {
    const now = Date.now()
    const completedAt = new Date(now - 24 * ONE_HOUR_MS - 1)
    const result = isWorkoutEditWindowExpired({ completed: true, completedAt }, { windowHours: 24, now })
    assert.equal(result.expired, true)
  })

  test('abgeschlossen vor genau 24h, Fenster 24h -> Grenzfall noch NICHT abgelaufen (> statt >=)', () => {
    const now = Date.now()
    const completedAt = new Date(now - 24 * ONE_HOUR_MS)
    const result = isWorkoutEditWindowExpired({ completed: true, completedAt }, { windowHours: 24, now })
    assert.equal(result.expired, false)
  })

  test('abgeschlossen vor 48h, Fenster 24h -> abgelaufen', () => {
    const now = Date.now()
    const completedAt = new Date(now - 48 * ONE_HOUR_MS)
    const result = isWorkoutEditWindowExpired({ completed: true, completedAt }, { windowHours: 24, now })
    assert.equal(result.expired, true)
  })

  test('kürzeres konfiguriertes Fenster (z.B. 1h) wird respektiert', () => {
    const now = Date.now()
    const completedAt = new Date(now - 2 * ONE_HOUR_MS)
    const result = isWorkoutEditWindowExpired({ completed: true, completedAt }, { windowHours: 1, now })
    assert.equal(result.expired, true)
    assert.equal(result.windowHours, 1)
  })

  test('existing=null/undefined -> nicht expired (Aufrufer prüft 404 separat)', () => {
    assert.equal(isWorkoutEditWindowExpired(null).expired, false)
    assert.equal(isWorkoutEditWindowExpired(undefined).expired, false)
  })
})

describe('getWorkoutEditWindowHours', () => {
  test('gültiger Env-Wert wird übernommen', () => {
    assert.equal(getWorkoutEditWindowHours('48'), 48)
  })

  test('fehlender/leerer Wert fällt auf 24h zurück', () => {
    assert.equal(getWorkoutEditWindowHours(undefined), 24)
    assert.equal(getWorkoutEditWindowHours(''), 24)
  })

  test('ungültiger Wert (0, negativ, nicht-numerisch) fällt auf 24h zurück', () => {
    assert.equal(getWorkoutEditWindowHours('0'), 24)
    assert.equal(getWorkoutEditWindowHours('-5'), 24)
    assert.equal(getWorkoutEditWindowHours('abc'), 24)
  })
})
