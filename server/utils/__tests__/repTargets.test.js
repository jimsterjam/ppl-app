import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const server = await import(join(__dirname, '../repTargets.js'))
// Client-Module sind bewusst frei von Vue-/Store-Imports und daher hier direkt importierbar.
const progression = await import(join(__dirname, '../../../client/src/utils/weightSuggestion.js'))
const rest = await import(join(__dirname, '../../../client/src/utils/restTimerRules.js'))

const within = ([min, max], range) => min >= range.min && max <= range.max

describe('Generator-Vorgaben (Schritt A)', () => {
  test('Wiederholungen liegen im Bereich der Fortschrittslogik im Workout', () => {
    const { hypertrophy, strength } = server.GENERATOR_RULES
    assert.ok(within(hypertrophy.compound.reps, progression.PROGRESSION_RANGES.hypertrophy))
    assert.ok(within(hypertrophy.isolation.reps, progression.PROGRESSION_RANGES.hypertrophy))
    assert.ok(within(strength.compound.reps, progression.PROGRESSION_RANGES.strength))
    // Zubehör im Kraft-Workout läuft im Workout als Bereich 8-12
    assert.ok(within(strength.isolation.reps, progression.PROGRESSION_RANGES.hypertrophy))
  })

  test('Pausen = Standard des Pausentimers', () => {
    for (const goal of ['hypertrophy', 'strength']) {
      for (const type of ['compound', 'isolation']) {
        assert.equal(server.GENERATOR_RULES[goal][type].rest, rest.REST_DEFAULT_SECONDS[goal][type], `${goal}/${type}`)
      }
    }
  })

  test('Muskelaufbau: 8-12 Wdh., 2-4 Sätze (Standard 3)', () => {
    assert.deepEqual(server.applyGeneratorRule({ reps: 15, sets: 5, rest: 60 }, 'hypertrophy', false), { reps: 12, sets: 4, rest: 120 })
    assert.deepEqual(server.applyGeneratorRule({}, 'muscle_building', true), { reps: 10, sets: 3, rest: 90 })
    assert.deepEqual(server.applyGeneratorRule({ reps: 6, sets: 1 }, 'hypertrophy', true), { reps: 8, sets: 2, rest: 90 })
  })

  test('Kraft: Grundübungen 3-5 Wdh. in 3-5 Sätzen, Zubehör 8-12', () => {
    assert.deepEqual(server.applyGeneratorRule({ reps: 8, sets: 3 }, 'strength', false), { reps: 5, sets: 3, rest: 180 })
    assert.deepEqual(server.applyGeneratorRule({ reps: 1, sets: 8 }, 'strength', false), { reps: 3, sets: 5, rest: 180 })
    assert.deepEqual(server.applyGeneratorRule({}, 'strength', false), { reps: 5, sets: 4, rest: 180 })
    assert.deepEqual(server.applyGeneratorRule({ reps: 15, sets: 3 }, 'strength', true), { reps: 12, sets: 3, rest: 120 })
    assert.deepEqual(server.getRepRange('strength', false), [3, 5])
  })
})
