/**
 * Utility-Funktionen für die Übersetzung von Übungsnamen
 * zwischen Deutsch und Englisch mit i18n-System Integration
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadDefaultExercises, getCachedDefaultExercises } from '@/utils/defaultExercisesLoader'

/**
 * Composable für Übungsübersetzungen
 * @returns {Object} Translation utilities
 */
export function useExerciseTranslation() {
  const { locale, t } = useI18n()
  const exercisesData = ref(getCachedDefaultExercises())
  loadDefaultExercises()
    .then((data) => {
      exercisesData.value = data
    })
    .catch(() => {})

  // Übersetzungsfunktion, die aus der JSON sucht
  function normalize(str) {
    return (str || '').trim().toLowerCase()
  }

  function capitalizeFirst(str) {
    const s = String(str || '')
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  }

  const isGerman = () => locale.value.startsWith('de')

  const getTranslatedExerciseName = (exerciseName) => {
    if (!exerciseName || exercisesData.value.length === 0) return exerciseName
    const normName = normalize(exerciseName)
    const found = exercisesData.value.find(e => normalize(e.name) === normName || normalize(e.name_en) === normName)
    if (!found) return exerciseName
    // Product decision: exercise names are always displayed in English.
    return found.name_en || found.name || exerciseName
  }

  function findByField(field, value) {
    if (!value) return null
    const normValue = normalize(value)
    return exercisesData.value.find(ex => normalize(ex[field]) === normValue || normalize(ex[`${field}_en`]) === normValue)
  }

  // Die Übungsdaten unterscheiden Beinmuskeln im deutschen muscleGroup-Feld NICHT fein -
  // Quadrizeps, Beinbeuger, Gesäß, Adduktoren und Abduktoren stehen dort alle als "Quadrizeps"
  // (nur das englische muscleGroup_en-Feld ist feiner, wird aber nicht zum Filtern verwendet).
  // Statt der irreführenden Fachbezeichnung "Quadrizeps" für alle Beinübungen zeigen wir
  // sinngemäß "Beine"/"Legs" - laienverständlicher und passt zu dem, was die Daten tatsächlich
  // hergeben (siehe Rückmeldung: "Quadrizeps" tauchte im Filter durch einen Seiteneffekt sogar
  // doppelt auf, weil "Hamstrings"/"Gluteus" als eigene Filterwerte in den Daten gar nicht
  // existieren). Der zugrunde liegende Filterwert bleibt "Quadrizeps" (siehe ExerciseList.vue),
  // nur die Anzeige ändert sich - hier zentral, damit Übungskarten und Filter-Dropdown
  // konsistent bleiben.
  const MUSCLE_GROUP_LABELS = {
    'quadrizeps': { de: 'Beine', en: 'Legs' }
  }

  const getTranslatedMuscleGroup = (muscleGroup) => {
    if (!muscleGroup) return ''
    const override = MUSCLE_GROUP_LABELS[normalize(muscleGroup)]
    if (override) return isGerman() ? override.de : override.en
    const found = findByField('muscleGroup', muscleGroup)
    if (!found) return muscleGroup
    return isGerman() ? found.muscleGroup : (found.muscleGroup_en || muscleGroup)
  }

  // Sinngemäße Anzeige-Begriffe statt wörtlicher Übersetzung (z.B. "leverage machine" ->
  // "Kraftmaschine" statt "Hebelmaschine" - im Fitnessstudio üblicher Sprachgebrauch, siehe
  // Rückmeldung). Notwendig, weil in default-exercises.json ein Teil der "equipment"-Werte
  // (deutsches Feld) NIE übersetzt wurde - dort steht z.B. "bosu ball" identisch in equipment
  // UND equipment_en, ein reiner Datensatz-Lookup liefert also weiterhin Rohenglisch/
  // Kleinschreibung. Keys hier sind normalisiert (trim + lowercase) gegen equipment/equipment_en.
  const EQUIPMENT_LABELS = {
    'kabelzug': { de: 'Kabelzug', en: 'Cable' },
    'cable': { de: 'Kabelzug', en: 'Cable' },
    'kettlebell': { de: 'Kettlebell', en: 'Kettlebell' },
    'kurzhanteln': { de: 'Kurzhanteln', en: 'Dumbbells' },
    'dumbbells': { de: 'Kurzhanteln', en: 'Dumbbells' },
    'dumbbell': { de: 'Kurzhanteln', en: 'Dumbbells' },
    'körpergewicht': { de: 'Körpergewicht', en: 'Bodyweight' },
    'bodyweight': { de: 'Körpergewicht', en: 'Bodyweight' },
    'eigengewicht': { de: 'Körpergewicht', en: 'Bodyweight' },
    'langhantel': { de: 'Langhantel', en: 'Barbell' },
    'barbell': { de: 'Langhantel', en: 'Barbell' },
    'maschine': { de: 'Maschine', en: 'Machine' },
    'machine': { de: 'Maschine', en: 'Machine' },
    'leverage machine': { de: 'Kraftmaschine', en: 'Leverage Machine' },
    'medizinball': { de: 'Medizinball', en: 'Medicine Ball' },
    'medicine ball': { de: 'Medizinball', en: 'Medicine Ball' },
    'medicineball': { de: 'Medizinball', en: 'Medicine Ball' },
    'resistance band': { de: 'Widerstandsband', en: 'Resistance Band' },
    'band': { de: 'Widerstandsband', en: 'Resistance Band' },
    'sandbag': { de: 'Sandsack', en: 'Sandbag' },
    'assisted': { de: 'Unterstützte Maschine', en: 'Assisted Machine' },
    'assisted (towel)': { de: 'Unterstützt (Handtuch)', en: 'Assisted (Towel)' },
    'bosu ball': { de: 'Bosu-Ball', en: 'Bosu Ball' },
    'hammer': { de: 'Hammer-Maschine', en: 'Hammer Machine' },
    'roller': { de: 'Rolle', en: 'Roller' },
    'rope': { de: 'Seil', en: 'Rope' },
    'stability ball': { de: 'Gymnastikball', en: 'Stability Ball' },
    'stationary bike': { de: 'Ergometer', en: 'Stationary Bike' },
    'tire': { de: 'Reifen', en: 'Tire' },
    'upper body ergometer': { de: 'Armergometer', en: 'Upper Body Ergometer' },
    'weighted': { de: 'Zusatzgewicht', en: 'Added Weight' },
    'wheel roller': { de: 'Ab-Roller', en: 'Ab Wheel' }
  }

  const getTranslatedEquipment = (equipment) => {
    if (!equipment) return ''
    const override = EQUIPMENT_LABELS[normalize(equipment)]
    if (override) return isGerman() ? override.de : override.en

    const found = findByField('equipment', equipment)
    const resolved = found ? (isGerman() ? found.equipment : (found.equipment_en || equipment)) : equipment
    // Kein Eintrag in EQUIPMENT_LABELS und auch kein Datensatz-Treffer (oder der Datensatz
    // selbst liefert Rohtext) - zumindest sicherstellen, dass nichts kleingeschrieben beginnt.
    return capitalizeFirst(resolved)
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