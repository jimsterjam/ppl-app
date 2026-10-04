import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ensureRelayAwake, nextRelayWakeDelayMs, __resetRelayWakeForTests } from '../aiClientFactory.js'

// User-Report 2026-10-04: viele parallele Weck-Schleifen pingten den schlafenden Relay alle 4 s,
// Render antwortete durchgehend mit 429 und das Feedback blieb hängen.

describe('nextRelayWakeDelayMs', () => {
  test('ohne 429 bleibt es beim normalen Abstand', () => {
    assert.equal(nextRelayWakeDelayMs({ status: 502, pollIntervalMs: 4000 }), 4000)
  })
  test('429: 10 s, 20 s, 40 s, dann gedeckelt', () => {
    assert.equal(nextRelayWakeDelayMs({ status: 429, consecutive429: 1 }), 10000)
    assert.equal(nextRelayWakeDelayMs({ status: 429, consecutive429: 2 }), 20000)
    assert.equal(nextRelayWakeDelayMs({ status: 429, consecutive429: 3 }), 40000)
    assert.equal(nextRelayWakeDelayMs({ status: 429, consecutive429: 6 }), 40000)
  })
  test('429 mit Retry-After: Header gewinnt, wenn länger (max. 40 s)', () => {
    assert.equal(nextRelayWakeDelayMs({ status: 429, retryAfter: '30', consecutive429: 1 }), 30000)
    assert.equal(nextRelayWakeDelayMs({ status: 429, retryAfter: '120', consecutive429: 1 }), 40000)
  })
})

describe('ensureRelayAwake', () => {
  const previousUrl = process.env.AI_RELAY_URL
  beforeEach(() => { process.env.AI_RELAY_URL = 'https://relay.test' })
  afterEach(() => {
    if (previousUrl === undefined) delete process.env.AI_RELAY_URL
    else process.env.AI_RELAY_URL = previousUrl
    __resetRelayWakeForTests()
  })

  test('mehrere gleichzeitige Aufrufer teilen sich EINE Weck-Schleife', async () => {
    let calls = 0
    __resetRelayWakeForTests({
      fetchImpl: async () => { calls += 1; return { ok: true, status: 200, headers: new Map() } }
    })
    await Promise.all([ensureRelayAwake(), ensureRelayAwake(), ensureRelayAwake(), ensureRelayAwake()])
    assert.equal(calls, 1)
    // Danach gilt der Relay als wach - kein weiterer Ping.
    await ensureRelayAwake()
    assert.equal(calls, 1)
  })

  test('nach gescheiterter Schleife startet nicht sofort die nächste (Pause)', async () => {
    let calls = 0
    __resetRelayWakeForTests({
      fetchImpl: async () => { calls += 1; throw new Error('down') }
    })
    // Kurzes Budget, Schleife läuft im Hintergrund weiter; sie endet erst nach 100 s - daher hier
    // nur prüfen, dass parallele Aufrufer keine zweite Schleife starten.
    await Promise.all([ensureRelayAwake({ maxWaitMs: 50 }), ensureRelayAwake({ maxWaitMs: 50 })])
    assert.equal(calls, 1)
  })

  test('Direkt-Modus (kein Relay): kein Ping', async () => {
    delete process.env.AI_RELAY_URL
    let calls = 0
    __resetRelayWakeForTests({ fetchImpl: async () => { calls += 1; return { ok: true } } })
    await ensureRelayAwake()
    assert.equal(calls, 0)
  })
})
