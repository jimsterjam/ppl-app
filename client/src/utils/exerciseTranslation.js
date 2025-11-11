/**
 * Utility-Funktionen für die Übersetzung von Übungsnamen
 * zwischen Deutsch und Englisch mit i18n-System Integration
 */
import { ref, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Composable für Übungsübersetzungen
 * @returns {Object} Translation utilities
 */
export function useExerciseTranslation() {
  const { locale } = useI18n()
  const exercisesData = ref([])

  // Lade die JSON nur einmal (Client-seitig)
  async function loadExercisesData() {
    if (exercisesData.value.length > 0) return
    try {
      const res = await fetch('/data/default-exercises.json')
      exercisesData.value = await res.json()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Fehler beim Laden der default-exercises.json:', e)
    }
  }

  // Sofort laden
  if (typeof window !== 'undefined') {
    loadExercisesData()
  }

  // Übersetzungsfunktion, die aus der JSON sucht
  function normalize(str) {
    return (str || '').trim().toLowerCase()
  }

  const getTranslatedExerciseName = (exerciseName) => {
    if (!exerciseName || exercisesData.value.length === 0) return exerciseName
    const lang = locale.value.startsWith('de') ? 'de' : 'en'
    const normName = normalize(exerciseName)
    const found = exercisesData.value.find(e => normalize(e.name) === normName || normalize(e.name_en) === normName)
    if (!found) return exerciseName
    return lang === 'de' ? found.name : found.name_en
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