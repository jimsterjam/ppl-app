import { describe, test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createMonthlyReportsRouter } from '../../routes/monthlyReports.js'
import { __setFocusCatalogForTests } from '../nextSessionFocus.js'

__setFocusCatalogForTests([
  { name: 'Bankdrücken Langhantel', name_en: 'barbell bench press', category: 'Push', equipment: 'Langhantel', aiMetadata: { exerciseType: 'compound' } }
])

const NOW = new Date('2026-10-01T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (d) => new Date(NOW.getTime() - d * DAY)
const makeWorkouts = (count) => Array.from({ length: count }, (_, i) => ({
  date: daysAgo(1 + i * 2),
  goal: 'hypertrophy',
  exercises: [{ name: 'Bankdrücken Langhantel', setDetails: [8, 8, 8].map((reps) => ({ reps, weight: 60 + i, done: true })) }]
}))
const ID_A = 'a'.repeat(24)

describe('/api/reports/monthly', () => {
  let server
  let base
  let state

  const reset = () => {
    state = {
      plan: 'pro',
      last: null,
      first: daysAgo(60),
      workouts: makeWorkouts(14),
      workoutLoads: 0,
      saved: [],
      saveError: null,
      stored: new Map(),
      seen: []
    }
  }

  before(async () => {
    reset()
    const app = express()
    app.use(express.json())
    app.use('/api/reports', createMonthlyReportsRouter({
      auth: (req, res, next) => {
        const uid = req.headers['x-test-user']
        if (!uid) return res.status(401).json({ error: 'unauthorized' })
        req.auth = { userId: uid }
        next()
      },
      loadProfile: async () => ({ paid: state.plan !== 'free' }),
      loadLastReport: async () => state.last,
      loadFirstWorkoutDate: async () => state.first,
      loadWorkouts: async () => { state.workoutLoads++; return state.workouts },
      saveReport: async (userId, built, now) => {
        if (state.saveError) throw state.saveError
        const doc = { _id: ID_A, userId, ...built, generatedAt: now, seenAt: null }
        state.saved.push(doc)
        state.stored.set(`${userId}:${ID_A}`, doc)
        return doc
      },
      listReports: async (userId) => [...state.stored.values()].filter((r) => r.userId === userId),
      getReport: async (userId, id) => state.stored.get(`${userId}:${id}`) || null,
      markSeen: async (userId, id) => { state.seen.push(`${userId}:${id}`) },
      now: () => NOW,
      limiter: (uid) => (uid === 'spammer' ? { allowed: false, retryAfterSec: 42 } : { allowed: true, retryAfterSec: 0 })
    }))
    server = app.listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${server.address().port}/api/reports/monthly`
  })

  after(() => server.close())
  beforeEach(reset)

  const call = (path, { uid = 'pro-user', method = 'GET' } = {}) =>
    fetch(`${base}${path}`, { method, headers: uid ? { 'x-test-user': uid } : {} })

  test('ohne Login 401', async () => {
    assert.equal((await call('/check', { uid: null, method: 'POST' })).status, 401)
    assert.equal((await call('', { uid: null })).status, 401)
  })

  test('ohne Pro 403 pro_required, keine Workouts geladen', async () => {
    state.plan = 'free'
    const res = await call('/check', { method: 'POST' })
    assert.equal(res.status, 403)
    assert.deepEqual(await res.json(), { error: 'pro_required', locked: true })
    assert.equal(state.workoutLoads, 0)
    assert.equal((await call('')).status, 403)
  })

  test('Limit erreicht: 429 mit Retry-After', async () => {
    const res = await call('/check', { uid: 'spammer', method: 'POST' })
    assert.equal(res.status, 429)
    assert.equal(res.headers.get('retry-after'), '42')
  })

  test('letzter Bericht vor 10 Tagen: zu früh, ohne Workouts zu laden', async () => {
    state.last = { periodEnd: daysAgo(10) }
    const body = await (await call('/check', { method: 'POST' })).json()
    assert.deepEqual(body, { created: false, reason: 'too_soon' })
    assert.equal(state.workoutLoads, 0)
  })

  test('erstes Workout vor 20 Tagen: noch kein erster Bericht', async () => {
    state.first = daysAgo(20)
    const body = await (await call('/check', { method: 'POST' })).json()
    assert.deepEqual(body, { created: false, reason: 'first_workout_too_recent' })
    assert.equal(state.workoutLoads, 0)
  })

  test('nur 11 Einheiten in 28 Tagen: kein Bericht', async () => {
    state.workouts = makeWorkouts(11)
    const body = await (await call('/check', { method: 'POST' })).json()
    assert.deepEqual(body, { created: false, reason: 'too_few_sessions' })
    assert.equal(state.saved.length, 0)
  })

  test('12 Einheiten: Bericht wird erzeugt und aus Serverdaten gespeichert', async () => {
    state.workouts = makeWorkouts(12)
    const res = await call('/check', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.created, true)
    assert.equal(body.report.id, ID_A)
    assert.equal(body.report.seenAt, null)
    assert.equal(state.saved.length, 1)
    assert.equal(state.saved[0].facts.totals.sessions, 12)
    assert.equal(state.saved[0].userId, 'pro-user')
  })

  test('zweites Gerät gleichzeitig (eindeutiger Index): created=false, reason exists', async () => {
    state.saveError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    const body = await (await call('/check', { method: 'POST' })).json()
    assert.deepEqual(body, { created: false, reason: 'exists' })
  })

  test('Request-Body wird ignoriert', async () => {
    const res = await fetch(`${base}/check`, {
      method: 'POST',
      headers: { 'x-test-user': 'pro-user', 'content-type': 'application/json' },
      body: JSON.stringify({ facts: { hacked: true }, userId: 'someone-else' })
    })
    assert.equal((await res.json()).created, true)
    assert.equal(state.saved[0].userId, 'pro-user')
    assert.equal(state.saved[0].facts.hacked, undefined)
  })

  test('Liste, Bericht lesen, als gesehen markieren - nur der eigene', async () => {
    await call('/check', { method: 'POST' })
    const list = await (await call('')).json()
    assert.equal(list.reports.length, 1)

    const detail = await (await call(`/${ID_A}`)).json()
    assert.equal(detail.id, ID_A)
    assert.equal(detail.facts.version, 1)

    assert.equal((await call(`/${ID_A}`, { uid: 'other-pro' })).status, 404)
    assert.equal((await call(`/${ID_A}/seen`, { uid: 'other-pro', method: 'POST' })).status, 404)
    assert.deepEqual(await (await call('', { uid: 'other-pro' })).json(), { reports: [] })

    assert.equal((await call(`/${ID_A}/seen`, { method: 'POST' })).status, 200)
    assert.deepEqual(state.seen, [`pro-user:${ID_A}`])
  })

  test('ungültige ID: 404, kein Datenbankzugriff', async () => {
    assert.equal((await call('/nicht-gueltig')).status, 404)
    assert.equal((await call('/..%2F..%2Fetc')).status, 404)
    assert.equal((await call(`/${'g'.repeat(24)}`)).status, 404)
  })
})
