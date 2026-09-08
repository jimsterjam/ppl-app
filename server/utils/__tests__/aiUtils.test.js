import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const {
  classifyAiError,
  isRetryableAiError,
  withAiRetry,
  parseJsonSafely,
  validateAiSuggestionPayload,
  checkAiBurstLimit
} = await import(join(__dirname, '../aiUtils.js'))

// Deckt die Kernbausteine der KI-Fehlerbehandlung ab (Fehlerklassifizierung, Retry, Burst-Limit,
// robustes JSON-Parsing) - laut TESTPHASE-TESTMATRIX.md Abschnitt 6 bisher komplett ungetestet,
// obwohl genau diese Logik bestimmt, ob ein KI-Fehler dem Nutzer als "network_unavailable"
// erscheint, automatisch retried wird, oder zu einem harten Fehler führt.
describe('classifyAiError', () => {
  test('HTTP 429 -> rate_limited', () => {
    assert.equal(classifyAiError({ status: 429 }), 'rate_limited')
  })

  test('HTTP 500-599 -> provider_server_error', () => {
    assert.equal(classifyAiError({ status: 500 }), 'provider_server_error')
    assert.equal(classifyAiError({ status: 503 }), 'provider_server_error')
  })

  test('Timeout-Code oder -Nachricht -> timeout', () => {
    assert.equal(classifyAiError({ code: 'ABORT_ERR' }), 'timeout')
    assert.equal(classifyAiError({ message: 'Request timeout after 30000ms' }), 'timeout')
  })

  // REGRESSION: 'ETIMEDOUT' ist der reale Node/axios/fetch-Fehlercode bei Netzwerk-Timeouts
  // (z.B. "connect ETIMEDOUT 1.2.3.4:443") - wurde bisher NICHT als 'timeout' erkannt, weil
  // 'ETIMEDOUT' den Teilstring 'TIMEOUT' nicht enthält (zusätzliches 'D'). Dadurch wurden echte
  // Netzwerk-Timeouts zum KI-Provider fälschlich als 'unknown' eingestuft und nie automatisch
  // wiederholt (siehe isRetryableAiError). Bug gefunden beim Schreiben dieses Tests, gefixt in
  // aiUtils.js.
  test('REGRESSION: realer Node-Timeout-Code ETIMEDOUT wird erkannt', () => {
    assert.equal(classifyAiError({ code: 'ETIMEDOUT' }), 'timeout')
    assert.equal(classifyAiError({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 1.2.3.4:443' }), 'timeout')
    assert.equal(classifyAiError({ code: 'ECONNABORTED' }), 'timeout')
  })

  test('JSON-Parse-Fehlermeldung -> invalid_json', () => {
    assert.equal(classifyAiError({ message: 'Unexpected token in JSON at position 0, could not parse' }), 'invalid_json')
  })

  test('HTTP 400-499 (kein 429) -> provider_client_error', () => {
    assert.equal(classifyAiError({ status: 400 }), 'provider_client_error')
    assert.equal(classifyAiError({ status: 404 }), 'provider_client_error')
  })

  test('unbekannter/leerer Fehler -> unknown', () => {
    assert.equal(classifyAiError({}), 'unknown')
    assert.equal(classifyAiError(undefined), 'unknown')
  })

  test('status kann auch über response.status oder statusCode kommen', () => {
    assert.equal(classifyAiError({ response: { status: 429 } }), 'rate_limited')
    assert.equal(classifyAiError({ statusCode: 500 }), 'provider_server_error')
  })
})

describe('isRetryableAiError', () => {
  test('rate_limited, timeout und provider_server_error sind retryable', () => {
    assert.equal(isRetryableAiError({ status: 429 }), true)
    assert.equal(isRetryableAiError({ code: 'ABORT_ERR' }), true)
    assert.equal(isRetryableAiError({ status: 500 }), true)
  })

  test('REGRESSION: echter Netzwerk-Timeout (ETIMEDOUT) ist retryable', () => {
    assert.equal(isRetryableAiError({ code: 'ETIMEDOUT' }), true)
  })

  test('provider_client_error und unknown sind NICHT retryable', () => {
    assert.equal(isRetryableAiError({ status: 400 }), false)
    assert.equal(isRetryableAiError({}), false)
  })
})

describe('withAiRetry', () => {
  test('Erfolg im ersten Versuch -> kein Retry, Ergebnis wird durchgereicht', async () => {
    let calls = 0
    const result = await withAiRetry(async () => {
      calls += 1
      return 'ok'
    }, { attempts: 2, baseDelayMs: 1 })
    assert.equal(result, 'ok')
    assert.equal(calls, 1)
  })

  test('retryable Fehler wird bis zum Erfolg wiederholt (innerhalb attempts)', async () => {
    let calls = 0
    const result = await withAiRetry(async () => {
      calls += 1
      if (calls < 3) {
        const err = new Error('server error')
        err.status = 500
        throw err
      }
      return 'ok-nach-retries'
    }, { attempts: 3, baseDelayMs: 1 })
    assert.equal(result, 'ok-nach-retries')
    assert.equal(calls, 3)
  })

  test('nicht-retryable Fehler wird sofort geworfen, ohne weitere Versuche', async () => {
    let calls = 0
    await assert.rejects(
      withAiRetry(async () => {
        calls += 1
        const err = new Error('bad request')
        err.status = 400
        throw err
      }, { attempts: 3, baseDelayMs: 1 }),
      /bad request/
    )
    assert.equal(calls, 1)
  })

  test('retryable Fehler, der auch nach allen Versuchen bestehen bleibt, wird am Ende geworfen', async () => {
    let calls = 0
    await assert.rejects(
      withAiRetry(async () => {
        calls += 1
        const err = new Error('always fails')
        err.status = 429
        throw err
      }, { attempts: 2, baseDelayMs: 1 }),
      /always fails/
    )
    assert.equal(calls, 3) // initialer Versuch + 2 Retries
  })
})

describe('parseJsonSafely', () => {
  test('sauberes JSON wird direkt geparst', () => {
    assert.deepEqual(parseJsonSafely('{"a":1}'), { a: 1 })
  })

  test('JSON in Markdown-Codefence (```json ... ```) wird erkannt', () => {
    const raw = '```json\n{"a":1}\n```'
    assert.deepEqual(parseJsonSafely(raw), { a: 1 })
  })

  test('JSON mit Text drumherum wird über {...}-Extraktion gefunden', () => {
    const raw = 'Hier ist das Ergebnis: {"a":1} - hoffe das hilft!'
    assert.deepEqual(parseJsonSafely(raw), { a: 1 })
  })

  test('leerer Payload wirft AI_EMPTY_JSON', () => {
    assert.throws(() => parseJsonSafely(''), { code: 'AI_EMPTY_JSON' })
    assert.throws(() => parseJsonSafely('   '), { code: 'AI_EMPTY_JSON' })
  })

  test('kaputtes/nicht parsbares JSON wirft AI_INVALID_JSON', () => {
    assert.throws(() => parseJsonSafely('das ist kein json { kaputt'), { code: 'AI_INVALID_JSON' })
  })
})

describe('validateAiSuggestionPayload', () => {
  test('gültiges Payload mit Übungen wird unverändert durchgereicht', () => {
    const payload = { exercises: [{ name: 'Bankdrücken' }] }
    assert.equal(validateAiSuggestionPayload(payload), payload)
  })

  test('fehlendes Payload wirft AI_INVALID_PAYLOAD', () => {
    assert.throws(() => validateAiSuggestionPayload(null), { code: 'AI_INVALID_PAYLOAD' })
    assert.throws(() => validateAiSuggestionPayload(undefined), { code: 'AI_INVALID_PAYLOAD' })
  })

  test('Payload ohne exercises-Array oder mit leerem Array wirft AI_INVALID_EXERCISES', () => {
    assert.throws(() => validateAiSuggestionPayload({}), { code: 'AI_INVALID_EXERCISES' })
    assert.throws(() => validateAiSuggestionPayload({ exercises: [] }), { code: 'AI_INVALID_EXERCISES' })
  })

  test('mehr als 8 Übungen werden auf 8 gekappt', () => {
    const payload = { exercises: Array.from({ length: 12 }, (_, i) => ({ name: `Ex${i}` })) }
    const result = validateAiSuggestionPayload(payload)
    assert.equal(result.exercises.length, 8)
  })
})

describe('checkAiBurstLimit', () => {
  test('erste Anfragen innerhalb des Limits sind erlaubt', () => {
    const user = `burst-test-user-${Date.now()}-a`
    for (let i = 0; i < 6; i++) {
      const result = checkAiBurstLimit(user)
      assert.equal(result.allowed, true)
    }
  })

  test('Anfrage über dem Limit (6 Requests/Fenster) wird abgelehnt mit retryAfterSec', () => {
    const user = `burst-test-user-${Date.now()}-b`
    for (let i = 0; i < 6; i++) {
      checkAiBurstLimit(user)
    }
    const blocked = checkAiBurstLimit(user)
    assert.equal(blocked.allowed, false)
    assert.equal(typeof blocked.retryAfterSec, 'number')
    assert.ok(blocked.retryAfterSec >= 1)
  })

  test('unterschiedliche User haben getrennte Buckets', () => {
    const userA = `burst-test-user-${Date.now()}-c1`
    const userB = `burst-test-user-${Date.now()}-c2`
    for (let i = 0; i < 6; i++) {
      checkAiBurstLimit(userA)
    }
    const blockedA = checkAiBurstLimit(userA)
    const allowedB = checkAiBurstLimit(userB)
    assert.equal(blockedA.allowed, false)
    assert.equal(allowedB.allowed, true)
  })
})
