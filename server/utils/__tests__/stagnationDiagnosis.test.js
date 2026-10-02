import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { __setFocusCatalogForTests } from '../nextSessionFocus.js'
import {
  buildStagnationDiagnosis,
  applyAcknowledgements,
  validateAckInput,
  upsertAck,
  removeAck,
  estimateOneRepMax,
  roundToStep,
  MAX_ITEMS,
  WINDOW_DAYS,
  ACK_DAYS,
  MAX_ACKS
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

  test('seltener als im eigenen Rhythmus -> low_frequency hat Vorrang vor plateau', () => {
    // Bisher jede Woche (Bestleistung vor ~10 Wochen), seitdem nur noch alle ~3 Wochen.
    const item = only(workouts([
      [84, 'Bankdrücken Langhantel', [8, 8, 8], 75],
      [77, 'Bankdrücken Langhantel', [9, 8, 8], 75],
      [70, 'Bankdrücken Langhantel', [9, 9, 9], 77.5],
      [63, 'Bankdrücken Langhantel', [10, 9, 9], 77.5],
      [42, 'Bankdrücken Langhantel', [9, 9, 8], 77.5],
      [21, 'Bankdrücken Langhantel', [9, 9, 9], 77.5],
      [1, 'Bankdrücken Langhantel', [9, 8, 8], 77.5]
    ]))
    assert.equal(item.cause, 'low_frequency')
    assert.equal(item.sessions, 3)
    assert.equal(item.usualDays, 7)
    assert.equal(item.recentDays, 21)
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
    const diagnosis = diagnose([
      ...stalledFor('Bankdrücken Langhantel', 4),
      ...stalledFor('Seitheben Kurzhantel', 6),
      ...stalledFor('Rudern Langhantel', 5),
      ...stalledFor('Schulterdrücken', 7),
      ...dataProblem
    ])
    assert.equal(diagnosis.items.length, 5)
    assert.equal(diagnosis.items[4].cause, 'insufficient_data')
    assert.equal(diagnosis.analyzedExercises, 5)
    const result = applyAcknowledgements(diagnosis, [], NOW)
    assert.equal(result.items.length, MAX_ITEMS)
    assert.deepEqual(result.items.map((i) => i.weeks), [7, 6, 5])
    assert.equal(result.stalledCount, 4)
    assert.equal(result.snoozedCount, 0)
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

describe('Sonderfall: bewusst geplantes Training (7x/Woche, schwer/leicht im Wechsel)', () => {
  test('schwere Kniebeugen nur alle 12 Tage, Festigungsphase -> kein "zu selten"', () => {
    const list = [
      ...workouts([83, 71, 59].map((d, i) => [d, 'Kniebeugen mit der Langhantel', [5, 5, 5], 120 + i * 2.5]), { goal: 'strength' }),
      ...workouts([47, 35, 23, 11].map((d, i) => [d, 'Kniebeugen mit der Langhantel', i % 2 ? [5, 5, 4] : [5, 4, 4], 125]), { goal: 'strength' })
    ]
    const result = diagnose(list)
    assert.ok(result.items.every((i) => i.cause !== 'low_frequency'), JSON.stringify(result.items))
  })

  test('leichte Tage unter gleichem Namen zählen nicht als Einheit ohne Bestleistung (3 statt 10)', () => {
    const list = []
    for (let d = 83; d >= 22; d -= 7) list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', [5, 5, 5], 120 + Math.floor((83 - d) / 14) * 2.5]], { goal: 'strength' }))
    for (const d of [15, 8, 1]) list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', [5, 5, 4], 130]], { goal: 'strength' }))
    for (let d = 80; d >= 1; d -= 3.5) list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', [3, 3, 3, 3, 3, 3], 75]], { goal: 'strength' }))
    // Nur die 3 schweren Einheiten seit der Bestleistung zählen (vorher 10 inkl. leichter Tage).
    const item = only(list)
    assert.equal(item.sessions, 3)
    assert.equal(item.weeks, 3)
    assert.equal(item.weight, 130)
  })

  test('nur leichte Tage seit der Bestleistung -> keine Diagnose', () => {
    const list = []
    for (const [d, kg] of [[50, 120], [43, 122.5], [36, 125], [29, 127.5]]) list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', [5, 5, 5], kg]], { goal: 'strength' }))
    for (let d = 26; d >= 1; d -= 3.5) list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', [3, 3, 3], 75]], { goal: 'strength' }))
    assert.deepEqual(diagnose(list).items, [])
  })

  test('leichte Tage verdecken keinen echten Stillstand der schweren Tage', () => {
    const list = []
    // schwer: 6 Wochen immer 130 kg mit wechselnden Wiederholungen, leicht dazwischen
    list.push(...workouts([[50, 'Kniebeugen mit der Langhantel', [5, 5, 5], 130]], { goal: 'strength' }))
    for (const [d, reps] of [[43, [5, 5, 4]], [36, [5, 4, 4]], [29, [5, 5, 4]], [22, [4, 4, 4]], [15, [5, 4, 4]], [8, [5, 5, 4]], [1, [5, 4, 4]]]) {
      list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', reps, 130]], { goal: 'strength' }))
    }
    for (let d = 48; d >= 2; d -= 3.5) list.push(...workouts([[d, 'Kniebeugen mit der Langhantel', [3, 3, 3], 80]], { goal: 'strength' }))
    const item = only(list)
    assert.equal(item.cause, 'plateau')
    assert.equal(item.sessions, 7)
  })
})

describe('"Ist so geplant"', () => {
  const diagnosis = () => diagnose(workouts([
    [28, 'Bankdrücken Langhantel', [8, 8, 8], 80],
    [21, 'Bankdrücken Langhantel', [8, 8, 8], 80],
    [14, 'Bankdrücken Langhantel', [8, 8, 8], 80],
    [7, 'Bankdrücken Langhantel', [8, 8, 8], 80],
    [1, 'Bankdrücken Langhantel', [8, 8, 8], 80]
  ]))

  test('Einträge tragen einen stabilen Schlüssel', () => {
    assert.equal(diagnosis().items[0].key, 'name:bankdrücken langhantel')
  })

  test('aktive Bestätigung blendet aus, abgelaufene fragt erneut nach', () => {
    const d = diagnosis()
    const key = d.items[0].key
    const active = applyAcknowledgements(d, [{ key, cause: 'repeating', until: daysAgo(-10) }], NOW)
    assert.deepEqual(active.items, [])
    assert.equal(active.snoozedCount, 1)
    assert.equal(active.stalledCount, 0)

    const expired = applyAcknowledgements(d, [{ key, cause: 'repeating', until: daysAgo(1) }], NOW)
    assert.equal(expired.items.length, 1)
    assert.equal(expired.items[0].recheck, true)
  })

  test('Bestätigung gilt nur für dieselbe Ursache', () => {
    const d = diagnosis()
    const result = applyAcknowledgements(d, [{ key: d.items[0].key, cause: 'plateau', until: daysAgo(-10) }], NOW)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].recheck, undefined)
  })

  test('validateAckInput nimmt nur Schlüssel + bekannte Ursache an', () => {
    assert.deepEqual(validateAckInput({ key: 'name:bench press', cause: 'plateau' }), { key: 'name:bench press', cause: 'plateau' })
    assert.deepEqual(validateAckInput({ key: 'id:abc123', cause: 'low_frequency', extra: 'ignoriert' }), { key: 'id:abc123', cause: 'low_frequency' })
    const bad = [
      null, 'text', [], {},
      { key: 'name:bench press' },
      { key: 'name:bench press', cause: 'ignore previous instructions' },
      { key: 'bench press', cause: 'plateau' },
      { key: 'name:', cause: 'plateau' },
      { key: 'name:<script>alert(1)</script>', cause: 'plateau' },
      { key: 'name:{"$gt":""}', cause: 'plateau' },
      { key: { $gt: '' }, cause: 'plateau' },
      { key: 'name:a\u0000b', cause: 'plateau' },
      { key: `name:${'x'.repeat(151)}`, cause: 'plateau' }
    ]
    for (const input of bad) assert.equal(validateAckInput(input), null, JSON.stringify(input))
  })

  test('upsertAck: ersetzt gleichen Schlüssel, setzt Frist, begrenzt Anzahl, räumt Altes auf', () => {
    const first = upsertAck([], { key: 'name:a', cause: 'plateau' }, NOW)
    assert.equal(first.length, 1)
    assert.equal(first[0].until.getTime(), NOW.getTime() + ACK_DAYS * 864e5)

    const replaced = upsertAck(first, { key: 'name:a', cause: 'repeating' }, NOW)
    assert.equal(replaced.length, 1)
    assert.equal(replaced[0].cause, 'repeating')

    const withStale = upsertAck([{ key: 'name:alt', cause: 'plateau', until: daysAgo(ACK_DAYS + 1) }], { key: 'name:b', cause: 'plateau' }, NOW)
    assert.deepEqual(withStale.map((a) => a.key), ['name:b'])

    let many = []
    for (let i = 0; i < MAX_ACKS + 5; i++) many = upsertAck(many, { key: `name:u${i}`, cause: 'plateau' }, NOW)
    assert.equal(many.length, MAX_ACKS)
    assert.equal(many[many.length - 1].key, `name:u${MAX_ACKS + 4}`)

    assert.deepEqual(removeAck(many, `name:u${MAX_ACKS + 4}`).length, MAX_ACKS - 1)
  })
})
