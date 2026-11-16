import { describe, it, expect } from 'vitest'
import { stripQuestionsFromNote, isQuestionToRemove } from '../noteQuestionStrip.js'

describe('stripQuestionsFromNote: Fragen fallen weg, Aussagen bleiben', () => {
  it('Frage und Aussage in einer Notiz: nur die Aussage bleibt', () => {
    expect(stripQuestionsFromNote('Kann es sein, dass die Schulter müde ist? Knie vorsichtig.')).toBe('Knie vorsichtig.')
  })

  it('Notiz nur aus einer Frage wird leer', () => {
    expect(stripQuestionsFromNote('Woran liegt es, dass ich bei Satz 5 einbreche?')).toBe('')
  })

  it('Zeilenumbrüche bleiben, Fragezeilen verschwinden', () => {
    expect(stripQuestionsFromNote('Schulter eng greifen.\nWarum fällt mir das schwer?\nEllbogen eng.')).toBe('Schulter eng greifen.\nEllbogen eng.')
  })

  it('Frage ohne Fragezeichen, die mit einer Wendung beginnt', () => {
    expect(stripQuestionsFromNote('Ich frage mich ob das am Gewicht liegt. Pause 3 Minuten.')).toBe('Pause 3 Minuten.')
    expect(stripQuestionsFromNote('Soll ich nächstes Mal steigern. Pause 3 Minuten.')).toBe('Pause 3 Minuten.')
  })

  it('Englisch', () => {
    expect(stripQuestionsFromNote('Could it be the rest time? Keep elbows tucked.')).toBe('Keep elbows tucked.')
  })

  it('Zusammenfassung mit " • ": nur die Frage der einen Übung fällt weg, die Aussage der anderen bleibt', () => {
    expect(stripQuestionsFromNote('Squat: Knie vorsichtig • Bench Press: Kann es sein, dass die Schulter müde ist?')).toBe('Squat: Knie vorsichtig')
    expect(stripQuestionsFromNote('Bench Press: Kann es sein, dass die Schulter müde ist? • Squat: Knie vorsichtig.')).toBe('Squat: Knie vorsichtig.')
  })
})

describe('Gegenproben: nichts verlieren, was keine Frage ist', () => {
  it.each([
    'Nächstes Mal sollte ich langsamer absenken.',
    'Heute soll ich 3x8 machen.',
    "Straps, that's why I use them.",
    'Schauen, ob die Hüfte mitmacht.',
    'Ich weiß nicht warum es klappt.',
    'Schulter tat weh',
    'Knie vorsichtig. Pause 3 Minuten.'
  ])('Aussage bleibt: %s', (note) => {
    expect(stripQuestionsFromNote(note)).toBe(note)
    expect(isQuestionToRemove(note)).toBe(false)
  })

  it('ohne Frage kommt die Notiz Zeichen für Zeichen unverändert zurück (kein Umformatieren)', () => {
    for (const note of ['Aufwärmen:\n\n  - 2 Sätze leicht\n  - dann steigern', 'A  B', 'Zeile 1\r\nZeile 2', ' vorn und hinten ', '']) {
      expect(stripQuestionsFromNote(note)).toBe(note)
    }
  })

  it('mit Frage bleibt die übrige Formatierung erhalten', () => {
    expect(stripQuestionsFromNote('Aufwärmen:\n  - 2 Sätze leicht\nWarum fällt mir das schwer?\n  - dann steigern')).toBe('Aufwärmen:\n  - 2 Sätze leicht\n  - dann steigern')
  })

  it('kein Text -> leerer Text, nichts wird geworfen', () => {
    expect(stripQuestionsFromNote(undefined)).toBe('')
    expect(stripQuestionsFromNote(null)).toBe('')
    expect(stripQuestionsFromNote(42)).toBe('')
  })

  it('bekannte Grenze: eine Frage ohne Fragezeichen mit der Wendung mitten im Satz bleibt im Favoriten', () => {
    expect(stripQuestionsFromNote('Ich wüsste gern, warum das so ist.')).toBe('Ich wüsste gern, warum das so ist.')
  })
})
