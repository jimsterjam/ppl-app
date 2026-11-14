// Kleines Hilfsmodul ohne Abhängigkeiten (Modell und Utils dürfen es laden, ohne den Analyse-Dienst zu ziehen).

/**
 * Übung wurde nicht gemacht: sie hat Arbeitssätze, aber keiner davon wurde abgehakt (done:false,
 * siehe Client saveReview/markOpenSetsNotDone). Ältere Daten ohne done-Angabe zählen als gemacht.
 */
export function isExerciseNotDone(exercise) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails.filter(set => set && !set.isWarmup) : [];
  return sets.length > 0 && sets.every(set => set.done === false);
}
