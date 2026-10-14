// "Nicht gemacht" (Absprache Paul 13.10.): Eine Übung gilt als nicht gemacht, wenn sie Arbeitssätze hat und keiner
// davon abgehakt wurde (done:false, siehe saveReview.markOpenSetsNotDone). Ältere Daten ohne done-Angabe zählen als gemacht.

export function isExerciseNotDone(exercise) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails.filter((set) => set && !set.isWarmup) : []
  return sets.length > 0 && sets.every((set) => set.done === false)
}

/** @returns {Array<{ name: string, note: string }>} nicht gemachte Übungen eines gespeicherten Workouts mit ihrer Notiz */
export function getNotDoneExercises(workout) {
  return (Array.isArray(workout?.exercises) ? workout.exercises : [])
    .filter(isExerciseNotDone)
    .map((exercise) => ({ name: exercise.name || '', note: typeof exercise.note === 'string' ? exercise.note.trim() : '' }))
}
