import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { __setFocusCatalogForTests } from '../nextSessionFocus.js'
import {
  buildStagnationDiagnosis,
  estimateOneRepMax,
  roundToStep,
  MAX_ITEMS,
  WINDOW_DAYS
} from '../stagnationDiagnosis.js'

__setFocusCatalogForTests([
  { name: 'Bankdrücken Langhantel', name_en: 'barbell bench press', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } },
  { name: 'Kniebeugen mit der Langhantel', name_en: 'barbell high bar squat', category: 'Legs', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } },
  { name: 'Seitheben Kurzhantel', name_en: 'dumbbell lateral raise', category: 'Push', equipment: 'Kurzhanteln', aiMetadata: { exerciseType: 'isolation' } },
  { name: 'Klimmzüge', name_en: 'pull-up', category: 'Pull', equipment: 'Körpergewicht', aiMetadata: { exerciseType: 'compound' } },
  { name: 'Box Jumps', name_en: 'box jump', category: 'Legs', equipment: 'Körpergewicht', aiMetadata: { exerciseType: 'compound' } }
])

const NOW = new Date('2026-10-01T12:00:00Z')
const daysAgo = (d) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)
const sets = (reps, weight, extra = {}) => reps.map((r) => ({ reps: r, weight, done: true, ...extra }))

// Ein Workout pro Eintrag: [TageZurück, Übungsname, Wdh.-Liste, Gewicht, Ziel]
function workouts(rows, { goal = 'hypertrophy' } = {}) {
  return rows.map(([ago, name, reps, weight, g, extra]) => ({
    date: daysAgo(ago),
    goal: g || goal,
    exercises: [{ name, setDetails: reps ? sets(reps, weight, extra) : [] }]
  }))
}

const diagnose = (list) => buildStagnationDiagnosis(list, { now: NOW })
const only = (list) => {
  const result = diagnose(list)
  assert.equal(result.items.length, 1, `erwartet 1 Eintrag, bekommen ${JSON.stringify(result.items)}`)
  return result.items[0]
}

describe('Hilfsfunktionen', () => {
  test('estimateOneRepMax nach Epley, Einzelwiederholung = Gewicht', () => {
    assert.equal(estimateOneRepMax(100, 1), 100)
    assert.equal(Math.round(estimateOneRepMax(100, 5) * 100) / 100, 116.67)
    assert.equal(estimateOneRepMax(0, 5), 0)
    assert.equal(estimateOneRepMax(80, 0), 0)
  })

  test('roundToStep rundet auf den Steigerungsschritt ab', () => {
    assert.equal(roundToStep(72, 2.5), 70)
    assert.equal(roundToStep(22.5, 2), 22)
    assert.equal(roundToStep(0, 2.5), 0)
  })
})

describe('kein Stillstand', () => {
  test('regelmäßige Steigerung -> keine Diagnose', () => {
    const list = workouts([
      [35, 'Bankdrücken Langhantel', [8, 8, 8], 70],
      [28, 'Bankdrücken Langhantel', [9, 9, 8], 70],
      [21, 'Bankdrücken Langhantel', [10, 9, 9], 70],
      [14, 'Bankdrücken Langhantel', [10, 10, 10], 72.5],
      [7, 'Bankdrücken Langhantel', [11, 10, 10], 72.5],
      [1, 'Bankdrücken Langhantel', [12, 11, 11], 72.5]
    ])
    const result = diagnose(list)
    assert.deepEqual(result.items, [])
    assert.equal(result.stalledCount, 0)
    assert.equal(result.analyzedExercises, 1)
  })

  test('zu wenige Sessions für eine Aussage -> keine Diagnose', () => {
    const list = workouts([
      [21, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [14, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [7, 'Bankdrücken Langhantel', [8, 8, 8], 80]
    ])
    assert.deepEqual(diagnose(list).items, [])
  })

  test('Stillstand erst seit 2 Wochen -> noch keine Diagnose', () => {
    const list = workouts([
      [16, 'Bankdrücken Langhantel', [10, 10, 10], 80],
      [12, 'Bankdrücken Langhantel', [9, 9, 9], 80],
      [8, 'Bankdrücken Langhantel', [9, 9, 9], 80],
      [4, 'Bankdrücken Langhantel', [10, 9, 9], 80],
      [1, 'Bankdrücken Langhantel', [9, 9, 9], 80]
    ])
    assert.deepEqual(diagnose(list).items, [])
  })

  test('Übung seit über 3 Wochen nicht mehr trainiert -> ignoriert', () => {
    const list = workouts([
      [70, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [60, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [50, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [40, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [30, 'Bankdrücken Langhantel', [8, 8, 8], 80]
    ])
    assert.deepEqual(diagnose(list).items, [])
  })

  test('Körpergewicht- und explosive Übungen werden nicht bewertet', () => {
    const list = [
      ...workouts([
        [35, 'Klimmzüge', [8, 8, 8], 0],
        [28, 'Klimmzüge', [8, 8, 8], 0],
        [21, 'Klimmzüge', [8, 8, 8], 0],
        [14, 'Klimmzüge', [8, 8, 8], 0],
        [7, 'Klimmzüge', [8, 8, 8], 0]
      ]),
      ...workouts([
        [35, 'Box Jumps', [5, 5, 5], 10],
        [28, 'Box Jumps', [5, 5, 5], 10],
        [21, 'Box Jumps', [5, 5, 5], 10],
        [14, 'Box Jumps', [5, 5, 5], 10],
        [7, 'Box Jumps', [5, 5, 5], 10]
      ])
    ]
    assert.deepEqual(diagnose(list).items, [])
  })

  test('Workouts außerhalb von 12 Wochen und in der Zukunft zählen nicht', () => {
    const list = workouts([
      [WINDOW_DAYS + 30, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [WINDOW_DAYS + 20, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [WINDOW_DAYS + 10, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [-5, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [1, 'Bankdrücken Langhantel', [8, 8, 8], 80]
    ])
    assert.deepEqual(diagnose(list).items, [])
  })
})

describe('Ursachen', () => {
  test('immer exakt gleich (Muskelaufbau) -> repeating, eine Wdh. mehr', () => {
    const item = only(workouts([
      [28, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [21, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [14, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [7, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [1, 'Bankdrücken Langhantel', [8, 8, 8], 80]
    ]))
    assert.equal(item.cause, 'repeating')
    assert.equal(item.weeks, 4)
    assert.equal(item.sessions, 4)
    assert.equal(item.weight, 80)
    assert.equal(item.reps, 8)
    assert.equal(item.nextReps, 9)
    assert.equal(item.nextWeight, null)
  })

  test('immer exakt gleich bei 12 Wdh. -> mehr Gewicht statt mehr Wdh.', () => {
    const item = only(workouts([
      [28, 'Bankdrücken Langhantel', [12, 12, 12], 60],
      [21, 'Bankdrücken Langhantel', [12, 12, 12], 60],
      [14, 'Bankdrücken Langhantel', [12, 12, 12], 60],
      [7, 'Bankdrücken Langhantel', [12, 12, 12], 60],
      [1, 'Bankdrücken Langhantel', [12, 12, 12], 60]
    ]))
    assert.equal(item.cause, 'repeating')
    assert.equal(item.nextReps, null)
    assert.equal(item.nextWeight, 62.5)
  })

  test('Kraft-Schema immer exakt gleich -> mehr Gewicht (Kurzhantel-Schritt 2 kg gilt nicht für Langhantel)', () => {
    const item = only(workouts([
      [28, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 5], 100],
      [21, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 5], 100],
      [14, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 5], 100],
      [7, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 5], 100],
      [1, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 5], 100]
    ], { goal: 'strength' }))
    assert.equal(item.cause, 'repeating')
    assert.equal(item.goal, 'strength')
    assert.equal(item.nextWeight, 102.5)
  })

  test('schwankend ohne neue Bestleistung -> plateau mit Entlastungsgewicht', () => {
    const item = only(workouts([
      [28, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 5], 100],
      [21, 'Kniebeugen mit der Langhantel', [5, 5, 5, 4, 4], 100],
      [14, 'Kniebeugen mit der Langhantel', [5, 5, 4, 4, 3], 100],
      [7, 'Kniebeugen mit der Langhantel', [5, 5, 5, 5, 4], 100],
      [1, 'Kniebeugen mit der Langhantel', [5, 5, 5, 4, 4], 100]
    ], { goal: 'strength' }))
    assert.equal(item.cause, 'plateau')
    assert.equal(item.weeks, 4)
    assert.equal(item.deloadWeight, 90)
  })

  test('Entlastungsgewicht bei Kurzhanteln auf 2-kg-Schritte', () => {
    const item = only(workouts([
      [28, 'Seitheben Kurzhantel', [12, 12, 12], 12],
      [21, 'Seitheben Kurzhantel', [11, 11, 10], 12],
      [14, 'Seitheben Kurzhantel', [12, 11, 10], 12],
      [7, 'Seitheben Kurzhantel', [11, 11, 11], 12],
      [1, 'Seitheben Kurzhantel', [12, 10, 10], 12]
    ]))
    assert.equal(item.cause, 'plateau')
    assert.equal(item.deloadWeight, 10)
  })

  test('über 8 Wochen ohne Bestleistung -> plateau_long mit Schema-Wechsel', () => {
    const rows = [[63, 'Bankdrücken Langhantel', [10, 10, 10], 80]]
    for (let ago = 56; ago >= 0; ago -= 7) rows.push([ago || 1, 'Bankdrücken Langhantel', [9, 10, 9], 80])
    const item = only(workouts(rows))
    assert.equal(item.cause, 'plateau_long')
    assert.equal(item.weeks, 9)
    assert.equal(item.switchTo, 'strength')
  })

  test('zu selten trainiert -> low_frequency hat Vorrang vor plateau', () => {
    const item = only(workouts([
      [62, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [42, 'Bankdrücken Langhantel', [7, 7, 8], 80],
      [22, 'Bankdrücken Langhantel', [8, 7, 7], 80],
      [2, 'Bankdrücken Langhantel', [8, 8, 7], 80]
    ]))
    assert.equal(item.cause, 'low_frequency')
    assert.equal(item.sessions, 3)
    assert.equal(item.weeks, 8)
  })

  test('oft eingetragen, aber kaum Sätze abgehakt -> insufficient_data', () => {
    const item = only(workouts([
      [28, 'Bankdrücken Langhantel', [8, 8, 8], 80, null, { done: false }],
      [21, 'Bankdrücken Langhantel', null, 0],
      [14, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [7, 'Bankdrücken Langhantel', [8, 8, 8], 80, null, { done: false }],
      [1, 'Bankdrücken Langhantel', null, 0]
    ]))
    assert.equal(item.cause, 'insufficient_data')
    assert.equal(item.logged, 5)
    assert.equal(item.complete, 1)
  })

  test('Sessions mit anderem Ziel zählen nicht mit (Kraft-Sessions im Muskelaufbau-Verlauf)', () => {
    // Die Kraft-Sessions (5x100) würden als Bestleistung jeden Muskelaufbau-Verlauf "stagnieren" lassen.
    const list = [
      ...workouts([
        [30, 'Bankdrücken Langhantel', [5, 5, 5], 100, 'strength'],
        [20, 'Bankdrücken Langhantel', [5, 5, 5], 100, 'strength']
      ]),
      ...workouts([
        [21, 'Bankdrücken Langhantel', [8, 8, 8], 70],
        [14, 'Bankdrücken Langhantel', [9, 9, 8], 70],
        [7, 'Bankdrücken Langhantel', [10, 9, 9], 70],
        [1, 'Bankdrücken Langhantel', [10, 10, 10], 70]
      ])
    ]
    assert.deepEqual(diagnose(list).items, [])
  })

  test('Aufwärmsätze zählen nicht zur Leistung', () => {
    const list = workouts([
      [28, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [21, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [14, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [7, 'Bankdrücken Langhantel', [8, 8, 8], 80],
      [1, 'Bankdrücken Langhantel', [8, 8, 8], 80]
    ])
    // Ein schwerer Aufwärmsatz darf keine "neue Bestleistung" erzeugen.
    list[4].exercises[0].setDetails.unshift({ reps: 3, weight: 120, isWarmup: true, done: true })
    assert.equal(only(list).cause, 'repeating')
  })
})

describe('Ausgabe', () => {
  test('höchstens MAX_ITEMS Einträge, längster Stillstand zuerst, Datenhinweise zuletzt', () => {
    const stalledFor = (name, weeks) => {
      const rows = [[weeks * 7 + 1, name, [8, 8, 8], 50]]
      for (let ago = weeks * 7 - 6; ago >= 1; ago -= 7) rows.push([ago, name, [8, 8, 8], 50])
      return workouts(rows)
    }
    const dataProblem = workouts([
      [21, 'Kniebeugen mit der Langhantel', null, 0],
      [14, 'Kniebeugen mit der Langhantel', null, 0],
      [7, 'Kniebeugen mit der Langhantel', null, 0]
    ])
    const result = diagnose([
      ...stalledFor('Bankdrücken Langhantel', 4),
      ...stalledFor('Seitheben Kurzhantel', 6),
      ...stalledFor('Rudern Langhantel', 5),
      ...stalledFor('Schulterdrücken', 7),
      ...dataProblem
    ])
    assert.equal(result.items.length, MAX_ITEMS)
    assert.deepEqual(result.items.map((i) => i.weeks), [7, 6, 5])
    assert.equal(result.stalledCount, 4)
    assert.equal(result.analyzedExercises, 5)
    assert.ok(result.items.every((i) => i.cause !== 'insufficient_data'))
  })

  test('ohne Progressionslogik: unavailable statt leerer Liste', () => {
    const result = buildStagnationDiagnosis([], { now: NOW, engine: null })
    assert.equal(result.unavailable, true)
  })

  test('leere oder kaputte Eingaben führen nicht zu Fehlern', () => {
    assert.deepEqual(diagnose(null).items, [])
    assert.deepEqual(diagnose([{}, { date: 'kein Datum' }, { date: daysAgo(1), exercises: [{}] }]).items, [])
  })
})
