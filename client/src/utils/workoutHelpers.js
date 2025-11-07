/**
 * 🏋️ Workout Helper Utilities
 * 
 * @description Wiederverwendbare Funktionen für Workout-Management
 * @usage import { prefillExercises, matchExerciseByIdOrName } from '@/utils/workoutHelpers'
 * 
 * Vereinheitlicht Exercise-Mapping-Logic die vorher dupliziert war in:
 * - prefillFromAISuggestion()
 * - prefillFromRepeatWorkout()
 * - Andere Workout-Builder-Funktionen
 */

import { logger } from './logger'

/**
 * Matched eine Übung aus einer Source-Liste gegen verfügbare Übungen
 * 
 * Matching-Strategie:
 * 1. Exakter Match via _id (wenn vorhanden)
 * 2. Fallback: Name-Match (case-insensitive)
 * 
 * @param {Object} sourceExercise - Die zu matchende Übung (von AI, Repeat, etc.)
 * @param {Array} availableExercises - Liste verfügbarer Übungen aus DB
 * @returns {Object|null} - Gematchte Übung oder null
 */
export const matchExerciseByIdOrName = (sourceExercise, availableExercises) => {
  if (!sourceExercise || !availableExercises || availableExercises.length === 0) {
    return null
  }
  
  // 1. Versuche Match via _id (am zuverlässigsten)
  if (sourceExercise._id) {
    const idMatch = availableExercises.find(ex => ex._id === sourceExercise._id)
    if (idMatch) {
      logger.debug(`✅ Matched via _id: ${idMatch.name}`)
      return idMatch
    }
  }
  
  // 2. Fallback: Match via Name (case-insensitive)
  const sourceName = (sourceExercise.name || '').toLowerCase().trim()
  if (sourceName) {
    const nameMatch = availableExercises.find(ex => 
      (ex.name || '').toLowerCase().trim() === sourceName
    )
    if (nameMatch) {
      logger.debug(`✅ Matched via name: ${nameMatch.name}`)
      return nameMatch
    }
  }
  
  logger.warn(`⚠️ Kein Match gefunden für: ${sourceExercise.name || 'Unbekannt'}`)
  return null
}

/**
 * Generic Exercise Prefill Logic
 * 
 * Nimmt Source-Übungen (von AI, Repeat Workout, etc.) und matched sie
 * gegen verfügbare Datenbank-Übungen. Behält Sets/Reps/Weight bei.
 * 
 * @param {Array} sourceExercises - Übungen die geprefilled werden sollen
 * @param {Array} availableExercises - Verfügbare Übungen aus DB
 * @param {Object} options - Zusätzliche Optionen
 * @param {boolean} options.skipDuplicates - Überspringe bereits existierende (default: true)
 * @param {Array} options.existingExercises - Bereits ausgewählte Übungen
 * @returns {Array} - Gematchte Übungen mit Sets/Reps/Weight
 * 
 * @example
 * const matched = prefillExercises(
 *   aiWorkout.exercises,
 *   allExercises,
 *   { existingExercises: selectedExercises.value }
 * )
 */
export const prefillExercises = (sourceExercises, availableExercises, options = {}) => {
  const {
    skipDuplicates = true,
    existingExercises = []
  } = options
  
  if (!Array.isArray(sourceExercises) || sourceExercises.length === 0) {
    logger.warn('prefillExercises: Keine Source-Übungen vorhanden')
    return []
  }
  
  if (!Array.isArray(availableExercises) || availableExercises.length === 0) {
    logger.warn('prefillExercises: Keine verfügbaren Übungen vorhanden')
    return []
  }
  
  logger.debug(`🔄 Prefill: ${sourceExercises.length} Übungen → ${availableExercises.length} verfügbar`)
  
  const matched = []
  const existingIds = new Set(existingExercises.map(ex => ex._id))
  
  for (const sourceEx of sourceExercises) {
    // Finde Match in verfügbaren Übungen
    const match = matchExerciseByIdOrName(sourceEx, availableExercises)
    
    if (!match) {
      logger.warn(`⚠️ Überspringe: ${sourceEx.name} (kein Match)`)
      continue
    }
    
    // Überspringe Duplikate (optional)
    if (skipDuplicates && existingIds.has(match._id)) {
      logger.debug(`ℹ️ Überspringe Duplikat: ${match.name}`)
      continue
    }
    
    // Erstelle Übung mit original Sets/Reps/Weight
    const prefilled = {
      ...match,
      sets: sourceEx.sets || 3,
      reps: sourceEx.reps || 10,
      weight: sourceEx.weight || null
    }
    
    // Preserve setDetails falls vorhanden
    if (sourceEx.setDetails && Array.isArray(sourceEx.setDetails)) {
      prefilled.setDetails = sourceEx.setDetails
    }
    
    matched.push(prefilled)
    existingIds.add(match._id) // Mark as used
    
    logger.debug(`✅ Prefilled: ${match.name} (${prefilled.sets}×${prefilled.reps})`)
  }
  
  logger.info(`✅ Prefill Complete: ${matched.length}/${sourceExercises.length} matched`)
  return matched
}

/**
 * Erstellt ein Standard-Workout-Objekt mit Default-Werten
 * 
 * @param {Object} overrides - Optionale Überschreibungen
 * @returns {Object} - Workout-Objekt
 */
export const createDefaultWorkout = (overrides = {}) => {
  return {
    name: 'Neues Workout',
    type: 'push',
    exercises: [],
    date: new Date().toISOString(),
    duration: 0,
    notes: '',
    ...overrides
  }
}

/**
 * Validiert ob ein Workout speicherbar ist
 * 
 * @param {Object} workout - Das zu validierende Workout
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
export const validateWorkout = (workout) => {
  const errors = []
  
  if (!workout.name || workout.name.trim().length === 0) {
    errors.push('Workout-Name ist erforderlich')
  }
  
  if (!workout.type || !['push', 'pull', 'legs'].includes(workout.type)) {
    errors.push('Ungültiger Workout-Typ')
  }
  
  if (!Array.isArray(workout.exercises) || workout.exercises.length === 0) {
    errors.push('Mindestens eine Übung erforderlich')
  }
  
  // Validiere jede Übung
  if (workout.exercises) {
    workout.exercises.forEach((ex, idx) => {
      if (!ex.name) {
        errors.push(`Übung ${idx + 1}: Name fehlt`)
      }
      if (!ex.sets || ex.sets < 1) {
        errors.push(`Übung ${idx + 1}: Ungültige Anzahl Sets`)
      }
      if (!ex.reps || ex.reps < 1) {
        errors.push(`Übung ${idx + 1}: Ungültige Anzahl Reps`)
      }
    })
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Berechnet die geschätzte Dauer eines Workouts
 * Basierend auf Anzahl Übungen, Sets und Reps
 * 
 * @param {Array} exercises - Liste der Übungen
 * @returns {number} - Geschätzte Dauer in Minuten
 */
export const estimateWorkoutDuration = (exercises) => {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return 0
  }
  
  let totalMinutes = 5 // Aufwärmen
  
  for (const ex of exercises) {
    const sets = ex.sets || 3
    const reps = ex.reps || 10
    
    // ~3-4 Sekunden pro Rep
    const workTime = (sets * reps * 3.5) / 60 // in Minuten
    
    // ~60-90 Sekunden Pause zwischen Sets
    const restTime = (sets - 1) * 1.25 // in Minuten
    
    totalMinutes += workTime + restTime
  }
  
  totalMinutes += 5 // Cool-down
  
  return Math.round(totalMinutes)
}

export default {
  matchExerciseByIdOrName,
  prefillExercises,
  createDefaultWorkout,
  validateWorkout,
  estimateWorkoutDuration
}
