/**
 * Training Analysis Service
 * Reine Backend-Berechnungen – KEINE AI-Abhängigkeit
 *
 * Verantwortlich für:
 * - Trainingsvolumen-Berechnung
 * - Gewichtsveränderungen
 * - Wiederholungsveränderungen
 * - Trend-Erkennung
 * - Daten-Strukturierung für AI
 */

import { logger } from '../utils/logger.js';

/**
 * Berechne echte Exercise-Stats
 * Nutzt setDetails wenn vorhanden (modern), sonst weight/reps/sets (legacy)
 * Ignoriert Warm-up Sets
 *
 * @param {Object} exercise - Exercise-Objekt aus Workout
 * @returns {Object|null} { weight, reps, sets, volume } oder null wenn keine echten Sets
 */
export function calculateExerciseStats(exercise) {
  if (!exercise) return null;

  // Moderne Struktur: setDetails mit isWarmup-Flag
  if (Array.isArray(exercise.setDetails) && exercise.setDetails.length > 0) {
    const workingSets = exercise.setDetails.filter(set => !set.isWarmup);
    if (workingSets.length === 0) return null; // Keine echten Sets

    const avgWeight = workingSets.reduce((sum, set) => sum + (set.weight || 0), 0) / workingSets.length;
    const avgReps = workingSets.reduce((sum, set) => sum + (set.reps || 0), 0) / workingSets.length;
    const totalVolume = workingSets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);

    return {
      weight: Math.round(avgWeight * 10) / 10,
      reps: Math.round(avgReps * 10) / 10,
      sets: workingSets.length,
      volume: totalVolume
    };
  }

  // Legacy-Struktur: weight/reps/sets direkt
  if (exercise.weight && exercise.reps && exercise.sets) {
    return {
      weight: exercise.weight,
      reps: exercise.reps,
      sets: exercise.sets,
      volume: exercise.weight * exercise.reps * exercise.sets
    };
  }

  return null;
}

/**
 * Bestimme Trend basierend auf Gewichts- und Volumenveränderung
 *
 * @param {number} weightChange - Kg-Differenz
 * @param {number} volumeChange - Prozentuale Volumenveränderung
 * @returns {string} 'positive' | 'negative' | 'stable'
 */
export function determineTrend(weightChange, volumeChange) {
  if (weightChange > 0 || volumeChange > 5) {
    return 'positive';
  } else if (weightChange < -2 || volumeChange < -5) {
    return 'negative';
  } else {
    return 'stable';
  }
}

/**
 * Analysiere eine einzelne Übung (aktuell vs. vorherig)
 *
 * @param {string} exerciseName - Name der Übung
 * @param {Object} currentEx - Aktuelle Übung
 * @param {Object} previousEx - Vorherige Übung (optional)
 * @param {number} daysDiff - Tage seit letzter Session
 * @returns {Object} Analysis-Objekt
 */
export function analyzeExercise(exerciseName, currentEx, previousEx = null, daysDiff = 0) {
  const currentStats = calculateExerciseStats(currentEx);

  if (!currentStats) {
    return null; // Keine echten Sets in Current
  }

  let analysis = {
    exercise: exerciseName,
    current: currentStats,
    previous: null,
    changes: {
      weight_change: 0,
      rep_change: 0,
      volume_change: 0,
      volume_change_percent: 0
    },
    progression: 'first_session',
    period_days: daysDiff
  };

  // Wenn vorherige Session existiert
  if (previousEx) {
    const prevStats = calculateExerciseStats(previousEx);
    if (prevStats) {
      const volumeChangePct = prevStats.volume > 0
        ? Math.round(((currentStats.volume - prevStats.volume) / prevStats.volume) * 100 * 10) / 10
        : 0;

      analysis.previous = prevStats;
      analysis.changes = {
        weight_change: Math.round((currentStats.weight - prevStats.weight) * 10) / 10,
        rep_change: Math.round((currentStats.reps - prevStats.reps) * 10) / 10,
        volume_change: Math.round((currentStats.volume - prevStats.volume) * 10) / 10,
        volume_change_percent: volumeChangePct
      };

      analysis.progression = determineTrend(analysis.changes.weight_change, volumeChangePct);

      // Kategorisiere Zeitraum
      if (daysDiff > 30) {
        analysis.period = `${Math.floor(daysDiff / 7)} weeks`;
      } else if (daysDiff >= 7) {
        analysis.period = '1 week';
      } else if (daysDiff > 0) {
        analysis.period = `${daysDiff} days`;
      } else {
        analysis.period = 'same day';
      }
    }
  }

  return analysis;
}

/**
 * Analysiere komplettes Workout mit historischem Vergleich
 *
 * @param {Object} currentWorkout - Aktuelles Workout
 * @param {Array} allWorkouts - Alle Workouts des Users (sortiert nach Datum DESC)
 * @returns {Array} Array von Exercise-Analysen
 */
export function analyzeWorkoutProgression(currentWorkout, allWorkouts) {
  const analysisResults = [];

  for (const exercise of currentWorkout.exercises || []) {
    const exerciseName = exercise.name || 'Unknown';

    try {
      // Finde letzte Session der gleichen Übung
      const previousWorkout = allWorkouts.find(w => {
        if (w._id.toString() === currentWorkout._id.toString()) return false;
        return w.exercises?.some(e => (e.name || '').toLowerCase() === exerciseName.toLowerCase());
      });

      let previousEx = null;
      let daysDiff = 0;

      if (previousWorkout) {
        previousEx = previousWorkout.exercises?.find(
          e => (e.name || '').toLowerCase() === exerciseName.toLowerCase()
        );
        daysDiff = Math.floor(
          (new Date(currentWorkout.date) - new Date(previousWorkout.date)) / (1000 * 60 * 60 * 24)
        );
      }

      const analysis = analyzeExercise(exerciseName, exercise, previousEx, daysDiff);

      if (analysis) {
        analysisResults.push(analysis);
      }

    } catch (error) {
      logger.error('Error analyzing exercise', {
        exercise: exerciseName,
        error: error.message
      });
    }
  }

  return analysisResults;
}

/**
 * Strukturiere Trainingsanalysen für AI-Eingabe
 * Dies ist der "Mini-Datensatz" den das LLM erhält
 *
 * @param {Array} exerciseAnalyses - Array von analyzeExercise() Ergebnissen
 * @returns {Object} Strukturierte Daten für AI
 */
export function structureAnalysisForAI(exerciseAnalyses) {
  if (!Array.isArray(exerciseAnalyses) || exerciseAnalyses.length === 0) {
    return null;
  }

  // Statistiken über alle Übungen
  const positiveExercises = exerciseAnalyses.filter(e => e.progression === 'positive');
  const negativeExercises = exerciseAnalyses.filter(e => e.progression === 'negative');
  const stableExercises = exerciseAnalyses.filter(e => e.progression === 'stable');

  // Top-Fortschritte
  const topProgress = exerciseAnalyses
    .filter(e => e.changes && e.changes.volume_change_percent !== undefined)
    .sort((a, b) => (b.changes.volume_change_percent || 0) - (a.changes.volume_change_percent || 0))
    .slice(0, 3);

  // Top-Rückgänge
  const topDeclines = exerciseAnalyses
    .filter(e => e.changes && e.changes.volume_change_percent !== undefined)
    .sort((a, b) => (a.changes.volume_change_percent || 0) - (b.changes.volume_change_percent || 0))
    .slice(0, 3);

  return {
    analysis_date: new Date().toISOString(),
    total_exercises_analyzed: exerciseAnalyses.length,

    // Zusammenfassung Progressionen
    progression_summary: {
      positive: positiveExercises.length,
      stable: stableExercises.length,
      negative: negativeExercises.length
    },

    // Detaillierte Übungs-Analysen (für AI)
    exercises: exerciseAnalyses.map(ex => ({
      exercise: ex.exercise,
      current_weight: ex.current?.weight || 0,
      current_reps: ex.current?.reps || 0,
      current_volume: ex.current?.volume || 0,

      ...(ex.previous ? {
        previous_weight: ex.previous.weight,
        previous_reps: ex.previous.reps,
        previous_volume: ex.previous.volume,
      } : {}),

      // Veränderungen (Fakten)
      changes: {
        weight_change_kg: ex.changes.weight_change,
        reps_change: ex.changes.rep_change,
        volume_change_kg: ex.changes.volume_change,
        volume_change_percent: ex.changes.volume_change_percent
      },

      // Trend (von Backend berechnet)
      progression: ex.progression, // 'positive' | 'negative' | 'stable' | 'first_session'
      period_days: ex.period_days,
      period_description: ex.period || 'first session'
    })),

    // Top-Übungen für AI-Schwerpunkt
    top_improvements: topProgress.map(ex => ({
      exercise: ex.exercise,
      volume_change_percent: ex.changes.volume_change_percent
    })),

    top_declines: topDeclines.map(ex => ({
      exercise: ex.exercise,
      volume_change_percent: ex.changes.volume_change_percent
    }))
  };
}

/**
 * Erstelle einfachen Mini-Datensatz für einzelne Übung
 * (Für ai-progress-feedback Endpunkt)
 */
export function createSimpleExerciseFeedback(trainingData) {
  return {
    exercise: trainingData.exercise || 'Unknown',
    period: trainingData.period || 'unknown',
    weight_change_kg: Number(trainingData.weight_change) || 0,
    reps_change: Number(trainingData.rep_change) || 0,
    volume_change_percent: Number(trainingData.volume_change) || 0,
    progression: trainingData.progression || 'unknown'
  };
}

export default {
  calculateExerciseStats,
  determineTrend,
  analyzeExercise,
  analyzeWorkoutProgression,
  structureAnalysisForAI,
  createSimpleExerciseFeedback
};
