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

// --- Trainingsart pro Übung ---------------------------------------------------------------
// Das Workout-Ziel (Kraft/Muskelaufbau) ist nur die Voreinstellung. Pro Übung kann der Nutzer
// eine eigene Trainingsart wählen (exercise.trainingType), z.B. im Kraft-Workout Hack Calf Raise
// auf Muskelaufbau. Explosive Übungen (Sprünge, Speed-Varianten, Umsetzen/Reißen) werden
// automatisch erkannt: dort zählt das Tempo, es gibt kein Wiederholungsziel.
export const EXERCISE_TRAINING_TYPES = Object.freeze(['strength', 'hypertrophy', 'explosive'])

const EXPLOSIVE_NAME_PATTERN = /\bspeed\b|jump|sprung|explosiv|plyo|\bclean\b|snatch|reißen|power start|medicine ball.*throw|überkopfwurf|brustwurf/i
// Treffer, die trotz Stichwort NICHT explosiv sind (Griffart, Bauchübung, Seilspringen).
const EXPLOSIVE_EXCLUDE_PATTERN = /clean[- ]grip|throw down|abwerfen|abwurf|power point|jump rope|springseil/i

export function isExplosiveExercise(info = {}) {
  const names = `${info.name_en || ''} ${info.name || ''}`
  return EXPLOSIVE_NAME_PATTERN.test(names) && !EXPLOSIVE_EXCLUDE_PATTERN.test(names)
}

export function sanitizeExerciseTrainingType(value) {
  return EXERCISE_TRAINING_TYPES.includes(value) ? value : null
}

/**
 * Wirksame Trainingsart einer Übung: eigene Wahl > automatisch explosiv > Workout-Ziel.
 * @returns {'strength'|'hypertrophy'|'explosive'}
 */
export function resolveExerciseGoal(info = {}, workoutGoal = DEFAULT_TRAINING_GOAL, override = null) {
  const own = sanitizeExerciseTrainingType(override)
  if (own) return own
  if (isExplosiveExercise(info)) return 'explosive'
  return normalizeTrainingGoal(workoutGoal)
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
  if (goal === 'explosive') return null // Tempo zählt, kein Wiederholungsziel
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

/** Arbeitssätze (ohne Aufwärmsätze und ohne ausdrücklich nicht gemachte Sätze) mit echten Wiederholungen. */
export function getWorkingSets(exercise = {}) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  return sets
    // done === false: im laufenden Workout nicht abgehakt. Fehlt das Feld (alte Daten), gilt der Satz als gemacht.
    .filter((set) => set && !set.isWarmup && set.done !== false)
    .map((set) => ({ reps: Number(set.reps) || 0, weight: Number(set.weight) || 0 }))
    .filter((set) => set.reps > 0)
}

// Zusatzsätze (Back-off): leichtere Sätze NACH den Hauptsätzen, z.B. 5x5 mit 100 kg + 2x10 mit
// 80 kg. Sie zählen für Vorschlag/Einschätzung nicht - aber nur, wenn sie deutlich leichter sind
// (höchstens 85 % des Hauptgewichts). Kleine Reduzierungen (100 -> 95 kg) gelten als "Hauptsatz
// nicht geschafft" und verhindern den Vorschlag (Absprache Paul, Variante b).
export const BACKOFF_MAX_RATIO = 0.85

/**
 * Hauptsätze = die ersten Arbeitssätze mit demselben Gewicht; dieses Gewicht muss das schwerste
 * sein (sonst Pyramide/Aufwärm-Rampe -> null). Alle Sätze danach müssen Zusatzsätze sein.
 * @returns {null | { main: Array, backoff: Array, weight: number }}
 */
export function splitMainAndBackoffSets(working = []) {
  if (!working.length) return null
  const weight = roundKg(working[0].weight)
  let k = 0
  while (k < working.length && roundKg(working[k].weight) === weight) k++
  const backoff = working.slice(k)
  if (backoff.some((set) => roundKg(set.weight) > roundKg(weight * BACKOFF_MAX_RATIO))) return null
  return { main: working.slice(0, k), backoff, weight }
}

/**
 * Gewichtsvorschlag für die aktuelle Session.
 * @param {object} info - Übungsinfos (name, name_en, category, equipment, aiMetadata)
 * @param {object|null} lastSessionExercise - dieselbe Übung aus der letzten abgeschlossenen Session
 * @param {string} goal - 'hypertrophy' | 'strength'
 * @returns {null | { targetReps, increment, baseWeight, suggestedWeights: number[] }}
 *   suggestedWeights[k] = Vorschlag für den k-ten Arbeitssatz (Gewicht letztes Mal + Schrittweite;
 *   da alle Arbeitssätze dasselbe Gewicht haben müssen, sind alle Werte gleich).
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
  // Das Gewicht gilt erst als geschafft, wenn ALLE Hauptsätze mit demselben Gewicht liefen
  // (z.B. 5x5 mit 100 kg). Deutlich leichtere Zusatzsätze danach zählen nicht; kleine
  // Reduzierungen (100/100/100/95/95) oder Steigerungen innerhalb der Sätze -> kein Vorschlag.
  // Aufwärm-/Ramp-Up-Sätze zählen ohnehin nicht (isWarmup).
  const split = splitMainAndBackoffSets(working)
  if (!split) return null
  const main = split.main
  // Nur wenn ALLE Hauptsätze das Ziel erreicht haben - sonst gleiches Gewicht, kein Hinweis.
  if (!main.every((set) => set.reps >= target.target)) return null
  // Bewusst KEIN Vergleich der Satzanzahl mit früheren Sessions: Favoriten werden mit den Sätzen
  // der letzten Session vorausgefüllt, nicht gemachte Sätze bleiben meist stehen - der Vergleich
  // hätte kaum gegriffen, aber bewusste Umstellungen (z.B. 5 -> 3 Sätze) bestraft.

  const increment = incrementFor(info)
  return {
    targetReps: target.target,
    increment,
    baseWeight: split.weight,
    suggestedWeights: main.map((set) => roundKg(set.weight + increment)),
    // Anzahl Zusatzsätze letztes Mal - dort gibt es keinen Chip (siehe getSuggestionForSet).
    backoffSets: split.backoff.length
  }
}

/**
 * Zustand für die Hinweiszeile unter der Übung (Einschätzung der letzten Session):
 *   'increase' - alle Arbeitssätze am Ziel -> mehr Gewicht (zusätzlich Chip, siehe getWeightSuggestion)
 *   'close'    - knapp dran: genau ein Satz, und der nur 1 Wdh. unter dem Ziel -> gleiches Gewicht
 *   'hold'     - sonst -> gleiches Gewicht, bis alle Sätze das Ziel schaffen
 * null = keine Einschätzung möglich (keine Historie, Körpergewicht, unterschiedliche Gewichte, ...),
 * dann zeigt die App nur das Wiederholungsziel. Senkungen werden nie vorgeschlagen.
 * @returns {null | { state, targetReps, weight, sets, totalReps, targetTotal, missingReps, suggestion }}
 */
export function getProgressionStatus(info = {}, lastSessionExercise = null, goal = DEFAULT_TRAINING_GOAL) {
  if (!lastSessionExercise || isNoLoadExercise(info)) return null
  const target = getRepTarget(info, goal)
  if (!target) return null
  const all = getWorkingSets(lastSessionExercise)
  if (!all.length || all.some((set) => set.weight <= 0)) return null
  // Nur Hauptsätze zählen (siehe splitMainAndBackoffSets) - Zusatzsätze bleiben außen vor.
  const split = splitMainAndBackoffSets(all)
  if (!split) return null
  const working = split.main
  const firstWeight = split.weight

  const totalReps = working.reduce((sum, set) => sum + set.reps, 0)
  const targetTotal = working.length * target.target
  const missingReps = working.reduce((sum, set) => sum + Math.max(0, target.target - set.reps), 0)
  const below = working.filter((set) => set.reps < target.target)
  const base = {
    targetReps: target.target,
    weight: firstWeight,
    sets: working.length,
    totalReps,
    targetTotal,
    missingReps
  }
  if (!below.length) {
    return { ...base, state: 'increase', suggestion: getWeightSuggestion(info, lastSessionExercise, goal) }
  }
  const state = below.length === 1 && below[0].reps === target.target - 1 ? 'close' : 'hold'
  return { ...base, state, suggestion: null }
}

/** Vorschlag für den k-ten Arbeitssatz der aktuellen Session (mehr Sätze als letztes Mal -> letzter Wert). */
export function getSuggestionForSet(suggestion, workingSetIndex) {
  const list = suggestion?.suggestedWeights
  if (!Array.isArray(list) || !list.length || workingSetIndex < 0) return null
  // Letztes Mal gab es Zusatzsätze: Sätze nach den Hauptsätzen bekommen keinen Vorschlag.
  if ((suggestion.backoffSets || 0) > 0 && workingSetIndex >= list.length) return null
  return list[Math.min(workingSetIndex, list.length - 1)]
}
