import { PLAN_LIMITS, cleanPlanText, normalizePlanExercises } from './trainingPlan'

// Eigener Plan (Absprache Paul 29.10.): freier Entwurf aus Name, Tagen und Übungen. Reine Funktionen auf einem Entwurf,
// damit sich Bauen und Bearbeiten ohne Oberfläche testen lässt. Entwurf:
//   { name, days: [{ id?, label, exercises: [{ exerciseId, name, muscleGroup, category?, sets }] }] }
// `id` (und lastDoneAt) bleiben beim Bearbeiten eines bestehenden Plans erhalten; `category` ist nur für die Tagesart gedacht.

export const DEFAULT_SETS = 3

export function emptyDraft() {
  return { name: '', days: [newDay()] }
}

export function newDay() {
  return { label: '', exercises: [] }
}

/** Entwurf aus einem bestehenden Plan (Tage mit Übungen; Favoriten-Tage ohne eigene Übungen bleiben leer). */
export function draftFromPlan(plan) {
  return {
    name: plan?.name || '',
    days: (plan?.days || []).map((day) => ({
      id: day.id,
      lastDoneAt: day.lastDoneAt || null,
      label: day.label || '',
      exercises: (day.exercises || []).map((ex) => ({ ...ex }))
    }))
  }
}

const clampSets = (value) => Math.min(PLAN_LIMITS.maxSets, Math.max(1, Math.floor(Number(value)) || DEFAULT_SETS))

/** Tagesart aus den Kategorien der Übungen: überwiegend Push/Pull/Legs, sonst Ganzkörper. */
export function deriveDayType(exercises) {
  const counts = { push: 0, pull: 0, legs: 0 }
  for (const ex of exercises || []) {
    const key = String(ex?.category || '').trim().toLowerCase()
    if (key in counts) counts[key] += 1
  }
  const total = (exercises || []).length
  const [type, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return total > 0 && count / total > 0.5 ? type : 'fullbody'
}

export function addDayTo(draft) {
  if (draft.days.length >= PLAN_LIMITS.maxDays) return draft
  return { ...draft, days: [...draft.days, newDay()] }
}

export function removeDayAt(draft, index) {
  if (draft.days.length <= 1 || index < 0 || index >= draft.days.length) return draft
  return { ...draft, days: draft.days.filter((_, i) => i !== index) }
}

function swap(list, from, to) {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export function moveDayBy(draft, index, direction) {
  return { ...draft, days: swap(draft.days, index, index + (direction < 0 ? -1 : 1)) }
}

export function setDayLabel(draft, index, label) {
  return { ...draft, days: draft.days.map((day, i) => (i === index ? { ...day, label: String(label ?? '').slice(0, PLAN_LIMITS.maxLabel) } : day)) }
}

/** Übungen anhängen (höchstens 12 je Tag, keine Doppelten). */
export function addExercisesTo(draft, dayIndex, entries) {
  return {
    ...draft,
    days: draft.days.map((day, i) => {
      if (i !== dayIndex) return day
      const known = new Set(day.exercises.map((ex) => ex.exerciseId))
      const added = []
      for (const entry of entries || []) {
        if (day.exercises.length + added.length >= PLAN_LIMITS.maxExercises) break
        const exerciseId = String(entry?.exerciseId || '').trim()
        if (!exerciseId || known.has(exerciseId)) continue
        known.add(exerciseId)
        added.push({ exerciseId, name: entry.name, muscleGroup: entry.muscleGroup || '', category: entry.category || '', sets: clampSets(entry.sets ?? DEFAULT_SETS) })
      }
      return added.length ? { ...day, exercises: [...day.exercises, ...added] } : day
    })
  }
}

export function removeExerciseAt(draft, dayIndex, exIndex) {
  return { ...draft, days: draft.days.map((day, i) => (i === dayIndex ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) } : day)) }
}

export function moveExerciseBy(draft, dayIndex, exIndex, direction) {
  return { ...draft, days: draft.days.map((day, i) => (i === dayIndex ? { ...day, exercises: swap(day.exercises, exIndex, exIndex + (direction < 0 ? -1 : 1)) } : day)) }
}

export function changeSets(draft, dayIndex, exIndex, delta) {
  return {
    ...draft,
    days: draft.days.map((day, i) => (i !== dayIndex ? day : {
      ...day,
      exercises: day.exercises.map((ex, j) => (j === exIndex ? { ...ex, sets: clampSets((Number(ex.sets) || DEFAULT_SETS) + delta) } : ex))
    }))
  }
}

/** @returns {{ ok: boolean, name: boolean, days: boolean, emptyDays: number[] }} welche Angaben fehlen */
export function validateDraft(draft) {
  const name = Boolean(cleanPlanText(draft?.name, PLAN_LIMITS.maxName))
  const days = Array.isArray(draft?.days) && draft.days.length > 0
  const emptyDays = (draft?.days || []).map((day, i) => (day.exercises?.length ? -1 : i)).filter((i) => i >= 0)
  return { ok: name && days && emptyDays.length === 0, name, days, emptyDays }
}

/** Plan-Eingabe für createTrainingPlan / updateTrainingPlan; ohne Tagesname heißt der Tag „Tag 1“ usw. */
export function draftToPlanInput(draft, dayFallback = (n) => `Day ${n}`) {
  return {
    name: cleanPlanText(draft.name, PLAN_LIMITS.maxName),
    days: draft.days.slice(0, PLAN_LIMITS.maxDays).map((day, i) => ({
      ...(day.id ? { id: day.id, lastDoneAt: day.lastDoneAt || null } : {}),
      label: cleanPlanText(day.label, PLAN_LIMITS.maxLabel) || dayFallback(i + 1),
      type: deriveDayType(day.exercises),
      goal: 'hypertrophy',
      exercises: normalizePlanExercises(day.exercises)
    }))
  }
}

/** Bearbeiteten Entwurf auf einen bestehenden Plan anwenden: Name und Tage ersetzen, der „nächste Tag“ bleibt, wenn es ihn noch gibt. */
export function applyDraftToPlan(plan, draft) {
  const input = draftToPlanInput(draft)
  const activeId = plan.days[plan.activeDayIndex]?.id
  const index = input.days.findIndex((day) => day.id && day.id === activeId)
  return { ...plan, name: input.name, days: input.days, activeDayIndex: index >= 0 ? index : 0 }
}
