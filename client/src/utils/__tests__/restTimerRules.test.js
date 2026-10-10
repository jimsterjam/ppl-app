import { describe, it, expect } from 'vitest'
import { restSecondsFor, clampRestSeconds, sanitizeCustomRest, formatRest, shouldAutoExpandRest, sanitizeRestOverrides, defaultRestSeconds } from '../restTimerRules.js'

describe('restTimerRules', () => {
  it('Standarddauer je Trainingsart und Übungsart', () => {
    expect(restSecondsFor('strength', 'compound')).toBe(180)
    expect(restSecondsFor('strength', 'isolation')).toBe(120)
    expect(restSecondsFor('hypertrophy', 'compound')).toBe(120)
    expect(restSecondsFor('hypertrophy', 'isolation')).toBe(90)
    expect(restSecondsFor('explosive', 'compound')).toBe(120)
    expect(restSecondsFor('hypertrophy', 'core')).toBe(90)
    expect(restSecondsFor('unbekannt', 'compound')).toBe(120)
  })

  it('gemerkte Dauer hat Vorrang, ungültige wird ignoriert', () => {
    expect(restSecondsFor('strength', 'compound', 240)).toBe(240)
    expect(restSecondsFor('strength', 'compound', 5)).toBe(180)
    expect(restSecondsFor('strength', 'compound', 'x')).toBe(180)
    expect(sanitizeCustomRest(9999)).toBeNull()
  })

  it('Begrenzung und Anzeige', () => {
    expect(clampRestSeconds(0)).toBe(15)
    expect(clampRestSeconds(1000)).toBe(600)
    expect(formatRest(125000)).toBe('2:05')
    expect(formatRest(0)).toBe('0:00')
    expect(formatRest(59001)).toBe('1:00')
  })

  it('minimierte Pause wird bei <= 10 s einmalig wieder groß', () => {
    const base = { minimized: true, fullscreen: true, running: true, remainingMs: 10000, autoExpanded: false }
    expect(shouldAutoExpandRest(base)).toBe(true)
    expect(shouldAutoExpandRest({ ...base, remainingMs: 10001 })).toBe(false)
    expect(shouldAutoExpandRest({ ...base, minimized: false })).toBe(false)
    expect(shouldAutoExpandRest({ ...base, fullscreen: false })).toBe(false)
    expect(shouldAutoExpandRest({ ...base, running: false })).toBe(false)
    expect(shouldAutoExpandRest({ ...base, autoExpanded: true })).toBe(false)
  })
})

// Wunsch Paul 10.10.: Standard-Pausen je Ziel (Kraft, Muskelaufbau, Speed) und Übungsart einstellbar.
describe('eigene Standard-Pausen', () => {
  const own = { strength: { compound: 240 }, hypertrophy: { isolation: 60 } }

  it('eigener Wert ersetzt den eingebauten Standard, nur für das gesetzte Ziel und die Übungsart', () => {
    expect(restSecondsFor('strength', 'compound', null, own)).toBe(240)
    expect(restSecondsFor('strength', 'isolation', null, own)).toBe(120)
    expect(restSecondsFor('hypertrophy', 'isolation', null, own)).toBe(60)
    expect(restSecondsFor('hypertrophy', 'core', null, own)).toBe(60)
    expect(restSecondsFor('explosive', 'compound', null, own)).toBe(120)
  })

  it('Vorrang: gemerkte Pause der Übung > eigener Standard > eingebauter Standard', () => {
    expect(restSecondsFor('strength', 'compound', 200, own)).toBe(200)
    expect(restSecondsFor('strength', 'compound', null, own)).toBe(240)
    expect(restSecondsFor('strength', 'compound', null, null)).toBe(180)
  })

  it('defaultRestSeconds liefert die eingebauten Werte', () => {
    expect(defaultRestSeconds('strength', 'compound')).toBe(180)
    expect(defaultRestSeconds('explosive', 'isolation')).toBe(120)
  })

  it('sanitizeRestOverrides: nur bekannte Ziele/Arten und gültige Sekunden', () => {
    expect(sanitizeRestOverrides({
      strength: { compound: 200.4, isolation: 5, core: 100 },
      hypertrophy: 'x',
      evil: { compound: 100 },
      explosive: { compound: 9999, isolation: 90 }
    })).toEqual({ strength: { compound: 200 }, explosive: { isolation: 90 } })
    expect(sanitizeRestOverrides(null)).toEqual({})
    expect(sanitizeRestOverrides('x')).toEqual({})
  })
})
