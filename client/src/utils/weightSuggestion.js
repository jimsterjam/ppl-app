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

// Die Vorgaben des Workout-Generators stehen in server/utils/repTargets.js (GENERATOR_RULES) und
// liegen innerhalb von PROGRESSION_RANGES (unten) - per Server-Test abgeglichen.

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

// --- Fortschrittslogik: Schema statt fester Zahl (Absprache Paul) ---------------------------
// Kraft (Grundübungen): festes Schema im Bereich 1-6 Wdh. (5x5, 6x1, 4x5 ...). Die Ziel-
//   Wiederholungen liest die App aus den letzten Sessions (häufigste Wdh.-Zahl der Hauptsätze);
//   ohne Verlauf 5. Mehr Gewicht, wenn alle Hauptsätze das Schema schaffen. Bei 1-3 Wdh.
//   (Singles/Doubles/Triples) erst, wenn das zweimal hintereinander mit demselben Gewicht klappt.
// Muskelaufbau (und Zubehör-/Isolationsübungen im Kraft-Workout): Bereich 8-12, Wiederholungen
//   klettern (3x10 -> 3x11 -> 3x12), mehr Gewicht erst bei 12 in allen Hauptsätzen.
// Die Satzanzahl gibt die App nie vor.
export const PROGRESSION_RANGES = Object.freeze({
  strength: Object.freeze({ min: 1, max: 6 }),
  hypertrophy: Object.freeze({ min: 8, max: 12 })
})
export const DEFAULT_STRENGTH_REPS = 5
// Bis zu dieser Wdh.-Zahl muss das Schema zweimal hintereinander geschafft werden.
export const CONFIRM_REPS_MAX = 3

// Übergangswert zwischen Kraft (1-6) und Muskelaufbau (8-12), Absprache Paul: schafft jemand bei
// Kraft 7+ in allen Hauptsätzen, ist das Gewicht zu leicht; bei Muskelaufbau unter 8 eher zu schwer.
export const TRANSITION_REPS = 7

/** 'fixed' (Kraft-Grundübung, festes Schema) oder 'range' (8-12) - null = kein Wdh.-Ziel. */
export function progressionModeFor(info = {}, goal = DEFAULT_TRAINING_GOAL) {
  if (goal === 'explosive') return null
  const type = classifyExercise(info)
  if (type === 'core') return null
  return normalizeTrainingGoal(goal) === 'strength' && type === 'compound' ? 'fixed' : 'range'
}

/**
 * Passt eine frühere Session zur aktuellen Trainingsart? (User-Report: eine Kraft-Session mit
 * 5x85 kg lieferte im Muskelaufbau-Workout "6 Wdh. mit 85 kg".)
 * - Trainingsart der Session bekannt (Workout-Ziel __workoutGoal bzw. trainingType der Übung):
 *   muss dieselbe sein.
 * - Unbekannt (alte Workouts): Plausibilität über die Wiederholungen - für Muskelaufbau darf nicht
 *   alles unter 7 liegen, für ein Kraft-Schema nicht alles über 7.
 */
export function isSessionCompatible(info = {}, sessionExercise = null, goal = DEFAULT_TRAINING_GOAL) {
  if (!sessionExercise) return false
  const known = sessionExercise.__workoutGoal || sessionExercise.trainingType
  if (known) {
    return resolveExerciseGoal(info, sessionExercise.__workoutGoal, sessionExercise.trainingType) === resolveExerciseGoal(info, goal)
  }
  const mode = progressionModeFor(info, goal)
  const reps = getWorkingSets(sessionExercise).map((set) => set.reps)
  if (!mode || !reps.length) return true
  if (mode === 'range') return Math.max(...reps) >= TRANSITION_REPS
  return Math.min(...reps) <= TRANSITION_REPS
}

/** Nur die Sessions, die zur aktuellen Trainingsart passen (Reihenfolge bleibt, neueste zuerst). */
export function compatibleSessions(info = {}, sessions = [], goal = DEFAULT_TRAINING_GOAL) {
  return (Array.isArray(sessions) ? sessions : []).filter((session) => isSessionCompatible(info, session, goal))
}

/**
 * Ziel-Wiederholungen eines festen Kraft-Schemas aus den letzten Sessions (neueste zuerst):
 * häufigste Wdh.-Zahl der Hauptsätze, bei Gleichstand die höhere, begrenzt auf 1-6.
 */
export function detectSchemeReps(sessions = []) {
  const counts = new Map()
  for (const session of (Array.isArray(sessions) ? sessions : []).slice(0, 3)) {
    const split = session ? splitMainAndBackoffSets(getWorkingSets(session)) : null
    for (const set of split?.main || []) counts.set(set.reps, (counts.get(set.reps) || 0) + 1)
  }
  if (!counts.size) return DEFAULT_STRENGTH_REPS
  let best = 0
  let bestCount = 0
  for (const [reps, count] of counts) {
    if (count > bestCount || (count === bestCount && reps > best)) { best = reps; bestCount = count }
  }
  const { min, max } = PROGRESSION_RANGES.strength
  return Math.min(max, Math.max(min, best))
}

/**
 * Wiederholungsziel einer Übung, oder null (keine Gewichtssteigerung sinnvoll).
 * @param {object} [options]
 * @param {Array} [options.sessions] - dieselbe Übung aus den letzten Sessions, neueste zuerst
 *   (nur für feste Kraft-Schemata relevant)
 * @returns {null | { type, mode: 'fixed'|'range', min, max, target }}
 */
export function getRepTarget(info = {}, goal = DEFAULT_TRAINING_GOAL, { sessions = [] } = {}) {
  if (goal === 'explosive') return null // Tempo zählt, kein Wiederholungsziel
  const type = classifyExercise(info)
  if (type === 'core') return null
  if (normalizeTrainingGoal(goal) === 'strength' && type === 'compound') {
    const { min, max } = PROGRESSION_RANGES.strength
    // Schema nur aus Sessions derselben Trainingsart ablesen.
    return { type, mode: 'fixed', min, max, target: detectSchemeReps(compatibleSessions(info, sessions, goal)) }
  }
  const { min, max } = PROGRESSION_RANGES.hypertrophy
  return { type, mode: 'range', min, max, target: max }
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

function buildSuggestion(info, split, target) {
  const increment = incrementFor(info)
  return {
    targetReps: target.target,
    increment,
    baseWeight: split.weight,
    // Vorschlag je Hauptsatz (alle gleich, da Hauptsätze dasselbe Gewicht haben).
    suggestedWeights: split.main.map((set) => roundKg(set.weight + increment)),
    // Anzahl Zusatzsätze letztes Mal - dort gibt es keinen Vorschlag (siehe getSuggestionForSet).
    backoffSets: split.backoff.length
  }
}

// Wurde das Schema in dieser (früheren) Session mit demselben Hauptgewicht geschafft?
function schemeAchieved(sessionExercise, weight, reps) {
  const split = sessionExercise ? splitMainAndBackoffSets(getWorkingSets(sessionExercise)) : null
  return !!split && split.weight === weight && split.main.every((set) => set.reps >= reps)
}

/**
 * Einschätzung der letzten Session für Hinweis, Vorschlag und "Nächstes Mal":
 *   'increase' - alle Hauptsätze am Ziel -> mehr Gewicht (suggestion gesetzt)
 *   'confirm'  - Kraft-Schema mit 1-3 Wdh. geschafft, aber erst einmal -> nochmal bestätigen
 *   'climb'    - Bereich 8-12: noch nicht überall 12 -> nächstes Mal eine Wdh. mehr (nextReps)
 *   'close'    - festes Schema, knapp dran: genau ein Satz 1 Wdh. zu wenig -> gleiches Gewicht
 *   'hold'     - festes Schema, sonst -> gleiches Gewicht
 * null = keine Einschätzung (keine Historie, Körpergewicht, Pyramide, ...). Nie Senkungen.
 * @param {object} [options]
 * @param {Array} [options.previousSessions] - dieselbe Übung aus den Sessions VOR der letzten,
 *   neueste zuerst (für Schema-Erkennung und die Bestätigungs-Regel bei 1-3 Wdh.)
 */
export function getProgressionStatus(info = {}, lastSessionExerciseRaw = null, goal = DEFAULT_TRAINING_GOAL, { previousSessions: previousRaw = [] } = {}) {
  if (!lastSessionExerciseRaw || isNoLoadExercise(info)) return null
  // Nur Sessions derselben Trainingsart (siehe isSessionCompatible).
  const [lastSessionExercise = null, ...previousSessions] = compatibleSessions(info, [lastSessionExerciseRaw, ...previousRaw], goal)
  if (!lastSessionExercise) return null
  const target = getRepTarget(info, goal, { sessions: [lastSessionExercise, ...previousSessions] })
  if (!target) return null
  const all = getWorkingSets(lastSessionExercise)
  // Satz ohne Gewicht = Körpergewicht-Satz -> kein Gewichtsvorschlag.
  if (!all.length || all.some((set) => set.weight <= 0)) return null
  // Nur Hauptsätze zählen (siehe splitMainAndBackoffSets) - Zusatzsätze bleiben außen vor;
  // kleine Reduzierungen, Steigerungen innerhalb der Sätze oder Pyramiden -> keine Einschätzung.
  const split = splitMainAndBackoffSets(all)
  if (!split) return null
  const working = split.main

  const totalReps = working.reduce((sum, set) => sum + set.reps, 0)
  const targetTotal = working.length * target.target
  const missingReps = working.reduce((sum, set) => sum + Math.max(0, target.target - set.reps), 0)
  const below = working.filter((set) => set.reps < target.target)
  const minReps = Math.min(...working.map((set) => set.reps))
  const base = {
    mode: target.mode,
    targetReps: target.target,
    min: target.min,
    max: target.max,
    weight: split.weight,
    sets: working.length,
    totalReps,
    targetTotal,
    missingReps,
    minReps
  }

  if (!below.length) {
    // Singles/Doubles/Triples: erst nach zweimal Schaffen steigern (Maximalversuche).
    if (target.mode === 'fixed' && target.target <= CONFIRM_REPS_MAX &&
      !schemeAchieved(previousSessions[0], split.weight, target.target)) {
      return { ...base, state: 'confirm', suggestion: null }
    }
    return {
      ...base,
      state: 'increase',
      // Kraft: 7+ in allen Hauptsätzen -> deutlich über dem Schema, Gewicht war zu leicht.
      aboveScheme: target.mode === 'fixed' && minReps >= TRANSITION_REPS,
      suggestion: buildSuggestion(info, split, target)
    }
  }
  if (target.mode === 'range') {
    return {
      ...base,
      state: 'climb',
      nextReps: Math.min(target.max, minReps + 1),
      // Muskelaufbau unter 8: unter dem Zielbereich (Gewicht eher zu schwer) - nur Hinweis, keine Senkung.
      belowRange: minReps < target.min,
      suggestion: null
    }
  }
  const state = below.length === 1 && below[0].reps === target.target - 1 ? 'close' : 'hold'
  return { ...base, state, suggestion: null }
}

/**
 * Gewichtsvorschlag für die aktuelle Session (nur im Zustand 'increase').
 * @returns {null | { targetReps, increment, baseWeight, suggestedWeights: number[], backoffSets }}
 */
export function getWeightSuggestion(info = {}, lastSessionExercise = null, goal = DEFAULT_TRAINING_GOAL, options = {}) {
  const status = getProgressionStatus(info, lastSessionExercise, goal, options)
  return status?.state === 'increase' ? status.suggestion : null
}

/** Vorschlag für den k-ten Arbeitssatz der aktuellen Session (mehr Sätze als letztes Mal -> letzter Wert). */
export function getSuggestionForSet(suggestion, workingSetIndex) {
  const list = suggestion?.suggestedWeights
  if (!Array.isArray(list) || !list.length || workingSetIndex < 0) return null
  // Letztes Mal gab es Zusatzsätze: Sätze nach den Hauptsätzen bekommen keinen Vorschlag.
  if ((suggestion.backoffSets || 0) > 0 && workingSetIndex >= list.length) return null
  return list[Math.min(workingSetIndex, list.length - 1)]
}
