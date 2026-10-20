import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { runDeterministicChecks } from '../../services/feedbackVerificationService.js'
import { feedbackQualityCases } from '../../scripts/evalCases/feedbackQualityCases.js'
import { mockWorkoutScenarios } from '../../scripts/evalCases/mockWorkoutScenarios.js'

// Der Eval-Runner (npm run eval) lief bisher nicht in CI - die Fälle veralteten still (3 von 6 schlugen fehl, weil
// die Beispieldaten nicht mehr der echten Struktur von structureAnalysisForAI entsprachen). Jetzt laufen die
// deterministischen Fälle bei jedem `npm test` (CI + scripts/check-all.sh).
describe('Eval-Fälle des KI-Feedbacks (deterministische Prüfung)', () => {
  for (const c of feedbackQualityCases) {
    test(c.name, () => {
      const result = runDeterministicChecks(c.draftText, c.structuredAnalysis)
      const rules = [...new Set(result.violations.map((v) => v.rule))].sort((a, b) => a - b)
      assert.deepEqual(rules, [...c.expectedDeterministicRules].sort((a, b) => a - b))
    })
  }
})

describe('Mock-Szenarien des Qualitäts-Loops', () => {
  test('jedes Szenario hat Namen und strukturierte Daten mit Übungen', () => {
    assert.ok(mockWorkoutScenarios.length >= 10)
    const names = new Set()
    for (const s of mockWorkoutScenarios) {
      assert.ok(s.name && !names.has(s.name), `Name fehlt oder doppelt: ${s.name}`)
      names.add(s.name)
      assert.ok(Array.isArray(s.structuredAnalysis?.exercises), `${s.name}: exercises fehlt`)
    }
  })
})
