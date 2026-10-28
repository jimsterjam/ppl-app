import { getTrainingPlans, getActiveTrainingPlan, updateTrainingPlan } from './trainingPlanStorage'
import { completeDay, getActiveDay } from './trainingPlan'
import { getAllFavorites } from './planFromTemplate'

// Plan im Alltag: welcher Tag ist heute dran, und was passiert nach dem Speichern eines Plan-Trainings.
// Rotation statt Kalender (Absprache Paul): nach dem trainierten Tag rückt der Plan zum Tag danach vor.

/** Tag samt zugehörigem Favoriten (`favorite` ist null, wenn der Favorit inzwischen gelöscht wurde). */
function describeDay(plan, day, favorites) {
  if (!plan || !day) return null
  return { plan, day, favorite: favorites.find((fav) => fav.id === day.favoriteId) || null }
}

/** Heute dran: aktueller Tag des aktiven Plans, oder null ohne aktiven Plan. */
export function getTodayPlanInfo(userId) {
  const plan = getActiveTrainingPlan(userId)
  return describeDay(plan, getActiveDay(plan), getAllFavorites(userId))
}

/** Beliebigen Tag eines Plans nachschlagen (für „Anderen Tag wählen“). */
export function getPlanDayInfo(userId, planId, dayId) {
  const plan = getTrainingPlans(userId).find((entry) => entry.id === planId)
  return describeDay(plan, plan?.days.find((day) => day.id === dayId), getAllFavorites(userId))
}

/**
 * Ein Plan-Training wurde gespeichert: Tag als trainiert merken, Plan rückt vor.
 * Unbekannter Plan/Tag (inzwischen gelöscht) ändert nichts. Mehrfaches Aufrufen für dasselbe Training ist unschädlich.
 * @returns {object|null} der aktualisierte Plan, sonst null
 */
export function advancePlanAfterWorkout({ userId, planId, planDayId, doneAt } = {}) {
  if (!planId || !planDayId) return null
  const plan = getTrainingPlans(userId).find((entry) => entry.id === planId)
  if (!plan || !plan.days.some((day) => day.id === planDayId)) return null
  const result = updateTrainingPlan({ userId, planId, updater: (p) => completeDay(p, planDayId, doneAt) })
  return result.ok ? result.plan : null
}

/**
 * Trainierte Muskelgruppen eines Plan-Tages (häufigste zuerst, höchstens `limit`), aus den Übungen des Favoriten.
 * Rohwerte wie im Katalog (z. B. „Brust“); die Anzeige übersetzt sie in die App-Sprache.
 */
export function getDayMuscleGroups(favorite, limit = 3) {
  const counts = new Map()
  const exercises = Array.isArray(favorite?.workout?.exercises) ? favorite.workout.exercises : []
  exercises.forEach((exercise) => {
    const group = String(exercise?.muscleGroup || '').trim()
    if (group) counts.set(group, (counts.get(group) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([group]) => group)
}
