import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectGoalChange, buildGoalChangeLine, applyGoalChangeLine } from '../goalChange.js'
import { sanitizeCoachText } from '../feedbackFactGuard.js'
import { analyzeWorkoutProgression, structureAnalysisForAI } from '../../services/trainingAnalysisService.js'
import OpenAIProvider, { getCoachSystemPromptText } from '../../services/OpenAIProvider.js'
import { getRuleLabel } from '../../services/feedbackVerificationService.js'

// Fund Jimmy 23.11.: Zielwechsel (Kraft 5x60 kg -> Muskelaufbau 8x40 kg) wurde als Gewichtsminus gewertet, der KI-Text blieb leer ("es gibt einiges zu besprechen").
const pullUp = { name: 'Weighted Pull-Up', setDetails: [] }
const sets = (reps, weight) => reps.map((r) => ({ reps: r, weight, done: true }))
const session = (goal, reps, weight, date, id, extra = {}) => ({
  _id: id, date, completed: true, goal,
  exercises: [{ name: 'Weighted Pull-Up', setDetails: sets(reps, weight), ...extra }]
})

test('Erkennung: Kraft -> Muskelaufbau gilt als Wechsel (von, auf)', () => {
  const change = detectGoalChange({ exercise: pullUp, previousExercise: pullUp, currentGoal: 'hypertrophy', previousGoal: 'strength' })
  assert.deepEqual(change, { from: 'strength', to: 'hypertrophy' })
})

test('Gegenprobe: gleiches Ziel, unbekanntes Ziel (ältere Workouts) und fehlende Vorsession ergeben keinen Wechsel', () => {
  assert.equal(detectGoalChange({ exercise: pullUp, previousExercise: pullUp, currentGoal: 'strength', previousGoal: 'strength' }), null)
  // Ältere Workouts ohne Ziel: nichts behaupten (sonst würde "Muskelaufbau" als Standard einen falschen Wechsel melden)
  assert.equal(detectGoalChange({ exercise: pullUp, previousExercise: pullUp, currentGoal: 'strength', previousGoal: undefined }), null)
  assert.equal(detectGoalChange({ exercise: pullUp, previousExercise: pullUp, currentGoal: undefined, previousGoal: 'strength' }), null)
  assert.equal(detectGoalChange({ exercise: pullUp, previousExercise: null, currentGoal: 'strength', previousGoal: 'hypertrophy' }), null)
})

test('eigene Wahl an der Übung geht vor dem Workout-Ziel', () => {
  const own = { ...pullUp, trainingType: 'strength' }
  // Workout-Ziel wechselt, die Übung ist aber beide Male Kraft -> kein Wechsel
  assert.equal(detectGoalChange({ exercise: own, previousExercise: { ...pullUp, trainingType: 'strength' }, currentGoal: 'hypertrophy', previousGoal: 'strength' }), null)
  // nur die Übung wechselt
  assert.deepEqual(detectGoalChange({ exercise: { ...pullUp, trainingType: 'technique' }, previousExercise: pullUp, currentGoal: 'strength', previousGoal: 'strength' }), { from: 'strength', to: 'technique' })
})

test('Auswertung: Zielwechsel steht an der Übung und in der KI-Eingabe, Prompt nennt Regel 34', () => {
  const previous = session('strength', [5, 5, 5, 5, 5], 60, '2026-11-10T10:00:00Z', 'w0')
  const current = session('hypertrophy', [8, 8, 8], 40, '2026-11-17T10:00:00Z', 'w1')
  const analyses = analyzeWorkoutProgression(current, [current, previous])
  assert.deepEqual(analyses[0].goalChange, { from: 'strength', to: 'hypertrophy' })
  const structured = structureAnalysisForAI(analyses)
  assert.deepEqual(structured.exercises[0].training_goal_changed, { from: 'strength', to: 'hypertrophy' })
  const prompt = new OpenAIProvider({ apiKey: 'test-key' }).buildPrompt(structured)
  assert.match(prompt, /Trainingsziel gewechselt \(App-Logik, verbindlich, siehe Regel 34\):\*\* von "strength" auf "hypertrophy"/)
  assert.match(getCoachSystemPromptText(), /34\. TRAININGSZIEL GEWECHSELT/)
  assert.match(getRuleLabel(28), /Trainingsziel gewechselt/)
})

test('Gegenprobe: gleiches Ziel oder erste Einheit: kein training_goal_changed in der KI-Eingabe und keine Zeile', () => {
  const previous = session('hypertrophy', [8, 8, 8], 40, '2026-11-10T10:00:00Z', 'w0')
  const current = session('hypertrophy', [9, 9, 9], 40, '2026-11-17T10:00:00Z', 'w1')
  const same = analyzeWorkoutProgression(current, [current, previous])
  assert.equal(same[0].goalChange, undefined)
  assert.equal('training_goal_changed' in structureAnalysisForAI(same).exercises[0], false)
  assert.equal(buildGoalChangeLine(same, 'de'), null)
  const first = analyzeWorkoutProgression(current, [current])
  assert.equal(first[0].goalChange, undefined)
})

test('App-Zeile: Text DE und EN, englische Übungsnamen', () => {
  const analyses = [{ exercise: 'Klimmzüge mit Gewicht', exerciseNameForAI: 'Weighted Pull-Up', goalChange: { from: 'strength', to: 'hypertrophy' } }]
  assert.equal(buildGoalChangeLine(analyses, 'de'),
    'Trainingsfokus gewechselt: Weighted Pull-Up: von Kraft auf Muskelaufbau. Dann sind andere Gewichte und Wiederholungen normal – das ist kein Rückschritt.')
  assert.equal(buildGoalChangeLine(analyses, 'en'),
    'Training focus changed: Weighted Pull-Up: from Strength to Muscle growth. Different weights and reps are expected then – this is not a step back.')
})

test('App-Zeile: gleiche Wechsel in einer Zeile (höchstens drei Namen), andere Wechsel eigene Zeile', () => {
  const change = { from: 'strength', to: 'hypertrophy' }
  const many = ['A1', 'B2', 'C3', 'D4'].map((n) => ({ exercise: n, exerciseNameForAI: n, goalChange: change }))
  const line = buildGoalChangeLine([...many, { exercise: 'E5', exerciseNameForAI: 'E5', goalChange: { from: 'hypertrophy', to: 'strength' } }], 'de')
  const lines = line.split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /A1, B2, C3 u\. a\.: von Kraft auf Muskelaufbau/)
  assert.doesNotMatch(lines[0], /D4/)
  assert.match(lines[1], /E5: von Muskelaufbau auf Kraft/)
})

test('applyGoalChangeLine hängt an den Text, ohne Wechsel bleibt er unverändert', () => {
  const analyses = [{ exercise: 'X1', exerciseNameForAI: 'X1', goalChange: { from: 'strength', to: 'hypertrophy' } }]
  assert.match(applyGoalChangeLine('Guter Tag 💪', analyses, 'de'), /^Guter Tag 💪\n\nTrainingsfokus gewechselt: X1/)
  assert.equal(applyGoalChangeLine('Guter Tag 💪', [{ exercise: 'X1' }], 'de'), 'Guter Tag 💪')
})

// Teil 2: Einstieg und Abschluss ohne Übungszeile
const names = ['Weighted Pull-Up', 'Lever T Bar Row']
const announcing = [
  'Hey! 💪 Heute war ein interessanter Tag im Training, und es gibt einiges zu besprechen.',
  '- Weighted Pull-Up: 5 kg weniger Gewicht, dafür mehr Wiederholungen',
  '- Lever T Bar Row: 10 kg weniger gestemmt',
  'Mach weiter so! 🔥'
].join('\n')

test('Zeilen entfernt und keine Übung mehr genannt: fester Hinweis statt leerem Einstieg und Abschluss', () => {
  const result = sanitizeCoachText(announcing, { language: 'de', exerciseNames: names })
  assert.equal(result.allDropped, true)
  assert.match(result.text, /Deine Auswertung steht oben/)
  assert.ok(result.reasons.includes('no_exercise_left'))
  assert.equal(sanitizeCoachText(announcing, { language: 'en', exerciseNames: names }).text, 'Your summary is above: it shows what changed since your last session.')
})

test('Gegenprobe: bleibt eine Zeile mit Übung stehen, bleibt der Text', () => {
  const text = ['Starker Tag 💪', '- Weighted Pull-Up: läuft rund 👍', '- Lever T Bar Row: 10 kg weniger gestemmt'].join('\n')
  const result = sanitizeCoachText(text, { language: 'de', exerciseNames: names })
  assert.equal(result.allDropped, false)
  assert.match(result.text, /Weighted Pull-Up: läuft rund/)
})

test('Gegenprobe: wurde nichts entfernt, bleibt auch ein Text ohne Übung (nur Einstieg) unverändert', () => {
  const result = sanitizeCoachText('Gute Einheit heute 💪 Mach weiter so!', { language: 'de', exerciseNames: names })
  assert.equal(result.allDropped, false)
  assert.equal(result.text, 'Gute Einheit heute 💪 Mach weiter so!')
})

test('Gegenprobe: ohne bekannte Übungsnamen wird die neue Regel nicht angewandt', () => {
  const result = sanitizeCoachText('Guter Tag 💪\n- Bankdrücken: 5 kg mehr\nMach weiter so!', { language: 'de', exerciseNames: [] })
  assert.equal(result.allDropped, false)
  assert.match(result.text, /Guter Tag/)
})

test('Gegenprobe: nur ein Einstieg mit Zahl wurde entfernt (keine Übungszeile betroffen): der übrige Text bleibt', () => {
  const text = 'Starker Start nach 3 Tagen Pause 💪\nMach weiter so!'
  const result = sanitizeCoachText(text, { language: 'de', exerciseNames: names })
  assert.equal(result.droppedLines, 1)
  assert.equal(result.allDropped, false)
  assert.match(result.text, /Mach weiter so/)
})

test('gekürzte Übungsnamen zählen als genannt (Pull-Up, T-Bar Row), der Text bleibt', () => {
  const text = ['Starker Tag 💪', '- Pull-Up: starke Einordnung 👍', '- T-Bar Row: 10 kg weniger gestemmt'].join('\n')
  const result = sanitizeCoachText(text, { language: 'de', exerciseNames: names })
  assert.equal(result.allDropped, false)
  assert.match(result.text, /Pull-Up: starke Einordnung/)
})

test('Prompt: der Einstieg kündigt nichts an', () => {
  assert.match(getCoachSystemPromptText(), /KÜNDIGT NICHTS AN/)
})
