import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

import { messages } from '@/i18n/index.js'
import { buildDeltaSentence } from '../deltaSentence.js'

// Vergleichsteil in der Sprache des Feedbacks, nicht der App (siehe AiFeedbackDeltaSummary.vue: t mit { locale }).
describe('Vergleichssatz in der Sprache des Feedbacks', () => {
  let i18n
  beforeEach(() => {
    i18n = createI18n({ legacy: false, locale: 'de', fallbackLocale: 'de', messages })
  })

  const item = {
    exercise: 'Bench Press Barbell', sets_change: 0, reps_change: 1, weight_change_kg: 2.5, weight_change_scope: 'uniform',
    top_weight_kg: 90, top_weight_change_kg: 2.5, is_first_session: false
  }
  const sentenceIn = (lang) => {
    const t = (key, params) => i18n.global.t(key, params ?? {}, { locale: lang })
    return buildDeltaSentence(item, t, (n) => String(n))
  }

  it('App auf Deutsch, Feedback englisch: Satz bleibt englisch', () => {
    i18n.global.locale.value = 'de'
    const en = sentenceIn('en')
    const de = sentenceIn('de')
    expect(en).not.toBe(de)
    expect(en).toMatch(/more|rep|weight|kg/i)
    expect(en).not.toMatch(/Wdh|gestemmt|mehr gestemmt/)
  })

  it('App auf Englisch, Feedback deutsch: Satz bleibt deutsch', () => {
    i18n.global.locale.value = 'en'
    const de = sentenceIn('de')
    expect(de).not.toMatch(/\bmore\b|\breps?\b/i)
  })
})
