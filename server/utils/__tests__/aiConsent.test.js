import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CURRENT_AI_CONSENT_VERSION,
  summarizeAiConsent,
  parseConsentInput,
  buildConsentUpdate,
  createRequireAiConsent,
  declaredConsentVersion,
  MIN_AI_CONSENT_VERSION,
  ANSWERS_CONSENT_VERSION
} from '../aiConsent.js'

const silent = { error() {} }

function run(mw, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this },
      json(body) { resolve({ status: this.statusCode, body }) }
    }
    mw(req, res, () => resolve({ status: 'next' }))
  })
}

test('summarizeAiConsent: ohne Eintrag oder Widerruf nicht erteilt', () => {
  assert.equal(summarizeAiConsent(null).granted, false)
  assert.equal(summarizeAiConsent({}).granted, false)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: false, version: 1 } }).granted, false)
})

test('summarizeAiConsent: erteilt nur mit aktueller Version', () => {
  const ok = summarizeAiConsent({ aiConsent: { granted: true, version: CURRENT_AI_CONSENT_VERSION, grantedAt: 'x' } })
  assert.equal(ok.granted, true)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: true, version: 0 } }).granted, false)
})

test('parseConsentInput: nur echtes Boolean', () => {
  assert.deepEqual(parseConsentInput({ granted: true, version: CURRENT_AI_CONSENT_VERSION }), { granted: true, version: CURRENT_AI_CONSENT_VERSION })
  assert.deepEqual(parseConsentInput({ granted: false, evil: 1 }), { granted: false, version: 1 })
  assert.equal(parseConsentInput({ granted: 'true' }), null)
  assert.equal(parseConsentInput({}), null)
  assert.equal(parseConsentInput(null), null)
})

test('buildConsentUpdate: setzt Version beim Zustimmen, Widerrufsdatum beim Widerruf', () => {
  const now = new Date()
  const grant = buildConsentUpdate(true, now)
  assert.equal(grant['aiConsent.version'], CURRENT_AI_CONSENT_VERSION)
  assert.equal(grant['aiConsent.grantedAt'], now)
  const revoke = buildConsentUpdate(false, now)
  assert.equal(revoke['aiConsent.granted'], false)
  assert.equal(revoke['aiConsent.revokedAt'], now)
})

test('Middleware: ohne Einwilligung 403 AI_CONSENT_REQUIRED', async () => {
  const mw = createRequireAiConsent({ loadProfile: async () => ({}), logger: silent })
  const r = await run(mw, { auth: { userId: 'u1' } })
  assert.equal(r.status, 403)
  assert.equal(r.body.code, 'AI_CONSENT_REQUIRED')
})

test('Middleware: mit Einwilligung weiter', async () => {
  const mw = createRequireAiConsent({
    loadProfile: async () => ({ aiConsent: { granted: true, version: CURRENT_AI_CONSENT_VERSION } }),
    logger: silent
  })
  assert.equal((await run(mw, { auth: { userId: 'u1' } })).status, 'next')
})

test('Middleware: Fehler beim Laden sperrt (503), sendet nichts weiter', async () => {
  const mw = createRequireAiConsent({ loadProfile: async () => { throw new Error('db') }, logger: silent })
  const r = await run(mw, { auth: { userId: 'u1' } })
  assert.equal(r.status, 503)
})

test('Middleware: ohne Nutzer-ID (Auth aus, nur Entwicklung) weiter', async () => {
  const mw = createRequireAiConsent({ loadProfile: async () => ({}), logger: silent })
  assert.equal((await run(mw, {})).status, 'next')
})

test('Textversion 2 ist die aktuelle; die neue App verlangt sie, ältere Apps (Text 1) nicht', () => {
  assert.equal(CURRENT_AI_CONSENT_VERSION, 2)
  assert.equal(MIN_AI_CONSENT_VERSION, 1)
  assert.equal(ANSWERS_CONSENT_VERSION, 2)
  const v1 = { aiConsent: { granted: true, version: 1, grantedAt: 'x' } }
  const v2 = { aiConsent: { granted: true, version: 2, grantedAt: 'x' } }
  // neue App fragt mit ihrer Textversion: Zustimmung zu Text 1 gilt dort nicht
  assert.equal(summarizeAiConsent(v1, 2).granted, false)
  assert.equal(summarizeAiConsent(v2, 2).granted, true)
  // ältere App ohne Angabe: Text 1 genügt
  assert.equal(summarizeAiConsent(v1).granted, true)
  assert.equal(summarizeAiConsent(v2).granted, true)
  // Gegenprobe: ohne Zustimmung, widerrufen oder Version 0 gilt nie
  assert.equal(summarizeAiConsent({ aiConsent: { granted: false, version: 2 } }).granted, false)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: true, version: 0 } }).granted, false)
  assert.equal(summarizeAiConsent(null, 2).granted, false)
  // ungültige verlangte Version fällt auf die älteste zurück, nie auf "alles erlaubt" ohne Zustimmung
  assert.equal(summarizeAiConsent({ aiConsent: { granted: false, version: 2 } }, 99).granted, false)
})

// Fund 17.11.: Apps vor Textversion 2 (z. B. 1.0 (5)) schicken keine Version. Die Zustimmung wurde als Text 1 gespeichert und
// vom Server als "nicht erteilt" zurückgegeben: Der Nutzer wurde nach jedem Workout erneut gefragt, "Zustimmung nicht gespeichert".
test('Ältere App ohne Versionsangabe: Zustimmen wird als erteilt zurückgegeben und gilt danach beim Abfragen', () => {
  const legacy = parseConsentInput({ granted: true })
  assert.equal(legacy.version, 1)
  const update = buildConsentUpdate(true, new Date(), legacy.version)
  assert.equal(update['aiConsent.version'], 1)
  const stored = { aiConsent: { granted: update['aiConsent.granted'], version: update['aiConsent.version'] } }
  // Antwort auf PUT (Maßstab: die zugestimmte Version) und spätere Abfrage ohne Versionsangabe
  assert.equal(summarizeAiConsent(stored, legacy.version).granted, true)
  assert.equal(summarizeAiConsent(stored, declaredConsentVersion({ query: {} })).granted, true)
})

test('Neue App: Zustimmung zu Text 1 gilt dort nicht (fragt einmal nach Text 2), Zustimmung zu Text 2 gilt', () => {
  const stored1 = { aiConsent: { granted: true, version: 1 } }
  assert.equal(summarizeAiConsent(stored1, declaredConsentVersion({ query: { consentVersion: '2' } })).granted, false)
  const current = parseConsentInput({ granted: true, version: CURRENT_AI_CONSENT_VERSION })
  const ok = buildConsentUpdate(true, new Date(), current.version)
  const stored2 = { aiConsent: { granted: true, version: ok['aiConsent.version'] } }
  assert.equal(summarizeAiConsent(stored2, current.version).granted, true)
  assert.equal(summarizeAiConsent(stored2, declaredConsentVersion({ query: { consentVersion: '2' } })).granted, true)
})

test('declaredConsentVersion: nur gültige ganze Versionen, sonst Text 1', () => {
  assert.equal(declaredConsentVersion({ query: { consentVersion: '2' } }), 2)
  assert.equal(declaredConsentVersion({ query: { consentVersion: '1' } }), 1)
  assert.equal(declaredConsentVersion({ query: { consentVersion: ['2', '1'] } }), 2)
  for (const bad of [undefined, null, '', '0', '3', '99', '-1', '1.5', 'abc', 'true', {}, { $gt: '' }]) {
    assert.equal(declaredConsentVersion({ query: { consentVersion: bad } }), 1, `ungültig: ${JSON.stringify(bad)}`)
  }
  assert.equal(declaredConsentVersion({}), 1)
  assert.equal(declaredConsentVersion(null), 1)
})

test('Middleware: Zustimmung zu Text 1 genügt für KI-Aufrufe und meldet die Version; Antworten verlangen Text 2', async () => {
  const profile = { aiConsent: { granted: true, version: 1 } }
  const general = createRequireAiConsent({ loadProfile: async () => profile, logger: silent })
  const req = { auth: { userId: 'u1' } }
  assert.equal((await run(general, req)).status, 'next')
  assert.equal(req.aiConsentVersion, 1)
  // Gegenprobe: für die Antworten reicht Text 1 nicht
  const answers = createRequireAiConsent({ loadProfile: async () => profile, logger: silent, minVersion: ANSWERS_CONSENT_VERSION })
  const refused = await run(answers, { auth: { userId: 'u1' } })
  assert.equal(refused.status, 403)
  assert.equal(refused.body.code, 'AI_CONSENT_REQUIRED')
  assert.equal(refused.body.consentVersion, CURRENT_AI_CONSENT_VERSION)
  const v2 = createRequireAiConsent({ loadProfile: async () => ({ aiConsent: { granted: true, version: 2 } }), logger: silent, minVersion: ANSWERS_CONSENT_VERSION })
  const req2 = { auth: { userId: 'u1' } }
  assert.equal((await run(v2, req2)).status, 'next')
  assert.equal(req2.aiConsentVersion, 2)
  // Gegenprobe: widerrufen gilt für beide nie
  const revoked = { aiConsent: { granted: false, version: 2 } }
  assert.equal((await run(createRequireAiConsent({ loadProfile: async () => revoked, logger: silent }), { auth: { userId: 'u1' } })).status, 403)
})

test('Gemeldete Version, die es nicht gibt, wird abgelehnt statt angepasst (kein Vortäuschen der aktuellen Zustimmung)', () => {
  assert.equal(parseConsentInput({ granted: true, version: 99 }), null)
  assert.equal(parseConsentInput({ granted: true, version: CURRENT_AI_CONSENT_VERSION + 1 }), null)
  assert.equal(parseConsentInput({ granted: true, version: 0 }), null)
  assert.equal(parseConsentInput({ granted: true, version: '2' }), null)
  assert.equal(parseConsentInput({ granted: true, version: 1.5 }), null)
  assert.equal(parseConsentInput({ granted: true, version: null }).version, 1)
  assert.equal(parseConsentInput({ granted: true, version: 1 }).version, 1)
  assert.equal(parseConsentInput({ granted: true, version: CURRENT_AI_CONSENT_VERSION }).version, CURRENT_AI_CONSENT_VERSION)
})

test('Textversion im Client und Server stimmt überein', async () => {
  const { AI_CONSENT_TEXT_VERSION } = await import('../../../client/src/config/aiConsentVersion.js')
  assert.equal(AI_CONSENT_TEXT_VERSION, CURRENT_AI_CONSENT_VERSION)
})
