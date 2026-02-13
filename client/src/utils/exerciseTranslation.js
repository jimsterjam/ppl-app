/**
 * Utility-Funktionen für die Übersetzung von Übungsnamen
 * zwischen Deutsch und Englisch mit i18n-System Integration
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import defaultExercises from '@/data/default-exercises.json'
import { normalizeDefaultExercises } from '@/utils/normalizeDefaultExercises'

/**
 * Composable für Übungsübersetzungen
 * @returns {Object} Translation utilities
 */
export function useExerciseTranslation() {
  const { locale, t } = useI18n()
  // Immer synchron und offlinefähig
  const exercisesData = ref(normalizeDefaultExercises(defaultExercises))

  // Übersetzungsfunktion, die aus der JSON sucht
  function normalize(str) {
    return (str || '').trim().toLowerCase()
  }

  const isGerman = () => locale.value.startsWith('de')

  const getTranslatedExerciseName = (exerciseName) => {
    if (!exerciseName || exercisesData.value.length === 0) return exerciseName
    const normName = normalize(exerciseName)
    const found = exercisesData.value.find(e => normalize(e.name) === normName || normalize(e.name_en) === normName)
    if (!found) return exerciseName
    return isGerman() ? found.name : found.name_en
  }

  function findByField(field, value) {
    if (!value) return null
    const normValue = normalize(value)
    return exercisesData.value.find(ex => normalize(ex[field]) === normValue || normalize(ex[`${field}_en`]) === normValue)
  }

  const getTranslatedMuscleGroup = (muscleGroup) => {
    if (!muscleGroup) return ''
    const found = findByField('muscleGroup', muscleGroup)
    if (!found) return muscleGroup
    return isGerman() ? found.muscleGroup : (found.muscleGroup_en || muscleGroup)
  }

  const getTranslatedEquipment = (equipment) => {
    if (!equipment) return ''
    const found = findByField('equipment', equipment)
    if (!found) return equipment
    return isGerman() ? found.equipment : (found.equipment_en || equipment)
  }

  const getLocalizedDescription = (exercise) => {
    if (!exercise) return ''
    if (isGerman()) {
      return exercise.description || exercise.description_en || ''
    }
    return exercise.description_en || exercise.description || ''
  }

  const categoryKeyMap = {
    Push: 'push',
    Pull: 'pull',
    Legs: 'legs',
    Core: 'core',
    'Full Body': 'fullBody',
    Cardio: 'cardio'
  }

  const getTranslatedCategory = (category) => {
    if (!category) return ''
    const key = categoryKeyMap[category] || category.toLowerCase().replace(/\s+/g, '')
    const translated = t(`exercises.categoryLabels.${key}`)
    return translated === `exercises.categoryLabels.${key}` ? category : translated
  }

  // Hilfsfunktion: gibt true zurück, wenn Übersetzung existiert
  const hasTranslation = (exerciseName) => {
    if (!exerciseName || exercisesData.value.length === 0) return false
    const normName = normalize(exerciseName)
    return exercisesData.value.some(e => normalize(e.name) === normName || normalize(e.name_en) === normName)
  }

  // Normalisiert Namen (wie vorher)
  const normalizeExerciseName = (exerciseName) => {
    if (!exerciseName) return ''
    return exerciseName.trim()
  }

  // Gibt alle Übersetzungen zurück
  const getAllTranslations = () => {
    return exercisesData.value
  }

  return {
    getTranslatedExerciseName,
    getTranslatedMuscleGroup,
    getTranslatedEquipment,
    getLocalizedDescription,
    getTranslatedCategory,
    hasTranslation,
    normalizeExerciseName,
    getAllTranslations
  }
}

/**
 * Standalone-Funktion für einfache Übersetzungen ohne Composable
 * @param {string} exerciseName - Übungsname
 * @param {string} locale - Zielsprache ('de' oder 'en')
 * @param {Object} translations - Übersetzungsmapping
 * @returns {string} Übersetzter Name
 */
// Nicht mehr benötigt, da alles über die JSON läuft