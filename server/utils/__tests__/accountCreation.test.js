import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ensureAccountCreatedAt } from '../accountCreation.js'

function fakeModel() {
  const calls = []
  return { calls, updateOne: async (filter, update) => { calls.push({ filter, update }); return { modifiedCount: 1 } } }
}

describe('Registrierungszeitpunkt aus Firebase', () => {
  it('holt den Zeitpunkt einmal und speichert ihn nur, wenn noch keiner da ist', async () => {
    const model = fakeModel()
    const profile = { uid: 'u1' }
    await ensureAccountCreatedAt(profile, { model, lookup: async () => 'Tue, 03 Feb 2026 10:00:00 GMT' })
    assert.equal(profile.accountCreatedAt.toISOString(), '2026-02-03T10:00:00.000Z')
    assert.equal(model.calls.length, 1)
    assert.deepEqual(model.calls[0].update, { $set: { accountCreatedAt: profile.accountCreatedAt } })
    assert.ok(model.calls[0].filter.$or)
  })

  it('fragt Firebase nicht erneut, wenn der Wert schon gespeichert ist', async () => {
    const model = fakeModel()
    let looked = 0
    const profile = { uid: 'u1', accountCreatedAt: new Date('2026-02-03T10:00:00Z') }
    await ensureAccountCreatedAt(profile, { model, lookup: async () => { looked += 1; return new Date() } })
    assert.equal(looked, 0)
    assert.equal(model.calls.length, 0)
  })

  it('Firebase nicht erreichbar oder unbrauchbar: nichts speichern, kein Fehler', async () => {
    for (const lookup of [async () => { throw new Error('offline') }, async () => null, async () => 'kein Datum']) {
      const model = fakeModel()
      const profile = { uid: 'u1' }
      const result = await ensureAccountCreatedAt(profile, { model, lookup })
      assert.equal(result.accountCreatedAt, undefined)
      assert.equal(model.calls.length, 0)
    }
  })
})
