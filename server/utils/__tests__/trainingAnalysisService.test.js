import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { calculateExerciseStats, analyzeExercise, analyzeWorkoutProgression, buildVolumeHistory, buildSetsComparison, resolveSatzgenauWeightChange, buildTopWeightChange, resolveBodyweightCorrelation, structureAnalysisForAI } = await import(
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

  test('setsComparison wird bei vorhandener vorheriger Session mitberechnet', () => {
    const currentEx = { setDetails: [{ weight: 85, reps: 8, isWarmup: false }] }
    const previousEx = { setDetails: [{ weight: 82.5, reps: 8, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, previousEx, 7)
    assert.equal(analysis.setsComparison.length, 1)
    assert.equal(analysis.setsComparison[0].weight_change_kg, 2.5)
  })
})

// Deckt den eigentlichen User-Report ab: ein Durchschnittsgewicht-Delta wie "0,8kg mehr" ist für
// den Nutzer bedeutungslos, wenn es nur aus einer veränderten Satzverteilung entsteht - der
// Pro-Satz-Vergleich soll stattdessen die tatsächliche, satzgenaue Veränderung liefern (siehe
// JSDoc bei buildSetsComparison in trainingAnalysisService.js).
describe('buildSetsComparison', () => {
  test('gleiche Satzzahl: jeder Satz bekommt seinen eigenen Vergleichswert (kein Durchschnitts-Delta)', () => {
    const currentEx = {
      setDetails: [
        { weight: 82.5, reps: 8, isWarmup: false },
        { weight: 85, reps: 8, isWarmup: false }
      ]
    }
    const previousEx = {
      setDetails: [
        { weight: 82.5, reps: 8, isWarmup: false },
        { weight: 82.5, reps: 8, isWarmup: false }
      ]
    }
    const result = buildSetsComparison(currentEx, previousEx)
    assert.equal(result.length, 2)
    assert.equal(result[0].weight_change_kg, 0)
    assert.equal(result[0].is_new_set, false)
    assert.equal(result[1].weight_change_kg, 2.5)
    assert.equal(result[1].reps_change, 0)
    assert.equal(result[1].is_new_set, false)
  })

  test('mehr Sätze als vorher: überzählige Sätze bekommen is_new_set=true statt einen Vergleichswert', () => {
    const currentEx = {
      setDetails: [
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false }
      ]
    }
    const previousEx = {
      setDetails: [
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false }
      ]
    }
    const result = buildSetsComparison(currentEx, previousEx)
    assert.equal(result.length, 3)
    assert.equal(result[2].is_new_set, true)
    assert.equal(result[2].weight_change_kg, undefined)
    assert.equal(result[2].previous_weight, undefined)
  })

  test('previous_weight 0 (reine Körpergewichtsübung) -> is_added_weight=true statt normaler Gewichtssteigerung', () => {
    const currentEx = { setDetails: [{ weight: 3, reps: 10, isWarmup: false }] }
    const previousEx = { setDetails: [{ weight: 0, reps: 10, isWarmup: false }] }
    const result = buildSetsComparison(currentEx, previousEx)
    assert.equal(result[0].is_added_weight, true)
    assert.equal(result[0].weight_change_kg, 3)
  })

  test('kein previousEx -> alle aktuellen Sätze sind is_new_set=true', () => {
    const currentEx = {
      setDetails: [
        { weight: 50, reps: 10, isWarmup: false },
        { weight: 50, reps: 10, isWarmup: false }
      ]
    }
    const result = buildSetsComparison(currentEx, null)
    assert.equal(result.length, 2)
    assert.equal(result.every(s => s.is_new_set), true)
  })

  test('currentEx ohne echte Arbeitssätze -> leeres Array', () => {
    const currentEx = { setDetails: [{ weight: 20, reps: 15, isWarmup: true }] }
    assert.deepEqual(buildSetsComparison(currentEx, null), [])
  })

  test('Warm-ups fließen nicht in den Vergleich ein', () => {
    const currentEx = {
      setDetails: [
        { weight: 20, reps: 15, isWarmup: true },
        { weight: 80, reps: 8, isWarmup: false }
      ]
    }
    const previousEx = {
      setDetails: [
        { weight: 20, reps: 15, isWarmup: true },
        { weight: 75, reps: 8, isWarmup: false }
      ]
    }
    const result = buildSetsComparison(currentEx, previousEx)
    assert.equal(result.length, 1)
    assert.equal(result[0].set_number, 1)
    assert.equal(result[0].weight_change_kg, 5)
  })

  test('Legacy-Struktur (weight/reps/sets ohne setDetails): alle Sätze identisch, Vergleich funktioniert trotzdem', () => {
    const currentEx = { weight: 60, reps: 8, sets: 3 }
    const previousEx = { weight: 55, reps: 8, sets: 3 }
    const result = buildSetsComparison(currentEx, previousEx)
    assert.equal(result.length, 3)
    assert.equal(result.every(s => s.weight_change_kg === 5), true)
  })
})

// Deckt den konkreten User-Report ab (Bankdrücken: nur der dritte Satz +2,5kg, Session-Ø
// zeigte fälschlich "0,5kg mehr") - resolveSatzgenauWeightChange löst weight_change_kg jetzt
// satzgenau statt als Durchschnitt auf (siehe JSDoc dort und in AiFeedbackDeltaSummary.vue).
describe('resolveSatzgenauWeightChange', () => {
  test('uniform: alle veränderten Sätze haben denselben Wert -> scope "uniform", einfache Zahl', () => {
    const setsComparison = [
      { set_number: 1, weight_change_kg: 2.5, is_new_set: false },
      { set_number: 2, weight_change_kg: 2.5, is_new_set: false },
      { set_number: 3, weight_change_kg: 2.5, is_new_set: false }
    ]
    const result = resolveSatzgenauWeightChange(setsComparison, 2.5)
    assert.equal(result.weightChangeKg, 2.5)
    assert.equal(result.scope, 'uniform')
    assert.deepEqual(result.setNumbers, [])
  })

  test('partial: nur ein Satz verändert (User-Report) -> konkrete Satznummer statt Ø-Wert', () => {
    const setsComparison = [
      { set_number: 1, weight_change_kg: 0, is_new_set: false },
      { set_number: 2, weight_change_kg: 0, is_new_set: false },
      { set_number: 3, weight_change_kg: 2.5, is_new_set: false }
    ]
    // Fallback (Session-Ø) wäre hier 0,83 - das darf NICHT zurückgegeben werden.
    const result = resolveSatzgenauWeightChange(setsComparison, 0.83)
    assert.equal(result.weightChangeKg, 2.5)
    assert.equal(result.scope, 'partial')
    assert.deepEqual(result.setNumbers, [3])
  })

  test('mixed: Sätze verändern sich gegenläufig -> Fallback-Zahl, aber scope "mixed" markiert sie als unsicher', () => {
    const setsComparison = [
      { set_number: 1, weight_change_kg: 2.5, is_new_set: false },
      { set_number: 2, weight_change_kg: -2.5, is_new_set: false }
    ]
    const result = resolveSatzgenauWeightChange(setsComparison, 0)
    assert.equal(result.scope, 'mixed')
    assert.deepEqual(result.setNumbers, [1, 2])
  })

  test('none: kein Satz hat sich verändert -> 0, scope "none"', () => {
    const setsComparison = [
      { set_number: 1, weight_change_kg: 0, is_new_set: false },
      { set_number: 2, weight_change_kg: 0, is_new_set: false }
    ]
    const result = resolveSatzgenauWeightChange(setsComparison, 0)
    assert.equal(result.weightChangeKg, 0)
    assert.equal(result.scope, 'none')
    assert.deepEqual(result.setNumbers, [])
  })

  test('unknown: keine vergleichbaren Sätze (z.B. leer oder alle neu) -> Fallback-Wert, scope "unknown"', () => {
    assert.deepEqual(resolveSatzgenauWeightChange([], 1.2), { weightChangeKg: 1.2, scope: 'unknown', setNumbers: [] })
    const onlyNewSets = [{ set_number: 1, is_new_set: true }]
    assert.deepEqual(resolveSatzgenauWeightChange(onlyNewSets, 0), { weightChangeKg: 0, scope: 'unknown', setNumbers: [] })
    assert.deepEqual(resolveSatzgenauWeightChange(undefined, 3), { weightChangeKg: 3, scope: 'unknown', setNumbers: [] })
  })

  test('partial: uniform über ALLE vergleichbaren Sätze (kein is_new_set dabei) -> trotzdem scope "uniform"', () => {
    const setsComparison = [
      { set_number: 1, weight_change_kg: 5, is_new_set: false },
      { set_number: 2, weight_change_kg: 5, is_new_set: false },
      { set_number: 3, is_new_set: true } // neuer Satz, fließt nicht in den Vergleich ein
    ]
    const result = resolveSatzgenauWeightChange(setsComparison, 5)
    assert.equal(result.scope, 'uniform')
    assert.equal(result.weightChangeKg, 5)
  })
})

// Deckt die deterministische Körpergewicht-Kraft-Gegenüberstellung ab (siehe JSDoc in
// trainingAnalysisService.js) - bewusst KEINE Kausal-/Korrelationsberechnung, nur zwei
// nebeneinandergestellte Fakten. Null-Annahmen-Prinzip: ohne zwei echte Messpunkte gibt die
// Funktion null zurück statt zu schätzen.
describe('resolveBodyweightCorrelation', () => {
  test('null, wenn für die aktuelle Session kein Körpergewicht erfasst wurde', () => {
    const current = { _id: 'w3', date: '2026-01-10', athleteBodyweightKg: null }
    const all = [
      { _id: 'w3', date: '2026-01-10', athleteBodyweightKg: null },
      { _id: 'w1', date: '2026-01-01', athleteBodyweightKg: 80 }
    ]
    assert.equal(resolveBodyweightCorrelation(current, all, []), null)
  })

  test('null, wenn keine vorherige Session mit erfasstem Körpergewicht existiert', () => {
    const current = { _id: 'w2', date: '2026-01-10', athleteBodyweightKg: 81 }
    const all = [
      { _id: 'w2', date: '2026-01-10', athleteBodyweightKg: 81 },
      { _id: 'w1', date: '2026-01-01', athleteBodyweightKg: null }
    ]
    assert.equal(resolveBodyweightCorrelation(current, all, []), null)
  })

  test('berechnet Gewichtsänderung, Tage-Differenz und Kraft-Kontext korrekt', () => {
    const current = { _id: 'w3', date: '2026-01-15', athleteBodyweightKg: 82 }
    const all = [
      { _id: 'w3', date: '2026-01-15', athleteBodyweightKg: 82 },
      { _id: 'w2', date: '2026-01-08', athleteBodyweightKg: null }, // ohne Gewicht - wird übersprungen
      { _id: 'w1', date: '2026-01-01', athleteBodyweightKg: 80 }
    ]
    const exerciseAnalyses = [
      { previous: { weight: 90 }, changes: { weight_change: 5 } },
      { previous: { weight: 60 }, changes: { weight_change: -2.5 } },
      { previous: { weight: 40 }, changes: { weight_change: 0 } },
      { previous: null, changes: { weight_change: 0 } } // kein Vorher-Vergleich -> zählt nicht mit
    ]
    const result = resolveBodyweightCorrelation(current, all, exerciseAnalyses)
    assert.deepEqual(result, {
      current_bodyweight_kg: 82,
      previous_bodyweight_kg: 80,
      bodyweight_change_kg: 2,
      period_days: 14,
      strength_context: {
        exercises_compared: 3,
        exercises_with_weight_increase: 1,
        exercises_with_weight_decrease: 1,
        exercises_stable: 1
      }
    })
  })

  test('nutzt die chronologisch NÄCHSTGELEGENE vorherige Session mit Körpergewicht, nicht die älteste', () => {
    const current = { _id: 'w3', date: '2026-01-20', athleteBodyweightKg: 83 }
    const all = [
      { _id: 'w3', date: '2026-01-20', athleteBodyweightKg: 83 },
      { _id: 'w2', date: '2026-01-10', athleteBodyweightKg: 81 },
      { _id: 'w1', date: '2026-01-01', athleteBodyweightKg: 79 }
    ]
    const result = resolveBodyweightCorrelation(current, all, [])
    assert.equal(result.previous_bodyweight_kg, 81)
    assert.equal(result.period_days, 10)
  })
})

describe('structureAnalysisForAI: bodyweight_correlation', () => {
  const exerciseAnalyses = [{
    exercise: 'Bankdrücken',
    current: { weight: 100, reps: 24, sets: 3, volume: 2400 },
    previous: null,
    changes: { weight_change: 0, rep_change: 0, sets_change: 0, volume_change: 0, volume_change_percent: 0 },
    progression: 'first_session',
    period_days: 0
  }]

  test('Feld fehlt komplett, wenn keine bodyweightCorrelation übergeben wird', () => {
    const result = structureAnalysisForAI(exerciseAnalyses)
    assert.equal('bodyweight_correlation' in result, false)
  })

  test('Feld wird 1:1 durchgereicht, wenn vorhanden', () => {
    const bodyweightCorrelation = {
      current_bodyweight_kg: 82,
      previous_bodyweight_kg: 80,
      bodyweight_change_kg: 2,
      period_days: 14,
      strength_context: { exercises_compared: 1, exercises_with_weight_increase: 1, exercises_with_weight_decrease: 0, exercises_stable: 0 }
    }
    const result = structureAnalysisForAI(exerciseAnalyses, { bodyweightCorrelation })
    assert.deepEqual(result.bodyweight_correlation, bodyweightCorrelation)
  })
})

// Regel 19 (OpenAIProvider.js) / Task "1RM deterministisch in Prompt einbauen": das Backend
// berechnet den %1RM-Wert deterministisch (Regel 1 "Datenwahrheit") aus dem vom Nutzer selbst
// hinterlegten UserExerciseNote.estimatedOneRepMaxKg - die KI bekommt nur das fertige Ergebnis.
describe('analyzeExercise: geschätztes 1RM (Regel 19)', () => {
  test('kein estimatedOneRepMaxKg in userNote -> oneRepMax ist null (Null-Annahmen-Prinzip)', () => {
    const currentEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, null, 0, { userNote: null })
    assert.equal(analysis.oneRepMax, null)
  })

  test('vorhandenes estimatedOneRepMaxKg -> oneRepMax mit korrekt berechnetem %1RM', () => {
    const currentEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    const analysis = analyzeExercise('Bankdrücken', currentEx, null, 0, {
      userNote: { estimatedOneRepMaxKg: 100 }
    })
    assert.deepEqual(analysis.oneRepMax, {
      estimatedOneRepMaxKg: 100,
      currentWeightPercentOf1RM: 80
    })
  })

  test('ungültiger estimatedOneRepMaxKg-Wert (0, negativ, NaN) -> oneRepMax bleibt null', () => {
    const currentEx = { setDetails: [{ weight: 80, reps: 8, isWarmup: false }] }
    assert.equal(analyzeExercise('X', currentEx, null, 0, { userNote: { estimatedOneRepMaxKg: 0 } }).oneRepMax, null)
    assert.equal(analyzeExercise('X', currentEx, null, 0, { userNote: { estimatedOneRepMaxKg: -50 } }).oneRepMax, null)
    assert.equal(analyzeExercise('X', currentEx, null, 0, { userNote: { estimatedOneRepMaxKg: 'x' } }).oneRepMax, null)
  })
})

describe('structureAnalysisForAI: 1RM-Felder (Regel 19)', () => {
  test('estimated_1rm_kg/current_weight_percent_of_1rm fehlen, wenn kein oneRepMax vorliegt', () => {
    const exerciseAnalyses = [{
      exercise: 'Bankdrücken',
      current: { weight: 80, reps: 8, sets: 1, volume: 640 },
      previous: null,
      changes: { weight_change: 0, rep_change: 0, sets_change: 0, volume_change: 0, volume_change_percent: 0 },
      progression: 'first_session',
      period_days: 0,
      oneRepMax: null
    }]
    const result = structureAnalysisForAI(exerciseAnalyses)
    assert.equal('estimated_1rm_kg' in result.exercises[0], false)
    assert.equal('current_weight_percent_of_1rm' in result.exercises[0], false)
  })

  test('estimated_1rm_kg/current_weight_percent_of_1rm werden 1:1 durchgereicht, wenn oneRepMax vorliegt', () => {
    const exerciseAnalyses = [{
      exercise: 'Speed Squats',
      current: { weight: 80, reps: 6, sets: 3, volume: 1440 },
      previous: null,
      changes: { weight_change: 0, rep_change: 0, sets_change: 0, volume_change: 0, volume_change_percent: 0 },
      progression: 'first_session',
      period_days: 0,
      oneRepMax: { estimatedOneRepMaxKg: 100, currentWeightPercentOf1RM: 80 }
    }]
    const result = structureAnalysisForAI(exerciseAnalyses)
    assert.equal(result.exercises[0].estimated_1rm_kg, 100)
    assert.equal(result.exercises[0].current_weight_percent_of_1rm, 80)
  })
})

// User-Report: alle Sätze schwerer, aber unterschiedlich viel -> war "gemischt" und nie Steigerung;
// verschobene Pyramide (Hack Calf Raise) -> Satz-für-Satz gegenläufig, Spitze gleich.
describe('resolveSatzgenauWeightChange: gleiche Richtung vs. gegenläufig', () => {
  test('alle Sätze schwerer, unterschiedlich viel -> "increased" mit Spanne', () => {
    const result = resolveSatzgenauWeightChange([
      { set_number: 1, weight_change_kg: 5, is_new_set: false },
      { set_number: 2, weight_change_kg: 5, is_new_set: false },
      { set_number: 3, weight_change_kg: 2.5, is_new_set: false }
    ], 4.2)
    assert.equal(result.scope, 'increased')
    assert.equal(result.minKg, 2.5)
    assert.equal(result.maxKg, 5)
    assert.equal(result.weightChangeKg, 5)
  })

  test('alle Sätze leichter -> "decreased", min = kleinster Schritt', () => {
    const result = resolveSatzgenauWeightChange([
      { set_number: 1, weight_change_kg: -2.5, is_new_set: false },
      { set_number: 2, weight_change_kg: -5, is_new_set: false }
    ], 0)
    assert.equal(result.scope, 'decreased')
    assert.equal(result.minKg, -2.5)
    assert.equal(result.maxKg, -5)
  })

  test('verschobene Pyramide -> "mixed"; schwerster Satz gleich', () => {
    const sets = (weights) => ({ setDetails: weights.map((weight) => ({ reps: 12, weight })) })
    const today = sets([128, 168, 198, 168, 148, 128])
    const last = sets([88, 128, 168, 198, 168, 148])
    const comparison = buildSetsComparison(today, last)
    assert.equal(resolveSatzgenauWeightChange(comparison, 0).scope, 'mixed')
    assert.deepEqual(buildTopWeightChange(today, last), { top_weight_current: 198, top_weight_previous: 198, top_weight_change: 0 })
    const analysis = analyzeExercise('Hack Calf Raise', today, last, 3)
    assert.equal(analysis.changes.volume_change_percent, 4.5)
    assert.equal(analysis.changes.top_weight_change, 0)
  })
})

// User-Report 04.10.: Weighted Pull-Up mit 1,25-kg-Schritten. 31,25 kg wurde auf 31,3 gerundet
// (Satz 2 "+1,2 kg" statt "+1,25 kg"), und an die KI ging zusätzlich die Ø-Gewichtsänderung
// über alle Sätze ("+0,5 kg"), die zu keinem echten Satz passt.
describe('Pull-Up-Beispiel vom 04.10.: 1,25-kg-Schritte, keine Ø-Werte an die KI', () => {
  const sets = (list) => list.map(([reps, weight]) => ({ reps, weight, isWarmup: false }))
  const last = { name: 'Weighted Pull-Up', setDetails: sets([[4, 32.5], [5, 31.25], [5, 30], [5, 30], [5, 30], [5, 25], [6, 22.5]]) }
  const today = { name: 'Weighted Pull-Up', setDetails: sets([[5, 32.5], [5, 32.5], [5, 32.5], [5, 30], [5, 30], [5, 25], [6, 22.5]]) }

  test('Satzvergleich behält 2 Nachkommastellen (31,25 bleibt 31,25)', () => {
    const result = buildSetsComparison(today, last)
    assert.equal(result[1].previous_weight, 31.25)
    assert.equal(result[1].weight_change_kg, 1.25)
    assert.equal(result[2].weight_change_kg, 2.5)
    assert.equal(result[0].weight_change_kg, 0)
    assert.equal(result[0].reps_change, 1)
  })

  test('satzgenaue Gewichtsänderung: Satz 2 und 3, Spanne 1,25 bis 2,5 kg', () => {
    const resolved = resolveSatzgenauWeightChange(buildSetsComparison(today, last), 0)
    assert.equal(resolved.scope, 'increased')
    assert.deepEqual(resolved.setNumbers, [2, 3])
    assert.equal(resolved.minKg, 1.25)
    assert.equal(resolved.maxKg, 2.5)
  })

  test('Top-Listen für die KI enthalten keine Ø-Gewichtsänderung', () => {
    const analysis = analyzeExercise('Weighted Pull-Up', today, last, 5)
    const structured = structureAnalysisForAI([analysis])
    for (const entry of [...structured.top_improvements, ...structured.top_declines]) {
      assert.equal('weight_change_kg' in entry, false)
    }
  })
})

// Backlog A7: Als "letzte Session" darf nur ein abgeschlossenes Workout gelten. Entwürfe und
// nicht abgeschlossene Workouts (z.B. angefangen und nie gespeichert, mit Platzhalter-Gewicht)
// werden zum Server synchronisiert und haben die Übung ebenfalls - sie verfälschten den
// Vergleich ("nächstes Workout mit dem jüngsten anderen Workout, egal ob fertig").
describe('Vergleich nur mit abgeschlossenen Workouts (A7)', () => {
  const sets = (list) => list.map(([reps, weight]) => ({ reps, weight, isWarmup: false }))
  const workout = (id, date, extra, list) => ({
    _id: id, date, createdAt: date, completed: true,
    exercises: [{ name: 'Weighted Pull-Up', setDetails: sets(list) }],
    ...extra
  })
  const real = workout('real', '2026-09-29T08:00:00Z', {}, [[5, 30], [5, 30]])
  const draft = workout('draft', '2026-10-02T08:00:00Z', { completed: false }, [[5, 5], [5, 5]])
  const flaggedDraft = workout('flagged', '2026-10-03T08:00:00Z', { isDraft: true }, [[5, 5], [5, 5]])
  const current = workout('cur', '2026-10-04T08:00:00Z', {}, [[5, 32.5], [5, 32.5]])
  // DESC nach Datum wie in routes/workouts.js
  const all = [current, flaggedDraft, draft, real]

  test('analyzeWorkoutProgression: Entwürfe (completed:false, isDraft) werden übersprungen', () => {
    const [analysis] = analyzeWorkoutProgression(current, all)
    assert.equal(analysis.setsComparison[0].previous_weight, 30)
    assert.equal(analysis.setsComparison[0].weight_change_kg, 2.5)
    assert.equal(analysis.period_days, 5)
  })

  test('Workout ohne completed-Feld (alte Daten) zählt weiter als abgeschlossen', () => {
    const legacy = workout('legacy', '2026-09-20T08:00:00Z', {}, [[5, 27.5]])
    delete legacy.completed
    const [analysis] = analyzeWorkoutProgression(current, [current, draft, legacy])
    assert.equal(analysis.setsComparison[0].previous_weight, 27.5)
  })

  test('nur Entwürfe vorhanden -> erste Session, kein Vergleich', () => {
    const [analysis] = analyzeWorkoutProgression(current, [current, draft, flaggedDraft])
    assert.equal(analysis.previous, null)
    assert.equal(analysis.progression, 'first_session')
  })

  test('buildVolumeHistory: Entwürfe zählen nicht als Datenpunkt', () => {
    const history = buildVolumeHistory('Weighted Pull-Up', current, all)
    assert.deepEqual(history, [300, 325])
  })

  test('Körpergewicht-Vergleich: Entwurf mit Körpergewicht wird übersprungen', () => {
    const withBw = (w, kg) => ({ ...w, athleteBodyweightKg: kg })
    const cur = withBw(current, 80)
    const result = resolveBodyweightCorrelation(cur, [cur, withBw(draft, 99), withBw(real, 82)], [])
    assert.equal(result?.previous_bodyweight_kg, 82)
  })
})
