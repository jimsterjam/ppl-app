import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeAiUsage, logAiUsage } from '../aiUsageLog.js'
import { runCoachCheck } from '../../services/coachCheckService.js'
import OpenAIProvider from '../../services/OpenAIProvider.js'

const usageWithCache = { prompt_tokens: 10400, completion_tokens: 220, total_tokens: 10620, prompt_tokens_details: { cached_tokens: 9984 } }

describe('summarizeAiUsage', () => {
  it('Eingabe-, zwischengespeicherte und Ausgabe-Token samt Anteil', () => {
    assert.deepEqual(summarizeAiUsage(usageWithCache), { promptTokens: 10400, cachedTokens: 9984, completionTokens: 220, cachedShare: 0.96 })
  })
  it('ohne Angabe zu zwischengespeicherten Token: null (Relay/Modell liefert das Feld nicht), nicht 0', () => {
    const summary = summarizeAiUsage({ prompt_tokens: 500, completion_tokens: 50 })
    assert.equal(summary.cachedTokens, null)
    assert.equal(summary.cachedShare, null)
    assert.equal(summary.promptTokens, 500)
  })
  it('ausdrücklich 0 zwischengespeichert bleibt 0 (Anteil 0)', () => {
    const summary = summarizeAiUsage({ prompt_tokens: 2000, prompt_tokens_details: { cached_tokens: 0 } })
    assert.equal(summary.cachedTokens, 0)
    assert.equal(summary.cachedShare, 0)
  })
  it('Gegenprobe: null, leerer Text, false und true sind unbekannt (null), nie 0 - sonst sähe "unbekannt" wie "kein Treffer" aus', () => {
    for (const bad of [null, undefined, '', ' ', false, true, '123', [], {}]) {
      const summary = summarizeAiUsage({ prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: bad }, completion_tokens: bad })
      assert.equal(summary.cachedTokens, null, `cached ${JSON.stringify(bad)}`)
      assert.equal(summary.cachedShare, null, `Anteil ${JSON.stringify(bad)}`)
      assert.equal(summary.completionTokens, null, `completion ${JSON.stringify(bad)}`)
    }
    assert.equal(summarizeAiUsage({ prompt_tokens: null }).promptTokens, null)
    assert.equal(summarizeAiUsage({ prompt_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } }).cachedTokens, 0)
  })
  it('Gegenprobe: ungültige Werte werden zu null, nie zu NaN oder Text; Anteil höchstens 1', () => {
    assert.equal(summarizeAiUsage(null), null)
    assert.equal(summarizeAiUsage('x'), null)
    const bad = summarizeAiUsage({ prompt_tokens: 'abc', completion_tokens: -5, prompt_tokens_details: { cached_tokens: {} } })
    assert.deepEqual(bad, { promptTokens: null, cachedTokens: null, completionTokens: null, cachedShare: null })
    assert.equal(summarizeAiUsage({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 300 } }).cachedShare, 1)
  })
})

describe('logAiUsage', () => {
  const capture = (call, usage, options = {}) => {
    const lines = []
    logAiUsage(call, usage, { write: (line) => lines.push(line), env: {}, ...options })
    return lines
  }

  it('eine Zeile mit festem Präfix und JSON', () => {
    const [line, ...rest] = capture('coach', usageWithCache, { model: 'gpt-4o-mini', requestId: 'req_1' })
    assert.equal(rest.length, 0)
    assert.match(line, /^\[ai-usage\] \{/)
    assert.deepEqual(JSON.parse(line.slice('[ai-usage] '.length)), {
      call: 'coach', model: 'gpt-4o-mini', requestId: 'req_1', promptTokens: 10400, cachedTokens: 9984, completionTokens: 220, cachedShare: 0.96
    })
  })

  it('nur Zahlen und Namen: Prompt-Text und andere Felder der Antwort gelangen nie in die Zeile', () => {
    const usage = { ...usageWithCache, secret: 'Bench Press 100 kg', prompt_tokens_details: { cached_tokens: 100, text: 'Notiz des Nutzers' } }
    const [line] = capture('verifier', usage)
    assert.doesNotMatch(line, /Bench Press|Notiz des Nutzers|secret/)
  })

  it('AI_USAGE_LOG=0 schaltet ab; jeder andere Wert und kein Wert lässt es an', () => {
    assert.equal(capture('coach', usageWithCache, { env: { AI_USAGE_LOG: '0' } }).length, 0)
    assert.equal(capture('coach', usageWithCache, { env: { AI_USAGE_LOG: '1' } }).length, 1)
    assert.equal(capture('coach', usageWithCache, { env: {} }).length, 1)
  })

  it('Gegenprobe: ohne usage keine Zeile; wirft nie, auch wenn das Schreiben fehlschlägt', () => {
    assert.equal(capture('coach', undefined).length, 0)
    assert.doesNotThrow(() => logAiUsage('coach', usageWithCache, { write: () => { throw new Error('kaputt') }, env: {} }))
  })

  it('Name des Aufrufs und IDs werden gekürzt', () => {
    const [line] = capture('x'.repeat(200), usageWithCache, { requestId: 'r'.repeat(200) })
    const parsed = JSON.parse(line.slice('[ai-usage] '.length))
    assert.equal(parsed.call.length, 40)
    assert.equal(parsed.requestId.length, 60)
  })
})

// Der Dienst ruft die Protokollierung wirklich auf (hier der kleinste Dienst mit Test-Client).
describe('Dienst schreibt die Zeile', () => {
  it('Coach-Check: eine Zeile mit den Token der Antwort; ohne usage keine Zeile', async () => {
    const lines = []
    const original = console.log
    console.log = (...args) => lines.push(args.join(' '))
    const workout = { type: 'push', goal: 'hypertrophy', origin: 'manual', completed: true, exercises: [{ name: 'Bench Press Barbell', setDetails: [{ reps: 10, weight: 20, done: true }] }] }
    const client = (usage) => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content: '{}' } }], ...(usage ? { usage } : {}) }) } } })
    try {
      await runCoachCheck({ workout, requestId: 'cc_1', deps: { client: client(usageWithCache) } })
      await runCoachCheck({ workout, requestId: 'cc_2', deps: { client: client(null) } })
    } finally {
      console.log = original
    }
    const usageLines = lines.filter((line) => line.startsWith('[ai-usage]'))
    assert.equal(usageLines.length, 1)
    const parsed = JSON.parse(usageLines[0].slice('[ai-usage] '.length))
    assert.equal(parsed.call, 'coach-check')
    assert.equal(parsed.requestId, 'cc_1')
    assert.equal(parsed.cachedTokens, 9984)
  })
})

// Auch eine unbrauchbare (leere) Antwort kostet Token: die Zeile muss VOR der Antwortprüfung stehen (Copilot-Review #203).
describe('Coach-Entwurf', () => {
  it('schreibt die Zeile auch dann, wenn die Antwort leer ist und der Aufruf danach scheitert', async () => {
    const lines = []
    const original = console.log
    console.log = (...args) => lines.push(args.join(' '))
    const provider = new OpenAIProvider({ apiKey: 'test-key' })
    provider.client = { chat: { completions: { create: async () => ({ choices: [{ message: { content: '' } }], usage: usageWithCache }) } } }
    try {
      await assert.rejects(() => provider.generateTrainingAnalysis({ total_exercises_analyzed: 0, exercises: [] }, { requestId: 'req_leer' }), /empty response/)
    } finally {
      console.log = original
    }
    const usageLines = lines.filter((line) => line.startsWith('[ai-usage]'))
    assert.equal(usageLines.length, 1)
    assert.equal(JSON.parse(usageLines[0].slice('[ai-usage] '.length)).call, 'coach')
  })
})

