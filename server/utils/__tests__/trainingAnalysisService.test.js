import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { calculateExerciseStats, analyzeExercise } = await import(
  join(__dirname, '../../services/trainingAnalysisService.js')
)

// Deckt die reps-Semantik-Änderung ab (Durchschnitt -> Gesamtsumme über alle Arbeitssätze,
// siehe JSDoc in trainingAnalysisService.js), sowohl für den modernen setDetails-Pfad als
// auch den Legacy-Pfad (weight/reps/sets ohne setDetails) - bisher gab es dafür KEINEN
// Unit-Test, obwohl genau hier zuletzt ein Bug (bedeutungslose Bruchzahlen wie "-0,2 Wdh.")
// gefixt wurde. Diese Tests sollen eine Rückkehr zur alten Durchschnitts-Semantik verhindern.
describe('calculateExerciseStats', () => {
  test('modern (setDetails): reps ist die Summe über alle Arbeitssätze, nicht der Durchschnitt', () => {
    const exercise = {
      setDetails: [
        { weight: 80, reps: 10, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 6, isWarmup: false }
      ]
    }
    const stats = calculateExerciseStats(exercise)
    assert.equal(stats.reps, 24) // 10+8+6, NICHT (10+8+6)/3 = 8
    assert.equal(stats.sets, 3)
    assert.equal(stats.weight, 80)
    assert.equal(stats.volume, 80 * 10 + 80 * 8 + 80 * 6)
  })

  test('modern (setDetails): Warm-up-Sätze werden ignoriert (weder Gewicht noch Reps noch Volumen)', () => {
    const exercise = {
      setDetails: [
        { weight: 20, reps: 15, isWarmup: true },
        { weight: 100, reps: 5, isWarmup: false },
        { weight: 100, reps: 5, isWarmup: false }
      ]
    }
    const stats = calculateExerciseStats(exercise)
    assert.equal(stats.reps, 10)
    assert.equal(stats.sets, 2)
    assert.equal(stats.weight, 100)
  })

  test('modern (setDetails): nur Warm-up-Sätze -> null (keine echten Arbeitssätze)', () => {
    const exercise = { setDetails: [{ weight: 20, reps: 15, isWarmup: true }] }
    assert.equal(calculateExerciseStats(exercise), null)
  })

  test('modern (setDetails): unterschiedliche Gewichte pro Satz -> Durchschnittsgewicht gerundet auf 1 Nachkommastelle', () => {
    const exercise = {
      setDetails: [
        { weight: 80, reps: 10, isWarmup: false },
        { weight: 82.5, reps: 8, isWarmup: false },
        { weight: 85, reps: 6, isWarmup: false }
      ]
    }
    const stats = calculateExerciseStats(exercise)
    assert.equal(stats.weight, 82.5) // (80+82.5+85)/3 = 82.5
  })

  test('Legacy (weight/reps/sets ohne setDetails): reps wird mit sets multipliziert (Gesamtsumme, konsistent zum modernen Pfad)', () => {
    const exercise = { weight: 60, reps: 8, sets: 4 }
    const stats = calculateExerciseStats(exercise)
    assert.equal(stats.reps, 32) // 8 * 4, nicht 8 (Wdh. pro Satz)
    assert.equal(stats.sets, 4)
    assert.equal(stats.weight, 60)
    assert.equal(stats.volume, 60 * 8 * 4) // Volumen-Formel unverändert korrekt
  })

  test('kein Exercise-Objekt -> null statt Crash', () => {
    assert.equal(calculateExerciseStats(null), null)
    assert.equal(calculateExerciseStats(undefined), null)
  })

  test('leeres Exercise-Objekt (weder setDetails noch legacy-Felder) -> null', () => {
    assert.equal(calculateExerciseStats({}), null)
  })

  test('leeres setDetails-Array fällt auf Legacy-Felder zurück, wenn vorhanden', () => {
    const exercise = { setDetails: [], weight: 50, reps: 10, sets: 3 }
    const stats = calculateExerciseStats(exercise)
    assert.equal(stats.reps, 30)
  })
})

describe('analyzeExercise', () => {
  test('erste Session (kein previousEx) -> progression "first_session", changes alle 0', () => {
    const currentEx = { setDetails: [{ weight: 50, reps: 10, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, null, 0)
    assert.equal(analysis.progression, 'first_session')
    assert.equal(analysis.previous, null)
    assert.deepEqual(analysis.changes, {
      weight_change: 0,
      rep_change: 0,
      sets_change: 0,
      volume_change: 0,
      volume_change_percent: 0
    })
  })

  test('current ohne echte Arbeitssätze -> gesamte Analyse ist null', () => {
    const currentEx = { setDetails: [{ weight: 20, reps: 15, isWarmup: true }] }
    assert.equal(analyzeExercise('Bankdrücken', currentEx, null, 0), null)
  })

  test('rep_change ist eine ganze Zahl (Differenz zweier Gesamtsummen), kein Rundungsartefakt mehr', () => {
    const currentEx = {
      setDetails: [
        { weight: 80, reps: 10, isWarmup: false },
        { weight: 80, reps: 9, isWarmup: false },
        { weight: 80, reps: 9, isWarmup: false }
      ]
    } // total reps = 28
    const previousEx = {
      setDetails: [
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false }
      ]
    } // total reps = 24
    const analysis = analyzeExercise('Bankdrücken', currentEx, previousEx, 7)
    assert.equal(analysis.changes.rep_change, 4) // 28 - 24, ganze Zahl
    assert.equal(Number.isInteger(analysis.changes.rep_change), true)
  })

  test('mehr Gewicht als vorher -> progression "positive"', () => {
    const currentEx = { setDetails: [{ weight: 85, reps: 8, isWarmup: false }] }
    const previousEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, previousEx, 7)
    assert.equal(analysis.progression, 'positive')
    assert.equal(analysis.changes.weight_change, 5)
  })

  test('deutlich weniger Gewicht als vorher -> progression "negative"', () => {
    const currentEx = { setDetails: [{ weight: 70, reps: 8, isWarmup: false }] }
    const previousEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, previousEx, 7)
    assert.equal(analysis.progression, 'negative')
  })

  test('identisches Gewicht/Volumen wie vorher -> progression "stable"', () => {
    const currentEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const previousEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, previousEx, 7)
    assert.equal(analysis.progression, 'stable')
    assert.equal(analysis.changes.weight_change, 0)
    assert.equal(analysis.changes.rep_change, 0)
  })

  test('sets_change zählt nur echte Arbeitssätze (Warm-ups bereits vorher rausgefiltert)', () => {
    const currentEx = {
      setDetails: [
        { weight: 20, reps: 15, isWarmup: true },
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false }
      ]
    } // 3 Arbeitssätze
    const previousEx = {
      setDetails: [
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false }
      ]
    } // 2 Arbeitssätze
    const analysis = analyzeExercise('Bankdrücken', currentEx, previousEx, 7)
    assert.equal(analysis.changes.sets_change, 1)
  })

  test('period_days und period-Beschreibung werden korrekt aus daysDiff abgeleitet', () => {
    const currentEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const previousEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }

    assert.equal(analyzeExercise('X', currentEx, previousEx, 0).period, 'same day')
    assert.equal(analyzeExercise('X', currentEx, previousEx, 3).period, '3 days')
    assert.equal(analyzeExercise('X', currentEx, previousEx, 7).period, '1 week')
    assert.equal(analyzeExercise('X', currentEx, previousEx, 35).period, '5 weeks')
  })

  test('Notiz am aktuellen Exercise wird getrimmt übernommen, sonst null', () => {
    const currentExWithNote = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }], note: '  Technik gefühlt besser  ' }
    const currentExWithoutNote = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    assert.equal(analyzeExercise('X', currentExWithNote).note, 'Technik gefühlt besser')
    assert.equal(analyzeExercise('X', currentExWithoutNote).note, null)
  })
})
