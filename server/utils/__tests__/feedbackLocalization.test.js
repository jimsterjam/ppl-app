import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const {
  resolveEnglishExerciseName,
  resolveFeedbackLanguage,
  reorderBulletLinesByExerciseOrder,
  languageDirective,
  toTitleCase,
  __setCatalogForTests
} = await import(join(__dirname, '../feedbackLocalization.js'))

describe('resolveEnglishExerciseName', () => {
  before(() => {
    __setCatalogForTests([
      { name: 'Wadenpresse sitzend im Winkel', name_en: 'calf press lever' },
      { name: 'Rumänisches Langhantel-Kreuzheben', name_en: 'barbell romanian deadlift' }
    ])
  })

  test('User-Report: deutscher Katalogname ohne DB-Übersetzung wird englisch', () => {
    assert.equal(resolveEnglishExerciseName('Wadenpresse sitzend im Winkel'), 'Calf Press Lever')
  })

  test('DB-Feld names.en hat Vorrang vor dem Katalog', () => {
    assert.equal(resolveEnglishExerciseName('Rumänisches Langhantel-Kreuzheben', 'romanian deadlift'), 'Romanian Deadlift')
  })

  test('eigene Übung ohne Katalog-Eintrag behält ihren Namen', () => {
    assert.equal(resolveEnglishExerciseName('Meine Spezialübung'), 'Meine Spezialübung')
  })

  test('toTitleCase lässt bereits großgeschriebene Wörter und Zahlen unverändert', () => {
    assert.equal(toTitleCase('barbell high-bar squat 1RM'), 'Barbell High-Bar Squat 1RM')
  })
})

describe('resolveFeedbackLanguage', () => {
  const req = (body = {}, headers = {}) => ({ body, get: (h) => headers[h.toLowerCase()] })

  test('Body-Feld hat Vorrang', () => {
    assert.equal(resolveFeedbackLanguage(req({ language: 'en' }, { 'x-app-language': 'de' })), 'en')
  })

  test('Header x-app-language', () => {
    assert.equal(resolveFeedbackLanguage(req({}, { 'x-app-language': 'en-US' })), 'en')
  })

  test('ohne Angabe bleibt es Deutsch (bisheriges Verhalten)', () => {
    assert.equal(resolveFeedbackLanguage(req()), 'de')
  })
})

describe('languageDirective', () => {
  test('Deutsch: kein Zusatz', () => {
    assert.equal(languageDirective('de'), '')
  })

  test('Englisch: Coach- und Prüf-Variante', () => {
    assert.match(languageDirective('en'), /ENGLISCH/)
    assert.match(languageDirective('en', 'verifier'), /KEIN Regelverstoß/)
  })
})

describe('reorderBulletLinesByExerciseOrder', () => {
  const order = ['Barbell High Bar Squat', 'Barbell Romanian Deadlift', 'Hack Calf Raise', 'Calf Press Lever']

  test('User-Report: Zusammenfassung wird in Workout-Reihenfolge gebracht', () => {
    const text = [
      'Great session 💪 Quick summary:',
      '',
      '- Calf Press Lever: volume up strongly (+22.7%).',
      '- Barbell Romanian Deadlift: volume up (+3.4%).',
      '- Barbell High Bar Squat: weight up by 2.5kg in every set.',
      '',
      'Next time: try adding weight on the squat.'
    ].join('\n')
    const result = reorderBulletLinesByExerciseOrder(text, order).split('\n')
    assert.deepEqual(result.slice(2, 5), [
      '- Barbell High Bar Squat: weight up by 2.5kg in every set.',
      '- Barbell Romanian Deadlift: volume up (+3.4%).',
      '- Calf Press Lever: volume up strongly (+22.7%).'
    ])
    assert.equal(result[0], 'Great session 💪 Quick summary:')
    assert.equal(result[6], 'Next time: try adding weight on the squat.')
  })

  test('Zeilen ohne erkennbare Übung bleiben am Ende der Gruppe, Text sonst unverändert', () => {
    const text = '- Something else: note\n- Calf Press Lever: ok\n- Barbell High Bar Squat: ok'
    assert.equal(
      reorderBulletLinesByExerciseOrder(text, order),
      '- Barbell High Bar Squat: ok\n- Calf Press Lever: ok\n- Something else: note'
    )
  })

  test('Fettgedruckte Namen und Text ohne Aufzählung', () => {
    assert.equal(
      reorderBulletLinesByExerciseOrder('- **Calf Press Lever**: a\n- **Hack Calf Raise**: b', order),
      '- **Hack Calf Raise**: b\n- **Calf Press Lever**: a'
    )
    assert.equal(reorderBulletLinesByExerciseOrder('Nur ein Satz.', order), 'Nur ein Satz.')
  })
})
