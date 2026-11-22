// Findet dieselbe Übung in der letzten abgeschlossenen Session (für den Gewichtsvorschlag, siehe
// weightSuggestion.js). Filter- und Abgleich-Reihenfolge entsprechen bewusst
// maybePrefillFromLastFavoritePerformance() in WorkoutDetailView.vue (diese Funktion bleibt
// unverändert): Duplikate nach ID entfernen (neuester Stand gewinnt), keine Entwürfe, nur
// abgeschlossene Workouts, aktuelles Workout ausgeschlossen, neueste zuerst; Abgleich per
// Übungs-ID, dann Name + Muskelgruppe, dann nur Name.

function ts(workout) {
  return new Date(workout?.updatedAt || workout?.date || workout?.createdAt || 0).getTime() || 0
}

function matchKeys(exercise = {}) {
  const byId = String(exercise?.exerciseId || exercise?._id || '').trim()
  const name = String(exercise?.name || '').trim().toLowerCase()
  const muscle = String(exercise?.muscleGroup || '').trim().toLowerCase()
  return {
    idKey: byId ? `id:${byId}` : '',
    nameKey: `name:${name}|muscle:${muscle}`,
    looseNameKey: `name:${name}`,
    name
  }
}

function hasWorkingSets(exercise = {}) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  return sets.some((set) => set && !set.isWarmup && set.done !== false
    && ((Number(set.reps) || 0) > 0 || (Number(set.durationSeconds) || 0) > 0))
}

/** Vorbereitete Liste der Kandidaten-Workouts (einmal pro geöffnetem Workout berechnen). */
export function prepareHistoryCandidates(historyWorkouts = [], currentWorkoutId = '') {
  const currentId = String(currentWorkoutId || '').trim()
  const deduped = new Map()
  for (const workout of Array.isArray(historyWorkouts) ? historyWorkouts : []) {
    if (!workout) continue
    const key = String(workout._id || workout.id || '').trim() || `anon:${ts(workout)}:${deduped.size}`
    const existing = deduped.get(key)
    if (!existing || ts(workout) >= ts(existing)) deduped.set(key, workout)
  }
  return Array.from(deduped.values())
    .filter((w) => String(w?._id || w?.id || '').trim() !== currentId || !currentId)
    .filter((w) => w?._isDraft !== true && w?.isDraft !== true)
    .filter((w) => w?.completed === true || w?.completed === undefined)
    .sort((a, b) => ts(b) - ts(a))
}

/**
 * Antwort des Nutzers (Fragen nach dem Training, F16) zu GENAU dieser Übung des Workouts, oder null. Wie auf dem Server
 * (activeAthleteAnswerMap in server/utils/athleteAnswers.js) zählt sie nur, wenn Position UND Name noch passen: wurde die Übung
 * danach ersetzt oder verschoben, gehört die Antwort nicht mehr dazu. Die Antworten stehen im Workout selbst (kommen vom Server mit).
 * @returns {{topic:string, answer:string}|null}
 */
export function athleteAnswerFor(workout, exercise) {
  const stored = Array.isArray(workout?.athlete_answers) ? workout.athlete_answers : []
  if (!stored.length || !exercise) return null
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : []
  const index = exercises.indexOf(exercise)
  if (index < 0) return null
  const name = String(exercise?.name || '').trim().toLowerCase()
  const entry = stored.find((item) => item && item.exerciseIndex === index && String(item.exercise || '').trim().toLowerCase() === name)
  return entry && typeof entry.topic === 'string' && typeof entry.answer === 'string' ? { topic: entry.topic, answer: entry.answer } : null
}

/**
 * Dieselbe Übung aus den neuesten passenden Sessions (neueste zuerst), höchstens `limit` Stück -
 * Grundlage für die Schema-Erkennung (5x5, 6x1 ...) und die Bestätigungs-Regel bei Singles.
 */
// So weit zurück schaut die Einschätzung "starker Einbruch" (Workout-Kasten, Fragen nach dem Training) nach der letzten Einheit derselben
// Trainingsart - wie "Nächstes Mal" auf dem Server (LOOKBACK_SESSIONS in server/utils/nextSessionFocus.js). Die letzten Einheiten können
// eine andere Trainingsart haben und fallen beim Vergleich weg.
export const COMPATIBLE_LOOKBACK_SESSIONS = 12

export function findRecentSessionExercises(currentExercise = {}, candidates = [], limit = 3) {
  const found = []
  for (const workout of candidates) {
    if (found.length >= limit) break
    const match = findLastSessionExercise(currentExercise, [workout])
    // Workout-Ziel der Session mitgeben: Hinweise vergleichen nur Sessions derselben Trainingsart
    // (isSessionCompatible in weightSuggestion.js). Ebenso die Antwort des Nutzers zu dieser Übung (Fragen nach dem Training).
    if (match) {
      const answer = athleteAnswerFor(workout, match)
      found.push(workout?.goal || answer
        ? { ...match, ...(workout?.goal ? { __workoutGoal: workout.goal } : {}), ...(answer ? { __athleteAnswer: answer } : {}) }
        : match)
    }
  }
  return found
}

/** Übung aus der neuesten passenden Session, oder null. */
export function findLastSessionExercise(currentExercise = {}, candidates = []) {
  const target = matchKeys(currentExercise)
  if (!target.idKey && !target.name) return null
  const strictNameKey = target.nameKey

  for (const workout of candidates) {
    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : []
    for (const exercise of exercises) {
      const keys = matchKeys(exercise)
      const isMatch =
        (target.idKey && keys.idKey && target.idKey === keys.idKey) ||
        (target.name && keys.looseNameKey === `name:${target.name}`) ||
        (target.name && keys.nameKey === strictNameKey)
      if (isMatch && hasWorkingSets(exercise)) return exercise
    }
  }
  return null
}
