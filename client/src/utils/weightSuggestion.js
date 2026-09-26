// Gewichtsvorschlag während eines laufenden Workouts (doppelte Progression).
//
// Prinzip: Die App legt das Wiederholungsziel selbst fest - abhängig vom Ziel des Workouts
// (beim Erstellen abgefragt, siehe utils/workoutGoal.js) und der Art der Übung. Der Nutzer muss kein Schema (3x3, 5x5, ...)
// kennen. Hat er in der letzten Session in ALLEN Arbeitssätzen das Ziel erreicht, schlägt die App
// pro Satz mehr Gewicht vor. Es werden nie Senkungen vorgeschlagen und nie Werte eingetragen -
// reiner Hinweis (siehe WorkoutDetailView.vue).
//
// Bewusst ohne Vue-/Store-Imports, damit alles direkt testbar ist.

export const TRAINING_GOALS = Object.freeze(['hypertrophy', 'strength'])
export const DEFAULT_TRAINING_GOAL = 'hypertrophy'

// Wiederholungsbereiche pro Trainingsziel und Übungsart. Vorschlag erst, wenn alle Arbeitssätze das
// obere Ende (max) erreicht haben. Der Quick Generator (server/utils/repTargets.js) nutzt dieselben
// Werte - bei Änderungen beide Stellen anpassen.
export const REP_TARGETS = Object.freeze({
  strength: Object.freeze({
    compound: Object.freeze({ min: 3, max: 5 }),
    isolation: Object.freeze({ min: 8, max: 10 })
  }),
  hypertrophy: Object.freeze({
    compound: Object.freeze({ min: 6, max: 10 }),
    isolation: Object.freeze({ min: 10, max: 12 })
  })
})

// Katalog-Einordnung (aiMetadata.exerciseType) ist nicht fehlerfrei - z.B. Seitheben steht dort als
// Grundübung. Diese typischen Isolationsbewegungen werden unabhängig vom Katalog als Isolation
// behandelt (englische und deutsche Namen).
const ISOLATION_NAME_PATTERN = /(lateral raise|front raise|rear delt|reverse fly|\bfly\b|\bflye|\bcurl|extension|kickback|calf raise|calf press|pec deck|butterfly|shrug|pullover|seitheben|frontheben|fliegende|curls?\b|strecken|wadenheben|wadenpresse)/i

const NO_LOAD_EQUIPMENT = new Set(['körpergewicht', 'bodyweight', 'body weight', 'assisted', 'resistance band', 'band'])
const SMALL_STEP_EQUIPMENT = new Set(['kurzhanteln', 'kurzhantel', 'dumbbell', 'dumbbells', 'kettlebell'])

export function normalizeTrainingGoal(goal) {
  return String(goal || '').toLowerCase().includes('strength') ? 'strength' : DEFAULT_TRAINING_GOAL
}

function lower(value) {
  return String(value || '').trim().toLowerCase()
}

/**
 * Übungsart für das Wiederholungsziel: 'compound' | 'isolation' | 'core'.
 * info: { name, name_en, category, equipment, equipment_en, aiMetadata } - aus aktueller Übung und/oder Katalog.
 */
export function classifyExercise(info = {}) {
  const category = lower(info.category)
  const metaType = lower(info.aiMetadata?.exerciseType)
  if (metaType === 'core' || category === 'core' || category === 'cardio') return 'core'

  const names = `${info.name_en || ''} ${info.name || ''}`
  if (ISOLATION_NAME_PATTERN.test(names)) return 'isolation'

  if (metaType === 'compound' || metaType === 'isolation') return metaType

  // Ohne Katalog-Einordnung (z.B. eigene Übung): Langhantel = Grundübung, sonst Isolation.
  return equipmentValues(info).some((eq) => eq === 'langhantel' || eq === 'barbell') ? 'compound' : 'isolation'
}

/** Wiederholungsziel für eine Übung, oder null (keine Gewichtssteigerung sinnvoll). */
export function getRepTarget(info = {}, goal = DEFAULT_TRAINING_GOAL) {
  const type = classifyExercise(info)
  if (type === 'core') return null
  const range = REP_TARGETS[normalizeTrainingGoal(goal)][type]
  return { type, min: range.min, max: range.max, target: range.max }
}

function equipmentValues(info = {}) {
  return [lower(info.equipment), lower(info.equipment_en)].filter(Boolean)
}

export function isNoLoadExercise(info = {}) {
  if (equipmentValues(info).some((eq) => NO_LOAD_EQUIPMENT.has(eq))) return true
  // Speed-Varianten werden über Tempo gesteuert, nicht über Gewicht.
  return /speed/i.test(`${info.name_en || ''} ${info.name || ''}`)
}

function incrementFor(info = {}) {
  return equipmentValues(info).some((eq) => SMALL_STEP_EQUIPMENT.has(eq)) ? 2 : 2.5
}

function roundKg(value) {
  return Math.round(value * 100) / 100
}

/** Arbeitssätze (ohne Aufwärmsätze) mit echten Wiederholungen. */
export function getWorkingSets(exercise = {}) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  return sets
    .filter((set) => set && !set.isWarmup)
    .map((set) => ({ reps: Number(set.reps) || 0, weight: Number(set.weight) || 0 }))
    .filter((set) => set.reps > 0)
}

/**
 * Gewichtsvorschlag für die aktuelle Session.
 * @param {object} info - Übungsinfos (name, name_en, category, equipment, aiMetadata)
 * @param {object|null} lastSessionExercise - dieselbe Übung aus der letzten abgeschlossenen Session
 * @param {string} goal - 'hypertrophy' | 'strength'
 * @returns {null | { targetReps, increment, baseWeight, suggestedWeights: number[] }}
 *   suggestedWeights[k] = Vorschlag für den k-ten Arbeitssatz (Gewicht dieses Satzes letztes Mal
 *   + Schrittweite), damit auch Pyramiden/unterschiedliche Satzgewichte stimmen.
 */
export function getWeightSuggestion(info = {}, lastSessionExercise = null, goal = DEFAULT_TRAINING_GOAL) {
  if (!lastSessionExercise) return null
  if (isNoLoadExercise(info)) return null

  const target = getRepTarget(info, goal)
  if (!target) return null

  const working = getWorkingSets(lastSessionExercise)
  if (!working.length) return null
  // Satz ohne Gewicht = Körpergewicht-Satz -> kein Gewichtsvorschlag.
  if (working.some((set) => set.weight <= 0)) return null
  // Nur wenn ALLE Arbeitssätze das Ziel erreicht haben - sonst gleiches Gewicht, kein Hinweis.
  if (!working.every((set) => set.reps >= target.target)) return null

  const increment = incrementFor(info)
  return {
    targetReps: target.target,
    increment,
    baseWeight: Math.max(...working.map((set) => set.weight)),
    suggestedWeights: working.map((set) => roundKg(set.weight + increment))
  }
}

/** Vorschlag für den k-ten Arbeitssatz der aktuellen Session (mehr Sätze als letztes Mal -> letzter Wert). */
export function getSuggestionForSet(suggestion, workingSetIndex) {
  const list = suggestion?.suggestedWeights
  if (!Array.isArray(list) || !list.length || workingSetIndex < 0) return null
  return list[Math.min(workingSetIndex, list.length - 1)]
}
