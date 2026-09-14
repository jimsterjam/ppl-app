/**
 * Mock-Workout-Szenarien für scripts/qualityLoopRunner.js (Batch-Qualitäts-Loop).
 *
 * Anders als feedbackQualityCases.js (fester, handgeschriebener Entwurfstext, keine echte
 * API-Generierung) enthalten diese Szenarien NUR strukturierte Trainingsdaten - denselben
 * Datentyp, den OpenAIProvider.buildPrompt() bzw. trainingAnalysisService.structureAnalysisForAI
 * produzieren. Der Qualitäts-Loop generiert daraus JEDES Mal frisch einen echten Feedback-Text
 * über die reale API (Relay), um über mehrere Durchläufe hinweg zu beobachten, wie oft der
 * Verifier eingreifen muss - deshalb bewusst KEIN vorgeschriebener draftText hier.
 *
 * Jedes Szenario zielt gezielt auf eine Regel-Risikozone aus dem Coach-System-Prompt
 * (OpenAIProvider.getCoachSystemPromptText), u.a. abgeleitet aus dem konkreten Bug-Report
 * ("Kniebeugen: 1kg mehr" statt satzgenau 2,5kg nur in den ersten beiden Sätzen).
 */

export const mockWorkoutScenarios = [
  {
    name: 'Gleichmäßiger Fortschritt (alle Sätze gleich gesteigert)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 82.5,
        current_reps: 24,
        current_sets: 3,
        current_volume: 1980,
        previous_weight: 80,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 1920,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 2.5, reps_change: 0, sets_change: 0, volume_change_kg: 60, volume_change_percent: 3.1 },
        sets_comparison: [
          { set_number: 1, current_weight: 82.5, current_reps: 8, previous_weight: 80, previous_reps: 8, weight_change_kg: 2.5, reps_change: 0 },
          { set_number: 2, current_weight: 82.5, current_reps: 8, previous_weight: 80, previous_reps: 8, weight_change_kg: 2.5, reps_change: 0 },
          { set_number: 3, current_weight: 82.5, current_reps: 8, previous_weight: 80, previous_reps: 8, weight_change_kg: 2.5, reps_change: 0 }
        ]
      }],
      top_improvements: [{ exercise: 'Bankdrücken', volume_change_percent: 3.1, weight_change_kg: 2.5 }],
      top_declines: []
    }
  },

  {
    name: 'Gemischte Sätze - nur erste zwei gesteigert (Regel 8 Risiko: pauschales Verdikt)',
    // Exakt der aus dem User-Bug-Report abgeleitete Fall: Satz 1+2 gesteigert, Satz 3 unverändert.
    // Ein sauberes Feedback darf hier NICHT pauschal "Kniebeugen: mehr gestemmt" schreiben.
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Kniebeugen',
        current_weight: 101.67,
        current_reps: 24,
        current_sets: 3,
        current_volume: 2440,
        previous_weight: 100,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 2400,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 1.7, reps_change: 0, sets_change: 0, volume_change_kg: 40, volume_change_percent: 1.7 },
        sets_comparison: [
          { set_number: 1, current_weight: 102.5, current_reps: 8, previous_weight: 100, previous_reps: 8, weight_change_kg: 2.5, reps_change: 0 },
          { set_number: 2, current_weight: 102.5, current_reps: 8, previous_weight: 100, previous_reps: 8, weight_change_kg: 2.5, reps_change: 0 },
          { set_number: 3, current_weight: 100, current_reps: 8, previous_weight: 100, previous_reps: 8, weight_change_kg: 0, reps_change: 0 }
        ]
      }],
      top_improvements: [{ exercise: 'Kniebeugen', volume_change_percent: 1.7, weight_change_kg: 1.7 }],
      top_declines: []
    }
  },

  {
    name: 'Zusatzgewicht bei vorher reiner Körpergewichtsübung (is_added_weight)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Dips',
        current_weight: 3,
        current_reps: 24,
        current_sets: 3,
        current_volume: 72,
        previous_weight: 0,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 0,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 3, reps_change: 0, sets_change: 0, volume_change_kg: 72, volume_change_percent: 100 },
        sets_comparison: [
          { set_number: 1, current_weight: 3, current_reps: 8, previous_weight: 0, previous_reps: 8, weight_change_kg: 3, reps_change: 0, is_added_weight: true },
          { set_number: 2, current_weight: 3, current_reps: 8, previous_weight: 0, previous_reps: 8, weight_change_kg: 3, reps_change: 0, is_added_weight: true },
          { set_number: 3, current_weight: 3, current_reps: 8, previous_weight: 0, previous_reps: 8, weight_change_kg: 3, reps_change: 0, is_added_weight: true }
        ]
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Zusätzlicher Satz gegenüber letzter Session (is_new_set)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Klimmzüge',
        current_weight: 0,
        current_reps: 30,
        current_sets: 4,
        current_volume: 0,
        previous_weight: 0,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 0,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 0, reps_change: 6, sets_change: 1, volume_change_kg: 0, volume_change_percent: 0 },
        sets_comparison: [
          { set_number: 1, current_weight: 0, current_reps: 8, previous_weight: 0, previous_reps: 8, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 0, current_reps: 8, previous_weight: 0, previous_reps: 8, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 0, current_reps: 8, previous_weight: 0, previous_reps: 8, weight_change_kg: 0, reps_change: 0 },
          { set_number: 4, current_weight: 0, current_reps: 6, is_new_set: true }
        ]
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Technikfokus-Übung (profile_hint exerciseType technique - Regel 13/14)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Nordic Curls',
        current_weight: 0,
        current_reps: 15,
        current_sets: 3,
        current_volume: 0,
        previous_weight: 0,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 0,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 },
        profile_hint: { exerciseType: 'technique', externalLoadRelevant: false, trainingVolumeRelevant: false, higherRepsAreProgress: false },
        sets_comparison: [
          { set_number: 1, current_weight: 0, current_reps: 5, previous_weight: 0, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 0, current_reps: 5, previous_weight: 0, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 0, current_reps: 5, previous_weight: 0, previous_reps: 5, weight_change_kg: 0, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Speed Squats - weniger Wdh. bei mehr Gewicht ist hier KEIN Rückgang (Regel 15)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Speed Squats',
        current_weight: 65,
        current_reps: 15,
        current_sets: 5,
        current_volume: 975,
        previous_weight: 60,
        previous_reps: 25,
        previous_sets: 5,
        previous_volume: 1500,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 5, reps_change: -10, sets_change: 0, volume_change_kg: -525, volume_change_percent: -35 },
        sets_comparison: [
          { set_number: 1, current_weight: 65, current_reps: 3, previous_weight: 60, previous_reps: 5, weight_change_kg: 5, reps_change: -2 },
          { set_number: 2, current_weight: 65, current_reps: 3, previous_weight: 60, previous_reps: 5, weight_change_kg: 5, reps_change: -2 },
          { set_number: 3, current_weight: 65, current_reps: 3, previous_weight: 60, previous_reps: 5, weight_change_kg: 5, reps_change: -2 },
          { set_number: 4, current_weight: 65, current_reps: 3, previous_weight: 60, previous_reps: 5, weight_change_kg: 5, reps_change: -2 },
          { set_number: 5, current_weight: 65, current_reps: 3, previous_weight: 60, previous_reps: 5, weight_change_kg: 5, reps_change: -2 }
        ]
      }],
      top_improvements: [],
      top_declines: [{ exercise: 'Speed Squats', volume_change_percent: -35, weight_change_kg: 5 }]
    }
  },

  {
    name: 'Keine Satzdaten erfasst (leere sets_comparison)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Wadenheben',
        current_weight: 40,
        current_reps: 36,
        current_sets: 3,
        current_volume: 1440,
        period_days: 7,
        period_description: '1 Woche',
        sets_comparison: []
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Körpergewichtsveränderung ohne Ursachenangabe (Regel 3 Risiko)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      athlete_bodyweight_kg: 78.6,
      exercises: [{
        exercise: 'Kreuzheben',
        current_weight: 140,
        current_reps: 15,
        current_sets: 3,
        current_volume: 2100,
        previous_weight: 140,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 2100,
        period_days: 14,
        period_description: '2 Wochen',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 },
        sets_comparison: [
          { set_number: 1, current_weight: 140, current_reps: 5, previous_weight: 140, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 140, current_reps: 5, previous_weight: 140, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 140, current_reps: 5, previous_weight: 140, previous_reps: 5, weight_change_kg: 0, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Stagnation mit erklärender Notiz (Deload - Regel 12)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Kreuzheben',
        current_weight: 100,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1500,
        previous_weight: 120,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1800,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: -20, reps_change: 0, sets_change: 0, volume_change_kg: -300, volume_change_percent: -16.7 },
        note_context: {
          persistent: { text: 'Bewusster Deload alle 6 Wochen, danach wieder steigern.', confirmed: true }
        },
        sets_comparison: [
          { set_number: 1, current_weight: 100, current_reps: 5, previous_weight: 120, previous_reps: 5, weight_change_kg: -20, reps_change: 0 },
          { set_number: 2, current_weight: 100, current_reps: 5, previous_weight: 120, previous_reps: 5, weight_change_kg: -20, reps_change: 0 },
          { set_number: 3, current_weight: 100, current_reps: 5, previous_weight: 120, previous_reps: 5, weight_change_kg: -20, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: [{ exercise: 'Kreuzheben', volume_change_percent: -16.7, weight_change_kg: -20 }]
    }
  }
];

export default mockWorkoutScenarios;
