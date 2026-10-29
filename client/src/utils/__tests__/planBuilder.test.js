import { describe, it, expect } from 'vitest'
import {
  emptyDraft, draftFromPlan, deriveDayType, addDayTo, removeDayAt, moveDayBy, setDayLabel, addExercisesTo, removeExerciseAt,
  moveExerciseBy, changeSets, validateDraft, draftToPlanInput, applyDraftToPlan
} from '../planBuilder.js'
import { createPlan, PLAN_LIMITS } from '../trainingPlan.js'

const ex = (n, extra = {}) => ({ exerciseId: `ex_${n}`, name: `exercise ${n}`, muscleGroup: 'Brust', category: 'Push', ...extra })

describe('Plan-Entwurf', () => {
  it('Start: leerer Entwurf mit einem Tag', () => {
    expect(emptyDraft()).toEqual({ name: '', days: [{ label: '', exercises: [] }] })
  })

  it('Tage: höchstens 7, mindestens 1, verschieben und benennen (Name gekürzt)', () => {
    let d = emptyDraft()
    for (let i = 0; i < 10; i += 1) d = addDayTo(d)
    expect(d.days).toHaveLength(PLAN_LIMITS.maxDays)
    expect(removeDayAt(emptyDraft(), 0).days).toHaveLength(1)
    d = setDayLabel(emptyDraft(), 0, 'x'.repeat(50))
    expect(d.days[0].label).toHaveLength(PLAN_LIMITS.maxLabel)
    let two = addDayTo(setDayLabel(emptyDraft(), 0, 'A'))
    two = setDayLabel(two, 1, 'B')
    expect(moveDayBy(two, 1, -1).days.map((x) => x.label)).toEqual(['B', 'A'])
    expect(moveDayBy(two, 0, -1).days.map((x) => x.label)).toEqual(['A', 'B'])
    expect(removeDayAt(two, 0).days.map((x) => x.label)).toEqual(['B'])
  })

  it('Übungen: anhängen ohne Doppelte, höchstens 12, Sätze 1-10, verschieben, entfernen', () => {
    let d = addExercisesTo(emptyDraft(), 0, [ex(1), ex(1), ex(2, { sets: 99 }), { name: 'ohne id' }])
    expect(d.days[0].exercises.map((e) => [e.exerciseId, e.sets])).toEqual([['ex_1', 3], ['ex_2', 10]])
    d = addExercisesTo(d, 0, Array.from({ length: 20 }, (_, i) => ex(i + 10)))
    expect(d.days[0].exercises).toHaveLength(PLAN_LIMITS.maxExercises)
    d = moveExerciseBy(d, 0, 1, -1)
    expect(d.days[0].exercises[0].exerciseId).toBe('ex_2')
    d = removeExerciseAt(d, 0, 0)
    expect(d.days[0].exercises[0].exerciseId).toBe('ex_1')
    d = changeSets(d, 0, 0, -5)
    expect(d.days[0].exercises[0].sets).toBe(1)
    d = changeSets(d, 0, 0, 20)
    expect(d.days[0].exercises[0].sets).toBe(PLAN_LIMITS.maxSets)
  })

  it('Prüfung: Name, mindestens ein Tag, jeder Tag mit Übungen', () => {
    expect(validateDraft(emptyDraft())).toEqual({ ok: false, name: false, days: true, emptyDays: [0] })
    let d = { ...addExercisesTo(emptyDraft(), 0, [ex(1)]), name: ' Mein Plan ' }
    expect(validateDraft(d).ok).toBe(true)
    d = addDayTo(d)
    expect(validateDraft(d)).toMatchObject({ ok: false, emptyDays: [1] })
    expect(validateDraft({ name: '   ', days: [] })).toMatchObject({ ok: false, name: false, days: false })
  })

  it('Tagesart: überwiegend Push/Pull/Legs, sonst Ganzkörper', () => {
    expect(deriveDayType([ex(1), ex(2), ex(3, { category: 'Pull' })])).toBe('push')
    expect(deriveDayType([ex(1, { category: 'Legs' }), ex(2, { category: 'Legs' })])).toBe('legs')
    expect(deriveDayType([ex(1), ex(2, { category: 'Pull' })])).toBe('fullbody')
    expect(deriveDayType([ex(1, { category: 'Core' })])).toBe('fullbody')
    expect(deriveDayType([])).toBe('fullbody')
  })

  it('Plan-Eingabe: gültig für createPlan, ohne Hilfsfelder, mit Ersatzname für Tage', () => {
    const d = { name: '  Mein <b>Plan</b> ', days: [{ label: '', exercises: [ex(1), ex(2)] }, { label: 'Beine', exercises: [ex(3, { category: 'Legs' })] }] }
    const input = draftToPlanInput(d, (n) => `Tag ${n}`)
    expect(input.name).toBe('Mein bPlan/b')
    expect(input.days.map((day) => day.label)).toEqual(['Tag 1', 'Beine'])
    expect(input.days.map((day) => day.type)).toEqual(['push', 'legs'])
    expect('category' in input.days[0].exercises[0]).toBe(false)
    const plan = createPlan(input)
    expect(plan.days).toHaveLength(2)
    expect(plan.templateId).toBe('')
  })

  it('Bearbeiten: Tag-IDs und „zuletzt trainiert“ bleiben erhalten', () => {
    const plan = createPlan({ name: 'P', days: [{ label: 'A', type: 'push', goal: 'hypertrophy', exercises: [ex(1)], lastDoneAt: '2026-10-01T10:00:00.000Z' }] })
    const draft = addExercisesTo(draftFromPlan(plan), 0, [ex(2)])
    const input = draftToPlanInput(draft)
    expect(input.days[0].id).toBe(plan.days[0].id)
    expect(input.days[0].lastDoneAt).toBe('2026-10-01T10:00:00.000Z')
    expect(input.days[0].exercises.map((e) => e.exerciseId)).toEqual(['ex_1', 'ex_2'])
  })

  it('Bearbeiten anwenden: Name/Tage ersetzt, nächster Tag bleibt erhalten, gelöschter nächster Tag -> erster', () => {
    const plan = createPlan({ name: 'P', days: [{ label: 'A', exercises: [ex(1)] }, { label: 'B', exercises: [ex(2)] }, { label: 'C', exercises: [ex(3)] }] })
    const next = { ...plan, activeDayIndex: 2 }
    let draft = draftFromPlan(next)
    draft = { ...draft, name: 'Neu' }
    draft = removeDayAt(draft, 0)
    const applied = applyDraftToPlan(next, draft)
    expect(applied.name).toBe('Neu')
    expect(applied.days.map((d) => d.label)).toEqual(['B', 'C'])
    expect(applied.activeDayIndex).toBe(1)
    const removedActive = applyDraftToPlan(next, removeDayAt(draftFromPlan(next), 2))
    expect(removedActive.activeDayIndex).toBe(0)
  })
})
