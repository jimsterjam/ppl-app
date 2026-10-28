import { getTrainingPlans, getActiveTrainingPlan, updateTrainingPlan } from './trainingPlanStorage'
import { completeDay, getActiveDay } from './trainingPlan'
import { getAllFavorites, buildTemplateExercise } from './planFromTemplate'

// Plan im Alltag: welcher Tag ist heute dran, und was passiert nach dem Speichern eines Plan-Trainings.
// Rotation statt Kalender (Absprache Paul): nach dem trainierten Tag rückt der Plan zum Tag danach vor.

/**
 * Tag samt seinen Übungen. Die Übungen stehen im Plan-Tag selbst (Vorlagen-Pläne) oder, bei älteren Plänen und
 * selbst hinzugefügten Tagen, im verknüpften Favoriten. `favorite` ist null, wenn der Favorit gelöscht wurde;
 * `hasWorkout` sagt, ob der Tag überhaupt gestartet werden kann.
 */
function describeDay(plan, day, favorites) {
  if (!plan || !day) return null
  const favorite = day.favoriteId ? favorites.find((fav) => fav.id === day.favoriteId) || null : null
  const exercises = day.exercises?.length ? day.exercises : (Array.isArray(favorite?.workout?.exercises) ? favorite.workout.exercises : [])
  return { plan, day, favorite, exercises, hasWorkout: exercises.length > 0 }
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

/** Anzeigename eines Tages: eigene Bezeichnung, sonst Name des Favoriten. */
export function planDayTitle(info) {
  return info?.day?.label || info?.favorite?.name || ''
}

/**
 * Tag in der Form eines Favoriten, damit der Start wie bei jedem Favoriten läuft. Bei Tagen mit eigenen Übungen
 * wird aus dem Katalog die volle Übung gebaut (Bilder, Muskelgruppe ...); `id` ist dann null (es gibt keinen Favoriten).
 */
export function buildDayStartFavorite(info, catalog) {
  if (!info?.hasWorkout) return null
  if (!info.day.exercises?.length) return info.favorite
  const byId = new Map((Array.isArray(catalog) ? catalog : []).map((entry) => [entry._id, entry]))
  const exercises = info.day.exercises.map((item) => {
    const entry = byId.get(item.exerciseId)
    return entry ? buildTemplateExercise(entry, item.sets) : buildTemplateExercise({ _id: item.exerciseId, name_en: item.name, name: item.name, muscleGroup: item.muscleGroup }, item.sets)
  })
  const name = planDayTitle(info) || info.plan.name
  return { id: null, type: info.day.type, name, workout: { name, type: info.day.type, goal: info.day.goal, notes: '', exercises } }
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
 * Trainierte Muskelgruppen (häufigste zuerst, höchstens `limit`) aus den Übungen eines Tages. Nimmt die Übungsliste oder
 * einen Favoriten. Rohwerte wie im Katalog (z. B. „Brust“); die Anzeige übersetzt sie in die App-Sprache.
 */
export function getDayMuscleGroups(source, limit = 3) {
  const counts = new Map()
  const exercises = Array.isArray(source) ? source : (Array.isArray(source?.workout?.exercises) ? source.workout.exercises : [])
  exercises.forEach((exercise) => {
    const group = String(exercise?.muscleGroup || '').trim()
    if (group) counts.set(group, (counts.get(group) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([group]) => group)
}
