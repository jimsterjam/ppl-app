import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { compareRuns, formatComparison } from '../../scripts/lib/evalCompare.js'

const run = (scenario, rules, extra = {}) => ({
  scenario,
  originalTriggeredRules: rules,
  triggeredRules: extra.final ?? rules,
  revisionAttempted: rules.length > 0,
  revisionSucceeded: rules.length > 0 ? (extra.final ?? rules).length === 0 : null,
  finalFeedbackText: 'Ein kurzer Text mit sieben Wörtern hier.',
  ...extra
})

describe('compareRuns', () => {
  test('erkennt Verschlechterung je Regel und Szenario', () => {
    const before = [run('A', []), run('A', []), run('B', [1]), run('B', [])]
    const after = [run('A', [3]), run('A', [3]), run('B', [1]), run('B', [])]
    const result = compareRuns(before, after)
    assert.equal(result.a.runs, 4)
    assert.equal(result.a.violationRate, 25)
    assert.equal(result.b.violationRate, 75)
    assert.ok(result.regressions.some((r) => r.includes('Regel 3')))
    assert.ok(result.regressions.some((r) => r.includes('Szenario „A“')))
    assert.ok(!result.regressions.some((r) => r.includes('Szenario „B“')))
  })

  test('keine Verschlechterung bei gleichen Läufen, Fehlerläufe werden getrennt gezählt', () => {
    const entries = [run('A', []), { scenario: 'A', error: 'timeout' }]
    const result = compareRuns(entries, entries)
    assert.equal(result.a.runs, 1)
    assert.equal(result.a.errors, 1)
    assert.deepEqual(result.regressions, [])
    assert.match(formatComparison(result), /Keine Verschlechterung/)
  })

  test('mehr Fehlläufe zählen als Verschlechterung, Ø Wörter wird berechnet', () => {
    const result = compareRuns([run('A', [])], [run('A', []), { scenario: 'A', error: 'x' }])
    assert.equal(result.a.avgWords, 7)
    assert.ok(result.regressions.some((r) => r.includes('fehlgeschlagene')))
  })
})
