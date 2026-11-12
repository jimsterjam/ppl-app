import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { applyGeneratorRule } from '../repTargets.js'
import {
  estimateExerciseBlockSeconds, estimateSessionSeconds, selectExercisesForTotalTime, sanitizeCalibration,
  maxSetsFor, minSetsFor, warmupSecondsFor, resolveTimeSelectionOptions,
  WARMUP_SECONDS, SHORT_WARMUP_SECONDS, BUFFER_SECONDS, OVER_BUDGET_TOLERANCE, COOLDOWN_MIN_SECONDS, COOLDOWN_MAX_SECONDS
} from '../workoutTimeModel.js'
import { getMaxExerciseCount } from '../exerciseCountTarget.js'
import { sanitizeQuickGeneratorRequest } from '../workoutSanitizer.js'

const minutes = (seconds) => seconds / 60

// Kandidaten wie im Generator: Rolle bestimmt Sätze/Pausen nach den Generator-Regeln (repTargets.js).
const main = (name, goal, sets) => ({ ...applyGeneratorRule({ name, sets }, goal, false), name, isIsolation: false, demandTier: 'high' })
const accessory = (name, goal, sets) => ({ ...applyGeneratorRule({ name, sets }, goal, true), name, isIsolation: true, demandTier: 'low' })

const strengthPool = () => [
  main('Barbell Bench Press', 'strength'), main('Barbell Squat', 'strength'), main('Barbell Bent Over Row', 'strength'),
  accessory('Dumbbell Lateral Raise', 'strength'), accessory('Cable Pushdown', 'strength'),
  accessory('Barbell Curl', 'strength'), accessory('Leg Curl', 'strength'), accessory('Calf Raise', 'strength')
]
const hypertrophyPool = () => [
  main('Barbell Bench Press', 'hypertrophy'), main('Barbell Squat', 'hypertrophy'), main('Barbell Bent Over Row', 'hypertrophy'),
  main('Barbell Overhead Press', 'hypertrophy'),
  accessory('Dumbbell Lateral Raise', 'hypertrophy'), accessory('Cable Pushdown', 'hypertrophy'),
  accessory('Barbell Curl', 'hypertrophy'), accessory('Leg Curl', 'hypertrophy'), accessory('Calf Raise', 'hypertrophy')
]

describe('Zeitmodell: Übungsblock', () => {
  test('Wechsel + Sätze + Pausen zwischen den Sätzen (keine Pause nach dem letzten Satz)', () => {
    // Grundübung Kraft: 150 + 5·40 + 4·180 = 1070 s
    assert.equal(estimateExerciseBlockSeconds({ sets: 5, rest: 180, isIsolation: false, demandTier: 'high' }, 'strength'), 1070)
    // Isolation: 90 + 3·35 + 2·120 = 435 s
    assert.equal(estimateExerciseBlockSeconds({ sets: 3, rest: 120, isIsolation: true }, 'strength'), 435)
  })

  test('eine Übung mit einem Satz hat keine Pause', () => {
    assert.equal(estimateExerciseBlockSeconds({ sets: 1, rest: 180, isIsolation: false }, 'strength'), 150 + 40)
  })

  test('ohne Pausenwert gilt der Standard der Generator-Regel', () => {
    assert.equal(estimateExerciseBlockSeconds({ sets: 2, isIsolation: false, demandTier: 'high' }, 'strength'), 150 + 80 + 180)
  })
})

describe('Zeitmodell: Eichpunkt (Jimmy: 4 Kraftübungen inkl. Warm-up ca. 70 min)', () => {
  const session = [
    { sets: 5, rest: 180, isIsolation: false, demandTier: 'high' },
    { sets: 5, rest: 180, isIsolation: false, demandTier: 'high' },
    { sets: 4, rest: 120, isIsolation: true },
    { sets: 3, rest: 120, isIsolation: true }
  ]

  test('Modell ohne Faktor liegt bei ca. 65 min (Warm-up 9 + Puffer 3 sind enthalten)', () => {
    const total = minutes(estimateSessionSeconds(session, 'strength'))
    assert.ok(total > 64 && total < 66.5, `war ${total}`)
    assert.equal(WARMUP_SECONDS, 540)
    assert.equal(BUFFER_SECONDS, 180)
  })

  test('mit persönlichem Faktor 70/65 stimmt die Schätzung auf die gemessenen 70 min', () => {
    const base = estimateSessionSeconds(session, 'strength')
    const k = 70 * 60 / base
    const total = minutes(estimateSessionSeconds(session, 'strength', { calibration: k }))
    assert.ok(Math.abs(total - 70) < 0.5, `war ${total}`)
  })

  test('ohne Übungen: 0 (kein Warm-up für nichts)', () => {
    assert.equal(estimateSessionSeconds([], 'strength'), 0)
  })
})

describe('Zeitmodell: persönlicher Faktor', () => {
  test('ungültige Werte werden 1, Extremwerte werden begrenzt', () => {
    assert.equal(sanitizeCalibration(undefined), 1)
    assert.equal(sanitizeCalibration('x'), 1)
    assert.equal(sanitizeCalibration(0), 1)
    assert.equal(sanitizeCalibration(5), 1.5)
    assert.equal(sanitizeCalibration(0.1), 0.8)
    assert.equal(sanitizeCalibration(1.08), 1.08)
  })
})

describe('Zeitmodell: Auswahl für die Wunschzeit (Gesamtzeit inkl. Warm-up)', () => {
  const run = (pool, goal, wanted, extra = {}) => selectExercisesForTotalTime(pool, wanted, goal, {
    maxExerciseCount: getMaxExerciseCount(wanted, goal, null), ...extra
  })

  test('Regression: Muskelaufbau 75 min ergibt kein 49-Minuten-Workout mehr', () => {
    const result = run(hypertrophyPool(), 'hypertrophy', 75)
    const total = minutes(result.estimatedDurationSeconds)
    assert.ok(total >= 68 && total <= 75 * (1 + OVER_BUDGET_TOLERANCE), `war ${total}`)
    assert.ok(result.exercises.length >= 6, `Übungen: ${result.exercises.length}`)
  })

  test('Kraft 75 min: 4 bis 5 Übungen, Gesamtzeit nahe der Wunschzeit', () => {
    const result = run(strengthPool(), 'strength', 75)
    const total = minutes(result.estimatedDurationSeconds)
    assert.ok(result.exercises.length >= 4 && result.exercises.length <= 5, `Übungen: ${result.exercises.length}`)
    assert.ok(total >= 65 && total <= 75 * (1 + OVER_BUDGET_TOLERANCE), `war ${total}`)
  })

  test('mehr Wunschzeit ergibt nie eine kürzere Einheit', () => {
    for (const goal of ['strength', 'hypertrophy']) {
      const pool = goal === 'strength' ? strengthPool : hypertrophyPool
      let previous = 0
      for (const wanted of [30, 45, 60, 75, 90]) {
        const seconds = run(pool(), goal, wanted).estimatedDurationSeconds
        assert.ok(seconds >= previous, `${goal} ${wanted}: ${seconds} < ${previous}`)
        previous = seconds
      }
    }
  })

  test('Ergebnis liegt höchstens 5 % über der Wunschzeit', () => {
    for (const goal of ['strength', 'hypertrophy']) {
      const pool = goal === 'strength' ? strengthPool : hypertrophyPool
      for (const wanted of [45, 60, 75, 90]) {
        const seconds = run(pool(), goal, wanted).estimatedDurationSeconds
        assert.ok(seconds <= wanted * 60 * (1 + OVER_BUDGET_TOLERANCE) + 1, `${goal} ${wanted}: ${minutes(seconds)}`)
      }
    }
  })

  test('übrige Zeit wird mit Sätzen gefüllt, aber nie über die Satzgrenze der Generator-Regel', () => {
    // Nur zwei Kandidaten und viel Zeit: beide Übungen bekommen Sätze bis zum Maximum.
    const pool = [main('Barbell Bench Press', 'strength', 3), main('Barbell Squat', 'strength', 3)]
    const result = selectExercisesForTotalTime(pool, 90, 'strength', { maxExerciseCount: 6 })
    for (const exercise of result.exercises) {
      assert.ok(exercise.sets <= maxSetsFor(exercise, 'strength'))
    }
    assert.equal(result.exercises[0].sets, 5)
  })

  test('Eingabeliste wird nicht verändert (Sätze werden nur an Kopien erhöht)', () => {
    const pool = [main('Barbell Bench Press', 'strength', 3), main('Barbell Squat', 'strength', 3)]
    selectExercisesForTotalTime(pool, 90, 'strength', { maxExerciseCount: 6 })
    assert.equal(pool[0].sets, 3)
  })

  test('Regression: 30 min Kraft mit den echten Generator-Standardwerten bleibt im Budget (vorher 40 min)', () => {
    // Standard: Grundübung 4 Sätze à 180 s Pause. Zwei volle Grundübungen allein wären 40,3 min.
    const result = run(strengthPool(), 'strength', 30)
    const total = minutes(result.estimatedDurationSeconds)
    assert.ok(total <= 30 * (1 + OVER_BUDGET_TOLERANCE), `war ${total}`)
    assert.ok(total >= 24, `zu wenig genutzt: ${total}`)
    assert.ok(result.exercises.some((e) => !e.isIsolation), 'mindestens eine Grundübung')
    assert.equal(result.overBudget, false)
    // 35 und 40 Minuten ebenso
    for (const wanted of [35, 40]) {
      const seconds = run(strengthPool(), 'strength', wanted).estimatedDurationSeconds
      assert.ok(seconds <= wanted * 60 * (1 + OVER_BUDGET_TOLERANCE) + 1, `${wanted}: ${minutes(seconds)}`)
    }
  })

  test('passt eine zweite Grundübung nur mit weniger Sätzen, werden Sätze bis zum Minimum gesenkt (nicht gestrichen)', () => {
    const pool = [main('Barbell Bench Press', 'strength'), main('Barbell Squat', 'strength')]
    const result = selectExercisesForTotalTime(pool, 36, 'strength', { maxExerciseCount: 4 })
    assert.equal(result.exercises.length, 2)
    assert.ok(result.exercises[1].sets < pool[1].sets)
    assert.ok(result.exercises[1].sets >= minSetsFor(pool[1], 'strength'))
    assert.ok(result.estimatedDurationSeconds <= 36 * 60 * (1 + OVER_BUDGET_TOLERANCE) + 1)
  })

  test('Pausen bleiben unverändert: zur Zeitersparnis werden nur Sätze und Übungen reduziert', () => {
    const result = run(strengthPool(), 'strength', 30)
    for (const exercise of result.exercises) {
      assert.equal(exercise.rest, exercise.isIsolation ? 120 : 180)
    }
  })

  test('sehr kurze Wunschzeit: es gibt keine feste Mindestzahl, aber mindestens eine Übung', () => {
    const result = selectExercisesForTotalTime(strengthPool(), 20, 'strength', { maxExerciseCount: 3 })
    assert.ok(result.exercises.length >= 1)
    assert.ok(minutes(result.estimatedDurationSeconds) <= 20 * (1 + OVER_BUDGET_TOLERANCE))
  })

  test('passt gar nichts: kürzeste Übung mit Mindestsätzen, die Überschreitung wird gemeldet', () => {
    const heavy = { ...main('Endlos-Pause', 'strength'), rest: 600 }
    const result = selectExercisesForTotalTime([heavy], 20, 'strength', { maxExerciseCount: 3 })
    assert.equal(result.exercises.length, 1)
    assert.equal(result.exercises[0].sets, minSetsFor(heavy, 'strength'))
    assert.equal(result.overBudget, true)
  })

  test('harte Obergrenze (manueller Override) bleibt gültig', () => {
    const result = selectExercisesForTotalTime(hypertrophyPool(), 90, 'hypertrophy', { maxExerciseCount: 3 })
    assert.equal(result.exercises.length, 3)
  })

  test('eine zu lange Übung blockiert kürzere weiter hinten nicht', () => {
    const long = { ...main('Big Lift', 'strength', 5), sets: 5 }
    const short = accessory('Curl', 'strength', 2)
    const result = selectExercisesForTotalTime([main('A', 'strength', 4), main('B', 'strength', 4), long, short], 45, 'strength', { maxExerciseCount: 6 })
    assert.ok(result.exercises.some((e) => e.name === 'Curl'))
  })

  test('Modus training_only: Warm-up kommt obendrauf, die Einheit wird entsprechend länger', () => {
    const total = selectExercisesForTotalTime(hypertrophyPool(), 60, 'hypertrophy', { maxExerciseCount: 8 })
    const only = selectExercisesForTotalTime(hypertrophyPool(), 60, 'hypertrophy', { maxExerciseCount: 8, durationMode: 'training_only' })
    assert.ok(only.estimatedDurationSeconds > total.estimatedDurationSeconds)
    assert.equal(only.timeBudgetSeconds, 60 * 60 + WARMUP_SECONDS)
  })

  test('persönlicher Faktor über 1: weniger Übungen/Sätze für dieselbe Wunschzeit', () => {
    const normal = run(hypertrophyPool(), 'hypertrophy', 60)
    const slow = run(hypertrophyPool(), 'hypertrophy', 60, { calibration: 1.3 })
    const count = (r) => r.exercises.reduce((sum, e) => sum + e.sets, 0)
    assert.ok(count(slow) < count(normal))
  })

  test('Aufteilung: Warm-up, Training und Cool-down ergeben die Gesamtzeit', () => {
    const result = run(hypertrophyPool(), 'hypertrophy', 75)
    assert.equal(result.warmupSeconds + result.trainingSeconds + result.cooldownSeconds, result.estimatedDurationSeconds)
  })

  test('Warm-up wird bei kurzen Einheiten kürzer: ≤ 30 min nur spezifisch (5 min), ab 45 min voll (9 min)', () => {
    assert.equal(warmupSecondsFor(20), SHORT_WARMUP_SECONDS)
    assert.equal(warmupSecondsFor(30), SHORT_WARMUP_SECONDS)
    assert.equal(warmupSecondsFor(45), WARMUP_SECONDS)
    assert.equal(warmupSecondsFor(75), WARMUP_SECONDS)
    const mid = warmupSecondsFor(38)
    assert.ok(mid > SHORT_WARMUP_SECONDS && mid < WARMUP_SECONDS)
    assert.equal(warmupSecondsFor(undefined), WARMUP_SECONDS)
  })

  describe('Cool-down am Ende (Vorschlag, 5-10 min, Absprache Jimmy)', () => {
    test('Muskelaufbau 75 min: Cool-down von 10 min, Gesamtzeit nahe der Wunschzeit', () => {
      const result = run(hypertrophyPool(), 'hypertrophy', 75)
      assert.equal(result.cooldownSeconds, COOLDOWN_MAX_SECONDS)
      const total = minutes(result.estimatedDurationSeconds)
      assert.ok(total >= 70 && total <= 75, `war ${total}`)
    })

    test('Kraft 75 min: mindestens 5 min Cool-down, Gesamtzeit nahe der Wunschzeit', () => {
      const result = run(strengthPool(), 'strength', 75)
      assert.ok(result.cooldownSeconds >= COOLDOWN_MIN_SECONDS && result.cooldownSeconds <= COOLDOWN_MAX_SECONDS)
      const total = minutes(result.estimatedDurationSeconds)
      assert.ok(total >= 70 && total <= 75, `war ${total}`)
    })

    test('Cool-down immer 5-10 min in vollen Minuten oder gar keins; nie über die Wunschzeit hinaus', () => {
      for (const goal of ['strength', 'hypertrophy']) {
        const pool = goal === 'strength' ? strengthPool : hypertrophyPool
        for (const wanted of [20, 30, 45, 60, 75, 90, 120]) {
          const result = run(pool(), goal, wanted)
          const cd = result.cooldownSeconds
          assert.ok(cd === 0 || (cd >= COOLDOWN_MIN_SECONDS && cd <= COOLDOWN_MAX_SECONDS && cd % 60 === 0), `${goal} ${wanted}: ${cd}`)
          if (cd > 0) assert.ok(result.estimatedDurationSeconds <= wanted * 60 + 1, `${goal} ${wanted}: ${minutes(result.estimatedDurationSeconds)}`)
        }
      }
    })

    test('knappe Einheit (30 min Kraft): kein Cool-down, die Zeit gehört den Arbeitssätzen', () => {
      assert.equal(run(strengthPool(), 'strength', 30).cooldownSeconds, 0)
    })

    test('Cool-down statt mehr Sätze: bei Muskelaufbau 60 min bleiben die Standard-Sätze (3)', () => {
      const result = run(hypertrophyPool(), 'hypertrophy', 60)
      assert.ok(result.exercises.every((e) => e.sets <= 3))
    })

    test('der persönliche Faktor skaliert das Cool-down nicht: konkret 600 s bei jedem Faktor, nur der Übungsteil skaliert', () => {
      // Zwei Übungen bei 90 min: Zeit für das volle Cool-down bleibt für jeden Faktor übrig.
      const pool = [main('Barbell Bench Press', 'hypertrophy'), main('Barbell Squat', 'hypertrophy')]
      for (const k of [0.8, 1.2, 1.5]) {
        const result = selectExercisesForTotalTime(pool, 90, 'hypertrophy', { maxExerciseCount: 2, calibration: k })
        assert.equal(result.cooldownSeconds, COOLDOWN_MAX_SECONDS, `k=${k}`)
        const exercisesOnly = estimateSessionSeconds(result.exercises, 'hypertrophy', { calibration: k })
        assert.equal(result.estimatedDurationSeconds, exercisesOnly + COOLDOWN_MAX_SECONDS, `k=${k}`)
      }
    })

    test('kurze Einheit (< 45 min) bekommt kein Cool-down, auch wenn durch eine manuelle Obergrenze Zeit übrig bleibt', () => {
      const pool = [main('Barbell Bench Press', 'hypertrophy'), main('Barbell Squat', 'hypertrophy'), main('Row', 'hypertrophy')]
      // 40 min, nur zwei Grundübungen erlaubt: es bleiben mehr als 5 min übrig, aber kein Cool-down.
      const result = selectExercisesForTotalTime(pool, 40, 'hypertrophy', { maxExerciseCount: 2 })
      assert.equal(result.exercises.length, 2)
      assert.ok(result.timeBudgetSeconds - result.estimatedDurationSeconds >= COOLDOWN_MIN_SECONDS)
      assert.equal(result.cooldownSeconds, 0)
      // 44 min ebenso keins, ab 45 min mit derselben Auswahl schon.
      assert.equal(selectExercisesForTotalTime(pool, 44, 'hypertrophy', { maxExerciseCount: 2 }).cooldownSeconds, 0)
      assert.ok(selectExercisesForTotalTime(pool, 45, 'hypertrophy', { maxExerciseCount: 2 }).cooldownSeconds >= COOLDOWN_MIN_SECONDS)
    })
  })
})

describe('Zeitmodell: Durchfluss vom Request bis zur Auswahl', () => {
  const body = (extra = {}) => ({ durationMinutes: 60, goal: 'strength', level: 'advanced', requestedType: 'fullbody', ...extra })
  const selectFrom = (rawBody) => {
    const context = sanitizeQuickGeneratorRequest(rawBody)
    const options = resolveTimeSelectionOptions(context)
    return { context, options, result: selectExercisesForTotalTime(strengthPool(), context.durationMinutes, context.goal, options) }
  }

  test('Request-Prüfung übernimmt durationMode und timeCalibration (geprüft/begrenzt)', () => {
    const ctx = sanitizeQuickGeneratorRequest(body({ durationMode: 'training_only', timeCalibration: 1.3 }))
    assert.equal(ctx.durationMode, 'training_only')
    assert.equal(ctx.timeCalibration, 1.3)
    assert.equal(sanitizeQuickGeneratorRequest(body({ timeCalibration: 9 })).timeCalibration, 1.5)
    assert.equal(sanitizeQuickGeneratorRequest(body({ timeCalibration: 'x' })).timeCalibration, 1)
    assert.equal(sanitizeQuickGeneratorRequest(body({ durationMode: 'quatsch' })).durationMode, 'total_session')
    assert.equal(sanitizeQuickGeneratorRequest(body()).durationMode, 'total_session')
  })

  test('training_only und Faktor 1,3 erreichen das Zeitmodell (Modus und Faktor im Ergebnis)', () => {
    const { options, result } = selectFrom(body({ durationMode: 'training_only', timeCalibration: 1.3 }))
    assert.equal(options.durationMode, 'training_only')
    assert.equal(options.calibration, 1.3)
    assert.equal(result.durationMode, 'training_only')
    assert.equal(result.calibration, 1.3)
  })

  test('ohne Angaben gilt Gesamtzeit mit Faktor 1', () => {
    const { result } = selectFrom(body())
    assert.equal(result.durationMode, 'total_session')
    assert.equal(result.calibration, 1)
  })

  test('der Faktor verändert das Ergebnis: langsamere Nutzer bekommen weniger Sätze/Übungen', () => {
    const normal = selectFrom(body({ durationMinutes: 75 })).result
    const slow = selectFrom(body({ durationMinutes: 75, timeCalibration: 1.4 })).result
    const sets = (r) => r.exercises.reduce((sum, e) => sum + e.sets, 0)
    assert.ok(sets(slow) < sets(normal))
  })

  test('Obergrenze der Übungsanzahl kommt aus dem Request (manueller Override)', () => {
    const { options } = selectFrom(body({ exerciseCountOverride: 3 }))
    assert.equal(options.maxExerciseCount, 3)
  })
})
