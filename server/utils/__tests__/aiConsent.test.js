import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CURRENT_AI_CONSENT_VERSION,
  summarizeAiConsent,
  parseConsentInput,
  buildConsentUpdate,
  createRequireAiConsent
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

test('Einwilligung der Textversion 1 gilt nach der Erweiterung um die Fragen nach dem Training nicht mehr (Version 2)', () => {
  assert.equal(CURRENT_AI_CONSENT_VERSION, 2)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: true, version: 1, grantedAt: 'x' } }).granted, false)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: true, version: 2, grantedAt: 'x' } }).granted, true)
})

test('Zustimmung zum alten Text (ältere App ohne Versionsangabe) gilt nicht für die neue Version', () => {
  // Ältere App-Version: schickt keine Version -> Textversion 1
  const legacy = parseConsentInput({ granted: true })
  assert.equal(legacy.version, 1)
  const update = buildConsentUpdate(true, new Date(), legacy.version)
  assert.equal(update['aiConsent.version'], 1)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: update['aiConsent.granted'], version: update['aiConsent.version'] } }).granted, false)
  // Neue App schickt die gesehene Version mit
  const current = parseConsentInput({ granted: true, version: CURRENT_AI_CONSENT_VERSION })
  const ok = buildConsentUpdate(true, new Date(), current.version)
  assert.equal(summarizeAiConsent({ aiConsent: { granted: true, version: ok['aiConsent.version'] } }).granted, true)
})

test('Version aus dem Request wird begrenzt: weder höher als aktuell noch unter 1, keine Nicht-Zahlen', () => {
  assert.equal(parseConsentInput({ granted: true, version: 99 }).version, CURRENT_AI_CONSENT_VERSION)
  assert.equal(parseConsentInput({ granted: true, version: 0 }).version, 1)
  assert.equal(parseConsentInput({ granted: true, version: '2' }).version, 1)
  assert.equal(parseConsentInput({ granted: true, version: 1.5 }).version, 1)
})

test('Textversion im Client und Server stimmt überein', async () => {
  const { AI_CONSENT_TEXT_VERSION } = await import('../../../client/src/config/aiConsentVersion.js')
  assert.equal(AI_CONSENT_TEXT_VERSION, CURRENT_AI_CONSENT_VERSION)
})
