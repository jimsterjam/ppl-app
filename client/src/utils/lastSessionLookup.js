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
  return sets.some((set) => set && !set.isWarmup && (Number(set.reps) || 0) > 0)
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
