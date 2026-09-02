import { describe, it, expect } from 'vitest'
import {
  HELPFUL_REASON_CODES,
  NOT_HELPFUL_REASON_CODES,
  reasonCodesForRating,
  toggleReasonCode,
  shouldOfferExerciseNote
} from '../feedbackRatingHelpers.js'

describe('reasonCodesForRating', () => {
  it('liefert die positiven Codes für "helpful"', () => {
    expect(reasonCodesForRating('helpful')).toEqual(HELPFUL_REASON_CODES)
  })

  it('liefert die negativen Codes für "not_helpful"', () => {
    expect(reasonCodesForRating('not_helpful')).toEqual(NOT_HELPFUL_REASON_CODES)
  })
})

describe('toggleReasonCode', () => {
  it('fügt einen noch nicht ausgewählten Code hinzu', () => {
    expect(toggleReasonCode([], 'TOO_GENERIC')).toEqual(['TOO_GENERIC'])
  })

  it('entfernt einen bereits ausgewählten Code', () => {
    expect(toggleReasonCode(['TOO_GENERIC', 'OTHER'], 'TOO_GENERIC')).toEqual(['OTHER'])
  })

  it('mutiert das Original-Array nicht', () => {
    const original = ['OTHER']
    const result = toggleReasonCode(original, 'TOO_GENERIC')
    expect(original).toEqual(['OTHER'])
    expect(result).toEqual(['OTHER', 'TOO_GENERIC'])
  })

  it('behandelt undefined/null wie ein leeres Array', () => {
    expect(toggleReasonCode(undefined, 'OTHER')).toEqual(['OTHER'])
    expect(toggleReasonCode(null, 'OTHER')).toEqual(['OTHER'])
  })
})

describe('shouldOfferExerciseNote', () => {
  it('true bei not_helpful + Korrekturtext + vorhandenen Übungen', () => {
    expect(shouldOfferExerciseNote({
      rating: 'not_helpful',
      correctionText: 'Mehr auf meine Notiz eingehen',
      exerciseNames: ['Bankdrücken']
    })).toBe(true)
  })

  it('false bei helpful, selbst mit Text', () => {
    expect(shouldOfferExerciseNote({
      rating: 'helpful',
      correctionText: 'Trotzdem ein Hinweis',
      exerciseNames: ['Bankdrücken']
    })).toBe(false)
  })

  it('false ohne Korrekturtext', () => {
    expect(shouldOfferExerciseNote({ rating: 'not_helpful', correctionText: '   ', exerciseNames: ['Bankdrücken'] })).toBe(false)
  })

  it('false ohne bekannte Übungen (z.B. alter Verlaufseintrag ohne Snapshot)', () => {
    expect(shouldOfferExerciseNote({ rating: 'not_helpful', correctionText: 'Text', exerciseNames: [] })).toBe(false)
  })
})
