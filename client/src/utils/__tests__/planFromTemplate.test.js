import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/trainingPlans', () => ({
  fetchTrainingPlansRemote: vi.fn().mockResolvedValue([]),
  pushTrainingPlanRemote: vi.fn().mockResolvedValue({}),
  deleteTrainingPlanRemote: vi.fn().mockResolvedValue(true)
}))
vi.mock('@/api/favoriteWorkouts', () => ({
  fetchFavoriteWorkoutsRemote: vi.fn().mockResolvedValue([]),
  pushFavoriteWorkoutRemote: vi.fn().mockResolvedValue({}),
  deleteFavoriteWorkoutRemote: vi.fn().mockResolvedValue(true)
}))
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null }) }))

import catalogJson from '@/data/default-exercises.json'
import { normalizeDefaultExercises } from '../normalizeDefaultExercises.js'
import { curateDefaultExercises } from '../exerciseCuration.js'
import { PLAN_TEMPLATES, PLAN_TEMPLATE_IDS, PLAN_TEMPLATE_LEVELS } from '../planTemplates.js'
import { createPlanFromTemplate, getAllFavorites, resolveTemplateDays } from '../planFromTemplate.js'
import { getTrainingPlans, createTrainingPlan } from '../trainingPlanStorage.js'
import { getFavoritesByType } from '../workoutFavorites.js'
import { equipmentKind } from '../exerciseSwaps.js'

// Wie in der App: gebündelter Katalog -> kuratiert -> normalisiert (defaultExercisesLoader.js).
const catalog = normalizeDefaultExercises(curateDefaultExercises(catalogJson, { enableCuration: true, enableExoticFilter: true }))
const labelFor = (key) => key
const base = (extra = {}) => ({
  userId: 'u1', templateId: 'ppl3', planName: 'PPL 3 Tage', favoritePrefix: 'PPL 3 Tage', labelFor, catalog, ...extra
})

const eachDay = (fn) => {
  for (const template of Object.values(PLAN_TEMPLATES)) {
    for (const day of template.days) for (const level of PLAN_TEMPLATE_LEVELS) fn(template, day, level, day.levels[level])
  }
}

describe('Vorlagen-Daten', () => {
  it('alle Übungen jeder Vorlage und Stufe gibt es im App-Katalog (nach Kuratierung und Normalisierung)', () => {
    const ids = new Set(catalog.map((entry) => entry._id))
    const missing = []
    eachDay((_t, _d, _l, list) => list.forEach((item) => { if (!ids.has(item.id)) missing.push(item.id) }))
    expect(missing).toEqual([])
  })

  it('Umfang: 4 Vorlagen mit 3 / 6 / 4 / 3 Tagen; je Tag 5 bis 6 Übungen mit 2 bis 4 Sätzen, zwei Stufen', () => {
    expect([...PLAN_TEMPLATE_IDS].sort()).toEqual(['fb3', 'ppl3', 'ppl6', 'ul4'])
    expect(PLAN_TEMPLATES.ppl3.days).toHaveLength(3)
    expect(PLAN_TEMPLATES.ppl6.days).toHaveLength(6)
    expect(PLAN_TEMPLATES.ul4.days).toHaveLength(4)
    expect(PLAN_TEMPLATES.fb3.days).toHaveLength(3)
    eachDay((_t, day, _l, list) => {
      expect(list.length).toBeGreaterThanOrEqual(5)
      expect(list.length).toBeLessThanOrEqual(6)
      list.forEach((item) => { expect(item.sets).toBeGreaterThanOrEqual(2); expect(item.sets).toBeLessThanOrEqual(4) })
      expect(['push', 'pull', 'legs', 'fullbody']).toContain(day.type)
      expect(day.labelKey).toBeTruthy()
    })
  })

  it('innerhalb eines Tages kommt keine Übung doppelt vor', () => {
    eachDay((_t, _d, _l, list) => {
      const ids = list.map((item) => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  it('Anfänger: überwiegend geführte Geräte (Maschine/Kabel/Smith), keine Lang- oder Kurzhantel-Grundübung', () => {
    const byId = new Map(catalog.map((entry) => [entry._id, entry]))
    eachDay((_t, _d, level, list) => {
      if (level !== 'beginner') return
      const kinds = list.map((item) => equipmentKind(byId.get(item.id)))
      expect(kinds.filter((k) => k === 'barbell' || k === 'dumbbell')).toEqual([])
      expect(kinds.filter((k) => k === 'machine' || k === 'cable' || k === 'smith').length).toBeGreaterThanOrEqual(Math.ceil(list.length / 2))
    })
  })

  it('Stufen unterscheiden sich: Fortgeschritten nutzt freie Gewichte, hat nie weniger Sätze insgesamt', () => {
    const byId = new Map(catalog.map((entry) => [entry._id, entry]))
    const total = (list) => list.reduce((sum, item) => sum + item.sets, 0)
    for (const template of Object.values(PLAN_TEMPLATES)) {
      for (const day of template.days) {
        expect(day.levels.beginner.map((i) => i.id)).not.toEqual(day.levels.advanced.map((i) => i.id))
        expect(total(day.levels.advanced)).toBeGreaterThanOrEqual(total(day.levels.beginner))
        expect(day.levels.advanced.some((item) => ['barbell', 'dumbbell'].includes(equipmentKind(byId.get(item.id))))).toBe(true)
      }
    }
  })
})

describe('createPlanFromTemplate', () => {
  beforeEach(() => {
    const data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k)
    })
  })

  it('legt nur einen Plan an - keine Favoriten (der Favoritenbereich gehört dem Nutzer)', () => {
    const result = createPlanFromTemplate(base())
    expect(result.ok).toBe(true)
    expect(getAllFavorites('u1')).toHaveLength(0)
    expect(getFavoritesByType('u1', 'push')).toHaveLength(0)
    expect(getTrainingPlans('u1')).toHaveLength(1)
  })

  it('Standard ist Anfänger; Tage enthalten ihre Übungen (englische Namen), Typ, Ziel und Sätze', () => {
    const { plan } = createPlanFromTemplate(base())
    expect(plan.level).toBe('beginner')
    expect(plan.templateId).toBe('ppl3')
    expect(plan.active).toBe(true)
    expect(plan.days.map((d) => d.label)).toEqual(['pushA', 'pullA', 'legsA'])
    expect(plan.days.map((d) => d.type)).toEqual(['push', 'pull', 'legs'])
    const push = plan.days[0]
    expect(push.favoriteId).toBe('')
    expect(push.goal).toBe('hypertrophy')
    expect(push.exercises).toHaveLength(5)
    expect(push.exercises[0]).toMatchObject({ exerciseId: 'ex_0577', name: 'lever chest press (weight stack)', sets: 3 })
    const names = new Set(catalog.map((entry) => entry.name_en))
    plan.days.forEach((day) => day.exercises.forEach((ex) => expect(names.has(ex.name)).toBe(true)))
  })

  it('Fortgeschritten: freie Gewichte, Stufe wird am Plan gespeichert', () => {
    const { plan } = createPlanFromTemplate(base({ level: 'advanced' }))
    expect(plan.level).toBe('advanced')
    expect(plan.days[0].exercises[0]).toMatchObject({ exerciseId: 'ex_0025', sets: 4 })
  })

  it('unbekannte Stufe -> Anfänger', () => {
    expect(createPlanFromTemplate(base({ level: 'pro' })).plan.level).toBe('beginner')
  })

  it('PPL 6 Tage, Ober-/Unterkörper und Ganzkörper: Tage und Typen', () => {
    expect(createPlanFromTemplate(base({ templateId: 'ppl6' })).plan.days).toHaveLength(6)
    const ul = createPlanFromTemplate(base({ userId: 'u2', templateId: 'ul4' })).plan
    expect(ul.days.map((d) => d.type)).toEqual(['fullbody', 'fullbody', 'fullbody', 'fullbody'])
  })

  it('Plan-Limit (3): es wird nichts angelegt', () => {
    for (let i = 0; i < 3; i += 1) createTrainingPlan({ userId: 'u1', name: `P${i}`, days: [{ favoriteId: `f${i}` }] })
    expect(createPlanFromTemplate(base())).toEqual({ ok: false, error: 'limit' })
    expect(getTrainingPlans('u1')).toHaveLength(3)
  })

  it('fehlende Übung im Katalog: Fehler, es wird nichts angelegt', () => {
    const partial = catalog.filter((entry) => entry._id !== 'ex_0577')
    const result = createPlanFromTemplate(base({ catalog: partial }))
    expect(result).toEqual({ ok: false, error: 'missingExercise', detail: 'ex_0577' })
    expect(getTrainingPlans('u1')).toEqual([])
  })

  it('unbekannte Vorlage', () => {
    expect(createPlanFromTemplate(base({ templateId: 'gibt-es-nicht' }))).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('resolveTemplateDays', () => {
  it('liefert je Tag aufgelöste Übungen samt Katalogeintrag; unbekannte Vorlage -> null', () => {
    const result = resolveTemplateDays({ templateId: 'fb3', level: 'advanced', catalog, labelFor })
    expect(result.missing).toEqual([])
    expect(result.days).toHaveLength(3)
    expect(result.days[0].exercises[0].entry.name_en).toBe(result.days[0].exercises[0].name)
    expect(resolveTemplateDays({ templateId: 'x', catalog })).toBeNull()
  })
})
