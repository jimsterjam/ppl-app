// Baut die Eingabe für detectQuestionTopics (utils/postWorkoutQuestions.js) aus einem gespeicherten Workout, dem Verlauf
// und dem Übungskatalog - dieselbe Aufbereitung wie der Hinweis über den Sätzen im laufenden Workout (WorkoutDetailView).
// Reine Funktion, ohne Vue-/Store-Imports.
import { prepareHistoryCandidates, findRecentSessionExercises, COMPATIBLE_LOOKBACK_SESSIONS } from '@/utils/lastSessionLookup'
import { buildCatalogIndex, findCatalogEntry } from '@/utils/exerciseMatch'
import { resolveExerciseGoal, sanitizeExerciseTrainingType } from '@/utils/weightSuggestion'
import { sanitizeWorkoutGoal } from '@/utils/workoutGoal'

function progressionInfo(ex, cat) {
  return {
    name: ex?.name,
    name_en: cat.name_en,
    category: cat.category_raw || cat.category || ex?.category,
    equipment: cat.equipment || ex?.equipment,
    equipment_en: cat.equipment_en || ex?.equipment_en,
    aiMetadata: cat.aiMetadata || ex?.aiMetadata,
    measureMode: ex?.measureMode
  }
}

/**
 * @param {object} input
 * @param {object} input.workout - das gespeicherte (abgeschlossene) Workout
 * @param {Array} input.history - Workouts des Nutzers (auch das aktuelle darf enthalten sein)
 * @param {Array} input.catalog - Übungskatalog
 * @param {string[]} [input.currentIds] - alle bekannten IDs des aktuellen Workouts (echte und temporäre), damit es sich nicht
 *   mit sich selbst vergleicht
 * @param {string} [input.fallbackGoal] - zuletzt gewähltes Workout-Ziel für Workouts ohne Ziel
 * @returns {{ workoutGoal: string, exercises: Array }} Eingabe für detectQuestionTopics
 */
export function buildQuestionInput({ workout, history = [], catalog = [], currentIds = [], fallbackGoal = '' } = {}) {
  const workoutGoal = sanitizeWorkoutGoal(workout?.goal) || sanitizeWorkoutGoal(fallbackGoal) || 'hypertrophy'
  const ids = [workout?._id, workout?.id, ...currentIds].map((id) => String(id || '').trim()).filter(Boolean)
  let candidates = Array.isArray(history) ? history : []
  for (const id of ids.length ? ids : ['']) candidates = prepareHistoryCandidates(candidates, id)
  const index = buildCatalogIndex(catalog)

  const exercises = (Array.isArray(workout?.exercises) ? workout.exercises : []).map((ex, i) => {
    const cat = findCatalogEntry(index, ex || {}) || {}
    const info = progressionInfo(ex, cat)
    const recent = findRecentSessionExercises(
      { name: ex?.name, exerciseId: ex?.exerciseId, _id: ex?._id, muscleGroup: ex?.muscleGroup },
      candidates,
      // Wie der Kasten und "Nächstes Mal": bis zur letzten Einheit derselben Trainingsart zurückschauen.
      COMPATIBLE_LOOKBACK_SESSIONS
    )
    const override = sanitizeExerciseTrainingType(ex?.trainingType) || sanitizeExerciseTrainingType(recent[0]?.trainingType) || null
    return {
      index: i,
      name: ex?.name || '',
      info,
      goal: resolveExerciseGoal(info, workoutGoal, override),
      exercise: ex,
      recent
    }
  })
  return { workoutGoal, exercises }
}
