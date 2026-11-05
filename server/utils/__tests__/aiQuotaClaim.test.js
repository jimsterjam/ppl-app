import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { claimAiQuotaSlot, releaseAiQuotaSlot } from '../aiQuotaClaim.js'

// Kleine Datenbank-Nachbildung nur für die hier benutzten Operatoren ($lt, $gt, $ne, $exists, $or, $inc, $set) mit
// künstlicher Verzögerung zwischen Lesen und Schreiben, damit gleichzeitige Aufrufe sich wirklich überlappen.
function createModel(initial) {
  const doc = JSON.parse(JSON.stringify(initial))
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc)
  const set = (path, value) => {
    const keys = path.split('.')
    const last = keys.pop()
    const target = keys.reduce((o, k) => (o[k] ??= {}), doc)
    target[last] = value
  }
  const same = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a ?? 0).getTime() === new Date(b ?? 0).getTime() && a != null && b != null : a === b)
  const matchField = (value, cond) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('$lt' in cond) return value !== undefined && value < cond.$lt
      if ('$gt' in cond) return value !== undefined && value > cond.$gt
      if ('$ne' in cond) return !same(value, cond.$ne)
      if ('$exists' in cond) return (value !== undefined) === cond.$exists
    }
    return same(value, cond)
  }
  const matches = (filter) => Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return cond.some(matches)
    if (key === 'uid') return doc.uid === cond
    return matchField(get(key), cond)
  })
  return {
    doc,
    async findOneAndUpdate(filter, update) {
      await new Promise((resolve) => setImmediate(resolve)) // Überlappung provozieren
      if (!matches(filter)) return null
      for (const [path, delta] of Object.entries(update.$inc || {})) set(path, (get(path) || 0) + delta)
      for (const [path, value] of Object.entries(update.$set || {})) set(path, value)
      return JSON.parse(JSON.stringify(doc))
    }
  }
}

const windowStart = new Date('2026-11-01T00:00:00Z')
const monthly = (limit, extra = {}) => ({ phase: 'monthly', limit, windowStart, ...extra })
const welcome = (limit) => ({ phase: 'welcome', limit, windowStart: null })

describe('KI-Kontingent: atomares Beanspruchen', () => {
  it('Monatsphase: zwei gleichzeitige Anfragen, ein freier Platz: genau eine bekommt ihn', async () => {
    const model = createModel({ uid: 'u', aiUsage: { monthWindowStart: windowStart, monthlyCount: 9 } })
    const results = await Promise.all([1, 2].map(() => claimAiQuotaSlot({ model, uid: 'u', state: monthly(10) })))
    assert.equal(results.filter((r) => r.claimed).length, 1)
    assert.equal(model.doc.aiUsage.monthlyCount, 10)
  })

  it('Willkommensphase: viele gleichzeitige Anfragen überschreiten den Topf nie', async () => {
    const model = createModel({ uid: 'u', aiUsage: { welcomeCount: 28 } })
    const results = await Promise.all(Array.from({ length: 6 }, () => claimAiQuotaSlot({ model, uid: 'u', state: welcome(30) })))
    assert.equal(results.filter((r) => r.claimed).length, 2)
    assert.equal(model.doc.aiUsage.welcomeCount, 30)
  })

  it('Willkommenstopf ohne gespeicherten Zähler startet bei 1', async () => {
    const model = createModel({ uid: 'u', aiUsage: {} })
    const result = await claimAiQuotaSlot({ model, uid: 'u', state: welcome(30) })
    assert.equal(result.claimed, true)
    assert.equal(model.doc.aiUsage.welcomeCount, 1)
  })

  it('neuer Monat: Fenster wird genau einmal zurückgesetzt, danach zählt jede Anfrage', async () => {
    const model = createModel({ uid: 'u', aiUsage: { monthWindowStart: new Date('2026-10-01T00:00:00Z'), monthlyCount: 10 } })
    const results = await Promise.all(Array.from({ length: 12 }, () => claimAiQuotaSlot({ model, uid: 'u', state: monthly(10) })))
    assert.equal(results.filter((r) => r.claimed).length, 10)
    assert.equal(model.doc.aiUsage.monthlyCount, 10)
    assert.equal(new Date(model.doc.aiUsage.monthWindowStart).toISOString(), windowStart.toISOString())
  })

  it('kein Fenster gespeichert: erste Anfrage setzt Fenster und Zähler', async () => {
    const model = createModel({ uid: 'u', aiUsage: {} })
    assert.equal((await claimAiQuotaSlot({ model, uid: 'u', state: monthly(10) })).claimed, true)
    assert.equal(model.doc.aiUsage.monthlyCount, 1)
  })

  it('leeres Kontingent und Limit 0 beanspruchen nichts', async () => {
    const full = createModel({ uid: 'u', aiUsage: { monthWindowStart: windowStart, monthlyCount: 10 } })
    assert.equal((await claimAiQuotaSlot({ model: full, uid: 'u', state: monthly(10) })).claimed, false)
    assert.equal((await claimAiQuotaSlot({ model: full, uid: 'u', state: monthly(0) })).claimed, false)
    assert.equal(full.doc.aiUsage.monthlyCount, 10)
  })
})

describe('KI-Kontingent: Platz zurückgeben', () => {
  it('Monatsphase: Zähler sinkt um 1, nie unter 0', async () => {
    const model = createModel({ uid: 'u', aiUsage: { monthWindowStart: windowStart, monthlyCount: 3 } })
    const claim = await claimAiQuotaSlot({ model, uid: 'u', state: monthly(10) })
    assert.equal(model.doc.aiUsage.monthlyCount, 4)
    await releaseAiQuotaSlot({ model, uid: 'u', claim })
    assert.equal(model.doc.aiUsage.monthlyCount, 3)
    const empty = createModel({ uid: 'u', aiUsage: { monthWindowStart: windowStart, monthlyCount: 0 } })
    assert.equal(await releaseAiQuotaSlot({ model: empty, uid: 'u', claim: { claimed: true, phase: 'monthly', windowStart } }), null)
    assert.equal(empty.doc.aiUsage.monthlyCount, 0)
  })

  it('Willkommensphase: nur der Willkommenstopf wird zurückgegeben', async () => {
    const model = createModel({ uid: 'u', aiUsage: { welcomeCount: 5, monthlyCount: 2, monthWindowStart: windowStart } })
    const claim = await claimAiQuotaSlot({ model, uid: 'u', state: welcome(30) })
    await releaseAiQuotaSlot({ model, uid: 'u', claim })
    assert.equal(model.doc.aiUsage.welcomeCount, 5)
    assert.equal(model.doc.aiUsage.monthlyCount, 2)
  })

  it('ohne beanspruchten Platz geschieht nichts', async () => {
    const model = createModel({ uid: 'u', aiUsage: { welcomeCount: 5 } })
    assert.equal(await releaseAiQuotaSlot({ model, uid: 'u', claim: { claimed: false } }), null)
    assert.equal(model.doc.aiUsage.welcomeCount, 5)
  })
})

import { withAiQuotaSlot } from '../aiQuotaClaim.js'

describe('KI-Kontingent: Aufruf nur mit Platz, Rückgabe ohne Ergebnis', () => {
  const make = (claimed) => {
    const log = { ran: 0, released: 0 }
    return {
      log,
      claim: async () => ({ claimed }),
      release: async () => { log.released += 1 }
    }
  }

  it('ohne freien Platz wird der KI-Aufruf gar nicht ausgeführt', async () => {
    const m = make(false)
    const out = await withAiQuotaSlot({ ...m, run: async () => { m.log.ran += 1; return 'text' } })
    assert.deepEqual(out, { limited: true, error: false })
    assert.equal(m.log.ran, 0)
    assert.equal(m.log.released, 0)
  })

  it('Datenbankfehler beim Beanspruchen ist kein erschöpftes Kontingent und ruft die KI nicht auf', async () => {
    const log = { ran: 0, released: 0 }
    const out = await withAiQuotaSlot({
      claim: async () => ({ claimed: false, error: true }),
      release: async () => { log.released += 1 },
      run: async () => { log.ran += 1; return 'text' }
    })
    assert.deepEqual(out, { limited: true, error: true })
    assert.equal(log.ran, 0)
    assert.equal(log.released, 0)
  })

  it('mit Ergebnis bleibt der Platz verbraucht', async () => {
    const m = make(true)
    const out = await withAiQuotaSlot({ ...m, run: async () => 'Feedback' })
    assert.deepEqual(out, { limited: false, result: 'Feedback' })
    assert.equal(m.log.released, 0)
  })

  it('ohne Ergebnis (leer oder null) geht der Platz zurück', async () => {
    for (const empty of [null, '', undefined]) {
      const m = make(true)
      const out = await withAiQuotaSlot({ ...m, run: async () => empty })
      assert.equal(out.limited, false)
      assert.equal(m.log.released, 1)
    }
  })

  it('bei einem Fehler geht der Platz zurück und der Fehler bleibt sichtbar', async () => {
    const m = make(true)
    await assert.rejects(() => withAiQuotaSlot({ ...m, run: async () => { throw new Error('boom') } }), /boom/)
    assert.equal(m.log.released, 1)
  })
})
