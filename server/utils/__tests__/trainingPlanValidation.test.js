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

describe('Plan-Tage mit eigenen Übungen und Stufe', () => {
  const ex = (n, extra = {}) => ({ exerciseId: `ex_${n}`, name: `Übung ${n}`, muscleGroup: 'Brust', sets: 3, ...extra })
  const ownDay = (n, exercises) => ({ id: `day_${n}`, label: `Tag ${n}`, type: 'push', goal: 'hypertrophy', exercises })

  test('Tag mit Übungen braucht keinen Favoriten', () => {
    const { value, error } = sanitizePlanPayload(body({ level: 'advanced', templateId: 'ppl3', days: [ownDay(1, [ex(1), ex(2)])] }))
    assert.equal(error, undefined)
    assert.equal(value.days[0].favoriteId, '')
    assert.equal(value.days[0].type, 'push')
    assert.deepEqual(value.days[0].exercises.map((e) => e.exerciseId), ['ex_1', 'ex_2'])
    assert.equal(value.level, 'advanced')
    assert.equal(value.templateId, 'ppl3')
  })

  test('Stufe: unbekannt oder fehlend -> beginner', () => {
    assert.equal(sanitizePlanPayload(body()).value.level, 'beginner')
    assert.equal(sanitizePlanPayload(body({ level: 'pro' })).value.level, 'beginner')
    assert.equal(sanitizePlanPayload(body({ level: { $ne: 1 } })).value.level, 'beginner')
  })

  test('Übungen: nur bekannte Felder, Sätze 1-10, höchstens 12, Ungültiges fällt weg, Texte bereinigt', () => {
    const many = Array.from({ length: 20 }, (_, i) => ex(i + 1))
    assert.equal(sanitizePlanPayload(body({ days: [ownDay(1, many)] })).value.days[0].exercises.length, PLAN_LIMITS.maxExercises)
    const { value } = sanitizePlanPayload(body({ days: [ownDay(1, [
      ex(1, { sets: 99, extra: 'x' }), ex(2, { sets: 0 }), ex(3, { sets: 'abc' }), { name: 'ohne id' }, ex(4, { name: '<b>Fett</b>\u0007' }), 'text'
    ])] }))
    const list = value.days[0].exercises
    assert.deepEqual(list.map((e) => e.sets), [10, 1, 3, 3])
    assert.equal('extra' in list[0], false)
    assert.equal(list[3].name, 'bFett/b')
  })

  test('Tag ohne Übungen und ohne Favorit ist ungültig', () => {
    assert.ok(sanitizePlanPayload(body({ days: [ownDay(1, [])] })).error)
    assert.ok(sanitizePlanPayload(body({ days: [ownDay(1, [{ name: 'x' }])] })).error)
  })

  test('Typ und Ziel: unbekannte Werte werden zu fullbody / hypertrophy', () => {
    const { value } = sanitizePlanPayload(body({ days: [{ ...ownDay(1, [ex(1)]), type: 'cardio', goal: 'x' }] }))
    assert.equal(value.days[0].type, 'fullbody')
    assert.equal(value.days[0].goal, 'hypertrophy')
  })
})
