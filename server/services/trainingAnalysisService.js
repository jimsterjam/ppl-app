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
import { determineTrendWithProfile, resolveEffectiveProfile, buildNoteContext } from './exerciseAnalysisRules.js';

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
 * @param {Object} [options] - Additive, optionale Korrektheits-Daten (Kap. 24-26, Phase 2).
 *   Standardmäßig leer -> Verhalten bleibt 1:1 identisch zum bisherigen Bestand, solange
 *   Aufrufer (Phase 3) noch kein Profil/keine Notiz übergeben.
 * @param {Object|null} [options.globalProfile] - Exercise.metricProfile (Rang 3)
 * @param {Object|null} [options.userNote] - UserExerciseNote-Dokument (Rang 1/2)
 * @returns {Object} Analysis-Objekt
 */
export function analyzeExercise(exerciseName, currentEx, previousEx = null, daysDiff = 0, options = {}) {
  const currentStats = calculateExerciseStats(currentEx);

  if (!currentStats) {
    return null; // Keine echten Sets in Current
  }

  const { globalProfile = null, userNote = null } = options || {};
  const effectiveProfile = resolveEffectiveProfile(globalProfile, userNote);

  // Nutzer-Notiz zur aktuellen Übung (z.B. "heute war die Technik gefühlt besser" oder
  // Hinweis auf eine technikfokussierte Übung ohne Gewichtssteigerung). Wird unverändert
  // an die AI weitergereicht, damit sie Stagnation/fehlendes Gewicht nicht fälschlich als
  // negative Progression wertet, wenn der Nutzer das selbst erklärt hat.
  const note = typeof currentEx?.note === 'string' ? currentEx.note.trim() : '';

  // Kap. 25: persistente exerciseNote (Rang 1/2) + sessionNote dieser Session zusammen -
  // additiv neben dem bisherigen "note"-Feld, ersetzt es nicht (Rückwärtskompatibilität).
  const noteContext = buildNoteContext({ sessionNote: note, userNote });

  let analysis = {
    exercise: exerciseName,
    current: currentStats,
    previous: null,
    changes: {
      weight_change: 0,
      rep_change: 0,
      sets_change: 0,
      volume_change: 0,
      volume_change_percent: 0
    },
    progression: 'first_session',
    period_days: daysDiff,
    note: note || null,
    noteContext,
    // Kap. 26: schlanker Hinweis fürs Prompt (Phase 4), damit die AI z.B. bei einer reinen
    // Technikübung nicht trotzdem eine Gewichtssteigerung empfiehlt. Nur gesetzt, wenn ein
    // Profil (global oder per User-Override) tatsächlich vorliegt - sonst weiterhin keine
    // übungsspezifische Aussage (Null-Annahmen-Prinzip).
    profileHint: effectiveProfile ? {
      exerciseType: effectiveProfile.exerciseType || null,
      externalLoadRelevant: effectiveProfile.externalLoadRelevant !== false,
      higherRepsAreProgress: effectiveProfile.higherRepsAreProgress !== false,
      trainingVolumeRelevant: effectiveProfile.trainingVolumeRelevant !== false,
      targetRepRange: effectiveProfile.targetRepRange || null
    } : null
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
        // Additiv (UI-Zusammenfassung "wieviel Sätze mehr/weniger"): Differenz der reinen
        // Arbeitssatz-Anzahl (Warm-ups bereits in calculateExerciseStats() herausgefiltert).
        // Fließt NICHT in determineTrendWithProfile()/progression ein (siehe
        // exerciseAnalysisRules.js) - rein additive Zahl fürs Frontend, ändert nichts an der
        // bestehenden Trend-Berechnung.
        sets_change: currentStats.sets - prevStats.sets,
        volume_change: Math.round((currentStats.volume - prevStats.volume) * 10) / 10,
        volume_change_percent: volumeChangePct
      };

      // Kap. 26: übungstypabhängige Trendbewertung, wenn ein Profil vorliegt (Rang 1-3);
      // ohne Profil identisch zum bisherigen determineTrend()-Verhalten.
      analysis.progression = determineTrendWithProfile({
        weightChange: analysis.changes.weight_change,
        volumeChangePercent: volumeChangePct,
        repsChange: analysis.changes.rep_change,
        profile: effectiveProfile
      });

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
 * @param {Object} [profileMaps] - Additiv/optional (Phase 2/3, default leer -> altes Verhalten)
 * @param {Map<string, Object>} [profileMaps.profileByExerciseName] - lowercased exerciseName -> Exercise.metricProfile
 * @param {Map<string, Object>} [profileMaps.userNoteByExerciseName] - lowercased exerciseName -> UserExerciseNote
 * @returns {Array} Array von Exercise-Analysen
 */
export function analyzeWorkoutProgression(currentWorkout, allWorkouts, profileMaps = {}) {
  const analysisResults = [];
  const { profileByExerciseName = new Map(), userNoteByExerciseName = new Map() } = profileMaps || {};

  for (const exercise of currentWorkout.exercises || []) {
    const exerciseName = exercise.name || 'Unknown';
    const lookupKey = exerciseName.toLowerCase();

    try {
      // Finde letzte Session der gleichen Übung
      //
      // WICHTIG: allWorkouts ist nach date DESC sortiert (neueste zuerst). Ein reines
      // .find() ohne Datums-Prüfung liefert bei diesem Sortier-Array das JÜNGSTE andere
      // Workout mit dieser Übung - das kann bei einem älteren currentWorkout ein SPÄTERES
      // (zukünftiges relativ zu currentWorkout) Workout sein statt des tatsächlich
      // vorherigen. Beispiel: 3 Workouts W1(alt)->W2->W3(neu) mit Gewichtssteigerung nur in
      // W2. Beim Analysieren von W1 fand find() fälschlich W3 als "previous" (identisches
      // Gewicht wie W1), wodurch die echte Steigerung in W2 nie sichtbar wurde. Fix: nur
      // Workouts zulassen, die chronologisch VOR currentWorkout liegen (date, bei Gleichstand
      // createdAt als Tiebreaker) - da das Array DESC sortiert ist, liefert find() dann
      // korrekt das nächstgelegene frühere Workout.
      const currentDateMs = new Date(currentWorkout.date).getTime();
      const currentCreatedMs = currentWorkout.createdAt ? new Date(currentWorkout.createdAt).getTime() : 0;

      const isStrictlyBeforeCurrent = (w) => {
        const wDateMs = new Date(w.date).getTime();
        if (wDateMs !== currentDateMs) return wDateMs < currentDateMs;
        // Gleiches Datum (z.B. Testdaten am selben Tag) -> createdAt als Tiebreaker
        const wCreatedMs = w.createdAt ? new Date(w.createdAt).getTime() : 0;
        return wCreatedMs < currentCreatedMs;
      };

      const previousWorkout = allWorkouts.find(w => {
        if (w._id.toString() === currentWorkout._id.toString()) return false;
        if (!isStrictlyBeforeCurrent(w)) return false;
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

      const analysis = analyzeExercise(exerciseName, exercise, previousEx, daysDiff, {
        globalProfile: profileByExerciseName.get(lookupKey) || null,
        userNote: userNoteByExerciseName.get(lookupKey) || null
      });

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
 * @param {Object} [options] - Additiv/optional (Phase 2/3, default leer -> altes Verhalten)
 * @param {number|null} [options.athleteBodyweightKg] - Kap. 24: nur ausgeben, wenn tatsächlich
 *   erfasst (Null-Annahmen-Prinzip) - fehlt der Wert, wird das Feld schlicht weggelassen statt
 *   mit einem Platzhalter gefüllt, damit die AI keine Annahme über das Körpergewicht trifft.
 * @returns {Object} Strukturierte Daten für AI
 */
export function structureAnalysisForAI(exerciseAnalyses, options = {}) {
  if (!Array.isArray(exerciseAnalyses) || exerciseAnalyses.length === 0) {
    return null;
  }

  const { athleteBodyweightKg = null } = options || {};

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

    // Nur ausgegeben, wenn tatsächlich für diese Session erfasst (Null-Annahmen-Prinzip,
    // Kap. 24) - kein Fallback/Platzhalter.
    ...(athleteBodyweightKg != null ? { athlete_bodyweight_kg: athleteBodyweightKg } : {}),

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
      current_sets: ex.current?.sets || 0,
      current_volume: ex.current?.volume || 0,

      ...(ex.previous ? {
        previous_weight: ex.previous.weight,
        previous_reps: ex.previous.reps,
        previous_sets: ex.previous.sets,
        previous_volume: ex.previous.volume,
      } : {}),

      // Veränderungen (Fakten)
      changes: {
        weight_change_kg: ex.changes.weight_change,
        reps_change: ex.changes.rep_change,
        sets_change: ex.changes.sets_change || 0,
        volume_change_kg: ex.changes.volume_change,
        volume_change_percent: ex.changes.volume_change_percent
      },

      // Trend (von Backend berechnet)
      progression: ex.progression, // 'positive' | 'negative' | 'stable' | 'first_session'
      period_days: ex.period_days,
      period_description: ex.period || 'first session',

      // Nutzer-Notiz zu dieser Übung (nur wenn vorhanden) - siehe analyzeExercise()
      ...(ex.note ? { note: ex.note } : {}),

      // Kap. 25: additiv, gemergte Notiz aus persistenter exerciseNote (Rang 1/2) und
      // sessionNote dieser Session, mit Kennzeichnung von Herkunft/Bestätigung, damit die
      // AI eine bestätigte persistente Einschränkung nicht mit einer einmaligen
      // Session-Bemerkung verwechselt (Prioritätsreihenfolge Kap. 25.1).
      ...(ex.noteContext ? { note_context: ex.noteContext } : {}),

      // Kap. 26: schlanker Übungsprofil-Hinweis (nur wenn vorhanden) - siehe analyzeExercise().
      ...(ex.profileHint ? { profile_hint: ex.profileHint } : {})
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

// Hinweis: determineTrend() (rein gewicht-/volumenbasiert) bleibt unverändert exportiert und
// als generischer Fallback erhalten. exerciseAnalysisRules.js repliziert dieselbe Logik
// intern (statt zu importieren), um einen zirkulären Import zwischen beiden Modulen zu
// vermeiden; beide Implementierungen müssen bei künftigen Änderungen synchron gehalten werden.
