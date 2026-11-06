import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProgressFindings,
  buildRepRangeFindings,
  buildSwapFindings,
  buildMuscleSetFindings,
  buildRecommendations,
  buildFindings,
  compareBestSets,
  confidenceFor,
  goalOf
} from '../monthlyFindings.js'

const DAY = 24 * 60 * 60 * 1000
const START = new Date('2026-09-01T10:00:00Z').getTime()
const sets = (weight, reps, count = 3) => Array.from({ length: count }, () => ({ weight, reps }))
// Eine Einheit im Format von countableSessions().
const session = (dayOffset, entries, workoutExtra = {}) => ({
  date: new Date(START + dayOffset * DAY),
  workout: { goal: 'hypertrophy', ...workoutExtra },
  exercises: entries.map((e) => ({ key: `name:${e.name.toLowerCase()}`, name: e.name, sets: e.sets, ex: { name: e.name, ...(e.ex || {}) } }))
})
const bench = (weight, reps, ex) => ({ name: 'Bench Press', sets: sets(weight, reps), ex })

describe('compareBestSets (relevante Verbesserung: +2,5 % Gewicht bei gleichen/mehr Wdh. oder +1 Wdh. bei gleichem Gewicht)', () => {
  test('Gewicht +2,5 % bei gleichen Wiederholungen = verbessert', () => {
    assert.equal(compareBestSets({ weight: 80, reps: 8 }, { weight: 82, reps: 8 }), 'improved')
  })
  test('Gewicht nur +1,25 % = unverändert (Schwelle)', () => {
    assert.equal(compareBestSets({ weight: 80, reps: 8 }, { weight: 81, reps: 8 }), 'unchanged')
  })
  test('mehr Gewicht, aber weniger Wiederholungen = unverändert', () => {
    assert.equal(compareBestSets({ weight: 80, reps: 8 }, { weight: 90, reps: 5 }), 'unchanged')
  })
  test('gleiches Gewicht +1 Wiederholung = verbessert, -1 = verschlechtert', () => {
    assert.equal(compareBestSets({ weight: 60, reps: 8 }, { weight: 60, reps: 9 }), 'improved')
    assert.equal(compareBestSets({ weight: 60, reps: 8 }, { weight: 60, reps: 7 }), 'worsened')
  })
  test('weniger Gewicht (-2,5 %) bei gleichen Wiederholungen = verschlechtert', () => {
    assert.equal(compareBestSets({ weight: 80, reps: 8 }, { weight: 78, reps: 8 }), 'worsened')
  })
  test('Körpergewicht (0 kg): +1 Wiederholung = verbessert', () => {
    assert.equal(compareBestSets({ weight: 0, reps: 8 }, { weight: 0, reps: 9 }), 'improved')
  })
})

describe('Sicherheit des Befunds', () => {
  test('3 = niedrig, 4-5 = mittel, ab 6 = hoch', () => {
    assert.deepEqual([3, 4, 5, 6, 9].map(confidenceFor), ['low', 'medium', 'medium', 'high', 'high'])
  })
})

describe('buildProgressFindings (Mindestdaten)', () => {
  test('zwei Einheiten: keine Aussage', () => {
    const r = buildProgressFindings([session(0, [bench(60, 8)]), session(20, [bench(70, 8)])])
    assert.equal(r.items.length, 0)
    assert.equal(r.insufficientCount, 1)
  })
  test('3 Einheiten, aber nur 10 Tage Abstand: keine Aussage', () => {
    const r = buildProgressFindings([session(0, [bench(60, 8)]), session(5, [bench(65, 8)]), session(10, [bench(70, 8)])])
    assert.equal(r.items.length, 0)
  })
  test('3 Einheiten über 3 Wochen mit Steigerung: verbessert, Sicherheit niedrig', () => {
    const r = buildProgressFindings([session(0, [bench(60, 8)]), session(10, [bench(62.5, 8)]), session(21, [bench(65, 8)])])
    assert.equal(r.items[0].type, 'improved')
    assert.equal(r.items[0].confidence, 'low')
    assert.deepEqual(r.items[0].from, { weight: 60, reps: 8 })
    assert.deepEqual(r.items[0].to, { weight: 65, reps: 8 })
  })
  test('Stillstand braucht 4 Einheiten über 3 Wochen; mit 3 Einheiten keine Stillstands-Aussage', () => {
    const three = buildProgressFindings([session(0, [bench(60, 8)]), session(10, [bench(60, 8)]), session(21, [bench(60, 8)])])
    assert.equal(three.items.length, 0)
    const four = buildProgressFindings([0, 7, 14, 21].map((d) => session(d, [bench(60, 8)])))
    assert.equal(four.items[0].type, 'unchanged')
    assert.equal(four.items[0].weeks, 3)
    assert.equal(four.items[0].confidence, 'medium')
  })
  test('Aufwärmsätze werden vom Aufrufer entfernt; unterschiedliche Ziele werden nicht vermischt', () => {
    const r = buildProgressFindings([
      session(0, [bench(60, 8)]),
      session(10, [bench(100, 3)], { goal: 'strength' }),
      session(21, [bench(62.5, 8)])
    ])
    // Nur 2 vergleichbare Muskelaufbau-Einheiten und 1 Kraft-Einheit -> keine Aussage.
    assert.equal(r.items.length, 0)
  })
  test('Zeit-Übungen und Ziele ohne Kraft/Muskelaufbau zählen nicht', () => {
    const timed = (d) => session(d, [bench(0, 30, { measureMode: 'time' })])
    assert.equal(buildProgressFindings([0, 10, 21, 28].map(timed)).items.length, 0)
    const explosive = (d) => session(d, [bench(60, 5, { trainingType: 'explosive' })])
    assert.equal(buildProgressFindings([0, 10, 21, 28].map(explosive)).items.length, 0)
  })
  test('goalOf: Übungs-Trainingsart gewinnt vor dem Workout-Ziel', () => {
    assert.equal(goalOf({ goal: 'hypertrophy' }, { trainingType: 'strength' }), 'strength')
    assert.equal(goalOf({ goal: 'strength' }, {}), 'strength')
    assert.equal(goalOf({ goal: null }, {}), null)
  })
})

describe('buildRepRangeFindings', () => {
  const heavy = (d) => session(d, [bench(100, 3)], { goal: 'hypertrophy' }) // 3 Wdh. liegen unter 8-12
  test('Hinweis nur ab 3 Einheiten und mehr als der Hälfte außerhalb', () => {
    assert.equal(buildRepRangeFindings([heavy(0), heavy(7)]).items.length, 0)
    const r = buildRepRangeFindings([heavy(0), heavy(7), heavy(14)])
    assert.equal(r.items[0].hint, true)
    assert.equal(r.items[0].percentInRange, 0)
    assert.deepEqual([r.items[0].min, r.items[0].max], [8, 12])
  })
  test('7 Wiederholungen sind neutral: weder im Bereich noch ein Hinweis', () => {
    const seven = (d) => session(d, [bench(70, 7)])
    const r = buildRepRangeFindings([seven(0), seven(7), seven(14)])
    assert.equal(r.items[0].hint, false)
    assert.equal(r.items[0].percentInRange, 0)
  })
  test('Kraft-Bereich 1-6', () => {
    const strong = (d) => session(d, [bench(100, 5)], { goal: 'strength' })
    const r = buildRepRangeFindings([strong(0), strong(7), strong(14)])
    assert.equal(r.items[0].percentInRange, 100)
    assert.equal(r.items[0].hint, false)
  })
})

describe('buildSwapFindings', () => {
  const swap = (d, scope, to = 'Incline Press', extra = {}) => session(d, [{ name: to, sets: sets(40, 10), ex: { replacedFrom: 'Bench Press', replacedScope: scope } }], { planDayId: 'day1', ...extra })
  test('im Plan gespeichert = dauerhafter Wechsel', () => {
    const r = buildSwapFindings([swap(0, 'plan')])
    assert.deepEqual(r.items, [{ type: 'permanent', from: 'Bench Press', to: 'Incline Press' }])
  })
  test('dieselbe neue Übung in 3 Einheiten = dauerhaft', () => {
    const r = buildSwapFindings([swap(0, 'today'), swap(7, 'today'), swap(14, 'today')])
    assert.equal(r.items[0].type, 'permanent')
  })
  test('3 "nur heute"-Wechsel auf unterschiedliche Übungen an derselben Planposition = Hopping', () => {
    const r = buildSwapFindings([swap(0, 'today', 'A Press'), swap(7, 'today', 'B Press'), swap(14, 'today', 'C Press')])
    assert.deepEqual(r.items, [{ type: 'hopping', from: 'Bench Press', count: 3 }])
  })
  test('2 Wechsel oder keine Planposition = kein Hopping', () => {
    assert.equal(buildSwapFindings([swap(0, 'today', 'A'), swap(7, 'today', 'B')]).items.length, 0)
    const noPlan = (d, to) => swap(d, 'today', to, { planDayId: '' })
    assert.equal(buildSwapFindings([noPlan(0, 'A'), noPlan(7, 'B'), noPlan(14, 'C')]).items.length, 0)
  })
  test('ohne replacedFrom (ältere Workouts) keine Befunde', () => {
    assert.equal(buildSwapFindings([session(0, [bench(60, 8)])]).items.length, 0)
  })
})

describe('buildMuscleSetFindings (nur Zahl, keine Bewertung)', () => {
  test('Sätze pro Woche je Muskelgruppe', () => {
    const map = new Map([['b1', 'Brust']])
    const s = [session(0, [{ name: 'Bench Press', sets: sets(60, 8, 4), ex: { exerciseId: 'b1' } }]), session(7, [{ name: 'Bench Press', sets: sets(60, 8, 4), ex: { exerciseId: 'b1' } }])]
    assert.deepEqual(buildMuscleSetFindings(s, map, 4).items, [{ muscle: 'Brust', setsPerWeek: 2 }])
  })
  test('ohne Zuordnung leer', () => {
    assert.deepEqual(buildMuscleSetFindings([session(0, [bench(60, 8)])], new Map(), 4).items, [])
  })
  test('Befunde enthalten keine Bewertungsfelder', () => {
    const f = buildMuscleSetFindings([session(0, [{ name: 'X', sets: sets(1, 1), ex: { exerciseId: 'b1' } }])], new Map([['b1', 'Brust']]), 4)
    assert.deepEqual(Object.keys(f.items[0]).sort(), ['muscle', 'setsPerWeek'])
  })
})

describe('Empfehlungen (höchstens 3, "nichts zu ändern" ist gültig)', () => {
  test('Reihenfolge: verschlechtert, Stillstand, Wiederholungs-Hinweis, Hopping; maximal 3', () => {
    const recs = buildRecommendations({
      progress: { items: [{ type: 'improved' }, { type: 'unchanged' }, { type: 'worsened' }, { type: 'unchanged' }] },
      repRange: { items: [{ hint: true }] },
      swaps: { items: [{ type: 'hopping' }] }
    })
    assert.deepEqual(recs, [{ section: 'progress', index: 2 }, { section: 'progress', index: 1 }, { section: 'progress', index: 3 }])
  })
  test('nur Verbesserungen = nichts zu ändern', () => {
    const f = buildFindings([session(0, [bench(60, 8)]), session(10, [bench(62.5, 8)]), session(21, [bench(65, 8)])])
    assert.equal(f.nothingToChange, true)
    assert.deepEqual(f.recommendations, [])
  })
})
