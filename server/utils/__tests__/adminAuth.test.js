import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { requireAdminUid, parseAdminUids } = await import(join(__dirname, '../../middleware/adminAuth.js'))

const ADMIN = '6zCFJN4TH3eqm470FiLgGBG337r2'

function run(req) {
  const result = { status: null, nextCalled: false }
  const res = {
    status(code) { result.status = code; return this },
    json() { return this }
  }
  requireAdminUid(req, res, () => { result.nextCalled = true })
  return result
}

describe('parseAdminUids', () => {
  test('trennt per Komma und entfernt Leerzeichen/leere Einträge', () => {
    assert.deepEqual([...parseAdminUids(` ${ADMIN} , ,other `)], [ADMIN, 'other'])
  })

  test('leerer Wert ergibt leere Menge', () => {
    assert.equal(parseAdminUids(undefined).size, 0)
  })
})

describe('requireAdminUid', () => {
  let previous
  beforeEach(() => { previous = process.env.ADMIN_UIDS })
  afterEach(() => {
    if (previous === undefined) delete process.env.ADMIN_UIDS
    else process.env.ADMIN_UIDS = previous
  })

  test('lässt die Admin-UID durch', () => {
    process.env.ADMIN_UIDS = ADMIN
    const r = run({ auth: { userId: ADMIN } })
    assert.equal(r.nextCalled, true)
    assert.equal(r.status, null)
  })

  test('blockt andere eingeloggte Accounts mit 403', () => {
    process.env.ADMIN_UIDS = ADMIN
    const r = run({ auth: { userId: 'someoneElse' } })
    assert.equal(r.nextCalled, false)
    assert.equal(r.status, 403)
  })

  test('blockt Aufrufe ohne Login mit 403', () => {
    process.env.ADMIN_UIDS = ADMIN
    const r = run({})
    assert.equal(r.nextCalled, false)
    assert.equal(r.status, 403)
  })

  test('nicht konfiguriert = gesperrt (503), nie offen', () => {
    delete process.env.ADMIN_UIDS
    const r = run({ auth: { userId: ADMIN } })
    assert.equal(r.nextCalled, false)
    assert.equal(r.status, 503)
  })
})
