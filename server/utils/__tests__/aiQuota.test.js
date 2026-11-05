import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readAiQuotaConfig, getAiQuotaState, canUseAi, nextAiUsage, aiQuotaSnapshot } from '../aiQuota.js'

const DAY = 24 * 60 * 60 * 1000
const config = { welcomeLimit: 30, welcomeDays: 30, monthlyLimit: 10 }
const created = new Date('2026-11-05T12:00:00Z')
const at = (days) => new Date(created.getTime() + days * DAY)

describe('KI-Kontingent: Konfiguration', () => {
  it('Standardwerte 30 / 30 Tage / 10', () => {
    assert.deepEqual(readAiQuotaConfig({}), { welcomeLimit: 30, welcomeDays: 30, monthlyLimit: 10 })
  })
  it('liest Umgebungsvariablen und ignoriert Unsinn', () => {
    assert.deepEqual(readAiQuotaConfig({ AI_WELCOME_LIMIT: '50', AI_WELCOME_DAYS: '14', FREE_AI_MONTHLY_LIMIT: '5' }),
      { welcomeLimit: 50, welcomeDays: 14, monthlyLimit: 5 })
    assert.deepEqual(readAiQuotaConfig({ AI_WELCOME_LIMIT: 'abc', AI_WELCOME_DAYS: '-3', FREE_AI_MONTHLY_LIMIT: '' }),
      { welcomeLimit: 30, welcomeDays: 0, monthlyLimit: 10 })
  })
})

describe('KI-Kontingent: Willkommensphase', () => {
  it('neues Konto: 30 Anfragen, Ende nach 30 Tagen', () => {
    const state = getAiQuotaState({ accountCreatedAt: created }, { now: at(1), config })
    assert.equal(state.phase, 'welcome')
    assert.equal(state.limit, 30)
    assert.equal(state.remaining, 30)
    assert.equal(state.welcomeEndsAt.getTime(), at(30).getTime())
    assert.equal(state.resetsAt.getTime(), at(30).getTime())
    assert.equal(state.regularLimit, 10)
  })

  it('zählt nur den Willkommenstopf, nicht den Monatszähler', () => {
    let profile = { accountCreatedAt: created, aiUsage: {} }
    for (let i = 0; i < 3; i += 1) {
      const state = getAiQuotaState(profile, { now: at(2), config })
      profile = { ...profile, aiUsage: nextAiUsage(profile, state) }
    }
    assert.equal(profile.aiUsage.welcomeCount, 3)
    assert.equal(profile.aiUsage.monthlyCount, 0)
    assert.equal(getAiQuotaState(profile, { now: at(2), config }).remaining, 27)
  })

  it('leerer Topf sperrt bis zum Ende der Willkommensphase', () => {
    const profile = { accountCreatedAt: created, aiUsage: { welcomeCount: 30 } }
    const state = getAiQuotaState(profile, { now: at(10), config })
    assert.equal(canUseAi(state), false)
    assert.equal(state.resetsAt.getTime(), at(30).getTime())
  })

  it('Monatswechsel mitten in der Willkommensphase bringt keine Extra-Anfragen', () => {
    const profile = { accountCreatedAt: new Date('2026-11-25T12:00:00Z'), aiUsage: { welcomeCount: 30 } }
    const state = getAiQuotaState(profile, { now: new Date('2026-12-02T12:00:00Z'), config })
    assert.equal(state.phase, 'welcome')
    assert.equal(canUseAi(state), false)
  })
})

describe('KI-Kontingent: Monatsphase', () => {
  it('nach 30 Tagen gilt das Monatskontingent von 10, unabhängig vom Willkommenstopf', () => {
    const profile = { accountCreatedAt: created, aiUsage: { welcomeCount: 30 } }
    const state = getAiQuotaState(profile, { now: at(31), config })
    assert.equal(state.phase, 'monthly')
    assert.equal(state.limit, 10)
    assert.equal(state.remaining, 10)
    assert.equal(canUseAi(state), true)
  })

  it('genau am Ende der Willkommensphase beginnt das Monatskontingent', () => {
    assert.equal(getAiQuotaState({ accountCreatedAt: created }, { now: at(30), config }).phase, 'monthly')
    assert.equal(getAiQuotaState({ accountCreatedAt: created }, { now: new Date(at(30).getTime() - 1), config }).phase, 'welcome')
  })

  it('zählt im Kalendermonat und setzt sich im neuen Monat zurück', () => {
    const old = { accountCreatedAt: new Date('2026-01-01T00:00:00Z'), aiUsage: { monthWindowStart: new Date('2026-10-01T00:00:00Z'), monthlyCount: 10 } }
    assert.equal(getAiQuotaState(old, { now: new Date('2026-10-20T10:00:00Z'), config }).remaining, 0)
    const next = getAiQuotaState(old, { now: new Date('2026-11-02T10:00:00Z'), config })
    assert.equal(next.remaining, 10)
    assert.equal(next.resetsAt.toISOString(), '2026-12-01T00:00:00.000Z')
    const used = nextAiUsage(old, next)
    assert.equal(used.monthlyCount, 1)
    assert.equal(used.monthWindowStart.toISOString(), '2026-11-01T00:00:00.000Z')
  })

  it('Konto ohne accountCreatedAt (Altdaten): kein Willkommenskontingent', () => {
    assert.equal(getAiQuotaState({}, { now: created, config }).phase, 'monthly')
  })

  it('createdAt des Profil-Dokuments zählt nicht: nur die Registrierung des Kontos', () => {
    // Altes Konto, Profil-Dokument erst jetzt angelegt: kein neues Willkommenskontingent.
    const profile = { createdAt: created, accountCreatedAt: new Date('2026-01-01T00:00:00Z') }
    assert.equal(getAiQuotaState(profile, { now: at(1), config }).phase, 'monthly')
    assert.equal(getAiQuotaState({ createdAt: created }, { now: at(1), config }).phase, 'monthly')
  })

  it('Willkommenskontingent abgeschaltet (0 Anfragen oder 0 Tage)', () => {
    assert.equal(getAiQuotaState({ accountCreatedAt: created }, { now: at(1), config: { ...config, welcomeLimit: 0 } }).phase, 'monthly')
    assert.equal(getAiQuotaState({ accountCreatedAt: created }, { now: at(1), config: { ...config, welcomeDays: 0 } }).phase, 'monthly')
  })
})

describe('KI-Kontingent: Schnappschuss für die App', () => {
  it('enthält Phase, Ende und regulären Wert, monthly*-Felder beschreiben den aktuellen Topf', () => {
    const state = getAiQuotaState({ accountCreatedAt: created, aiUsage: { welcomeCount: 4 } }, { now: at(3), config })
    const snap = aiQuotaSnapshot(state, 'free')
    assert.equal(snap.phase, 'welcome')
    assert.equal(snap.monthlyCount, 4)
    assert.equal(snap.monthlyLimit, 30)
    assert.equal(snap.monthlyRemaining, 26)
    assert.equal(snap.regularMonthlyLimit, 10)
    assert.equal(snap.resetsAt, at(30).toISOString())
  })
})
