import { PLAN_TEMPLATES, PLAN_TEMPLATE_GOAL, PLAN_TEMPLATE_LEVELS, DEFAULT_PLAN_LEVEL } from './planTemplates'
import { getFavoritesByType } from './workoutFavorites'
import { createTrainingPlan, getTrainingPlans } from './trainingPlanStorage'
import { canCreatePlan, normalizePlanLevel } from './trainingPlan'

// Plan aus einer Vorlage anlegen (Absprache Paul 28.10.): die Übungen jedes Trainingstages werden direkt im Plan
// gespeichert, es entstehen keine Favoriten (der Favoritenbereich bleibt das, was der Nutzer selbst ablegt).

const FAVORITE_TYPES = ['push', 'pull', 'legs', 'fullbody']

/** Alle Favoriten des Nutzers über alle Arten hinweg. */
export function getAllFavorites(userId) {
  return FAVORITE_TYPES.flatMap((type) => getFavoritesByType(userId, type))
}

/** Übung für den Favoriten: Katalogeintrag plus Sätze. Wiederholungen/Gewicht wie bei jedem neuen Favoriten (10 / 0 kg). */
export function buildTemplateExercise(entry, sets) {
  const count = Math.max(1, Number(sets) || 3)
  return {
    ...entry,
    // Übungsnamen werden immer englisch gespeichert (Katalogfeld `name` ist deutsch).
    name: entry.name_en || entry.name,
    exerciseId: entry._id,
    sets: count,
    reps: 10,
    weight: 0,
    rest: 90,
    setDetails: Array.from({ length: count }, () => ({ reps: 10, weight: 0 }))
  }
}

/** Übungen einer Vorlage in einer Stufe, aufgelöst gegen den Katalog. `missing` nennt IDs, die der Katalog nicht kennt. */
export function resolveTemplateDays({ templateId, level, catalog, labelFor = (key) => key }) {
  const template = PLAN_TEMPLATES[templateId]
  if (!template) return null
  const stage = PLAN_TEMPLATE_LEVELS.includes(level) ? level : DEFAULT_PLAN_LEVEL
  const byId = new Map((Array.isArray(catalog) ? catalog : []).map((entry) => [entry._id, entry]))
  const missing = []
  const days = template.days.map((day) => ({
    labelKey: day.labelKey,
    label: labelFor(day.labelKey),
    type: day.type,
    goal: PLAN_TEMPLATE_GOAL,
    exercises: day.levels[stage].map((item) => {
      const entry = byId.get(item.id)
      if (!entry) { missing.push(item.id); return null }
      return { exerciseId: entry._id, name: entry.name_en || entry.name, muscleGroup: entry.muscleGroup || '', sets: item.sets, entry }
    }).filter(Boolean)
  }))
  return { days, missing }
}

/**
 * @param {object} options
 * @param {string} options.userId
 * @param {string} options.templateId - Schlüssel in PLAN_TEMPLATES
 * @param {'beginner'|'advanced'} [options.level] - Standard: Anfänger
 * @param {string} options.planName - Name des Plans (App-Sprache)
 * @param {(labelKey: string) => string} options.labelFor - Tagbezeichnung in der App-Sprache
 * @param {Array} options.catalog - normalisierter Übungskatalog (loadDefaultExercises)
 * @returns {{ ok: true, plan: object } | { ok: false, error: 'unknown'|'limit'|'missingExercise'|'storage', detail?: string }}
 */
export function createPlanFromTemplate({ userId, templateId, level = DEFAULT_PLAN_LEVEL, planName, labelFor, catalog }) {
  if (!PLAN_TEMPLATES[templateId]) return { ok: false, error: 'unknown' }
  if (!canCreatePlan(getTrainingPlans(userId))) return { ok: false, error: 'limit' }
  const resolved = resolveTemplateDays({ templateId, level, catalog, labelFor })
  if (resolved.missing.length) return { ok: false, error: 'missingExercise', detail: resolved.missing[0] }

  const result = createTrainingPlan({
    userId,
    name: planName,
    level: normalizePlanLevel(level),
    templateId,
    days: resolved.days.map(({ label, type, goal, exercises }) => ({
      label,
      type,
      goal,
      exercises: exercises.map(({ exerciseId, name, muscleGroup, sets }) => ({ exerciseId, name, muscleGroup, sets }))
    }))
  })
  if (!result.ok) return { ok: false, error: result.error === 'limit' ? 'limit' : 'storage', detail: result.error }
  return { ok: true, plan: result.plan }
}
