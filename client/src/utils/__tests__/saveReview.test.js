import { describe, it, expect } from 'vitest'
import { buildSaveReview, markOpenSetsNotDone, markAllSetsDone, setLabelFor } from '../saveReview.js'

const done = (reps, weight, extra = {}) => ({ reps, weight, done: true, ...extra })
const open = (reps, weight, extra = {}) => ({ reps, weight, ...extra })
const lastAt = (weight) => ({ setDetails: [{ reps: 5, weight }, { reps: 5, weight }] })
const feedback = () => 'lief gut'

describe('buildSaveReview', () => {
  it('alles gemacht, plausibel, Feedback da -> leer', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Squat', setDetails: [done(5, 100), done(5, 100)] }],
      trackingActive: true,
      getNote: feedback,
      lastSessions: [lastAt(100)],
      repTargets: [{ target: 5 }]
    })
    expect(review.isEmpty).toBe(true)
    expect(review.hasOpenSets).toBe(false)
  })

  it('nicht abgehakte Arbeitssätze werden mit Nummer gelistet, Aufwärmsätze nie', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Squat', setDetails: [open(5, 60, { isWarmup: true }), done(5, 100), done(5, 100), open(5, 100), open(5, 100)] }],
      trackingActive: true,
      getNote: feedback
    })
    expect(review.forgotten).toEqual([{ kind: 'openSets', exIndex: 0, name: 'Squat', sets: '3, 4', count: 2 }])
    expect(review.hasOpenSets).toBe(true)
  })

  it('Übung ohne einen einzigen abgehakten Arbeitssatz -> notDone (bleibt im Workout), Teilmenge -> openSets', () => {
    const review = buildSaveReview({
      exercises: [
        { name: 'Row', setDetails: [open(8, 50), open(8, 50)] },
        { name: 'Squat', setDetails: [open(5, 60, { isWarmup: true }), done(5, 100), open(5, 100)] }
      ],
      trackingActive: true,
      getNote: feedback
    })
    expect(review.forgotten).toEqual([
      { kind: 'notDone', exIndex: 0, name: 'Row' },
      { kind: 'openSets', exIndex: 1, name: 'Squat', sets: '2', count: 1 }
    ])
    expect(review.hasOpenSets).toBe(true)
  })

  it('Übung ganz ohne Sätze -> noSets', () => {
    const review = buildSaveReview({ exercises: [{ name: 'Row', setDetails: [] }], trackingActive: true })
    expect(review.forgotten).toEqual([{ kind: 'noSets', exIndex: 0, name: 'Row' }])
  })

  it('Gewicht auffällig: +25 % / unter der Hälfte, Grenzen selbst sind ok', () => {
    const run = (weight) => buildSaveReview({
      exercises: [{ name: 'Bench', setDetails: [done(5, weight)] }],
      trackingActive: true,
      getNote: feedback,
      lastSessions: [lastAt(80)]
    }).check.map((c) => c.kind)
    expect(run(800)).toEqual(['weightOutlier'])
    expect(run(30)).toEqual(['weightOutlier'])
    expect(run(100)).toEqual([])
    expect(run(40)).toEqual([])
  })

  it('0 kg, obwohl letztes Mal mit Gewicht', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Squat', setDetails: [done(5, 100), done(5, 100), done(5, 0)] }],
      trackingActive: true,
      getNote: feedback,
      lastSessions: [lastAt(100)]
    })
    expect(review.check).toEqual([{ kind: 'zeroWeight', exIndex: 0, name: 'Squat', set: '3' }])
  })

  it('Körpergewicht-Übung: kein Gewichts-Check', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Pull-up', setDetails: [done(8, 0)] }],
      trackingActive: true,
      getNote: feedback,
      lastSessions: [lastAt(10)],
      noLoad: [true]
    })
    expect(review.isEmpty).toBe(true)
  })

  it('Wiederholungen: 0 oder mehr als doppelt so viele wie das Ziel', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Curl', setDetails: [done(0, 10), done(25, 10), done(24, 10)] }],
      trackingActive: true,
      getNote: feedback,
      repTargets: [{ target: 12 }]
    })
    expect(review.check.map((c) => [c.kind, c.set])).toEqual([['zeroReps', '1'], ['repsOutlier', '2']])
  })

  it('Aufwärmsätze und nicht abgehakte Sätze werden nicht auf Ausreißer geprüft', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Squat', setDetails: [done(5, 20, { isWarmup: true }), done(5, 100), open(0, 0)] }],
      trackingActive: true,
      getNote: feedback,
      lastSessions: [lastAt(100)],
      repTargets: [{ target: 5 }]
    })
    expect(review.check).toEqual([])
  })

  it('Feedback fehlt nur bei Übungen mit gemachten Sätzen', () => {
    const review = buildSaveReview({
      exercises: [
        { name: 'Squat', setDetails: [done(5, 100)] },
        { name: 'Row', setDetails: [open(10, 50)] }
      ],
      trackingActive: true,
      getNote: () => ''
    })
    expect(review.check).toEqual([{ kind: 'missingFeedback', exIndex: 0, name: 'Squat' }])
  })

  it('abgeschlossenes Workout bearbeiten: Sätze ohne Haken gelten als gemacht', () => {
    const review = buildSaveReview({
      exercises: [{ name: 'Squat', setDetails: [open(5, 100), open(5, 100)] }],
      trackingActive: false,
      getNote: feedback
    })
    expect(review.isEmpty).toBe(true)
  })
})

describe('markOpenSetsNotDone / markAllSetsDone / setLabelFor', () => {
  const exercises = [{ name: 'Squat', setDetails: [done(5, 100), open(5, 100)] }]

  it('nichts wird entfernt: nicht abgehakte Arbeitssätze bekommen ausdrücklich done:false, Aufwärmsätze bleiben', () => {
    const warm = open(5, 60, { isWarmup: true })
    const result = markOpenSetsNotDone([warm, done(5, 100), open(5, 100), open(5, 90, { done: false })])
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual(warm)
    expect(result[1].done).toBe(true)
    expect(result[2]).toEqual({ reps: 5, weight: 100, done: false })
    expect(result[3].done).toBe(false)
    expect(markOpenSetsNotDone([open(5, 50)])).toEqual([{ reps: 5, weight: 50, done: false }])
    expect(markOpenSetsNotDone(undefined)).toEqual([])
  })

  it('markiert alle Sätze als gemacht, ohne das Original zu verändern', () => {
    expect(markAllSetsDone(exercises)[0].setDetails.every((s) => s.done === true)).toBe(true)
    expect(exercises[0].setDetails[1].done).toBeUndefined()
  })

  it('Satznummern wie in der Tabelle', () => {
    const sets = [{ isWarmup: true }, {}, { isWarmup: true }, {}]
    expect([0, 1, 2, 3].map((i) => setLabelFor(sets, i))).toEqual(['W1', '1', 'W2', '2'])
  })
})
