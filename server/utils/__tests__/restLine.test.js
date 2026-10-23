import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { stripAiRestLines, buildRestLine, applyRestLine } from '../restLine.js'

const ex = (name, progression, previous = true) => ({ exercise: name, exerciseNameForAI: name, progression, ...(previous ? { previous: { sets: 3 } } : {}) })
const REST = 'Der Rest lief stabil, die Details siehst du oben.'

describe('Sammelzeile "Der Rest lief stabil"', () => {
  test('nur eine Übung im Workout: keine Sammelzeile', () => {
    const text = 'Starke Einheit 💪\n- Bench Press: läuft rund'
    assert.equal(applyRestLine(text, { exerciseAnalyses: [ex('Bench Press', 'positive')] }), text)
  })

  test('KI-Sammelzeile wird entfernt, wenn es keinen Rest gibt', () => {
    const text = 'Starke Einheit 💪\n- Bench Press: läuft rund\n- Der Rest lief stabil, die Details siehst du oben.'
    assert.equal(applyRestLine(text, { exerciseAnalyses: [ex('Bench Press', 'positive')] }), 'Starke Einheit 💪\n- Bench Press: läuft rund')
  })

  test('weitere stabile Übungen ohne Erwähnung: App hängt die Zeile an (DE/EN)', () => {
    const analyses = [ex('Bench Press', 'positive'), ex('Barbell Row', 'stable'), ex('Biceps Curl', 'stable')]
    const text = 'Starke Einheit 💪\n- Bench Press: läuft rund'
    assert.equal(applyRestLine(text, { exerciseAnalyses: analyses }), `${text}\n\n${REST}`)
    assert.equal(applyRestLine(text, { exerciseAnalyses: analyses, language: 'en' }), `${text}\n\nThe rest stayed steady, the details are above.`)
  })

  test('KI schreibt die Zeile selbst und es gibt einen Rest: genau eine Zeile (die der App)', () => {
    const analyses = [ex('Bench Press', 'positive'), ex('Barbell Row', 'stable')]
    const text = 'Starke Einheit 💪\n- Bench Press: läuft rund\n- Der Rest lief solide.'
    const result = applyRestLine(text, { exerciseAnalyses: analyses })
    assert.equal(result.split('\n').filter((l) => /Rest/.test(l)).length, 1)
    assert.ok(result.endsWith(REST))
  })

  test('unerwähnte VERBESSERTE Übung: keine Zeile (war "stabil" fälschlich, User-Report 24.10.)', () => {
    const analyses = [ex('Bench Press', 'positive'), ex('Barbell Row', 'stable'), ex('Biceps Curl', 'positive')]
    assert.equal(buildRestLine('- Bench Press: läuft rund', analyses), null)
    assert.equal(applyRestLine('- Bench Press: läuft rund', { exerciseAnalyses: analyses }), '- Bench Press: läuft rund')
  })

  test('unerwähnter Rückgang: lieber keine Zeile als eine falsche Behauptung', () => {
    const analyses = [ex('Bench Press', 'positive'), ex('Barbell Row', 'negative')]
    assert.equal(buildRestLine('Text ohne Row', analyses), null)
  })

  test('erste Session (kein Vorher-Vergleich) zählt nicht als "Rest lief stabil"', () => {
    const analyses = [ex('Bench Press', 'positive'), ex('Barbell Row', 'first_session', false)]
    assert.equal(buildRestLine('- Bench Press: läuft rund', analyses), null)
  })

  test('erwähnte Übungen zählen nicht zum Rest; Erkennung ohne Groß-/Kleinschreibung', () => {
    const analyses = [ex('Bench Press', 'stable'), ex('Barbell Row', 'stable')]
    assert.equal(buildRestLine('- bench press und barbell row laufen', analyses), null)
  })

  test('stripAiRestLines erkennt typische Varianten, lässt normale Zeilen stehen', () => {
    const text = '- Der Rest lief stabil.\n- Alles andere lief solide.\n- The rest looked good.\n- Rest day ist wichtig\n- Bench Press: top'
    assert.equal(stripAiRestLines(text), '- Rest day ist wichtig\n- Bench Press: top')
  })
})
