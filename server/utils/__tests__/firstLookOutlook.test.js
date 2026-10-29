import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFirstLookOutlook, applyFirstLookOutlook, isFirstLook, FIRST_LOOK_COMPARISON_MIN } from '../firstLookOutlook.js'
import { getFirstLookDirectiveText, getCoachSystemPromptText } from '../../services/OpenAIProvider.js'
import { getVerifierChecklistText } from '../../services/feedbackVerificationService.js'
import Workout from '../../models/Workout.js'

// Absprache Paul 29.10.: Erste Einordnung bei den ersten 3 gleichen Workouts, ab dem 4. das vergleichende Feedback.
test('Schwelle: 1.-3. gleiches Workout = Erste Einordnung, ab dem 4. Vergleich', () => {
  assert.equal(FIRST_LOOK_COMPARISON_MIN, 4)
  assert.equal(isFirstLook(1), true)
  assert.equal(isFirstLook(3), true)
  assert.equal(isFirstLook(4), false)
  assert.equal(isFirstLook(8), false)
})

test('Ausblick (fester App-Text): Empfehlungen kommen von der App, Ausführung in Eigenverantwortung', () => {
  const de = buildFirstLookOutlook('de')
  assert.match(de, /gibt dir die App Empfehlungen/)
  assert.match(de, /3×10 auf 3×11, bis 3×12/)
  assert.match(de, /Ab dem 4\. gleichen Workout/)
  assert.match(de, /Die App kann das nicht prüfen/)
  assert.match(de, /Verantwortung/)
  const en = buildFirstLookOutlook('en')
  assert.match(en, /gives you recommendations/)
  assert.match(en, /cannot check that/)
  assert.match(en, /responsibility/)
  assert.equal(buildFirstLookOutlook('fr'), de)
})

test('Ausblick wird nach dem KI-Text angehängt; ohne KI-Text steht er allein', () => {
  const text = applyFirstLookOutlook('Starker Start! 💪', 'de')
  assert.ok(text.startsWith('Starker Start! 💪\n\nSo geht es weiter:'))
  assert.ok(applyFirstLookOutlook('', 'de').startsWith('So geht es weiter:'))
})

test('Prompt-Modus: keine Vergleiche, keine Empfehlungen, keine Ausführungsaussagen; Vorrang vor dem Output-Format', () => {
  const directive = getFirstLookDirectiveText()
  assert.match(directive, /feedback_mode: "first_look"/)
  assert.match(directive, /VORRANG VOR DEM OUTPUT-FORMAT/)
  assert.match(directive, /KEINE Vergleiche mit früheren Einheiten/)
  assert.match(directive, /KEINE Empfehlung zu Gewicht oder Wiederholungen/)
  assert.match(directive, /KEINE Aussage zur Ausführung/)
  // Der Standard-Prompt bleibt unverändert (Modus nur bei first_look angehängt)
  assert.doesNotMatch(getCoachSystemPromptText(), /feedback_mode: "first_look"/)
})

test('Prüf-KI kennt die Erste Einordnung (Regel 26)', () => {
  const checklist = getVerifierChecklistText()
  assert.match(checklist, /26\. ERSTE EINORDNUNG/)
  assert.match(checklist, /first_look/)
})

test('Workout.ai_feedback_kind: nur bekannte Werte, sonst null', () => {
  assert.equal(new Workout({ userId: 'u', ai_feedback_kind: 'first_look' }).ai_feedback_kind, 'first_look')
  assert.equal(new Workout({ userId: 'u', ai_feedback_kind: 'comparison' }).ai_feedback_kind, 'comparison')
  assert.equal(new Workout({ userId: 'u', ai_feedback_kind: 'x' }).ai_feedback_kind, null)
  assert.equal(new Workout({ userId: 'u' }).ai_feedback_kind, null)
})
