import { getTrainingPlans, updateTrainingPlan } from './trainingPlanStorage'
import { getAllFavorites } from './planFromTemplate'
import { deleteFavoriteWorkout } from './workoutFavorites'
import { normalizePlanExercises } from './trainingPlan'

// Einmalige Umstellung (Absprache Paul 28.10.): Pläne, die mit der ersten Fassung aus einer Vorlage angelegt wurden,
// verweisen auf je einen Favoriten pro Tag. Das war falsch - der Favoritenbereich gehört dem Nutzer. Hier wandern die
// Übungen in den Plan-Tag, und genau diese Vorlagen-Favoriten werden entfernt. Erkannt werden sie am Namen
// „<Vorlagen-Präfix> <Tagbezeichnung>“; selbst angelegte Favoriten bleiben unberührt.

const LEGACY_PREFIXES = {
  'PPL 3 Tage': 'ppl3', 'PPL 6 Tage': 'ppl6', 'Ober Unterkörper': 'ul4', 'Ganzkörper': 'fb3',
  'PPL 3 days': 'ppl3', 'PPL 6 days': 'ppl6', 'Upper Lower': 'ul4', 'Full body': 'fb3'
}

const squash = (value) => String(value || '').replace(/\s+/g, ' ').trim()

function legacyTemplateOf(favoriteName, dayLabel) {
  const label = squash(dayLabel)
  if (!label) return ''
  const name = squash(favoriteName)
  const prefix = Object.keys(LEGACY_PREFIXES).find((candidate) => name === `${candidate} ${label}`)
  return prefix ? LEGACY_PREFIXES[prefix] : ''
}

/**
 * @param {object} options
 * @param {string} options.userId
 * @param {Array} [options.catalog] - Übungskatalog, um englische Namen sicherzustellen (alte Einträge haben deutsche)
 * @returns {{ plans: number, favoritesRemoved: number }}
 */
export function migrateTemplateFavoritesToPlans({ userId, catalog = [] } = {}) {
  const result = { plans: 0, favoritesRemoved: 0 }
  const favorites = getAllFavorites(userId)
  if (!favorites.length) return result
  const byId = new Map(catalog.map((entry) => [entry._id, entry]))

  for (const plan of getTrainingPlans(userId)) {
    const toRemove = []
    let templateId = plan.templateId
    const days = plan.days.map((day) => {
      if (day.exercises?.length || !day.favoriteId) return day
      const favorite = favorites.find((fav) => fav.id === day.favoriteId)
      const template = favorite ? legacyTemplateOf(favorite.name, day.label) : ''
      if (!favorite || !template) return day
      const exercises = normalizePlanExercises((favorite.workout?.exercises || []).map((ex) => {
        const entry = byId.get(ex.exerciseId || ex._id)
        return { exerciseId: ex.exerciseId || ex._id, name: entry?.name_en || ex.name, muscleGroup: ex.muscleGroup, sets: ex.sets }
      }))
      if (!exercises.length) return day
      templateId = template
      toRemove.push(favorite)
      return { ...day, favoriteId: '', type: favorite.type, goal: favorite.workout?.goal || 'hypertrophy', exercises }
    })
    if (!toRemove.length) continue
    // Die ersten Pläne enthielten die Übungen der heutigen Stufe „Fortgeschritten“ (freie Gewichte).
    const saved = updateTrainingPlan({ userId, planId: plan.id, updater: (p) => ({ ...p, days, templateId, level: 'advanced' }) })
    if (!saved.ok) continue
    result.plans += 1
    toRemove.forEach((favorite) => {
      if (deleteFavoriteWorkout({ userId, type: favorite.type, id: favorite.id }).success) result.favoritesRemoved += 1
    })
  }
  return result
}
