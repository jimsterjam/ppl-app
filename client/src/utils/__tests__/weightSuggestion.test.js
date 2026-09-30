import { describe, it, expect } from 'vitest'
import {
  classifyExercise,
  getRepTarget,
  getWeightSuggestion,
  getSuggestionForSet,
  getProgressionStatus,
  normalizeTrainingGoal,
  isExplosiveExercise,
  resolveExerciseGoal
} from '../weightSuggestion.js'

const squat = { name: 'Kniebeugen mit der Langhantel', name_en: 'barbell high bar squat', category: 'Legs', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
const lateralRaise = { name: 'Seitheben Kurzhanteln', name_en: 'dumbbell lateral raise', category: 'Push', equipment: 'Kurzhanteln', aiMetadata: { exerciseType: 'compound' } }
const crunch = { name: 'Crunch', name_en: 'crunch', category: 'Core', equipment: 'Körpergewicht', aiMetadata: { exerciseType: 'core' } }

function session(sets) {
  return { name: squat.name, setDetails: sets }
}

describe('classifyExercise / getRepTarget', () => {
  it('Grundübung aus dem Katalog', () => {
    expect(classifyExercise(squat)).toBe('compound')
    expect(getRepTarget(squat, 'strength')).toMatchObject({ mode: 'fixed', min: 1, max: 6, target: 5 })
    expect(getRepTarget(squat, 'hypertrophy')).toMatchObject({ mode: 'range', min: 8, max: 12, target: 12 })
  })

  it('Katalog-Fehler: Seitheben wird trotz "compound" als Isolation behandelt', () => {
    expect(classifyExercise(lateralRaise)).toBe('isolation')
    // Isolation im Kraft-Workout = Zubehör -> Bereich 8-12 wie Muskelaufbau
    expect(getRepTarget(lateralRaise, 'strength')).toMatchObject({ mode: 'range', target: 12 })
    expect(getRepTarget(lateralRaise, 'hypertrophy').target).toBe(12)
  })

  it('Rumpfübungen bekommen kein Ziel', () => {
    expect(getRepTarget(crunch, 'hypertrophy')).toBeNull()
  })

  it('unbekanntes Ziel fällt auf Muskelaufbau zurück', () => {
    expect(normalizeTrainingGoal(undefined)).toBe('hypertrophy')
    expect(normalizeTrainingGoal('max_strength')).toBe('strength')
  })
})

describe('getWeightSuggestion', () => {
  it('alle Sätze am Ziel -> Vorschlag pro Satz (+2.5 kg Langhantel)', () => {
    const last = session([{ reps: 5, weight: 60 }, { reps: 5, weight: 60 }, { reps: 5, weight: 60 }])
    expect(getWeightSuggestion(squat, last, 'strength')).toEqual({
      targetReps: 5,
      increment: 2.5,
      baseWeight: 60,
      suggestedWeights: [62.5, 62.5, 62.5],
      backoffSets: 0
    })
  })

  it('ein Satz unter dem Ziel -> kein Vorschlag (keine Senkung)', () => {
    const last = session([{ reps: 5, weight: 60 }, { reps: 5, weight: 60 }, { reps: 4, weight: 60 }])
    expect(getWeightSuggestion(squat, last, 'strength')).toBeNull()
  })

  it('Aufwärmsätze werden ignoriert', () => {
    const last = session([
      { reps: 3, weight: 20, isWarmup: true },
      { reps: 12, weight: 60 },
      { reps: 12, weight: 60 }
    ])
    expect(getWeightSuggestion(squat, last, 'hypertrophy')?.suggestedWeights).toEqual([62.5, 62.5])
  })

  it('Trainingsziel entscheidet: 5 Wdh. reichen bei Kraft, nicht bei Muskelaufbau', () => {
    const last = session([{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }])
    expect(getWeightSuggestion(squat, last, 'strength')).not.toBeNull()
    expect(getWeightSuggestion(squat, last, 'hypertrophy')).toBeNull()
  })

  it('Kurzhanteln: +2 kg', () => {
    const last = { setDetails: [{ reps: 12, weight: 10 }, { reps: 12, weight: 10 }] }
    expect(getWeightSuggestion(lateralRaise, last, 'hypertrophy')?.suggestedWeights).toEqual([12, 12])
  })

  it('unterschiedliche Gewichte in den Arbeitssätzen -> kein Vorschlag', () => {
    const dropped = session([100, 100, 100, 95, 95].map((weight) => ({ reps: 5, weight })))
    const ascending = session([90, 95, 100].map((weight) => ({ reps: 5, weight })))
    expect(getWeightSuggestion(squat, dropped, 'strength')).toBeNull()
    expect(getWeightSuggestion(squat, ascending, 'strength')).toBeNull()
  })

  it('Aufwärmsatz mit anderem Gewicht stört nicht', () => {
    const last = session([{ reps: 5, weight: 60, isWarmup: true }, { reps: 5, weight: 100 }, { reps: 5, weight: 100 }])
    expect(getWeightSuggestion(squat, last, 'strength')?.suggestedWeights).toEqual([102.5, 102.5])
  })

  it('Körpergewicht / 0 kg / Speed-Variante / keine Historie -> kein Vorschlag', () => {
    expect(getWeightSuggestion({ ...squat, equipment: 'Körpergewicht' }, session([{ reps: 10, weight: 0 }]), 'hypertrophy')).toBeNull()
    expect(getWeightSuggestion(squat, session([{ reps: 10, weight: 0 }]), 'hypertrophy')).toBeNull()
    expect(getWeightSuggestion({ ...squat, name_en: 'barbell speed squat' }, session([{ reps: 10, weight: 60 }]), 'hypertrophy')).toBeNull()
    expect(getWeightSuggestion(squat, null, 'hypertrophy')).toBeNull()
    expect(getWeightSuggestion(crunch, session([{ reps: 20, weight: 10 }]), 'hypertrophy')).toBeNull()
  })

  it('5x5-Beispiele: nur alle fünf Sätze mit 5 Wdh. führen zum Vorschlag', () => {
    const at100 = (reps) => session(reps.map((r) => ({ reps: r, weight: 100 })))
    expect(getWeightSuggestion(squat, at100([5, 5, 5, 5, 5]), 'strength')?.suggestedWeights[0]).toBe(102.5)
    expect(getWeightSuggestion(squat, at100([5, 5, 5, 5, 4]), 'strength')).toBeNull()
    expect(getWeightSuggestion(squat, at100([5, 5, 5, 4, 4]), 'strength')).toBeNull()
    expect(getWeightSuggestion(squat, at100([5, 5, 4, 4, 3]), 'strength')).toBeNull()
  })

  it('Satzanzahl spielt keine Rolle: 3x5 nach 5x5 -> trotzdem Vorschlag', () => {
    const three = session([{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }, { reps: 5, weight: 100 }])
    expect(getWeightSuggestion(squat, three, 'strength')?.suggestedWeights).toEqual([102.5, 102.5, 102.5])
  })

  it('nicht abgehakte Sätze (done: false) zählen nicht', () => {
    const last = session([{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }, { reps: 2, weight: 100, done: false }])
    expect(getWeightSuggestion(squat, last, 'strength')?.suggestedWeights).toEqual([102.5, 102.5])
  })

  it('getSuggestionForSet: mehr Sätze als letztes Mal -> letzter Wert', () => {
    const suggestion = { suggestedWeights: [62.5, 65] }
    expect(getSuggestionForSet(suggestion, 0)).toBe(62.5)
    expect(getSuggestionForSet(suggestion, 3)).toBe(65)
    expect(getSuggestionForSet(null, 0)).toBeNull()
  })
})

describe('getProgressionStatus', () => {
  const at100 = (reps) => session(reps.map((r) => ({ reps: r, weight: 100 })))

  it('5/5/5/5/5 -> Steigern mit Vorschlag', () => {
    const s = getProgressionStatus(squat, at100([5, 5, 5, 5, 5]), 'strength')
    expect(s).toMatchObject({ state: 'increase', weight: 100, targetReps: 5, sets: 5 })
    expect(s.suggestion.suggestedWeights[0]).toBe(102.5)
  })

  it('5/5/5/5/4 -> Knapp dran', () => {
    expect(getProgressionStatus(squat, at100([5, 5, 5, 5, 4]), 'strength')).toMatchObject({ state: 'close', missingReps: 1, suggestion: null })
  })

  it('5/5/4/4/3 -> Halten mit 21 von 25', () => {
    expect(getProgressionStatus(squat, at100([5, 5, 4, 4, 3]), 'strength')).toMatchObject({ state: 'hold', totalReps: 21, targetTotal: 25 })
  })

  it('zwei Sätze je 1 Wdh. zu wenig -> Halten, nicht Knapp dran', () => {
    expect(getProgressionStatus(squat, at100([5, 5, 5, 4, 4]), 'strength')?.state).toBe('hold')
  })

  it('unterschiedliche Gewichte / keine Historie / Körpergewicht -> null', () => {
    const mixed = session([100, 100, 95].map((weight) => ({ reps: 5, weight })))
    expect(getProgressionStatus(squat, mixed, 'strength')).toBeNull()
    expect(getProgressionStatus(squat, null, 'strength')).toBeNull()
    expect(getProgressionStatus({ ...squat, equipment: 'Körpergewicht' }, at100([5, 5]), 'strength')).toBeNull()
  })
})

describe('Trainingsart pro Übung', () => {
  it('explosive Übungen werden am Namen erkannt, Fehltreffer nicht', () => {
    expect(isExplosiveExercise({ name: 'Trap Bar Jumps' })).toBe(true)
    expect(isExplosiveExercise({ name_en: 'power clean' })).toBe(true)
    expect(isExplosiveExercise({ name: 'Kettlebell einarmiges Reißen' })).toBe(true)
    expect(isExplosiveExercise({ name_en: 'front squat barbell clean-grip' })).toBe(false)
    expect(isExplosiveExercise({ name_en: 'assisted hanging knee raise with throw down' })).toBe(false)
    expect(isExplosiveExercise({ name_en: 'jump rope' })).toBe(false)
    expect(isExplosiveExercise(squat)).toBe(false)
  })

  it('eigene Wahl > automatisch explosiv > Workout-Ziel', () => {
    expect(resolveExerciseGoal(squat, 'strength')).toBe('strength')
    expect(resolveExerciseGoal(lateralRaise, 'strength', 'hypertrophy')).toBe('hypertrophy')
    expect(resolveExerciseGoal({ name: 'Trap Bar Jumps' }, 'strength')).toBe('explosive')
    expect(resolveExerciseGoal({ name: 'Trap Bar Jumps' }, 'strength', 'strength')).toBe('strength')
    expect(resolveExerciseGoal(squat, 'strength', 'unsinn')).toBe('strength')
  })

  it('explosiv: kein Wiederholungsziel, kein Vorschlag, kein Halten-Text', () => {
    const last = session([{ reps: 3, weight: 30 }, { reps: 3, weight: 30 }])
    expect(getRepTarget(squat, 'explosive')).toBeNull()
    expect(getWeightSuggestion(squat, last, 'explosive')).toBeNull()
    expect(getProgressionStatus(squat, last, 'explosive')).toBeNull()
  })

  it('Isolationsübung im Kraft-Workout auf Muskelaufbau gestellt -> Ziel 12', () => {
    expect(getRepTarget(lateralRaise, resolveExerciseGoal(lateralRaise, 'strength', 'hypertrophy')).target).toBe(12)
  })
})

describe('Zusatzsätze (Back-off) nach den Hauptsätzen', () => {
  const sets = (list) => session(list.map(([reps, weight]) => ({ reps, weight })))

  it('5x5 mit 100 kg + 2x10 mit 80 kg -> Vorschlag nur für die 5 Hauptsätze', () => {
    const s = getWeightSuggestion(squat, sets([[5, 100], [5, 100], [5, 100], [5, 100], [5, 100], [10, 80], [10, 80]]), 'strength')
    expect(s.suggestedWeights).toEqual([102.5, 102.5, 102.5, 102.5, 102.5])
    expect(s.backoffSets).toBe(2)
    expect(getSuggestionForSet(s, 4)).toBe(102.5)
    expect(getSuggestionForSet(s, 5)).toBeNull()
  })

  it('Zusatzsätze egal für Knapp dran / Halten', () => {
    const last = sets([[5, 100], [5, 100], [5, 100], [5, 100], [4, 100], [8, 80], [6, 80]])
    expect(getProgressionStatus(squat, last, 'strength')).toMatchObject({ state: 'close', sets: 5, totalReps: 24 })
  })

  it('kleine Reduzierung (100 -> 95 kg, weniger als 15 %) verhindert den Vorschlag', () => {
    expect(getWeightSuggestion(squat, sets([[5, 100], [5, 100], [5, 100], [5, 95], [5, 95]]), 'strength')).toBeNull()
    expect(getWeightSuggestion(squat, sets([[5, 100], [5, 100], [5, 85]]), 'strength')).not.toBeNull()
  })

  it('ohne Zusatzsätze letztes Mal: mehr Sätze heute bekommen weiter den letzten Wert', () => {
    const s = getWeightSuggestion(squat, sets([[5, 100], [5, 100]]), 'strength')
    expect(s.backoffSets).toBe(0)
    expect(getSuggestionForSet(s, 3)).toBe(102.5)
  })

  it('Pyramide (erster Satz nicht der schwerste) -> weiter kein Vorschlag', () => {
    expect(getWeightSuggestion(squat, sets([[5, 90], [5, 100], [5, 80]]), 'strength')).toBeNull()
  })
})

describe('Schema statt fester Zahl', () => {
  const sets = (reps, weight = 100) => session(reps.map((r) => ({ reps: r, weight })))

  it('Kraft: Schema wird aus den Sessions erkannt (6x1, 4x5, 6x6)', () => {
    expect(getRepTarget(squat, 'strength', { sessions: [sets([1, 1, 1, 1, 1, 1])] }).target).toBe(1)
    expect(getRepTarget(squat, 'strength', { sessions: [sets([5, 5, 5, 5])] }).target).toBe(5)
    expect(getRepTarget(squat, 'strength', { sessions: [sets([6, 6, 6, 6, 6, 6])] }).target).toBe(6)
    // Gleichstand -> höhere Zahl; über 6 wird auf 6 begrenzt; ohne Verlauf 5
    expect(getRepTarget(squat, 'strength', { sessions: [sets([5, 5, 4, 4])] }).target).toBe(5)
    expect(getRepTarget(squat, 'strength', { sessions: [sets([8, 8, 8])] }).target).toBe(6)
    expect(getRepTarget(squat, 'strength').target).toBe(5)
  })

  it('Kraft 4x5 geschafft -> mehr Gewicht, 5/5/5/4/3 -> Halten', () => {
    expect(getProgressionStatus(squat, sets([5, 5, 5, 5]), 'strength').state).toBe('increase')
    expect(getProgressionStatus(squat, sets([5, 5, 5, 4, 3]), 'strength').state).toBe('hold')
  })

  it('Singles (6x1): erst nach zweimal Schaffen mit demselben Gewicht steigern', () => {
    const singles = sets([1, 1, 1, 1, 1, 1], 140)
    expect(getProgressionStatus(squat, singles, 'strength').state).toBe('confirm')
    expect(getProgressionStatus(squat, singles, 'strength', { previousSessions: [sets([1, 1, 1, 1, 1, 1], 140)] }).state).toBe('increase')
    expect(getProgressionStatus(squat, singles, 'strength', { previousSessions: [sets([1, 1, 1, 1, 1, 1], 137.5)] }).state).toBe('confirm')
    // 5x5 braucht keine Bestätigung
    expect(getProgressionStatus(squat, sets([5, 5, 5, 5, 5]), 'strength').state).toBe('increase')
  })

  it('Muskelaufbau 8-12: klettern, erst bei 12 überall mehr Gewicht', () => {
    const s10 = getProgressionStatus(squat, sets([10, 10, 10], 60), 'hypertrophy')
    expect(s10).toMatchObject({ state: 'climb', minReps: 10, nextReps: 11, max: 12 })
    expect(getProgressionStatus(squat, sets([12, 11, 10], 60), 'hypertrophy').nextReps).toBe(11)
    expect(getProgressionStatus(squat, sets([12, 12, 12], 60), 'hypertrophy').state).toBe('increase')
    // nach einer Steigerung auch unter 8: weiter klettern, nie senken
    expect(getProgressionStatus(squat, sets([7, 7, 6], 62.5), 'hypertrophy')).toMatchObject({ state: 'climb', nextReps: 7 })
    expect(getWeightSuggestion(squat, sets([10, 10, 10], 60), 'hypertrophy')).toBeNull()
  })
})
