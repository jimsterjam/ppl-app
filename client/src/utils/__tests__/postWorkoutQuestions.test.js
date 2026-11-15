import { describe, it, expect } from 'vitest'
import {
  detectQuestionTopics, weightThreshold, schemeDiffers, mainSetsSummary, isExerciseSkipped, MAX_QUESTION_TOPICS
} from '../postWorkoutQuestions.js'

const bench = { name: 'Bankdrücken', name_en: 'barbell bench press', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
const legPress = { name: 'Beinpresse', name_en: 'leg press', category: 'Legs', equipment: 'Maschine', aiMetadata: { exerciseType: 'compound' } }
const dbPress = { name: 'Schulterdrücken Kurzhanteln', name_en: 'dumbbell shoulder press', category: 'Push', equipment: 'Kurzhanteln', aiMetadata: { exerciseType: 'compound' } }
const plank = { name: 'Plank', name_en: 'plank', category: 'Core', equipment: 'Körpergewicht', measureMode: 'time' }

const sets = (weight, repsList, goal) => ({ ...(goal ? { __workoutGoal: goal } : {}), setDetails: repsList.map((reps) => ({ weight, reps, done: true })) })
const times = (n, reps) => Array(n).fill(reps)
const entry = (index, info, goal, exercise, recent = []) => ({ index, name: info.name, info, goal, exercise, recent })
const detect = (workoutGoal, exercises) => detectQuestionTopics({ workoutGoal, exercises })
const one = (workoutGoal, info, goal, exercise, recent) => detect(workoutGoal, [entry(0, info, goal, exercise, recent)])

describe('Schwelle: 5 % oder ein kleiner Gewichtsschritt, je nachdem was größer ist', () => {
  it('Beispiele aus der Absprache', () => {
    expect(weightThreshold(bench, 150)).toBe(7.5)
    expect(weightThreshold(bench, 50)).toBe(2.5)
    expect(weightThreshold(dbPress, 8)).toBe(2)
  })
})

describe('A Absicht', () => {
  it('150 -> 135 kg (10 %) ist A, kein C', () => {
    const r = one('hypertrophy', legPress, 'hypertrophy', sets(135, times(3, 10)), [sets(150, times(3, 10))])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ topic: 'intent', kind: 'weight_drop' })
  })

  it('5x5 -> 3x10 (Schema anders) ist A', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(60, times(3, 10)), [sets(60, times(5, 5), 'hypertrophy')])
    expect(r[0]).toMatchObject({ topic: 'intent', kind: 'scheme' })
  })

  it('Gegenprobe: 4x8 -> 3x10 ist kein anderes Schema', () => {
    expect(schemeDiffers({ sets: 3, reps: 10 }, { sets: 4, reps: 8 })).toBe(false)
  })

  it('ausgelassene Übung ist A, auch ohne Verlauf', () => {
    const skipped = { setDetails: times(3, 10).map((reps) => ({ weight: 50, reps, done: false })) }
    const r = one('hypertrophy', bench, 'hypertrophy', skipped, [])
    expect(r[0]).toMatchObject({ topic: 'intent', kind: 'skipped' })
    expect(isExerciseSkipped(skipped)).toBe(true)
  })

  it('Gegenprobe: nur ein Teil der Sätze nicht abgehakt zählt nicht als ausgelassen', () => {
    const part = { setDetails: [{ weight: 50, reps: 10, done: true }, { weight: 50, reps: 10, done: false }] }
    expect(isExerciseSkipped(part)).toBe(false)
  })
})

describe('C Vergleich', () => {
  it('50 -> 47,5 kg (5 %) ist C "weniger"', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(47.5, times(3, 10)), [sets(50, times(3, 10))])
    expect(r[0]).toMatchObject({ topic: 'compare', kind: 'less' })
  })

  it('Kurzhantel 8 -> 7 kg ist C wegen des Gewichtsschritts', () => {
    const r = one('hypertrophy', dbPress, 'hypertrophy', sets(7, times(3, 10)), [sets(8, times(3, 10))])
    expect(r[0]).toMatchObject({ topic: 'compare', kind: 'less' })
  })

  it('genau wie beim letzten Mal ist C "gleich"', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, times(3, 10)), [sets(50, times(3, 10))])
    expect(r[0]).toMatchObject({ topic: 'compare', kind: 'same' })
  })

  it('eine Wiederholung weniger in einem Satz ist C "weniger"', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, [10, 10, 9]), [sets(50, times(3, 10))])
    expect(r[0]).toMatchObject({ topic: 'compare', kind: 'less' })
  })

  it('Gegenprobe: mehr Gewicht, mehr Wiederholungen oder nichts zum Vergleichen -> keine Frage', () => {
    expect(one('hypertrophy', bench, 'hypertrophy', sets(52.5, times(3, 10)), [sets(50, times(3, 10))])).toEqual([])
    expect(one('hypertrophy', bench, 'hypertrophy', sets(50, times(3, 11)), [sets(50, times(3, 10))])).toEqual([])
    expect(one('hypertrophy', bench, 'hypertrophy', sets(50, times(3, 10)), [])).toEqual([])
  })

  it('Gegenprobe: weniger Gewicht, aber mehr Wiederholungen ist Fortschritt, keine Frage', () => {
    expect(one('hypertrophy', bench, 'hypertrophy', sets(47.5, times(3, 11)), [sets(50, times(3, 10))])).toEqual([])
  })

  it('Gegenprobe: viel weniger Wiederholungen bei gleichem Gewicht (kein anderes Schema) -> keine Frage', () => {
    expect(one('hypertrophy', bench, 'hypertrophy', sets(50, times(3, 8)), [sets(50, times(3, 10))])).toEqual([])
  })
})

describe('B letzter Satz', () => {
  it('Kraft: beim ersten Schaffen nur der Hinweis, keine Frage', () => {
    const r = one('strength', bench, 'strength', sets(100, times(5, 5)), [sets(97.5, times(5, 5))])
    expect(r.find((t) => t.topic === 'last_set')).toBeUndefined()
  })

  it('Kraft: beim zweiten Schaffen mit demselben Gewicht wird gefragt', () => {
    const r = one('strength', bench, 'strength', sets(100, times(5, 5)), [sets(100, times(5, 5)), sets(97.5, times(5, 5))])
    expect(r[0]).toMatchObject({ topic: 'last_set', kind: 'fixed' })
  })

  it('Kraft: nicht noch einmal fragen, wenn schon beim letzten Mal "steigern" anstand', () => {
    const r = one('strength', bench, 'strength', sets(100, times(5, 5)), [sets(100, times(5, 5)), sets(100, times(5, 5)), sets(97.5, times(5, 5))])
    expect(r.find((t) => t.topic === 'last_set')).toBeUndefined()
  })

  it('Kraft: Gegenprobe zweimal geschafft, aber ein Satz verfehlt -> keine B-Frage', () => {
    const r = one('strength', bench, 'strength', sets(100, [5, 5, 5, 5, 4]), [sets(100, times(5, 5)), sets(97.5, times(5, 5))])
    expect(r.find((t) => t.topic === 'last_set')).toBeUndefined()
  })

  it('Muskelaufbau: beim ersten Mal 12 in allen Sätzen wird gefragt', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, times(3, 12)), [sets(50, times(3, 11))])
    expect(r[0]).toMatchObject({ topic: 'last_set', kind: 'range' })
  })

  it('Muskelaufbau: Gegenprobe 11 statt 12 in einem Satz -> keine Frage nach dem letzten Satz', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, [12, 12, 11]), [sets(50, times(3, 11))])
    expect(r.find((t) => t.topic === 'last_set')).toBeUndefined()
  })

  it('Muskelaufbau: nicht erneut, wenn beim letzten Mal schon 12 überall (Nutzer blieb beim Gewicht)', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, times(3, 12)), [sets(50, times(3, 12)), sets(50, times(3, 11))])
    expect(r.find((t) => t.topic === 'last_set')).toBeUndefined()
  })

  it('Kraft: 7+ Wiederholungen (Gewicht klar zu leicht) fragt nicht', () => {
    const r = one('strength', bench, 'strength', sets(60, times(5, 8)), [sets(60, times(5, 5)), sets(57.5, times(5, 5))])
    expect(r.find((t) => t.topic === 'last_set')).toBeUndefined()
  })
})

describe('Auswahl und Ausschlüsse', () => {
  it('höchstens zwei Themen, Vorrang A vor B vor C', () => {
    const exercises = [
      entry(0, bench, 'hypertrophy', sets(50, times(3, 10)), [sets(50, times(3, 10))]), // C gleich
      entry(1, legPress, 'hypertrophy', sets(135, times(3, 10)), [sets(150, times(3, 10))]), // A
      entry(2, dbPress, 'hypertrophy', sets(20, times(3, 12)), [sets(20, times(3, 11))]), // B
      entry(3, bench, 'hypertrophy', sets(50, times(3, 10)), [sets(50, times(3, 10))]) // C
    ]
    const r = detect('hypertrophy', exercises)
    expect(r).toHaveLength(MAX_QUESTION_TOPICS)
    expect(r.map((t) => t.topic)).toEqual(['intent', 'last_set'])
    expect(r.map((t) => t.exerciseIndex)).toEqual([1, 2])
  })

  it('je Übung höchstens ein Thema (A vor C)', () => {
    const r = one('hypertrophy', legPress, 'hypertrophy', sets(135, times(3, 10)), [sets(150, times(3, 10))])
    expect(r).toHaveLength(1)
  })

  it('Gegenprobe: Zeit-Übung, Technik und Explosiv bekommen keine Frage', () => {
    expect(one('hypertrophy', plank, 'hypertrophy', sets(0, [60]), [sets(0, [60])])).toEqual([])
    expect(one('technique', bench, 'technique', sets(50, times(3, 10)), [sets(50, times(3, 10))])).toEqual([])
    expect(one('hypertrophy', bench, 'explosive', sets(50, times(3, 10)), [sets(50, times(3, 10))])).toEqual([])
  })

  it('Gegenprobe: Körpergewicht-Sätze und Pyramiden bekommen keine Frage', () => {
    expect(one('hypertrophy', bench, 'hypertrophy', sets(0, times(3, 10)), [sets(0, times(3, 10))])).toEqual([])
    const pyramid = { setDetails: [{ weight: 40, reps: 10, done: true }, { weight: 50, reps: 8, done: true }, { weight: 60, reps: 6, done: true }] }
    expect(mainSetsSummary(pyramid)).toBeNull()
    expect(one('hypertrophy', bench, 'hypertrophy', pyramid, [pyramid])).toEqual([])
  })

  it('Zusatzsätze (Back-off) und Aufwärmsätze zählen nicht', () => {
    const withBackoff = { setDetails: [
      { weight: 20, reps: 10, isWarmup: true, done: true },
      ...times(3, 10).map((reps) => ({ weight: 50, reps, done: true })),
      { weight: 30, reps: 15, done: true }
    ] }
    expect(mainSetsSummary(withBackoff)).toMatchObject({ sets: 3, weight: 50, totalReps: 30 })
  })

  it('leere oder kaputte Eingabe wirft nicht', () => {
    expect(detectQuestionTopics()).toEqual([])
    expect(detectQuestionTopics({ exercises: [null, {}, { exercise: null }] })).toEqual([])
    expect(detect('hypertrophy', [{ index: 0, name: 'x', info: bench, goal: 'hypertrophy', exercise: sets(50, [10]), recent: 'x' }])).toEqual([])
  })
}
)

describe('Gegenannahmen aus dem Selbst-Review', () => {
  it('Steigerung mit weniger Wiederholungen (12 -> 8 bei mehr Gewicht) ist kein "anderes Schema"', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(52.5, times(3, 8), 'hypertrophy'), [sets(50, times(3, 12), 'hypertrophy')])
    expect(r).toEqual([])
  })

  it('bewusster Zielwechsel (Kraft -> Muskelaufbau) löst weder Schema- noch Gewichts-Frage aus', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(60, times(3, 10), 'hypertrophy'), [sets(80, times(5, 5), 'strength')])
    expect(r).toEqual([])
  })

  it('Gegenprobe: gleiche Trainingsart bei gleicher Gewichtssenkung fragt dagegen', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(60, times(3, 10), 'hypertrophy'), [sets(80, times(3, 10), 'hypertrophy')])
    expect(r[0]).toMatchObject({ topic: 'intent', kind: 'weight_drop' })
  })

  it('ausgelassene Zeit-, Technik- und Explosiv-Übung bekommt keine Frage', () => {
    const skipped = (weight) => ({ setDetails: times(3, 10).map((reps) => ({ weight, reps, done: false })) })
    expect(one('hypertrophy', plank, 'hypertrophy', skipped(0), [])).toEqual([])
    expect(one('technique', bench, 'technique', skipped(50), [])).toEqual([])
    expect(one('hypertrophy', bench, 'explosive', skipped(50), [])).toEqual([])
  })

  it('Gewichtsgrenze mit Dezimalzahlen: genau an der Schwelle ist C, nicht A', () => {
    // 22,4 -> 19,9 = 2,5 kg = Schwelle (5 % von 22,4 = 1,12; Gewichtsschritt 2,5)
    const r = one('hypertrophy', bench, 'hypertrophy', sets(19.9, times(3, 10)), [sets(22.4, times(3, 10))])
    expect(r[0]).toMatchObject({ topic: 'compare', kind: 'less' })
  })

  it('Übung mit eigener Trainingsart (Kraft-Workout, Übung auf Muskelaufbau) bekommt die B-Frage', () => {
    // Workout-Ziel strength, aber diese Übung ist auf Muskelaufbau gestellt; letzte Session trug dieselbe Wahl.
    const last = { ...sets(50, times(3, 11), 'strength'), trainingType: 'hypertrophy' }
    const r = one('strength', bench, 'hypertrophy', sets(50, times(3, 12)), [last])
    expect(r[0]).toMatchObject({ topic: 'last_set', kind: 'range' })
  })

  it('Copilot-Runde 2: gleiche Gesamtzahl bei anderer Satz-/Wiederholungs-Aufteilung ist kein "genau wie beim letzten Mal"', () => {
    // 5x8 = 40 und 4x10 = 40 Wiederholungen, aber nicht dasselbe Schema (und unter der Schwelle für A).
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, times(4, 10)), [sets(50, times(5, 8))])
    expect(r.find((t) => t.topic === 'compare')).toBeUndefined()
  })

  it('Copilot-Runde 2: nach einer "Gewicht war zu leicht"-Einschätzung (7+ Wdh.) zählt das nicht als schon gefragt', () => {
    // Letztes Mal 5x7 (aboveScheme, dort gab es keine B-Frage), vorletztes Mal 5x5; heute 5x5 mit demselben Gewicht.
    const r = one('strength', bench, 'strength', sets(100, times(5, 5)), [sets(100, times(5, 7)), sets(100, times(5, 5))])
    expect(r[0]).toMatchObject({ topic: 'last_set', kind: 'fixed' })
  })

  it('gleiche Gesamtzahl, aber anders auf die Sätze verteilt (12/12/6 statt 10/10/10) -> keine Frage', () => {
    const r = one('hypertrophy', bench, 'hypertrophy', sets(50, [12, 12, 6]), [sets(50, times(3, 10))])
    expect(r.find((t) => t.topic === 'compare')).toBeUndefined()
  })
})
