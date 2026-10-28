import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizePlanPayload, isPlanLimitExceeded, PLAN_LIMITS } from '../trainingPlanValidation.js'

const day = (n, extra = {}) => ({ id: `day_${n}`, label: `Tag ${n}`, favoriteId: `fav_${n}`, ...extra })
const body = (extra = {}) => ({ clientId: 'plan_1', name: 'PPL 3x', days: [day(1), day(2), day(3)], activeDayIndex: 1, active: true, ...extra })

describe('sanitizePlanPayload', () => {
  test('gültiger Plan wird übernommen', () => {
    const { value, error } = sanitizePlanPayload(body())
    assert.equal(error, undefined)
    assert.equal(value.clientId, 'plan_1')
    assert.equal(value.name, 'PPL 3x')
    assert.equal(value.days.length, 3)
    assert.equal(value.activeDayIndex, 1)
    assert.equal(value.active, true)
  })

  test('nur bekannte Felder: fremde Felder im Body werden nie gespeichert', () => {
    const { value } = sanitizePlanPayload({ ...body(), userId: 'other', admin: true, days: [{ ...day(1), extra: 'x' }] })
    assert.equal('userId' in value, false)
    assert.equal('admin' in value, false)
    assert.equal('extra' in value.days[0], false)
  })

  test('Pflichtfelder: clientId, Name, mindestens ein gültiger Tag', () => {
    assert.ok(sanitizePlanPayload(body({ clientId: '' })).error)
    assert.ok(sanitizePlanPayload(body({ clientId: 'ungültig id!' })).error)
    assert.ok(sanitizePlanPayload(body({ name: '   ' })).error)
    assert.ok(sanitizePlanPayload(body({ days: [] })).error)
    assert.ok(sanitizePlanPayload(body({ days: [{ id: 'd', label: 'x' }] })).error)
    assert.ok(sanitizePlanPayload(null).error)
    assert.ok(sanitizePlanPayload([]).error)
  })

  test('Texte: Steuerzeichen und < > raus, auf feste Länge gekürzt statt abgelehnt', () => {
    const { value } = sanitizePlanPayload(body({
      name: `  <b>${'N'.repeat(100)}</b>\u0007 `,
      days: [day(1, { label: `L\u0000${'x'.repeat(80)}` })]
    }))
    assert.ok(!/[<>]/.test(value.name))
    assert.ok([...value.name].every((ch) => ch.charCodeAt(0) >= 32))
    assert.equal(Array.from(value.name).length, PLAN_LIMITS.maxName)
    assert.equal(Array.from(value.days[0].label).length, PLAN_LIMITS.maxLabel)
  })

  test('höchstens 7 Tage, doppelte Tag-IDs und ungültige Tage fallen weg', () => {
    const many = Array.from({ length: 12 }, (_, i) => day(i + 1))
    assert.equal(sanitizePlanPayload(body({ days: many })).value.days.length, PLAN_LIMITS.maxDays)
    const { value } = sanitizePlanPayload(body({ days: [day(1), day(1), { id: 'x' }, day(2)] }))
    assert.deepEqual(value.days.map((d) => d.id), ['day_1', 'day_2'])
  })

  test('activeDayIndex außerhalb der Tage -> 0; active nur bei echtem true', () => {
    assert.equal(sanitizePlanPayload(body({ activeDayIndex: 9 })).value.activeDayIndex, 0)
    assert.equal(sanitizePlanPayload(body({ activeDayIndex: -1 })).value.activeDayIndex, 0)
    assert.equal(sanitizePlanPayload(body({ active: 'true' })).value.active, false)
  })

  test('lastDoneAt: gültiges Datum bleibt, Unsinn wird null', () => {
    const { value } = sanitizePlanPayload(body({ days: [day(1, { lastDoneAt: '2026-10-24T10:00:00Z' }), day(2, { lastDoneAt: 'gestern' })] }))
    assert.equal(value.days[0].lastDoneAt.toISOString(), '2026-10-24T10:00:00.000Z')
    assert.equal(value.days[1].lastDoneAt, null)
  })
})

describe('isPlanLimitExceeded', () => {
  test('ab 3 vorhandenen Plänen ist das Limit erreicht', () => {
    assert.equal(isPlanLimitExceeded(0), false)
    assert.equal(isPlanLimitExceeded(2), false)
    assert.equal(isPlanLimitExceeded(3), true)
  })
})
