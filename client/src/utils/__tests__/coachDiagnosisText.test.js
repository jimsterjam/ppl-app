import { describe, test, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import { messages } from '@/i18n/index.js'
import { diagnosisTextKeys, DIAGNOSIS_CAUSES } from '../coachDiagnosisText.js'

// Beispiel-Einträge wie vom Server (server/utils/stagnationDiagnosis.js) - je Ursache und Variante.
const ITEMS = [
  { name: 'Bench Press', cause: 'insufficient_data', logged: 5, complete: 1 },
  { name: 'Bench Press', cause: 'low_frequency', weeks: 8, sessions: 3, weight: 80, sets: 3, usualDays: 7, recentDays: 21 },
  { name: 'Bench Press', cause: 'repeating', weeks: 4, sessions: 4, weight: 80, sets: 3, reps: 8, nextReps: 9, nextWeight: null },
  { name: 'Squat', cause: 'repeating', weeks: 4, sessions: 4, weight: 100, sets: 5, reps: 5, nextReps: null, nextWeight: 102.5 },
  { name: 'Squat', cause: 'plateau', weeks: 4, sessions: 4, weight: 100, sets: 5, deloadWeight: 90 },
  { name: 'Squat', cause: 'plateau_long', weeks: 9, sessions: 8, weight: 100, sets: 5, switchTo: 'hypertrophy' },
  { name: 'Curl', cause: 'plateau_long', weeks: 9, sessions: 8, weight: 20, sets: 3, switchTo: 'strength' }
]

function translate(locale) {
  const i18n = createI18n({ legacy: false, locale, messages, missingWarn: false, fallbackWarn: false })
  return i18n.global.t
}

describe('diagnosisTextKeys', () => {
  test('unbekannte Ursache oder leerer Eintrag -> null', () => {
    expect(diagnosisTextKeys(null)).toBeNull()
    expect(diagnosisTextKeys({ cause: 'something_else' })).toBeNull()
  })

  test('jede Ursache wird abgedeckt', () => {
    const covered = new Set(ITEMS.map((i) => i.cause))
    expect([...covered].sort()).toEqual([...DIAGNOSIS_CAUSES].sort())
  })

  test('richtige Variante für "repeating" und "plateau_long"', () => {
    expect(diagnosisTextKeys(ITEMS[2]).nextKey).toBe('coachDiagnosis.next_repeating_reps')
    expect(diagnosisTextKeys(ITEMS[3]).nextKey).toBe('coachDiagnosis.next_repeating_weight')
    expect(diagnosisTextKeys(ITEMS[5]).nextKey).toBe('coachDiagnosis.next_plateau_long_hypertrophy')
    expect(diagnosisTextKeys(ITEMS[6]).nextKey).toBe('coachDiagnosis.next_plateau_long_strength')
    expect(diagnosisTextKeys(ITEMS[0]).showWeeks).toBe(false)
    expect(diagnosisTextKeys(ITEMS[1]).showWeeks).toBe(true)
  })

  test('Gewicht im Sprachformat (DE Komma, EN Punkt)', () => {
    expect(diagnosisTextKeys(ITEMS[3], 'de').params.nextWeight).toBe('102,5')
    expect(diagnosisTextKeys(ITEMS[3], 'en').params.nextWeight).toBe('102.5')
  })

  for (const locale of ['de', 'en']) {
    test(`alle Texte vorhanden und vollständig ausgefüllt (${locale})`, () => {
      const t = translate(locale)
      for (const item of ITEMS) {
        const keys = diagnosisTextKeys(item, locale)
        for (const key of [keys.causeKey, keys.nextKey]) {
          const text = t(key, keys.params)
          expect(text, `${locale}: ${key} fehlt`).not.toBe(key)
          expect(text, `${locale}: ${key} hat offene Platzhalter`).not.toMatch(/\{\w+\}|undefined|NaN/)
        }
      }
      // Übrig sind die Texte, die der Monatsbericht für den Stillstand nutzt
      for (const key of ['stalledFor', 'causeLabel', 'nextLabel']) {
        expect(t(`coachDiagnosis.${key}`, { count: 3, weeks: 4 })).not.toBe(`coachDiagnosis.${key}`)
      }
    })
  }
})
