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

import { createPlan, normalizePlan, replaceDayExercise, normalizePlanExercises, PLAN_LIMITS } from '../trainingPlan.js'
import { createTrainingPlan, getTrainingPlans } from '../trainingPlanStorage.js'
import { saveFavoriteWorkout, getFavoritesByType } from '../workoutFavorites.js'
import { getTodayPlanInfo, getPlanDayInfo, buildDayStartFavorite, planDayTitle } from '../planProgress.js'
import { replaceExerciseInPlanDay } from '../exerciseSwapApply.js'
import { migrateTemplateFavoritesToPlans, removeOrphanTemplateFavorites } from '../planMigration.js'

const ex = (n, extra = {}) => ({ exerciseId: `ex_${n}`, name: `exercise ${n}`, muscleGroup: 'Brust', sets: 3, ...extra })
const ownDay = (label, exercises = [ex(1), ex(2)]) => ({ label, type: 'push', goal: 'hypertrophy', exercises })

beforeEach(() => {
  const data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  })
})

describe('Plan mit eigenen Übungen und Stufe', () => {
  it('Tag mit Übungen braucht keinen Favoriten; Stufe und Vorlage werden gespeichert', () => {
    const plan = createPlan({ name: 'P', level: 'advanced', templateId: 'ppl3', days: [ownDay('Push A')] })
    expect(plan.level).toBe('advanced')
    expect(plan.templateId).toBe('ppl3')
    expect(plan.days[0].favoriteId).toBe('')
    expect(plan.days[0].exercises).toHaveLength(2)
  })

  it('Stufe unbekannt -> beginner; Tag ohne Übungen und ohne Favorit ist ungültig', () => {
    expect(createPlan({ name: 'P', level: 'pro', days: [ownDay('A')] }).level).toBe('beginner')
    expect(normalizePlan({ name: 'P', days: [{ label: 'x', exercises: [] }] })).toBeNull()
  })

  it('ältere Pläne mit Favoriten-Verweis bleiben gültig (Stufe beginner, keine Übungen)', () => {
    const plan = normalizePlan({ name: 'Alt', days: [{ id: 'd1', favoriteId: 'fav_1' }] })
    expect(plan.days[0].exercises).toEqual([])
    expect(plan.days[0].favoriteId).toBe('fav_1')
    expect(plan.level).toBe('beginner')
  })

  it('Übungen werden bereinigt: Felder, Sätze 1-10, höchstens 12, ungültige IDs fallen weg', () => {
    const list = normalizePlanExercises([ex(1, { sets: 99, evil: 1 }), ex(2, { sets: 0 }), { name: 'ohne id' }, ex(3, { exerciseId: '<x>' }), ex(4, { name: '<b>Fett</b>' })])
    expect(list.map((e) => e.sets)).toEqual([10, 1, 3])
    expect('evil' in list[0]).toBe(false)
    expect(list[2].name).toBe('bFett/b')
    expect(normalizePlanExercises(Array.from({ length: 30 }, (_, i) => ex(i + 1)))).toHaveLength(PLAN_LIMITS.maxExercises)
  })

  it('replaceDayExercise: ersetzt genau eine Übung, Satzanzahl bleibt, Rest unverändert', () => {
    const plan = createPlan({ name: 'P', days: [ownDay('Push A', [ex(1, { sets: 4 }), ex(2)])] })
    const dayId = plan.days[0].id
    const next = replaceDayExercise(plan, dayId, { exerciseId: 'ex_1', name: 'exercise 1' }, { exerciseId: 'ex_9', name: 'machine press', muscleGroup: 'Brust', sets: 99 })
    expect(next.days[0].exercises.map((e) => [e.exerciseId, e.sets])).toEqual([['ex_9', 4], ['ex_2', 3]])
    expect(replaceDayExercise(plan, dayId, { name: 'gibt es nicht' }, { exerciseId: 'ex_9', name: 'x' })).toBe(plan)
    expect(replaceDayExercise(plan, 'nope', ex(1), ex(9))).toBe(plan)
  })
})

describe('Tag starten und anzeigen', () => {
  it('Heute: Tag mit eigenen Übungen ist startbar, ohne dass es einen Favoriten gibt', () => {
    createTrainingPlan({ userId: 'u1', name: 'P', days: [ownDay('Push A')] })
    const info = getTodayPlanInfo('u1')
    expect(info.hasWorkout).toBe(true)
    expect(info.favorite).toBeNull()
    expect(info.exercises).toHaveLength(2)
    expect(planDayTitle(info)).toBe('Push A')
  })

  it('Favoriten-Tag: Übungen kommen vom Favoriten; gelöschter Favorit -> nicht startbar', () => {
    const fav = saveFavoriteWorkout({ userId: 'u1', type: 'push', name: 'Mein Push', workout: { name: 'Mein Push', type: 'push', exercises: [{ exerciseId: 'ex_1', name: 'x', muscleGroup: 'Brust', sets: 3 }] } }).favorite
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: fav.id }, { favoriteId: 'weg' }] })
    const plan = getTrainingPlans('u1')[0]
    expect(getPlanDayInfo('u1', plan.id, plan.days[0].id)).toMatchObject({ hasWorkout: true })
    expect(getPlanDayInfo('u1', plan.id, plan.days[1].id)).toMatchObject({ hasWorkout: false })
    expect(planDayTitle(getPlanDayInfo('u1', plan.id, plan.days[0].id))).toBe('Mein Push')
  })

  it('buildDayStartFavorite: Katalogübung wird voll gebaut (englischer Name, Sätze), sonst aus den Plan-Daten', () => {
    createTrainingPlan({ userId: 'u1', name: 'P', days: [ownDay('Push A', [ex(1, { sets: 4 }), ex(2)])] })
    const info = getTodayPlanInfo('u1')
    const catalog = [{ _id: 'ex_1', name: 'Deutscher Name', name_en: 'bench press', muscleGroup: 'Brust', imageUrl: 'i.jpg' }]
    const favorite = buildDayStartFavorite(info, catalog)
    expect(favorite.id).toBeNull()
    expect(favorite.type).toBe('push')
    expect(favorite.name).toBe('Push A')
    expect(favorite.workout.goal).toBe('hypertrophy')
    expect(favorite.workout.exercises[0]).toMatchObject({ exerciseId: 'ex_1', name: 'bench press', imageUrl: 'i.jpg', sets: 4 })
    expect(favorite.workout.exercises[0].setDetails).toHaveLength(4)
    expect(favorite.workout.exercises[1]).toMatchObject({ exerciseId: 'ex_2', name: 'exercise 2', sets: 3 })
  })

  it('buildDayStartFavorite: nicht startbarer Tag -> null', () => {
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: 'weg' }] })
    expect(buildDayStartFavorite(getTodayPlanInfo('u1'), [])).toBeNull()
  })
})

describe('replaceExerciseInPlanDay', () => {
  it('ändert den Plan-Tag, keinen Favoriten', () => {
    createTrainingPlan({ userId: 'u1', name: 'P', days: [ownDay('Push A')] })
    const plan = getTrainingPlans('u1')[0]
    const result = replaceExerciseInPlanDay({
      userId: 'u1', planId: plan.id, dayId: plan.days[0].id,
      oldExercise: { exerciseId: 'ex_1', name: 'exercise 1' },
      entry: { _id: 'ex_9', name_en: 'lever chest press', name: 'Brustpresse', muscleGroup: 'Brust' }
    })
    expect(result).toEqual({ ok: true })
    expect(getTrainingPlans('u1')[0].days[0].exercises.map((e) => e.name)).toEqual(['lever chest press', 'exercise 2'])
    expect(getFavoritesByType('u1', 'push')).toHaveLength(0)
  })

  it('Tag oder Übung nicht gefunden', () => {
    createTrainingPlan({ userId: 'u1', name: 'P', days: [ownDay('Push A')] })
    const plan = getTrainingPlans('u1')[0]
    expect(replaceExerciseInPlanDay({ userId: 'u1', planId: plan.id, dayId: 'nope', oldExercise: ex(1), entry: { _id: 'ex_9', name_en: 'x' } })).toEqual({ ok: false, error: 'dayNotFound' })
    expect(replaceExerciseInPlanDay({ userId: 'u1', planId: plan.id, dayId: plan.days[0].id, oldExercise: { name: 'andere' }, entry: { _id: 'ex_9', name_en: 'x' } })).toEqual({ ok: false, error: 'exerciseNotFound' })
  })
})

describe('Umstellung alter Vorlagen-Pläne', () => {
  const legacyFavorite = (name, type, exercises) => saveFavoriteWorkout({ userId: 'u1', type, name, workout: { name, type, goal: 'hypertrophy', exercises } }).favorite
  const legacyExercises = [{ exerciseId: 'ex_1', name: 'Deutscher Name', muscleGroup: 'Brust', sets: 4 }, { exerciseId: 'ex_2', name: 'zwei', muscleGroup: 'Trizeps', sets: 3 }]
  const catalog = [{ _id: 'ex_1', name_en: 'bench press barbell', name: 'Bankdrücken' }]

  it('Vorlagen-Favoriten wandern in den Plan und verschwinden aus den Favoriten; eigene bleiben', () => {
    const push = legacyFavorite('PPL 3 Tage Push A', 'push', legacyExercises)
    const pull = legacyFavorite('PPL 3 Tage Pull A', 'pull', legacyExercises)
    const own = legacyFavorite('Mein Push', 'push', legacyExercises)
    createTrainingPlan({ userId: 'u1', name: 'Push/Pull/Legs · 3 Tage', days: [{ favoriteId: push.id, label: 'Push A' }, { favoriteId: pull.id, label: 'Pull A' }, { favoriteId: own.id, label: 'Mein Push' }] })

    expect(migrateTemplateFavoritesToPlans({ userId: 'u1', catalog })).toEqual({ plans: 1, favoritesRemoved: 2 })
    const plan = getTrainingPlans('u1')[0]
    expect(plan.templateId).toBe('ppl3')
    expect(plan.level).toBe('advanced')
    expect(plan.days[0]).toMatchObject({ favoriteId: '', type: 'push', goal: 'hypertrophy' })
    expect(plan.days[0].exercises[0]).toMatchObject({ exerciseId: 'ex_1', name: 'bench press barbell', sets: 4 })
    expect(plan.days[1].type).toBe('pull')
    // eigener Favorit bleibt als Verweis erhalten
    expect(plan.days[2].favoriteId).toBe(own.id)
    expect(getFavoritesByType('u1', 'push').map((f) => f.name)).toEqual(['Mein Push'])
    expect(getFavoritesByType('u1', 'pull')).toHaveLength(0)
  })

  it('zweiter Lauf ändert nichts mehr', () => {
    const push = legacyFavorite('PPL 3 Tage Push A', 'push', legacyExercises)
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: push.id, label: 'Push A' }] })
    migrateTemplateFavoritesToPlans({ userId: 'u1', catalog })
    expect(migrateTemplateFavoritesToPlans({ userId: 'u1', catalog })).toEqual({ plans: 0, favoritesRemoved: 0 })
  })

  it('englische Namens-Präfixe werden erkannt; ein ähnlicher Name ohne genaues Muster nicht', () => {
    const en = legacyFavorite('Upper Lower Upper A', 'fullbody', legacyExercises)
    const similar = legacyFavorite('Upper Lower Upper A extra', 'fullbody', legacyExercises)
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: en.id, label: 'Upper A' }, { favoriteId: similar.id, label: 'Upper A' }] })
    expect(migrateTemplateFavoritesToPlans({ userId: 'u1', catalog })).toEqual({ plans: 1, favoritesRemoved: 1 })
    expect(getFavoritesByType('u1', 'fullbody').map((f) => f.name)).toEqual(['Upper Lower Upper A extra'])
  })

  it('Tag ohne Bezeichnung wird nie umgestellt (Schutz selbst angelegter Favoriten)', () => {
    const fav = legacyFavorite('Ganzkörper ', 'fullbody', legacyExercises)
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: fav.id }] })
    expect(migrateTemplateFavoritesToPlans({ userId: 'u1', catalog })).toEqual({ plans: 0, favoritesRemoved: 0 })
    expect(getFavoritesByType('u1', 'fullbody')).toHaveLength(1)
  })
})

describe('Übrig gebliebene Vorlagen-Favoriten', () => {
  const fav = (name, type = 'push') => saveFavoriteWorkout({ userId: 'u1', type, name, workout: { name, type, exercises: [{ exerciseId: 'ex_1', name: 'x', sets: 3 }] } }).favorite
  const labels = ['Push A', 'Pull A', 'Ganzkörper A', 'Full body A']

  it('entfernt Vorlagen-Favoriten ohne Plan, lässt eigene und genutzte unberührt', () => {
    fav('PPL 3 Tage Push A')
    fav('Ganzkörper Ganzkörper A', 'fullbody')
    fav('Full body Full body A', 'fullbody')
    fav('Mein Push')
    fav('PPL 3 Tage Push A extra')
    const used = fav('PPL 6 Tage Pull A', 'pull')
    createTrainingPlan({ userId: 'u1', name: 'P', days: [{ favoriteId: used.id, label: 'Pull A' }] })

    expect(removeOrphanTemplateFavorites({ userId: 'u1', dayLabels: [...labels, 'Ganzkörper A', 'Full body A'] })).toBe(3)
    expect(getFavoritesByType('u1', 'push').map((f) => f.name).sort()).toEqual(['Mein Push', 'PPL 3 Tage Push A extra'])
    expect(getFavoritesByType('u1', 'fullbody')).toHaveLength(0)
    expect(getFavoritesByType('u1', 'pull').map((f) => f.name)).toEqual(['PPL 6 Tage Pull A'])
  })

  it('ohne Tagbezeichnungen oder ohne Favoriten passiert nichts', () => {
    fav('PPL 3 Tage Push A')
    expect(removeOrphanTemplateFavorites({ userId: 'u1', dayLabels: [] })).toBe(0)
    expect(removeOrphanTemplateFavorites({ userId: 'u2', dayLabels: labels })).toBe(0)
    expect(getFavoritesByType('u1', 'push')).toHaveLength(1)
  })
})
