import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'
import { getVerifierChecklistText } from '../../services/feedbackVerificationService.js'

// Absprache 09.10. (Paul, Variante 2 "Coach statt Protokoll"): höchstens 3 Übungen mit
// Einordnung, bewusste Entscheidungen aus der Notiz werden bestätigt statt als "weniger Gewicht"
// formuliert. Schützt davor, dass das alte Zusammenfassungs-Format unbemerkt zurückkommt.
test('Coach-Prompt: höchstens 3 Übungen, keine Zusammenfassung', () => {
  const prompt = getCoachSystemPromptText()
  assert.match(prompt, /HÖCHSTENS 3 Übungen/)
  assert.match(prompt, /Übungen ohne Besonderheit WEGLASSEN/)
  assert.doesNotMatch(prompt, /Kurz zusammengefasst:"/)
})

test('Coach-Prompt: bewusste Entscheidung aus der Notiz wird bestätigt (Regel 8 + 27)', () => {
  const prompt = getCoachSystemPromptText()
  assert.match(prompt, /AUSNAHME BEWUSSTE ENTSCHEIDUNG/)
  assert.match(prompt, /27\. FACHLICHE EINORDNUNG/)
  assert.doesNotMatch(prompt, /einfach neutral benennen, was die Notiz sagt/)
})

test('Prüf-KI: bestätigte bewusste Entscheidung ist kein Verstoß, nicht alle Übungen nötig', () => {
  const checklist = getVerifierChecklistText()
  assert.match(checklist, /BEWUSSTE Entscheidung/)
  assert.match(checklist, /NICHT alle Übungen vorkommen/)
})
