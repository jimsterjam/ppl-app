// Welche Fragen nach dem Training gestellt werden (Backlog F16, Etappe 2) - reine Logik, ohne Oberfläche.
//
// Keine festen Fragen: höchstens zwei Themen je Workout, je Übung höchstens eins, Vorrang A > B > C.
//   A Absicht ('intent'):      Schema anders, Gewicht deutlich niedriger oder Übung ausgelassen
//   B letzter Satz ('last_set'): die Steigerung steht an (Kraft: beim zweiten Schaffen, Muskelaufbau: beim ersten Mal 12)
//   C Vergleich ('compare'):   gleiches Schema, Zahlen gleich oder knapp darunter
// Bewusst ohne Vue-/Store-Imports, damit alles direkt testbar ist. Wer fragt (Einwilligung, Kontingent, Schalter,
// Bearbeiten) entscheidet die Oberfläche (Etappe 3), nicht diese Datei.
import {
  getProgressionStatus, getWorkingSets, splitMainAndBackoffSets, isNoLoadExercise, incrementFor, compatibleSessions
} from './weightSuggestion.js'

export const MAX_QUESTION_TOPICS = 2

// ---- Stellschrauben (beim echten Training prüfen, Absprache Jimmy 14.11.) -------------------------------------
// Schwelle für das Gewicht: 5 % ODER ein kleiner Gewichtsschritt (2,5 kg, Kurzhanteln 2 kg), je nachdem was größer ist.
// Bis einschließlich zur Schwelle darunter gilt C (knapp darunter), darüber A.
export const WEIGHT_THRESHOLD_RATIO = 0.05
// Wiederholungen: bis zu 5 % oder eine Wiederholung weniger zählt noch als "etwas weniger" (C).
export const REPS_THRESHOLD_RATIO = 0.05
// Schema "anders": mindestens so viele Sätze mehr/weniger oder so viele Wiederholungen mehr/weniger je Satz
// (5x5 -> 3x10 ist anders, 4x8 -> 3x10 nicht).
export const SCHEME_SETS_DIFF = 2
export const SCHEME_REPS_DIFF = 3
// ------------------------------------------------------------------------------------------------------------------

const TOPIC_PRIORITY = { intent: 0, last_set: 1, compare: 2 }

/** Gewichtsschwelle in kg für eine Übung, bezogen auf das Gewicht beim letzten Mal. */
export function weightThreshold(info, referenceWeight) {
  return Math.max((Number(referenceWeight) || 0) * WEIGHT_THRESHOLD_RATIO, incrementFor(info))
}

function round(value) {
  return Math.round(value * 100) / 100
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Nicht gemacht: Arbeitssätze vorhanden, aber keiner abgehakt (wie auf dem Server, utils/exerciseDone.js). */
export function isExerciseSkipped(exercise) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails.filter((set) => set && !set.isWarmup) : []
  return sets.length > 0 && sets.every((set) => set.done === false)
}

/** Hauptsätze einer Session ({ sets, reps (mittlerer Wert), repsList (je Satz), totalReps, weight }) oder null (Pyramide, Körpergewicht, leer). */
export function mainSetsSummary(exercise) {
  const working = getWorkingSets(exercise)
  if (!working.length || working.some((set) => set.weight <= 0)) return null
  const split = splitMainAndBackoffSets(working)
  if (!split) return null
  const reps = split.main.map((set) => set.reps)
  return {
    sets: split.main.length,
    reps: median(reps),
    repsList: reps,
    totalReps: reps.reduce((sum, value) => sum + value, 0),
    weight: split.weight
  }
}

/** Ist das Schema (Satzzahl, Wiederholungen je Satz) deutlich anders als beim letzten Mal? */
export function schemeDiffers(now, last) {
  return Math.abs(now.sets - last.sets) >= SCHEME_SETS_DIFF || Math.abs(now.reps - last.reps) >= SCHEME_REPS_DIFF
}

function detectForExercise({ index, name, info, goal, workoutGoal, exercise, recent }) {
  const facts = { name }
  // Ohne Wiederholungsziel/Gewicht keine Fragen (Technik, Explosiv, Zeit, Körpergewicht) - auch nicht beim Auslassen.
  if (isNoLoadExercise(info) || goal === 'technique' || goal === 'explosive') return null
  // A: Übung ausgelassen
  if (isExerciseSkipped(exercise)) {
    return { topic: 'intent', kind: 'skipped', exerciseIndex: index, facts }
  }
  const now = mainSetsSummary(exercise)
  if (!now) return null
  // "Beim letzten Mal" = letzte Session derselben Trainingsart (wie beim Hinweis über den Sätzen). Ein bewusster
  // Wechsel von Kraft auf Muskelaufbau ist über die Zielwahl schon bekannt und braucht keine Frage.
  const lastRaw = compatibleSessions(info, recent, goal)[0] || null
  const last = lastRaw && !isExerciseSkipped(lastRaw) ? mainSetsSummary(lastRaw) : null

  if (last) {
    // Mehr Gewicht bei weniger Wiederholungen (12 -> 8 nach einer Steigerung) ist normaler Fortschritt, kein neues Schema.
    const differs = now.weight <= last.weight && schemeDiffers(now, last)
    const drop = last.weight - now.weight
    if (differs || round(drop) > round(weightThreshold(info, last.weight))) {
      return {
        topic: 'intent',
        kind: differs ? 'scheme' : 'weight_drop',
        exerciseIndex: index,
        facts: { ...facts, now, last }
      }
    }
  }

  // B: die Steigerung steht an. Die Einschätzung kommt aus derselben Logik wie der Hinweis über den Sätzen.
  // Die wirksame Trainingsart der Übung (auch eine eigene Wahl) mitgeben, sonst gilt das Workout-Ziel und die Übung passt nicht zu sich selbst.
  const status = getProgressionStatus(info, { ...exercise, __workoutGoal: workoutGoal, trainingType: goal }, goal, { previousSessions: recent })
  if (status?.state === 'increase' && !status.aboveScheme) {
    // Schon beim letzten Mal "steigern"? Dann wurde die Frage damals gestellt (oder der Nutzer hat nicht gesteigert).
    const before = recent[0] ? getProgressionStatus(info, recent[0], goal, { previousSessions: recent.slice(1) }) : null
    // Nur wenn die damalige Steigerung selbst B-tauglich war; "Gewicht klar zu leicht" (aboveScheme) hat keine Frage ausgelöst.
    if (!(before?.state === 'increase' && !before.aboveScheme)) {
      return { topic: 'last_set', kind: status.mode, exerciseIndex: index, facts: { ...facts, now } }
    }
  }

  // C: gleiches Schema, nichts besser, aber höchstens knapp darunter
  if (last) {
    const weightDrop = last.weight - now.weight
    const repsDrop = last.totalReps - now.totalReps
    const repsAllowed = Math.max(1, last.totalReps * REPS_THRESHOLD_RATIO)
    const notBetter = weightDrop >= 0 && repsDrop >= 0
    // Nur Gleiches mit Gleichem vergleichen: gleiche Satzzahl (5x8 und 4x10 haben beide 40 Wdh., sind aber nicht dasselbe).
    const sameShape = now.sets === last.sets
    const identical = weightDrop === 0 && repsDrop === 0
    // Gleiche Gesamtzahl, aber Sätze einzeln anders (12/12/6 oder 12/8/10 statt 10/10/10 bzw. 11/9/10): weder "gleich" noch
    // "weniger" - keine Frage.
    const sameSetByRep = now.repsList.every((value, i) => value === last.repsList[i])
    if (sameShape && notBetter && !(identical && !sameSetByRep) && round(weightDrop) <= round(weightThreshold(info, last.weight)) && repsDrop <= repsAllowed) {
      const same = identical
      return {
        topic: 'compare',
        kind: same ? 'same' : 'less',
        exerciseIndex: index,
        facts: { ...facts, now, last }
      }
    }
  }
  return null
}

/**
 * Entscheidet, welche Themen nach dem Training gefragt werden.
 * @param {object} input
 * @param {string} input.workoutGoal - Ziel des Workouts ('strength' | 'hypertrophy' ...)
 * @param {Array<{ index:number, name:string, info:object, goal:string, exercise:object, recent:Array }>} input.exercises
 *   je Übung des Workouts: `info` wie bei getProgressionStatus, `goal` = wirksame Trainingsart der Übung, `exercise` = die
 *   Übung dieses Workouts, `recent` = dieselbe Übung aus früheren Sessions, neueste zuerst (ohne dieses Workout)
 * @returns {Array<{ topic:'intent'|'last_set'|'compare', kind:string, exerciseIndex:number, facts:object }>}
 *   höchstens MAX_QUESTION_TOPICS, je Übung eins, sortiert nach Vorrang A > B > C, dann Reihenfolge im Workout
 */
export function detectQuestionTopics({ workoutGoal, exercises = [] } = {}) {
  const found = []
  for (const entry of Array.isArray(exercises) ? exercises : []) {
    if (!entry?.exercise) continue
    const topic = detectForExercise({ ...entry, workoutGoal, recent: Array.isArray(entry.recent) ? entry.recent : [] })
    if (topic) found.push(topic)
  }
  found.sort((a, b) => TOPIC_PRIORITY[a.topic] - TOPIC_PRIORITY[b.topic] || a.exerciseIndex - b.exerciseIndex)
  return found.slice(0, MAX_QUESTION_TOPICS)
}
