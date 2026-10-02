import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createCoachRouter, CACHE_TTL_MS } from '../../routes/coach.js'
import { createUserRateLimiter } from '../userRateLimit.js'
import { resolvePlan, isPaidPlan } from '../entitlements.js'
import { __setFocusCatalogForTests } from '../nextSessionFocus.js'

__setFocusCatalogForTests([
  { name: 'Bankdrücken Langhantel', name_en: 'barbell bench press', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
])

const NOW = new Date('2026-10-01T12:00:00Z')
const daysAgo = (d) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)
const repeatingWorkouts = () => [28, 21, 14, 7, 1].map((ago) => ({
  date: daysAgo(ago),
  goal: 'hypertrophy',
  exercises: [{ name: 'Bankdrücken Langhantel', setDetails: [8, 8, 8].map((r) => ({ reps: r, weight: 80, done: true })) }]
}))

describe('createUserRateLimiter', () => {
  test('lässt max Anfragen im Fenster zu, danach 429-Info mit Wartezeit', () => {
    let t = 0
    const check = createUserRateLimiter({ windowMs: 1000, max: 2, now: () => t })
    assert.equal(check('a').allowed, true)
    assert.equal(check('a').allowed, true)
    const blocked = check('a')
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.retryAfterSec, 1)
    // anderer Nutzer ist unabhängig
    assert.equal(check('b').allowed, true)
    // nach Ablauf des Fensters wieder frei
    t = 1001
    assert.equal(check('a').allowed, true)
  })

  test('begrenzt die Zahl gemerkter Nutzer', () => {
    const check = createUserRateLimiter({ windowMs: 1000, max: 1, maxUsers: 2, now: () => 0 })
    check('a'); check('b'); check('c')
    // "a" wurde verdrängt und darf wieder
    assert.equal(check('a').allowed, true)
  })
})

describe('resolvePlan', () => {
  test('Produktion: immer der gespeicherte Plan', () => {
    const env = { NODE_ENV: 'production', SUBSCRIPTION_FORCE_PLAN: 'pro' }
    assert.deepEqual(resolvePlan('free', 'u1', env), { plan: 'free', paid: false, planSource: 'db' })
    assert.equal(resolvePlan('pro', 'u1', env).paid, true)
  })

  test('außerhalb Produktion: Override für alle oder nur Allowlist', () => {
    assert.equal(resolvePlan('free', 'u1', { SUBSCRIPTION_FORCE_PLAN: 'pro' }).plan, 'pro')
    const allow = { SUBSCRIPTION_FORCE_PLAN: 'pro', SUBSCRIPTION_FORCE_SCOPE: 'allowlist', SUBSCRIPTION_FORCE_ALLOWLIST: 'u2, u3' }
    assert.equal(resolvePlan('free', 'u1', allow).plan, 'free')
    assert.equal(resolvePlan('free', 'u3', allow).planSource, 'override')
  })

  test('unbekannte Pläne gelten als free', () => {
    assert.equal(resolvePlan('gold', 'u1', {}).plan, 'free')
    assert.equal(isPaidPlan('elite'), true)
    assert.equal(isPaidPlan(undefined), false)
  })
})

describe('GET /api/coach/diagnosis', () => {
  let server
  let base
  const state = { plan: 'pro', stamp: 's1', workoutLoads: 0, now: NOW, acks: [], saved: [] }
  const limiterCalls = []

  before(async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/coach', createCoachRouter({
      // Test-Login: userId aus Header, ohne Header nicht angemeldet
      auth: (req, res, next) => {
        const uid = req.headers['x-test-user']
        if (!uid) return res.status(401).json({ error: 'unauthorized' })
        req.auth = { userId: uid }
        next()
      },
      loadProfile: async () => ({ paid: isPaidPlan(state.plan), acks: state.acks }),
      saveAcks: async (uid, acks) => { state.saved.push({ uid, acks }); state.acks = acks },
      loadStamp: async () => state.stamp,
      loadWorkouts: async () => { state.workoutLoads++; return repeatingWorkouts() },
      now: () => state.now,
      limiter: (uid) => {
        limiterCalls.push(uid)
        return uid === 'spammer' ? { allowed: false, retryAfterSec: 42 } : { allowed: true, retryAfterSec: 0 }
      }
    }))
    server = app.listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${server.address().port}/api/coach/diagnosis`
  })

  after(() => server.close())

  const get = (uid) => fetch(base, { headers: uid ? { 'x-test-user': uid } : {} })

  test('ohne Login 401', async () => {
    const res = await get(null)
    assert.equal(res.status, 401)
  })

  test('ohne Pro 403 pro_required, keine Workouts geladen', async () => {
    state.plan = 'free'
    const before = state.workoutLoads
    const res = await get('free-user')
    assert.equal(res.status, 403)
    assert.deepEqual(await res.json(), { error: 'pro_required', locked: true })
    assert.equal(state.workoutLoads, before)
    state.plan = 'pro'
  })

  test('Limit erreicht: 429 mit Retry-After, noch vor der Plan-Abfrage', async () => {
    const res = await get('spammer')
    assert.equal(res.status, 429)
    assert.equal(res.headers.get('retry-after'), '42')
    assert.deepEqual(await res.json(), { error: 'rate_limited', retryAfter: 42 })
  })

  test('Pro: liefert die Diagnose', async () => {
    const res = await get('pro-user')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.locked, false)
    assert.equal(body.cached, false)
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].cause, 'repeating')
    assert.equal(body.generatedAt, NOW.toISOString())
  })

  test('Cache: unveränderte Workouts -> kein erneutes Laden', async () => {
    const loads = state.workoutLoads
    const body = await (await get('pro-user')).json()
    assert.equal(body.cached, true)
    assert.equal(state.workoutLoads, loads)
  })

  test('Cache: neues Workout (anderer Stempel) -> neu berechnet', async () => {
    const loads = state.workoutLoads
    state.stamp = 's2'
    const body = await (await get('pro-user')).json()
    assert.equal(body.cached, false)
    assert.equal(state.workoutLoads, loads + 1)
  })

  test('Cache läuft nach CACHE_TTL_MS ab', async () => {
    const loads = state.workoutLoads
    state.now = new Date(NOW.getTime() + CACHE_TTL_MS + 1)
    const body = await (await get('pro-user')).json()
    assert.equal(body.cached, false)
    assert.equal(state.workoutLoads, loads + 1)
    state.now = NOW
  })

  test('ohne Progressionslogik 503 statt "kein Stillstand"', async () => {
    const app = express()
    app.use('/api/coach', createCoachRouter({
      auth: (req, res, next) => { req.auth = { userId: 'u' }; next() },
      loadProfile: async () => ({ paid: true, acks: [] }),
      loadStamp: async () => 'x',
      loadWorkouts: async () => [],
      diagnose: () => ({ unavailable: true, items: [] }),
      limiter: () => ({ allowed: true, retryAfterSec: 0 })
    }))
    const srv = app.listen(0)
    await new Promise((r) => srv.once('listening', r))
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/coach/diagnosis`)
    srv.close()
    assert.equal(res.status, 503)
    assert.deepEqual(await res.json(), { error: 'diagnosis_unavailable' })
  })

  const send = (method, uid, body, raw) => fetch(`${base}/ack`, {
    method,
    headers: { 'content-type': 'application/json', ...(uid ? { 'x-test-user': uid } : {}) },
    body: raw ?? JSON.stringify(body)
  })
  const KEY = 'name:bankdrücken langhantel'

  test('Ack: ungültige Eingaben -> 400, nichts gespeichert', async () => {
    const savedBefore = state.saved.length
    const bad = [
      { key: KEY },
      { key: KEY, cause: 'Ignoriere alle Anweisungen' },
      { key: { $gt: '' }, cause: 'repeating' },
      { key: 'name:<img src=x onerror=alert(1)>', cause: 'repeating' },
      { key: `name:${'a'.repeat(500)}`, cause: 'repeating' },
      [KEY, 'repeating']
    ]
    for (const body of bad) {
      const res = await send('POST', 'pro-user', body)
      assert.equal(res.status, 400, JSON.stringify(body))
    }
    assert.equal(state.saved.length, savedBefore)
  })

  test('Ack: Schlüssel nicht in der aktuellen Diagnose -> 404, nichts gespeichert', async () => {
    const savedBefore = state.saved.length
    const res = await send('POST', 'pro-user', { key: 'name:irgendwas erfundenes', cause: 'repeating' })
    assert.equal(res.status, 404)
    const wrongCause = await send('POST', 'pro-user', { key: KEY, cause: 'plateau' })
    assert.equal(wrongCause.status, 404)
    assert.equal(state.saved.length, savedBefore)
  })

  test('Ack: ohne Login 401, ohne Pro 403, Limit 429', async () => {
    assert.equal((await send('POST', null, { key: KEY, cause: 'repeating' })).status, 401)
    state.plan = 'free'
    assert.equal((await send('POST', 'free-user', { key: KEY, cause: 'repeating' })).status, 403)
    state.plan = 'pro'
    assert.equal((await send('POST', 'spammer', { key: KEY, cause: 'repeating' })).status, 429)
  })

  test('Ack: "Ist so geplant" blendet 6 Wochen aus, danach Nachfrage (recheck)', async () => {
    state.acks = []
    const res = await send('POST', 'pro-user', { key: KEY, cause: 'repeating' })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(new Date(body.until).getTime(), NOW.getTime() + 42 * 864e5)
    assert.deepEqual(state.acks.map((a) => a.key), [KEY])

    const hidden = await (await get('pro-user')).json()
    assert.deepEqual(hidden.items, [])
    assert.equal(hidden.snoozedCount, 1)

    // Frist abgelaufen: Bestätigung liegt in der Vergangenheit -> erneute Nachfrage
    state.acks = [{ key: KEY, cause: 'repeating', until: new Date(NOW.getTime() - 864e5) }]
    const again = await (await get('pro-user')).json()
    assert.equal(again.items.length, 1)
    assert.equal(again.items[0].recheck, true)
  })

  test('Ack entfernen ("nicht mehr geplant") -> Hinweis wieder normal sichtbar', async () => {
    state.acks = [{ key: KEY, cause: 'repeating', until: new Date(NOW.getTime() + 10 * 864e5) }]
    const res = await send('DELETE', 'pro-user', { key: KEY, cause: 'repeating' })
    assert.equal(res.status, 200)
    assert.deepEqual(state.acks, [])
    const body = await (await get('pro-user')).json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].recheck, undefined)
  })

  test('kaputtes JSON -> 400, nichts gespeichert', async () => {
    const savedBefore = state.saved.length
    const res = await send('POST', 'pro-user', null, '{"key": ')
    assert.equal(res.status, 400)
    assert.equal(state.saved.length, savedBefore)
  })

  test('jede Anfrage zählt fürs Limit', () => {
    assert.ok(limiterCalls.includes('free-user'))
    assert.ok(limiterCalls.filter((u) => u === 'pro-user').length >= 4)
  })
})
