import { describe, it, expect } from 'vitest'
import { detectTextLanguage, resolveFeedbackLanguage } from '../feedbackLanguage.js'

const DE = 'Tolle Session heute! Du hast einige Fortschritte erzielt und die Zahlen zeigen, dass du auf dem richtigen Weg bist. Nächstes Mal – Barbell Seated Behind Head Military Press: 10 Wdh. pro Satz mit dem gleichen Gewicht.'
const EN = 'Great session today! You made some progress and the numbers show that you are on the right track. Next time – Lever T Bar Row: keep the weight and try to add one rep in every set.'

describe('Sprache eines Feedbacks', () => {
  it('erkennt deutsche und englische Coach-Texte', () => {
    expect(detectTextLanguage(DE)).toBe('de')
    expect(detectTextLanguage(EN)).toBe('en')
  })

  it('zu kurz oder uneindeutig: null', () => {
    expect(detectTextLanguage('')).toBeNull()
    expect(detectTextLanguage('Bench Press 90 kg')).toBeNull()
  })

  it('gespeicherte Sprache hat Vorrang vor der Erkennung', () => {
    expect(resolveFeedbackLanguage({ ai_feedback_language: 'en', ai_feedback: DE }, 'de')).toBe('en')
  })

  it('ohne gespeicherte Angabe: am Text erkannt, unabhängig von der App-Sprache', () => {
    expect(resolveFeedbackLanguage({ ai_feedback: DE }, 'en')).toBe('de')
    expect(resolveFeedbackLanguage({ ai_feedback: EN }, 'de')).toBe('en')
  })

  it('weder Angabe noch erkennbarer Text: App-Sprache', () => {
    expect(resolveFeedbackLanguage({ ai_feedback: 'OK' }, 'en')).toBe('en')
    expect(resolveFeedbackLanguage({}, 'de')).toBe('de')
  })
})
