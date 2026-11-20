import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeExercise, withoutUnusedMeasureFields, timeChangeSeconds, timedSnapshotFields, resolveRepsSetChanges, resolveSatzgenauWeightChange } from '../../services/trainingAnalysisService.js'

// Fund Jimmy 20.11.: "Handhop Position Hold" (Zeit halten) stand im Feedback als "20 Wiederholungen mehr und 2 Sätze mehr, bei gleichem
// Gewicht". In den Sätzen standen Wdh./kg, die der Nutzer nie gesehen hat (Standard 10 Wdh./0 kg), Zähler und Gewicht gehören dort nicht hin.
const timed = (sets, extra = {}) => ({ name: 'Handhop Position Hold', measureMode: 'time', setDetails: sets.map((seconds) => ({ reps: 10, weight: 0, durationSeconds: seconds, done: true })), ...extra })

describe('Zeit halten: keine Wiederholungen und kein Gewicht in der Auswertung', () => {
  it('2 Sätze mehr bei gleicher Satzzeit: Wdh.- und Gewichtsänderung 0, Zeit und Sätze gezählt', () => {
    const analysis = analyzeExercise('Handhop Position Hold', timed([30, 30, 30, 30]), timed([30, 30]), 7)
    assert.equal(analysis.changes.rep_change, 0)
    assert.equal(analysis.changes.weight_change, 0)
    assert.equal(analysis.changes.sets_change, 2)
    assert.equal(analysis.timeChangeSeconds, 60)
    assert.equal(analysis.measureMode, 'time')
    assert.equal(analysis.timeTrend, 'more')
    assert.deepEqual(resolveRepsSetChanges(analysis.setsComparison), [])
    assert.equal(resolveSatzgenauWeightChange(analysis.setsComparison, 0).scope, 'none')
  })

  it('Gegenprobe: mit echten Wdh. und kg bleibt es bei der normalen Rechnung (keine Messart)', () => {
    const normal = (sets) => ({ name: 'Bench Press', setDetails: sets.map((reps) => ({ reps, weight: 60, done: true })) })
    const analysis = analyzeExercise('Bench Press', normal([10, 10, 10, 10]), normal([10, 10]), 7)
    assert.equal(analysis.changes.rep_change, 20)
    assert.equal(analysis.changes.sets_change, 2)
    assert.equal(analysis.measureMode, undefined)
    assert.equal('timeChangeSeconds' in analysis, false)
    assert.deepEqual(timedSnapshotFields(analysis), {})
  })

  it('Wiederholungen in Zeit: Wdh. zählen weiter, kg nicht', () => {
    const repsTime = (sets) => ({ name: 'Burpees', measureMode: 'repsTime', setDetails: sets.map((reps) => ({ reps, weight: 5, durationSeconds: 60, done: true })) })
    const analysis = analyzeExercise('Burpees', repsTime([12, 12]), repsTime([10, 10]), 7)
    assert.equal(analysis.changes.rep_change, 4)
    assert.equal(analysis.changes.weight_change, 0)
    assert.equal(analysis.timeChangeSeconds, null)
  })

  it('weniger gehalten: negative Zeitänderung', () => {
    assert.equal(timeChangeSeconds(timed([20, 20]), timed([30, 30])), -20)
    assert.equal(analyzeExercise('x', timed([20, 20]), timed([30, 30]), 7).timeTrend, 'less')
  })

  it('Gegenprobe: ohne frühere Zeit, ohne Vorgänger oder bei anderer Messart kein Zeitvergleich', () => {
    const noDuration = { name: 'x', measureMode: 'time', setDetails: [{ reps: 10, weight: 0, done: true }] }
    assert.equal(timeChangeSeconds(timed([30]), noDuration), null)
    assert.equal(timeChangeSeconds(timed([30]), null), null)
    assert.equal(timeChangeSeconds({ name: 'x', setDetails: [{ reps: 5, weight: 5, durationSeconds: 30 }] }, timed([30])), null)
    assert.equal(analyzeExercise('x', timed([30, 30]), null, 0).timeChangeSeconds, null)
  })

  it('timedSnapshotFields: Messart und Sekunden; ohne Zeitvergleich nur die Messart', () => {
    assert.deepEqual(timedSnapshotFields({ measureMode: 'time', timeChangeSeconds: 60 }), { measure_mode: 'time', time_change_seconds: 60 })
    assert.deepEqual(timedSnapshotFields({ measureMode: 'time', timeChangeSeconds: null }), { measure_mode: 'time' })
    assert.deepEqual(timedSnapshotFields({ measureMode: 'repsTime', timeChangeSeconds: null }), { measure_mode: 'repsTime' })
    assert.deepEqual(timedSnapshotFields({}), {})
    assert.deepEqual(timedSnapshotFields(null), {})
  })

  it('withoutUnusedMeasureFields ändert die Eingabe nicht und lässt normale Übungen unverändert', () => {
    const original = timed([30])
    const copy = withoutUnusedMeasureFields(original)
    assert.equal(original.setDetails[0].reps, 10)
    assert.equal(copy.setDetails[0].reps, 0)
    assert.equal(copy.setDetails[0].durationSeconds, 30)
    const normal = { name: 'x', setDetails: [{ reps: 5, weight: 50 }] }
    assert.equal(withoutUnusedMeasureFields(normal), normal)
    assert.equal(withoutUnusedMeasureFields(null), null)
  })
})
