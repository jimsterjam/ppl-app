import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMonthlyReport,
  countSessionsInPeriod,
  evaluateReportDue,
  REPORT_MIN_SESSIONS,
  REPORT_PERIOD_DAYS,
  MAX_CURVE_EXERCISES
} from '../monthlyReport.js'
import { __setFocusCatalogForTests, getProgressionEngine } from '../nextSessionFocus.js'

__setFocusCatalogForTests([
  { name: 'Bankdrücken Langhantel', name_en: 'barbell bench press', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } },
  { name: 'Kniebeugen', name_en: 'squat', category: 'Legs', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
])

const NOW = new Date('2026-10-01T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (d) => new Date(NOW.getTime() - d * DAY)
const sets = (weight, reps, count = 3) => Array.from({ length: count }, () => ({ reps, weight, done: true }))
const workout = (ago, exercises, extra = {}) => ({ date: daysAgo(ago), goal: 'hypertrophy', exercises, ...extra })
const bench = (weight, reps = 8, count = 3) => ({ name: 'Bankdrücken Langhantel', setDetails: sets(weight, reps, count) })

describe('evaluateReportDue (Absprache Paul 10.10.: mind. 12 Einheiten in 28 Tagen, erster Bericht nach 4 Wochen)', () => {
  test('Konstanten wie vereinbart', () => {
    assert.equal(REPORT_MIN_SESSIONS, 12)
    assert.equal(REPORT_PERIOD_DAYS, 28)
  })

  test('erster Bericht: erstes Workout muss mindestens 28 Tage her sein', () => {
    assert.deepEqual(evaluateReportDue({ now: NOW, firstWorkoutDate: daysAgo(27) }), { due: false, reason: 'first_workout_too_recent' })
    assert.deepEqual(evaluateReportDue({ now: NOW, firstWorkoutDate: null }), { due: false, reason: 'first_workout_too_recent' })
    assert.equal(evaluateReportDue({ now: NOW, firstWorkoutDate: daysAgo(28) }).due, true)
  })

  test('weitere Berichte: frühestens 28 Tage nach dem letzten', () => {
    assert.deepEqual(evaluateReportDue({ now: NOW, lastPeriodEnd: daysAgo(27) }), { due: false, reason: 'too_soon' })
    assert.equal(evaluateReportDue({ now: NOW, lastPeriodEnd: daysAgo(28) }).due, true)
  })

  test('mit 11 Einheiten kein Bericht, mit 12 ja', () => {
    assert.deepEqual(evaluateReportDue({ now: NOW, lastPeriodEnd: daysAgo(40), sessionsInPeriod: 11 }), { due: false, reason: 'too_few_sessions' })
    assert.equal(evaluateReportDue({ now: NOW, lastPeriodEnd: daysAgo(40), sessionsInPeriod: 12 }).due, true)
  })

  test('ohne Angabe zur Einheitenzahl wird sie nicht geprüft', () => {
    assert.equal(evaluateReportDue({ now: NOW, lastPeriodEnd: daysAgo(40) }).due, true)
  })
})

describe('countSessionsInPeriod', () => {
  test('zählt nur Workouts mit Arbeitssätzen im Zeitraum', () => {
    const workouts = [
      workout(1, [bench(80)]),
      workout(3, [{ name: 'Bankdrücken Langhantel', setDetails: [{ reps: 10, weight: 40, isWarmup: true }] }]), // nur Aufwärmen
      workout(4, [{ name: 'Bankdrücken Langhantel', setDetails: [{ reps: 8, weight: 80, done: false }] }]), // nicht abgehakt
      workout(5, []), // leer
      workout(29, [bench(80)]) // vor dem Zeitraum
    ]
    assert.equal(countSessionsInPeriod(workouts, NOW), 1)
  })
})

describe('buildMonthlyReport', () => {
  test('ohne Progressionslogik: nicht verfügbar statt falscher Zahlen', () => {
    assert.deepEqual(buildMonthlyReport([workout(1, [bench(80)])], { now: NOW, engine: null }), { unavailable: true })
  })

  test('Zahlen: Einheiten, Sätze, Volumen; Aufwärmsätze zählen nicht', () => {
    const workouts = [
      workout(2, [{ name: 'Bankdrücken Langhantel', setDetails: [{ reps: 10, weight: 40, isWarmup: true }, ...sets(80, 8, 3)] }]),
      workout(9, [bench(82.5, 5, 2)])
    ]
    const { facts, periodStart, periodEnd } = buildMonthlyReport(workouts, { now: NOW })
    assert.equal(periodEnd.getTime(), NOW.getTime())
    assert.equal(periodStart.getTime(), daysAgo(28).getTime())
    assert.equal(facts.totals.sessions, 2)
    assert.equal(facts.totals.sets, 5)
    assert.equal(facts.totals.volumeKg, 3 * 80 * 8 + 2 * 82.5 * 5)
    assert.equal(facts.version, 1)
  })

  test('Wochen: vier Blöcke, Summe = Einheiten im Zeitraum', () => {
    const workouts = [26, 20, 19, 12, 5, 1].map((ago) => workout(ago, [bench(80)]))
    const { facts } = buildMonthlyReport(workouts, { now: NOW })
    assert.equal(facts.weeks.length, 4)
    assert.deepEqual(facts.weeks.map((w) => w.sessions), [1, 2, 1, 2])
    assert.equal(facts.weeks.reduce((sum, w) => sum + w.sessions, 0), facts.totals.sessions)
  })

  test('Vergleich mit dem Vormonat und Fazit-Schlüssel', () => {
    const current = [1, 5, 9].map((ago) => workout(ago, [bench(80)]))
    const previous2 = [30, 40].map((ago) => workout(ago, [bench(80)]))
    assert.equal(buildMonthlyReport([...current, ...previous2], { now: NOW }).facts.conclusion, 'more')
    assert.equal(buildMonthlyReport([...current, ...previous2, workout(50, [bench(80)])], { now: NOW }).facts.previous.sessions, 3)
    const same = [...current, ...[30, 40, 45].map((ago) => workout(ago, [bench(80)]))]
    assert.equal(buildMonthlyReport(same, { now: NOW }).facts.conclusion, 'same')
    const fewer = [workout(1, [bench(80)]), ...[30, 35, 40].map((ago) => workout(ago, [bench(80)]))]
    assert.equal(buildMonthlyReport(fewer, { now: NOW }).facts.conclusion, 'fewer')
    const first = buildMonthlyReport(current, { now: NOW }).facts
    assert.equal(first.conclusion, 'first')
    assert.equal(first.previous, null)
  })

  test('Bestleistung: nur Übungen mit früherer Einheit, die übertroffen wurde', () => {
    const workouts = [
      workout(2, [bench(85), { name: 'Kniebeugen', setDetails: sets(100, 5) }]),
      workout(40, [bench(80), { name: 'Kniebeugen', setDetails: sets(100, 5) }]) // Kniebeugen unverändert
    ]
    assert.equal(buildMonthlyReport(workouts, { now: NOW }).facts.totals.personalBests, 1)
    // ohne frühere Einheit keine Bestleistung
    assert.equal(buildMonthlyReport([workout(2, [bench(85)])], { now: NOW }).facts.totals.personalBests, 0)
  })

  test('Kurve: schwerster Arbeitssatz je Einheit, mind. 2 Punkte, Aufwärmen zählt nicht', () => {
    const workouts = [
      workout(10, [{ name: 'Bankdrücken Langhantel', setDetails: [{ reps: 10, weight: 100, isWarmup: true }, { reps: 8, weight: 70, done: true }, { reps: 6, weight: 75, done: true }] }]),
      workout(3, [bench(77.5, 5)]),
      workout(2, [{ name: 'Kniebeugen', setDetails: sets(100, 5) }]) // nur ein Punkt -> keine Kurve
    ]
    const { facts } = buildMonthlyReport(workouts, { now: NOW })
    assert.equal(facts.exercises.length, 1)
    const curve = facts.exercises[0]
    assert.equal(curve.name, 'Bankdrücken Langhantel')
    assert.equal(curve.metric, 'weight')
    assert.deepEqual(curve.points.map((p) => [p.value, p.reps]), [[75, 6], [77.5, 5]])
    assert.equal(curve.points[0].date, daysAgo(10).toISOString())
  })

  test('Körpergewicht-Übung ohne Zusatzgewicht: Kurve zeigt Wiederholungen', () => {
    const pullUps = (reps) => ({ name: 'Klimmzüge', setDetails: reps.map((r) => ({ reps: r, weight: 0, done: true })) })
    const { facts } = buildMonthlyReport([workout(8, [pullUps([6, 5])]), workout(2, [pullUps([8, 6])])], { now: NOW })
    assert.equal(facts.exercises[0].metric, 'reps')
    assert.deepEqual(facts.exercises[0].points.map((p) => p.value), [6, 8])
  })

  test('Kurven: höchstens MAX_CURVE_EXERCISES, häufigste zuerst', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Übung ${String(i).padStart(2, '0')}`)
    const workouts = [1, 2].map((ago) => workout(ago, names.map((name) => ({ name, setDetails: sets(50 + ago, 8) }))))
    workouts.push(workout(3, [{ name: 'Übung 11', setDetails: sets(50, 8) }]))
    const { facts } = buildMonthlyReport(workouts, { now: NOW })
    assert.equal(facts.exercises.length, MAX_CURVE_EXERCISES)
    assert.equal(facts.exercises[0].name, 'Übung 11')
  })

  test('Stillstand: gleiche Übung 5 Wochen lang unverändert steht im Bericht; Datenhinweise nicht', () => {
    const workouts = [28, 21, 14, 7, 1].map((ago) => workout(ago, [bench(80)]))
    const { facts } = buildMonthlyReport(workouts, { now: NOW })
    assert.equal(facts.stagnation.items.length, 1)
    assert.equal(facts.stagnation.items[0].cause, 'repeating')
    assert.ok(facts.stagnation.analyzedExercises >= 1)

    // viele Einträge ohne echte Sätze -> nur Datenhinweis -> nicht im Bericht
    const sparse = [28, 21, 14, 7, 1].map((ago) => workout(ago, [{ name: 'Bankdrücken Langhantel', setDetails: [{ reps: 8, weight: 80, done: false }] }]))
    assert.deepEqual(buildMonthlyReport(sparse, { now: NOW }).facts.stagnation.items, [])
  })

  test('Engine ist die echte Progressionslogik des Clients', () => {
    assert.ok(getProgressionEngine())
  })
})
