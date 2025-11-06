/**
 * Utility-Funktionen für die Übersetzung von Übungsnamen
 * zwischen Deutsch und Englisch mit i18n-System Integration
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Composable für Übungsübersetzungen
 * @returns {Object} Translation utilities
 */
export function useExerciseTranslation() {
  const { locale, t } = useI18n()
  
  // Computed für reaktive Übersetzungen basierend auf aktueller Sprache
  const translateExerciseName = computed(() => {
    return (exerciseName) => {
      if (!exerciseName) return exerciseName
      
      // Wenn bereits Englisch ist und wir auf Deutsch umschalten
      if (locale.value === 'de') {
        // Umgekehrte Suche: Englisch → Deutsch
        const englishToGerman = Object.entries(t('exercises.names'))
          .find(([german, english]) => english === exerciseName)
        return englishToGerman?.[0] || exerciseName
      }
      
      // Deutsch → Englisch (Standard)
      return t(`exercises.names.${exerciseName}`, exerciseName)
    }
  })
  
  /**
   * Hilfsfunktion um Übungsnamen für die aktuelle Sprache zu übersetzen
   * @param {string} exerciseName - Der ursprüngliche Übungsname
   * @returns {string} Übersetzter Name oder ursprünglicher Name als Fallback
   */
  const getTranslatedExerciseName = (exerciseName) => {
    return translateExerciseName.value(exerciseName)
  }
  
  /**
   * Überprüft ob eine Übersetzung für einen Übungsnamen existiert
   * @param {string} exerciseName - Der zu prüfende Übungsname
   * @returns {boolean} True wenn Übersetzung verfügbar
   */
  const hasTranslation = (exerciseName) => {
    if (!exerciseName) return false
    
    const translations = t('exercises.names')
    return exerciseName in translations
  }
  
  /**
   * Normalisiert Übungsnamen für konsistente Darstellung
   * @param {string} exerciseName - Der zu normalisierende Name
   * @returns {string} Normalisierter Name
   */
  const normalizeExerciseName = (exerciseName) => {
    if (!exerciseName) return ''
    
    // Entferne überflüssige Leerzeichen und normalisiere
    return exerciseName.trim()
  }
  
  /**
   * Gibt alle verfügbaren Übersetzungen zurück
   * @returns {Object} Alle Übersetzungen als German → English Mapping
   */
  const getAllTranslations = () => {
    return t('exercises.names')
  }
  
  return {
    translateExerciseName,
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
export function translateExercise(exerciseName, locale, translations) {
  if (!exerciseName || !translations) return exerciseName
  
  // Deutsch → Englisch
  if (locale === 'en' && exerciseName in translations) {
    return translations[exerciseName]
  }
  
  // Englisch → Deutsch (umgekehrte Suche)
  if (locale === 'de') {
    const germanName = Object.entries(translations)
      .find(([german, english]) => english === exerciseName)?.[0]
    return germanName || exerciseName
  }
  
  return exerciseName
}