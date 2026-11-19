import { describe, it, expect } from 'vitest'
import { createI18nInstance, setLocale } from '@/i18n'

// Texte des Kastens über den Sätzen bei starkem Einbruch (freigegeben von Jimmy 19.11.), DE und EN.
describe('Kasten über den Sätzen: starker Einbruch', () => {
  const textFor = (locale, key, params) => {
    const i18n = createI18nInstance()
    setLocale(i18n, locale)
    return i18n.global.t(key, params)
  }

  it('restore (DE): nennt früheres und letztes Gewicht, Verletzung als Beispiel, schrittweise', () => {
    const text = textFor('de', 'workoutDetail.progressionRestore', { last: '75', weight: '40' })
    expect(text).toBe('Letztes Mal waren es 75 kg, zuletzt 40 kg. Wenn nichts dagegenspricht (z. B. eine Verletzung), starte wieder bei 75 kg. Sonst taste dich Schritt für Schritt heran.')
  })

  it('rebuild (DE): gleiches Gewicht, dann Schritt für Schritt', () => {
    expect(textFor('de', 'workoutDetail.progressionRebuild', { weight: '40' })).toBe('Gleiches Gewicht (40 kg), dann Schritt für Schritt wieder steigern.')
  })

  it('EN: beide Texte vorhanden, mit eingesetzten Zahlen und ohne offene Platzhalter', () => {
    for (const [key, params] of [['workoutDetail.progressionRestore', { last: '75', weight: '40' }], ['workoutDetail.progressionRebuild', { weight: '40' }]]) {
      const text = textFor('en', key, params)
      expect(text).toContain('40 kg')
      expect(text).not.toMatch(/[{}]|workoutDetail\./)
      expect(text).not.toBe(textFor('de', key, params))
    }
    expect(textFor('en', 'workoutDetail.progressionRestore', { last: '75', weight: '40' })).toContain('75 kg')
  })
})
