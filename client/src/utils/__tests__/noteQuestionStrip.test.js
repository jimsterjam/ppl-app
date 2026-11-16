import { describe, it, expect } from 'vitest'
import { stripQuestionsFromNote, isQuestionSentence } from '../noteQuestionStrip.js'

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

  it('Frage mit typischer Wendung ohne Fragezeichen', () => {
    expect(stripQuestionsFromNote('Ich frage mich ob das am Gewicht liegt. Pause 3 Minuten.')).toBe('Pause 3 Minuten.')
  })

  it('Englisch', () => {
    expect(stripQuestionsFromNote('Could it be the rest time? Keep elbows tucked.')).toBe('Keep elbows tucked.')
  })

  it('Gegenprobe: Notiz ohne Fragen bleibt unverändert', () => {
    for (const note of ['Schulter tat weh', 'Knie vorsichtig. Pause 3 Minuten.', 'Zeile 1\nZeile 2', '']) {
      expect(stripQuestionsFromNote(note)).toBe(note)
    }
  })

  it('Gegenprobe: kein Text -> leerer Text, nichts wird geworfen', () => {
    expect(stripQuestionsFromNote(undefined)).toBe('')
    expect(stripQuestionsFromNote(null)).toBe('')
    expect(stripQuestionsFromNote(42)).toBe('')
  })

  it('bekannte Grenze: ein Aussagesatz mit einer Fragewendung ("ich weiß nicht warum") gilt auch als Frage', () => {
    expect(isQuestionSentence('Ich weiß nicht warum es klappt.')).toBe(true)
  })
})
