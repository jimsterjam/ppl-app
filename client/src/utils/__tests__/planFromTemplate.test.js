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
import { PLAN_TEMPLATES, PLAN_TEMPLATE_IDS } from '../planTemplates.js'
import { createPlanFromTemplate, getAllFavorites } from '../planFromTemplate.js'
import { getTrainingPlans, createTrainingPlan } from '../trainingPlanStorage.js'
import { getFavoritesByType, saveFavoriteWorkout } from '../workoutFavorites.js'

// Wie in der App: gebündelter Katalog -> kuratiert -> normalisiert (defaultExercisesLoader.js).
const catalog = normalizeDefaultExercises(curateDefaultExercises(catalogJson, { enableCuration: true, enableExoticFilter: true }))
const labelFor = (key) => key
const base = (extra = {}) => ({
  userId: 'u1', templateId: 'ppl3', planName: 'PPL 3 Tage', favoritePrefix: 'PPL 3 Tage', labelFor, catalog, ...extra
})

describe('Vorlagen-Daten', () => {
  it('alle Übungen jeder Vorlage gibt es im App-Katalog (nach Kuratierung und Normalisierung)', () => {
    const ids = new Set(catalog.map((entry) => entry._id))
    const missing = []
    for (const template of Object.values(PLAN_TEMPLATES)) {
      for (const day of template.days) for (const item of day.exercises) if (!ids.has(item.id)) missing.push(item.id)
    }
    expect(missing).toEqual([])
  })

  it('Umfang: 4 Vorlagen mit 3 / 6 / 4 / 3 Tagen, je Tag 5 bis 6 Übungen und 2 bis 4 Sätze', () => {
    expect([...PLAN_TEMPLATE_IDS].sort()).toEqual(['fb3', 'ppl3', 'ppl6', 'ul4'])
    expect(PLAN_TEMPLATES.ppl3.days).toHaveLength(3)
    expect(PLAN_TEMPLATES.ppl6.days).toHaveLength(6)
    expect(PLAN_TEMPLATES.ul4.days).toHaveLength(4)
    expect(PLAN_TEMPLATES.fb3.days).toHaveLength(3)
    for (const template of Object.values(PLAN_TEMPLATES)) {
      for (const day of template.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(5)
        expect(day.exercises.length).toBeLessThanOrEqual(6)
        day.exercises.forEach((item) => { expect(item.sets).toBeGreaterThanOrEqual(2); expect(item.sets).toBeLessThanOrEqual(4) })
        expect(['push', 'pull', 'legs', 'fullbody']).toContain(day.type)
        expect(day.labelKey).toBeTruthy()
      }
    }
  })

  it('innerhalb eines Tages kommt keine Übung doppelt vor', () => {
    for (const template of Object.values(PLAN_TEMPLATES)) {
      for (const day of template.days) {
        const ids = day.exercises.map((item) => item.id)
        expect(new Set(ids).size).toBe(ids.length)
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

  it('Übungsnamen in den Favoriten sind englisch (Katalog-name_en), nicht der deutsche Katalogname', () => {
    createPlanFromTemplate(base())
    const names = new Set(catalog.map((entry) => entry.name_en))
    const stored = getFavoritesByType('u1', 'push')[0].workout.exercises.map((ex) => ex.name)
    expect(stored.length).toBeGreaterThan(0)
    stored.forEach((name) => expect(names.has(name)).toBe(true))
  })

  it('legt Plan und je Tag einen Favoriten an (Ziel Muskelaufbau, Typ je Tag, Sätze wie in der Vorlage)', () => {
    const result = createPlanFromTemplate(base())
    expect(result.ok).toBe(true)
    expect(result.plan.active).toBe(true)
    expect(result.plan.days.map((d) => d.label)).toEqual(['pushA', 'pullA', 'legsA'])
    expect(getFavoritesByType('u1', 'push')).toHaveLength(1)
    expect(getFavoritesByType('u1', 'pull')).toHaveLength(1)
    expect(getFavoritesByType('u1', 'legs')).toHaveLength(1)
    const push = result.favorites[0]
    expect(push.name).toBe('PPL 3 Tage pushA')
    expect(push.workout.goal).toBe('hypertrophy')
    expect(push.workout.exercises).toHaveLength(5)
    expect(push.workout.exercises[0].sets).toBe(4)
    expect(push.workout.exercises[0].setDetails).toHaveLength(4)
    // Plan-Tage verweisen auf genau diese Favoriten
    expect(result.plan.days.map((d) => d.favoriteId)).toEqual(result.favorites.map((f) => f.id))
    expect(getAllFavorites('u1')).toHaveLength(3)
  })

  it('PPL 6 Tage: 6 Favoriten (je 2 Push/Pull/Legs); Ober-/Unterkörper und Ganzkörper als Ganzkörper-Favoriten', () => {
    expect(createPlanFromTemplate(base({ templateId: 'ppl6' })).ok).toBe(true)
    expect(getFavoritesByType('u1', 'push')).toHaveLength(2)
    expect(createPlanFromTemplate(base({ userId: 'u2', templateId: 'ul4' })).ok).toBe(true)
    expect(getFavoritesByType('u2', 'fullbody')).toHaveLength(4)
  })

  it('Plan-Limit (3): kein Favorit wird angelegt', () => {
    for (let i = 0; i < 3; i += 1) createTrainingPlan({ userId: 'u1', name: `P${i}`, days: [{ favoriteId: `f${i}` }] })
    expect(createPlanFromTemplate(base())).toEqual({ ok: false, error: 'limit' })
    expect(getAllFavorites('u1')).toHaveLength(0)
  })

  it('Favoriten-Limit (10 je Art): Fehler und Rollback - es bleibt nichts Halbes zurück', () => {
    for (let i = 0; i < 10; i += 1) {
      saveFavoriteWorkout({ userId: 'u1', type: 'legs', name: `Beine ${i}`, workout: { exercises: [{ name: 'x', sets: 3 }] } })
    }
    const before = getAllFavorites('u1').length
    const result = createPlanFromTemplate(base())
    expect(result).toMatchObject({ ok: false, error: 'favoriteLimit' })
    expect(getAllFavorites('u1')).toHaveLength(before)
    expect(getTrainingPlans('u1')).toEqual([])
  })

  it('fehlende Übung im Katalog: Fehler, es wird nichts angelegt', () => {
    const partial = catalog.filter((entry) => entry._id !== 'ex_0025')
    const result = createPlanFromTemplate(base({ catalog: partial }))
    expect(result).toEqual({ ok: false, error: 'missingExercise', detail: 'ex_0025' })
    expect(getAllFavorites('u1')).toHaveLength(0)
  })

  it('unbekannte Vorlage', () => {
    expect(createPlanFromTemplate(base({ templateId: 'gibt-es-nicht' }))).toEqual({ ok: false, error: 'unknown' })
  })
})
