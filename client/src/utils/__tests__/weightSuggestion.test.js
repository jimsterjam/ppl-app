import { describe, it, expect } from 'vitest'
import {
  classifyExercise,
  getRepTarget,
  getWeightSuggestion,
  getSuggestionForSet,
  normalizeTrainingGoal
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
    expect(getRepTarget(squat, 'strength')).toMatchObject({ min: 3, max: 5, target: 5 })
    expect(getRepTarget(squat, 'hypertrophy')).toMatchObject({ min: 6, max: 10, target: 10 })
  })

  it('Katalog-Fehler: Seitheben wird trotz "compound" als Isolation behandelt', () => {
    expect(classifyExercise(lateralRaise)).toBe('isolation')
    expect(getRepTarget(lateralRaise, 'strength').target).toBe(10)
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
      suggestedWeights: [62.5, 62.5, 62.5]
    })
  })

  it('ein Satz unter dem Ziel -> kein Vorschlag (keine Senkung)', () => {
    const last = session([{ reps: 5, weight: 60 }, { reps: 5, weight: 60 }, { reps: 4, weight: 60 }])
    expect(getWeightSuggestion(squat, last, 'strength')).toBeNull()
  })

  it('Aufwärmsätze werden ignoriert', () => {
    const last = session([
      { reps: 3, weight: 20, isWarmup: true },
      { reps: 10, weight: 60 },
      { reps: 10, weight: 60 }
    ])
    expect(getWeightSuggestion(squat, last, 'hypertrophy')?.suggestedWeights).toEqual([62.5, 62.5])
  })

  it('Trainingsziel entscheidet: 5 Wdh. reichen bei Kraft, nicht bei Muskelaufbau', () => {
    const last = session([{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }])
    expect(getWeightSuggestion(squat, last, 'strength')).not.toBeNull()
    expect(getWeightSuggestion(squat, last, 'hypertrophy')).toBeNull()
  })

  it('Kurzhanteln: +2 kg; unterschiedliche Satzgewichte je Satz', () => {
    const last = { setDetails: [{ reps: 12, weight: 10 }, { reps: 12, weight: 12.5 }] }
    expect(getWeightSuggestion(lateralRaise, last, 'hypertrophy')?.suggestedWeights).toEqual([12, 14.5])
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

  it('getSuggestionForSet: mehr Sätze als letztes Mal -> letzter Wert', () => {
    const suggestion = { suggestedWeights: [62.5, 65] }
    expect(getSuggestionForSet(suggestion, 0)).toBe(62.5)
    expect(getSuggestionForSet(suggestion, 3)).toBe(65)
    expect(getSuggestionForSet(null, 0)).toBeNull()
  })
})
