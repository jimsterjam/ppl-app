// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActiveUid, __resetUserScopedStorageForTests } from '@/utils/userScopedStorage'
import {
  isQuestionsEnabled, setQuestionsEnabled, hasSeenIntro, markIntroSeen, skipsInARow, recordSkip, resetSkips,
  shouldOfferTurnOff, SKIPS_BEFORE_OFFER
} from '../postWorkoutQuestionPrefs.js'

describe('Fragen nach dem Training: Einstellungen und Zähler', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* ohne Speicher */ }
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
  })

  it('Standard: an, Erklärung noch nicht gesehen, kein Angebot zum Ausschalten', () => {
    expect(isQuestionsEnabled()).toBe(true)
    expect(hasSeenIntro()).toBe(false)
    expect(shouldOfferTurnOff()).toBe(false)
  })

  it('Ausschalten und wieder einschalten (setzt den Zähler zurück)', () => {
    for (let i = 0; i < SKIPS_BEFORE_OFFER; i += 1) recordSkip()
    expect(shouldOfferTurnOff()).toBe(true)
    setQuestionsEnabled(false)
    expect(isQuestionsEnabled()).toBe(false)
    setQuestionsEnabled(true)
    expect(isQuestionsEnabled()).toBe(true)
    expect(skipsInARow()).toBe(0)
  })

  it('Angebot erst nach dreimal Überspringen in Folge; eine Antwort setzt den Zähler zurück', () => {
    recordSkip()
    recordSkip()
    expect(shouldOfferTurnOff()).toBe(false)
    resetSkips()
    recordSkip()
    recordSkip()
    expect(shouldOfferTurnOff()).toBe(false)
    recordSkip()
    expect(shouldOfferTurnOff()).toBe(true)
  })

  it('Gegenprobe: ein zweites Konto auf demselben Gerät sieht nichts vom ersten', () => {
    setQuestionsEnabled(false)
    markIntroSeen()
    recordSkip()
    setActiveUid('uid-b')
    expect(isQuestionsEnabled()).toBe(true)
    expect(hasSeenIntro()).toBe(false)
    expect(skipsInARow()).toBe(0)
    setActiveUid('uid-a')
    expect(isQuestionsEnabled()).toBe(false)
    expect(hasSeenIntro()).toBe(true)
  })

  it('kaputte gespeicherte Werte zählen als 0 bzw. an', () => {
    localStorage.setItem('post-questions-skips:uid-a', 'abc')
    localStorage.setItem('post-questions:uid-a', 'x')
    expect(skipsInARow()).toBe(0)
    expect(isQuestionsEnabled()).toBe(true)
  })
})
