import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeWorkoutProgression, structureAnalysisForAI } from '../../services/trainingAnalysisService.js'
import { buildNextSessionFocus, buildProgressionStates } from '../nextSessionFocus.js'
import OpenAIProvider, { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'
import { getVerifierChecklistText, RULE_LABELS } from '../../services/feedbackVerificationService.js'

// Absprache Paul 16.10.: Trainingsart "Technik" - keine Vorgaben, der Nutzer entscheidet selbst.
const session = (reps, date, id, trainingType) => ({
  _id: id, date, completed: true, goal: 'strength',
  exercises: [{ name: 'Barbell High Bar Squat', ...(trainingType ? { trainingType } : {}), note: trainingType ? 'Fokus auf Tiefe' : undefined, setDetails: reps.map((r) => ({ reps: r, weight: 60, done: true })) }]
})
const last = session([5, 5, 5, 5, 5], '2026-10-07T10:00:00Z', 'w0', 'technique')
const current = session([5, 5, 5, 5, 4], '2026-10-14T10:00:00Z', 'w1', 'technique')

test('Technik: keine "Nächstes Mal"-Zeile und kein Fortschrittszustand für die Übung', () => {
  assert.equal(buildNextSessionFocus({ workout: current, history: [last] }), null)
  assert.equal(buildProgressionStates({ workout: current, history: [last] }).size, 0)
})

test('Gleiche Daten ohne Technik-Flag liefern weiter eine Einordnung', () => {
  const plain = session([5, 5, 5, 5, 4], '2026-10-14T10:00:00Z', 'w2', null)
  const prev = session([5, 5, 5, 5, 5], '2026-10-07T10:00:00Z', 'w3', null)
  assert.equal(buildProgressionStates({ workout: plain, history: [prev] }).get('barbell high bar squat'), 'almost_there')
})

test('KI: training_type technique, Prompt ohne Zahlen mit Notiz, Regel 31 und Prüfregel 25', () => {
  const analyses = analyzeWorkoutProgression(current, [current, last])
  const structured = structureAnalysisForAI(analyses)
  assert.equal(structured.exercises[0].training_type, 'technique')
  const prompt = new OpenAIProvider({ apiKey: 'test-key' }).buildPrompt(structured)
  assert.match(prompt, /Trainingsart: Technik/)
  assert.match(prompt, /Fokus auf Tiefe/)
  assert.doesNotMatch(prompt, /Satzdaten|kg ×|Gesamtvolumen/)
  assert.match(getCoachSystemPromptText(), /31\. TECHNIK-ÜBUNGEN/)
  assert.match(getVerifierChecklistText(), /25\. Technik-Übungen/)
  assert.ok(RULE_LABELS[25])
})
