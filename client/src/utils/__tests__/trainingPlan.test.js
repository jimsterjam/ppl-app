import { describe, it, expect } from 'vitest'
import {
  PLAN_LIMITS,
  addDay,
  canCreatePlan,
  cleanPlanText,
  completeDay,
  createPlan,
  ensureSingleActive,
  findPlansUsingFavorite,
  getActiveDay,
  getActivePlan,
  mergePlans,
  moveDay,
  normalizePlan,
  removeDay,
  removeFavoriteFromPlan,
  renameDay,
  renamePlan,
  selectDay,
  setActivePlan,
  skipActiveDay
} from '../trainingPlan.js'

const T0 = '2026-10-20T10:00:00.000Z'
const T1 = '2026-10-21T10:00:00.000Z'
const T2 = '2026-10-22T10:00:00.000Z'

function ppl(extra = {}) {
  return createPlan({
    name: 'PPL 3x',
    days: [
      { favoriteId: 'fav_push', label: 'Push A' },
      { favoriteId: 'fav_pull', label: 'Pull A' },
      { favoriteId: 'fav_legs', label: 'Legs A' }
    ],
    ...extra
  }, T0)
}
const dayId = (plan, i) => plan.days[i].id

describe('createPlan / normalizePlan', () => {
  it('legt einen Plan mit Tagen an, Start bei Tag 1', () => {
    const plan = ppl()
    expect(plan.days).toHaveLength(3)
    expect(plan.activeDayIndex).toBe(0)
    expect(plan.active).toBe(false)
    expect(plan.days.every((d) => d.id && d.lastDoneAt === null)).toBe(true)
  })

  it('ohne Namen oder ohne gültigen Tag: kein Plan', () => {
    expect(createPlan({ name: '  ', days: [{ favoriteId: 'f' }] })).toBeNull()
    expect(createPlan({ name: 'X', days: [] })).toBeNull()
    expect(createPlan({ name: 'X', days: [{ label: 'ohne Favorit' }] })).toBeNull()
    expect(normalizePlan(null)).toBeNull()
  })

  it('Texte: Steuerzeichen und < > raus, gekürzt; höchstens 7 Tage; doppelte Tag-IDs fallen weg', () => {
    const plan = normalizePlan({
      name: `<i>${'N'.repeat(80)}</i>\u0007`,
      days: Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, favoriteId: `f${i}`, label: `L${'x'.repeat(50)}` }))
    })
    expect(plan.name).not.toMatch(/[<>]/)
    expect([...plan.name].every((ch) => ch.charCodeAt(0) >= 32)).toBe(true)
    expect(Array.from(plan.name)).toHaveLength(PLAN_LIMITS.maxName)
    expect(plan.days).toHaveLength(PLAN_LIMITS.maxDays)
    expect(Array.from(plan.days[0].label)).toHaveLength(PLAN_LIMITS.maxLabel)
    const dup = normalizePlan({ name: 'X', days: [{ id: 'a', favoriteId: 'f1' }, { id: 'a', favoriteId: 'f2' }] })
    expect(dup.days).toHaveLength(1)
  })

  it('activeDayIndex außerhalb der Tage wird auf 0 gesetzt, ungültige Daten werden null', () => {
    expect(normalizePlan({ name: 'X', days: [{ favoriteId: 'f' }], activeDayIndex: 5 }).activeDayIndex).toBe(0)
    const plan = normalizePlan({ name: 'X', days: [{ favoriteId: 'f', lastDoneAt: 'kaputt' }] })
    expect(plan.days[0].lastDoneAt).toBeNull()
  })

  it('cleanPlanText kürzt nach Zeichen, nicht nach Bytes (Emojis bleiben ganz)', () => {
    expect(cleanPlanText('💪'.repeat(30), 24)).toBe('💪'.repeat(24))
  })
})

describe('Rotation: completeDay / skipActiveDay / selectDay', () => {
  it('nach dem Training rückt der Plan zum nächsten Tag vor und merkt den Zeitpunkt', () => {
    const plan = ppl()
    const next = completeDay(plan, dayId(plan, 0), T1, T1)
    expect(getActiveDay(next).label).toBe('Pull A')
    expect(next.days[0].lastDoneAt).toBe(T1)
    expect(next.updatedAt).toBe(T1)
  })

  it('nach dem letzten Tag geht es wieder von vorn los', () => {
    let plan = ppl()
    for (let i = 0; i < 3; i += 1) plan = completeDay(plan, getActiveDay(plan).id, T1, T1)
    expect(getActiveDay(plan).label).toBe('Push A')
    expect(plan.days.every((d) => d.lastDoneAt === T1)).toBe(true)
  })

  it('anderen Tag gewählt und trainiert: weiter geht es mit dem Tag danach', () => {
    const plan = ppl()
    const chosen = selectDay(plan, dayId(plan, 2), T1)
    expect(getActiveDay(chosen).label).toBe('Legs A')
    const done = completeDay(chosen, dayId(plan, 2), T2, T2)
    expect(getActiveDay(done).label).toBe('Push A')
    // Tag 1 wurde nie trainiert
    expect(done.days[0].lastDoneAt).toBeNull()
  })

  it('Überspringen rückt vor, ohne den Tag als trainiert zu merken; am Ende wieder zum ersten', () => {
    let plan = ppl()
    plan = skipActiveDay(plan, T1)
    expect(getActiveDay(plan).label).toBe('Pull A')
    expect(plan.days[0].lastDoneAt).toBeNull()
    plan = skipActiveDay(skipActiveDay(plan, T1), T1)
    expect(getActiveDay(plan).label).toBe('Push A')
  })

  it('Plan mit nur einem Tag bleibt auf diesem Tag', () => {
    const plan = createPlan({ name: 'Solo', days: [{ favoriteId: 'f' }] }, T0)
    expect(getActiveDay(completeDay(plan, plan.days[0].id, T1, T1)).favoriteId).toBe('f')
    expect(skipActiveDay(plan).activeDayIndex).toBe(0)
  })

  it('unbekannter Tag (z. B. gelöscht): Plan bleibt unverändert', () => {
    const plan = ppl()
    expect(completeDay(plan, 'gibt-es-nicht', T1, T1)).toBe(plan)
    expect(selectDay(plan, 'gibt-es-nicht', T1)).toBe(plan)
  })
})

describe('Tage ändern', () => {
  it('Tag hinzufügen, Tageslimit 7, ohne Favorit nicht möglich', () => {
    let plan = ppl()
    plan = addDay(plan, { favoriteId: 'fav_extra', label: 'Extra' }, T1)
    expect(plan.days).toHaveLength(4)
    expect(addDay(plan, { label: 'ohne' }, T1)).toBeNull()
    for (let i = 0; i < 3; i += 1) plan = addDay(plan, { favoriteId: `f${i}` }, T1)
    expect(plan.days).toHaveLength(PLAN_LIMITS.maxDays)
    expect(addDay(plan, { favoriteId: 'zu-viel' }, T1)).toBeNull()
  })

  it('Tag entfernen: aktueller Tag bleibt sinnvoll; der letzte Tag lässt sich nicht entfernen', () => {
    const plan = selectDay(ppl(), dayId(ppl(), 0), T1)
    const base = ppl()
    // aktiver Tag = 2 (Index 1); davor wird einer entfernt -> aktiver Tag bleibt derselbe Tag
    const active1 = selectDay(base, dayId(base, 1), T1)
    const removedBefore = removeDay(active1, dayId(base, 0), T2)
    expect(getActiveDay(removedBefore).label).toBe('Pull A')
    // der aktive Tag selbst wird entfernt -> der folgende Tag rückt nach
    const removedActive = removeDay(active1, dayId(base, 1), T2)
    expect(getActiveDay(removedActive).label).toBe('Legs A')
    // aktiver Tag ist der letzte und wird entfernt -> zurück zum ersten
    const last = selectDay(base, dayId(base, 2), T1)
    expect(getActiveDay(removeDay(last, dayId(base, 2), T2)).label).toBe('Push A')
    const solo = createPlan({ name: 'Solo', days: [{ favoriteId: 'f' }] })
    expect(removeDay(solo, solo.days[0].id)).toBeNull()
    expect(plan).toBeTruthy()
  })

  it('Tag verschieben: der aktuelle Tag bleibt derselbe Tag; an den Rändern passiert nichts', () => {
    const base = selectDay(ppl(), dayId(ppl(), 0), T0)
    const plan = ppl()
    const moved = moveDay(plan, dayId(plan, 0), 1, T1)
    expect(moved.days.map((d) => d.label)).toEqual(['Pull A', 'Push A', 'Legs A'])
    expect(getActiveDay(moved).label).toBe('Push A')
    expect(moveDay(plan, dayId(plan, 0), -1, T1)).toBe(plan)
    expect(moveDay(plan, dayId(plan, 2), 1, T1)).toBe(plan)
    expect(base).toBeTruthy()
  })

  it('Umbenennen: leere Namen werden ignoriert, Tage lassen sich leeren (dann zählt der Favoritenname)', () => {
    const plan = ppl()
    expect(renamePlan(plan, '   ', T1)).toBe(plan)
    expect(renamePlan(plan, ' Neuer Name ', T1).name).toBe('Neuer Name')
    expect(renameDay(plan, dayId(plan, 0), '', T1).days[0].label).toBe('')
    expect(renameDay(plan, 'x', 'Y', T1)).toBe(plan)
  })
})

describe('Favorit gelöscht', () => {
  it('findPlansUsingFavorite findet betroffene Pläne', () => {
    const a = ppl()
    const b = createPlan({ name: 'Anderer', days: [{ favoriteId: 'fav_x' }] })
    expect(findPlansUsingFavorite([a, b], 'fav_pull')).toEqual([a])
    expect(findPlansUsingFavorite([a, b], 'nix')).toEqual([])
  })

  it('Tag des Favoriten fällt weg; war es der aktuelle Tag, rückt der folgende nach', () => {
    const base = ppl()
    const active = selectDay(base, dayId(base, 1), T1)
    const result = removeFavoriteFromPlan(active, 'fav_pull', T2)
    expect(result.days.map((d) => d.label)).toEqual(['Push A', 'Legs A'])
    expect(getActiveDay(result).label).toBe('Legs A')
  })

  it('Favorit vor dem aktuellen Tag entfernt: aktueller Tag bleibt derselbe; Favorit im letzten Tag: zurück zum ersten', () => {
    const base = ppl()
    const active = selectDay(base, dayId(base, 1), T1)
    expect(getActiveDay(removeFavoriteFromPlan(active, 'fav_push', T2)).label).toBe('Pull A')
    const last = selectDay(base, dayId(base, 2), T1)
    expect(getActiveDay(removeFavoriteFromPlan(last, 'fav_legs', T2)).label).toBe('Pull A')
  })

  it('betrifft der Favorit alle Tage: null (Plan wird gelöscht); nicht enthalten: unverändert', () => {
    const solo = createPlan({ name: 'Solo', days: [{ favoriteId: 'f' }] })
    expect(removeFavoriteFromPlan(solo, 'f', T1)).toBeNull()
    const plan = ppl()
    expect(removeFavoriteFromPlan(plan, 'nix', T1)).toBe(plan)
  })
})

describe('mehrere Pläne', () => {
  it('canCreatePlan: höchstens 3', () => {
    expect(canCreatePlan([1, 2])).toBe(true)
    expect(canCreatePlan([1, 2, 3])).toBe(false)
  })

  it('ensureSingleActive: genau einer aktiv (der zuletzt geänderte), bei keinem der zuletzt geänderte', () => {
    const a = { ...ppl(), id: 'a', active: true, updatedAt: T0 }
    const b = { ...ppl(), id: 'b', active: true, updatedAt: T2 }
    const c = { ...ppl(), id: 'c', active: false, updatedAt: T1 }
    const both = ensureSingleActive([a, b, c])
    expect(both.filter((p) => p.active).map((p) => p.id)).toEqual(['b'])
    const none = ensureSingleActive([{ ...a, active: false }, { ...c }])
    expect(none.filter((p) => p.active).map((p) => p.id)).toEqual(['c'])
    expect(ensureSingleActive([])).toEqual([])
  })

  it('setActivePlan wechselt den aktiven Plan; unbekannte ID ändert nichts', () => {
    const a = { ...ppl(), id: 'a', active: true }
    const b = { ...ppl(), id: 'b', active: false }
    const next = setActivePlan([a, b], 'b', T2)
    expect(getActivePlan(next).id).toBe('b')
    expect(next[0].active).toBe(false)
    const plans = [a, b]
    expect(setActivePlan(plans, 'x', T2)).toBe(plans)
  })

  it('mergePlans: je Plan gewinnt der neuere Stand, höchstens 3 Pläne, genau einer aktiv', () => {
    const local = [{ ...ppl(), id: 'a', name: 'Alt', updatedAt: T0, active: true }]
    const remote = [
      { ...ppl(), id: 'a', name: 'Neu vom Server', updatedAt: T2, active: false },
      { ...ppl(), id: 'b', updatedAt: T1 },
      { ...ppl(), id: 'c', updatedAt: T1 },
      { ...ppl(), id: 'd', updatedAt: T0 }
    ]
    const merged = mergePlans(local, remote)
    expect(merged).toHaveLength(3)
    expect(merged.find((p) => p.id === 'a').name).toBe('Neu vom Server')
    expect(merged.some((p) => p.id === 'd')).toBe(false)
    expect(merged.filter((p) => p.active)).toHaveLength(1)
  })

  it('mergePlans ignoriert ungültige Einträge', () => {
    expect(mergePlans([{ nonsense: true }, null], [{ name: '', days: [] }])).toEqual([])
  })
})
