import { PLAN_TEMPLATES, PLAN_TEMPLATE_GOAL } from './planTemplates'
import { saveFavoriteWorkout, deleteFavoriteWorkout, getFavoritesByType } from './workoutFavorites'
import { createTrainingPlan, getTrainingPlans } from './trainingPlanStorage'
import { canCreatePlan } from './trainingPlan'

// Plan aus einer Vorlage anlegen (Absprache Paul 28.10.): aus jedem Trainingstag entsteht ein Favorit (Ziel Muskelaufbau),
// der Plan verweist darauf. Klappt ein Schritt nicht, werden die schon angelegten Favoriten wieder entfernt - es bleibt
// nie ein halber Plan zurück.

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
    exerciseId: entry._id,
    sets: count,
    reps: 10,
    weight: 0,
    rest: 90,
    setDetails: Array.from({ length: count }, () => ({ reps: 10, weight: 0 }))
  }
}

/**
 * @param {object} options
 * @param {string} options.userId
 * @param {string} options.templateId - Schlüssel in PLAN_TEMPLATES
 * @param {string} options.planName - Name des Plans (App-Sprache)
 * @param {string} options.favoritePrefix - Präfix für die Favoriten-Namen (nur Buchstaben, Zahlen, Leerzeichen)
 * @param {(labelKey: string) => string} options.labelFor - Tagbezeichnung in der App-Sprache
 * @param {Array} options.catalog - normalisierter Übungskatalog (loadDefaultExercises)
 * @returns {{ ok: true, plan: object, favorites: object[] } | { ok: false, error: string, detail?: string }}
 */
export function createPlanFromTemplate({ userId, templateId, planName, favoritePrefix, labelFor, catalog }) {
  const template = PLAN_TEMPLATES[templateId]
  if (!template) return { ok: false, error: 'unknown' }
  if (!canCreatePlan(getTrainingPlans(userId))) return { ok: false, error: 'limit' }

  const byId = new Map((Array.isArray(catalog) ? catalog : []).map((entry) => [entry._id, entry]))
  // Erst alle Übungen auflösen, dann etwas anlegen.
  const prepared = []
  for (const day of template.days) {
    const exercises = []
    for (const item of day.exercises) {
      const entry = byId.get(item.id)
      if (!entry) return { ok: false, error: 'missingExercise', detail: item.id }
      exercises.push(buildTemplateExercise(entry, item.sets))
    }
    prepared.push({ day, label: labelFor(day.labelKey), exercises })
  }

  const created = []
  const rollback = () => created.forEach((fav) => deleteFavoriteWorkout({ userId, type: fav.type, id: fav.id }))

  for (const { day, label, exercises } of prepared) {
    const name = `${favoritePrefix} ${label}`.replace(/\s+/g, ' ').trim()
    const result = saveFavoriteWorkout({
      userId,
      type: day.type,
      name,
      workout: { name, type: day.type, goal: PLAN_TEMPLATE_GOAL, notes: '', exercises }
    })
    if (!result.success) {
      rollback()
      return { ok: false, error: result.code === 'LIMIT_REACHED' ? 'favoriteLimit' : 'storage', detail: result.code }
    }
    created.push(result.favorite)
  }

  const planResult = createTrainingPlan({
    userId,
    name: planName,
    days: created.map((fav, i) => ({ favoriteId: fav.id, label: prepared[i].label }))
  })
  if (!planResult.ok) {
    rollback()
    return { ok: false, error: planResult.error === 'limit' ? 'limit' : 'storage', detail: planResult.error }
  }
  return { ok: true, plan: planResult.plan, favorites: created }
}
