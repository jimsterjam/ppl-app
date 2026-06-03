/**
 * Reine Metrik-Berechnungen für Workouts.
 * Keine Datenbank-, Netzwerk- oder sonstigen Abhängigkeiten.
 */

export function startOfIsoWeek(dateInput) {
  const date = new Date(dateInput);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - isoDay + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function normalizeCategory(input, workoutType) {
  const source = (input || workoutType || 'push').toString().toLowerCase();
  if (source.includes('pull') || source.includes('rück') || source.includes('back')) return 'pull';
  if (source.includes('leg') || source.includes('bein')) return 'legs';
  if (source.includes('core') || source.includes('abs') || source.includes('bauch')) return 'core';
  if (source.includes('cardio')) return 'cardio';
  return 'push';
}

export function calculateExerciseVolume(exercise) {
  if (!exercise) return 0;
  if (Array.isArray(exercise.setDetails) && exercise.setDetails.length) {
    return exercise.setDetails.reduce((sum, set) => {
      if (set?.isWarmup) return sum;
      const reps = Number(set?.reps ?? exercise.reps ?? 0);
      const weight = Number(set?.weight ?? exercise.weight ?? 0);
      // Leere Zeilen (reps=null/0 UND weight=0) überspringen
      if (!reps && !weight) return sum;
      return sum + Math.max(0, reps) * Math.max(0, weight);
    }, 0);
  }
  const sets = Number(exercise.sets) || 1;
  const reps = Number(exercise.reps) || 0;
  const weight = Number(exercise.weight) || 0;
  return Math.max(0, sets) * Math.max(0, reps) * Math.max(0, weight);
}

export function getExerciseBestWeight(exercise) {
  let best = Number(exercise?.weight) || 0;
  if (Array.isArray(exercise?.setDetails)) {
    exercise.setDetails.forEach((set) => {
      if (set?.isWarmup) return;
      const current = Number(set?.weight) || 0;
      if (current > best) best = current;
    });
  }
  return best;
}

export function computeWorkoutMetrics(workout) {
  const metrics = {
    volume: 0,
    bestLifts: [],
    muscleVolume: new Map()
  };

  if (!Array.isArray(workout?.exercises)) {
    return metrics;
  }

  workout.exercises.forEach((exercise) => {
    const exerciseVolume = calculateExerciseVolume(exercise);
    metrics.volume += exerciseVolume;

    const category = normalizeCategory(exercise?.category, workout?.type);
    metrics.muscleVolume.set(category, (metrics.muscleVolume.get(category) || 0) + exerciseVolume);

    const peakWeight = getExerciseBestWeight(exercise);
    if (peakWeight > 0 && exercise?.name) {
      metrics.bestLifts.push({
        name: exercise.name,
        weight: peakWeight,
        reps: Number(exercise.reps) || null
      });
    }
  });

  return metrics;
}
