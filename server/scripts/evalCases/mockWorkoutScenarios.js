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
    name: 'Körpergewicht gestiegen + mehrere Übungen stärker (Regel 18 Risiko: Kausalaussage)',
    // Klassischer Fall für eine halluzinierte Ursache (Regel 3/18): Körpergewicht UND Kraft sind
    // im selben Zeitraum gestiegen - ein sauberes Feedback darf daraus NICHT "weil du
    // zugenommen hast, bist du stärker geworden" o.ä. ableiten, sondern beide Fakten nur
    // nebeneinanderstellen (siehe resolveBodyweightCorrelation in trainingAnalysisService.js).
    structuredAnalysis: {
      total_exercises_analyzed: 2,
      athlete_bodyweight_kg: 82,
      bodyweight_correlation: {
        current_bodyweight_kg: 82,
        previous_bodyweight_kg: 80,
        bodyweight_change_kg: 2,
        period_days: 21,
        strength_context: {
          exercises_compared: 2,
          exercises_with_weight_increase: 2,
          exercises_with_weight_decrease: 0,
          exercises_stable: 0
        }
      },
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 105,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1575,
        previous_weight: 95,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1425,
        period_days: 21,
        period_description: '3 Wochen',
        changes: { weight_change_kg: 10, reps_change: 0, sets_change: 0, volume_change_kg: 150, volume_change_percent: 10.5 },
        sets_comparison: [
          { set_number: 1, current_weight: 105, current_reps: 5, previous_weight: 95, previous_reps: 5, weight_change_kg: 10, reps_change: 0 },
          { set_number: 2, current_weight: 105, current_reps: 5, previous_weight: 95, previous_reps: 5, weight_change_kg: 10, reps_change: 0 },
          { set_number: 3, current_weight: 105, current_reps: 5, previous_weight: 95, previous_reps: 5, weight_change_kg: 10, reps_change: 0 }
        ]
      }, {
        exercise: 'Kniebeugen',
        current_weight: 130,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1950,
        previous_weight: 122.5,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1837.5,
        period_days: 21,
        period_description: '3 Wochen',
        changes: { weight_change_kg: 7.5, reps_change: 0, sets_change: 0, volume_change_kg: 112.5, volume_change_percent: 6.1 },
        sets_comparison: [
          { set_number: 1, current_weight: 130, current_reps: 5, previous_weight: 122.5, previous_reps: 5, weight_change_kg: 7.5, reps_change: 0 },
          { set_number: 2, current_weight: 130, current_reps: 5, previous_weight: 122.5, previous_reps: 5, weight_change_kg: 7.5, reps_change: 0 },
          { set_number: 3, current_weight: 130, current_reps: 5, previous_weight: 122.5, previous_reps: 5, weight_change_kg: 7.5, reps_change: 0 }
        ]
      }],
      top_improvements: [
        { exercise: 'Bankdrücken', volume_change_percent: 10.5, weight_change_kg: 10 },
        { exercise: 'Kniebeugen', volume_change_percent: 6.1, weight_change_kg: 7.5 }
      ],
      top_declines: []
    }
  },

  {
    name: 'Körpergewicht UND Kraft gesunken (Regel 18 Risiko: Kausalaussage in die andere Richtung)',
    // Spiegelbild zum obigen Szenario: hier sind Körpergewicht UND Trainingsgewicht bei beiden
    // Übungen gesunken - genauso verboten wäre hier "weil du abgenommen hast, bist du
    // schwächer geworden" o.ä. Testet, ob die Kausalfalle auch in der "negativen" Richtung
    // vermieden wird, nicht nur beim naheliegenderen positiven Fall.
    structuredAnalysis: {
      total_exercises_analyzed: 2,
      athlete_bodyweight_kg: 78,
      bodyweight_correlation: {
        current_bodyweight_kg: 78,
        previous_bodyweight_kg: 80,
        bodyweight_change_kg: -2,
        period_days: 21,
        strength_context: {
          exercises_compared: 2,
          exercises_with_weight_increase: 0,
          exercises_with_weight_decrease: 2,
          exercises_stable: 0
        }
      },
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 80,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1200,
        previous_weight: 90,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1350,
        period_days: 21,
        period_description: '3 Wochen',
        changes: { weight_change_kg: -10, reps_change: 0, sets_change: 0, volume_change_kg: -150, volume_change_percent: -11.1 },
        sets_comparison: [
          { set_number: 1, current_weight: 80, current_reps: 5, previous_weight: 90, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 2, current_weight: 80, current_reps: 5, previous_weight: 90, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 3, current_weight: 80, current_reps: 5, previous_weight: 90, previous_reps: 5, weight_change_kg: -10, reps_change: 0 }
        ]
      }, {
        exercise: 'Kniebeugen',
        current_weight: 110,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1650,
        previous_weight: 120,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1800,
        period_days: 21,
        period_description: '3 Wochen',
        changes: { weight_change_kg: -10, reps_change: 0, sets_change: 0, volume_change_kg: -150, volume_change_percent: -8.3 },
        sets_comparison: [
          { set_number: 1, current_weight: 110, current_reps: 5, previous_weight: 120, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 2, current_weight: 110, current_reps: 5, previous_weight: 120, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 3, current_weight: 110, current_reps: 5, previous_weight: 120, previous_reps: 5, weight_change_kg: -10, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: [
        { exercise: 'Bankdrücken', volume_change_percent: -11.1, weight_change_kg: -10 },
        { exercise: 'Kniebeugen', volume_change_percent: -8.3, weight_change_kg: -10 }
      ]
    }
  },

  {
    name: 'Körpergewicht gestiegen, Kraft gesunken (Regel 18 Risiko: erzwungener Zusammenhang bei gegenläufigen Werten)',
    // Die beiden Fakten widersprechen sich: Körpergewicht rauf, Trainingsgewicht bei beiden
    // Übungen runter. Ein sauberes Feedback darf hier KEINEN Zusammenhang zwischen beiden
    // herstellen (weder positiv noch negativ) - die Zahlen passen ohnehin nicht zu einer
    // simplen "mehr Gewicht = mehr/weniger Kraft"-Erzählung.
    structuredAnalysis: {
      total_exercises_analyzed: 2,
      athlete_bodyweight_kg: 84,
      bodyweight_correlation: {
        current_bodyweight_kg: 84,
        previous_bodyweight_kg: 80,
        bodyweight_change_kg: 4,
        period_days: 28,
        strength_context: {
          exercises_compared: 2,
          exercises_with_weight_increase: 0,
          exercises_with_weight_decrease: 2,
          exercises_stable: 0
        }
      },
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 85,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1275,
        previous_weight: 95,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1425,
        period_days: 28,
        period_description: '4 Wochen',
        changes: { weight_change_kg: -10, reps_change: 0, sets_change: 0, volume_change_kg: -150, volume_change_percent: -10.5 },
        sets_comparison: [
          { set_number: 1, current_weight: 85, current_reps: 5, previous_weight: 95, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 2, current_weight: 85, current_reps: 5, previous_weight: 95, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 3, current_weight: 85, current_reps: 5, previous_weight: 95, previous_reps: 5, weight_change_kg: -10, reps_change: 0 }
        ]
      }, {
        exercise: 'Kniebeugen',
        current_weight: 115,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1725,
        previous_weight: 125,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1875,
        period_days: 28,
        period_description: '4 Wochen',
        changes: { weight_change_kg: -10, reps_change: 0, sets_change: 0, volume_change_kg: -150, volume_change_percent: -8 },
        sets_comparison: [
          { set_number: 1, current_weight: 115, current_reps: 5, previous_weight: 125, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 2, current_weight: 115, current_reps: 5, previous_weight: 125, previous_reps: 5, weight_change_kg: -10, reps_change: 0 },
          { set_number: 3, current_weight: 115, current_reps: 5, previous_weight: 125, previous_reps: 5, weight_change_kg: -10, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: [
        { exercise: 'Bankdrücken', volume_change_percent: -10.5, weight_change_kg: -10 },
        { exercise: 'Kniebeugen', volume_change_percent: -8, weight_change_kg: -10 }
      ]
    }
  },

  {
    name: 'Sehr kurzer Zeitraum seit letzter Gewichtserfassung (Regel 18: vorsichtige Einordnung bei geringer Datenbasis)',
    // Nur 2 Tage zwischen den beiden Körpergewicht-Messpunkten - ein sauberes Feedback sollte
    // das NICHT mit derselben Sicherheit präsentieren wie einen über Wochen etablierten Trend
    // (siehe Regel 18, letzter Punkt). Bewusst nur EINE Übung mit einer kleinen, plausiblen
    // Steigerung, damit der Bodyweight-Fakt nicht durch andere auffällige Werte überdeckt wird.
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      athlete_bodyweight_kg: 81,
      bodyweight_correlation: {
        current_bodyweight_kg: 81,
        previous_bodyweight_kg: 80,
        bodyweight_change_kg: 1,
        period_days: 2,
        strength_context: {
          exercises_compared: 1,
          exercises_with_weight_increase: 1,
          exercises_with_weight_decrease: 0,
          exercises_stable: 0
        }
      },
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 95,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1425,
        previous_weight: 92,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1380,
        period_days: 2,
        period_description: '2 Tage',
        changes: { weight_change_kg: 3, reps_change: 0, sets_change: 0, volume_change_kg: 45, volume_change_percent: 3.3 },
        sets_comparison: [
          { set_number: 1, current_weight: 95, current_reps: 5, previous_weight: 92, previous_reps: 5, weight_change_kg: 3, reps_change: 0 },
          { set_number: 2, current_weight: 95, current_reps: 5, previous_weight: 92, previous_reps: 5, weight_change_kg: 3, reps_change: 0 },
          { set_number: 3, current_weight: 95, current_reps: 5, previous_weight: 92, previous_reps: 5, weight_change_kg: 3, reps_change: 0 }
        ]
      }],
      top_improvements: [{ exercise: 'Bankdrücken', volume_change_percent: 3.3, weight_change_kg: 3 }],
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
  },

  {
    name: 'Starker unerklärter Rückgang ohne Notiz (Regel 5 Risiko: Diagnose)',
    // Kein note_context, kein profile_hint - nichts in den Daten erklärt den Einbruch. Ein
    // sauberes Feedback darf hier NICHT "vermutlich eine Verletzung/Überlastung" o.ä.
    // unterstellen (Regel 5), sondern den Rückgang rein deskriptiv benennen und höchstens als
    // Möglichkeit formulieren, dass die Ursache unbekannt ist (Regel 3/7).
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Schulterdrücken',
        current_weight: 30,
        current_reps: 24,
        current_sets: 3,
        current_volume: 720,
        previous_weight: 50,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 1200,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: -20, reps_change: 0, sets_change: 0, volume_change_kg: -480, volume_change_percent: -40 },
        sets_comparison: [
          { set_number: 1, current_weight: 30, current_reps: 8, previous_weight: 50, previous_reps: 8, weight_change_kg: -20, reps_change: 0 },
          { set_number: 2, current_weight: 30, current_reps: 8, previous_weight: 50, previous_reps: 8, weight_change_kg: -20, reps_change: 0 },
          { set_number: 3, current_weight: 30, current_reps: 8, previous_weight: 50, previous_reps: 8, weight_change_kg: -20, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: [{ exercise: 'Schulterdrücken', volume_change_percent: -40, weight_change_kg: -20 }]
    }
  },

  {
    name: 'Erstes Training einer Übung mit hohem Startwert (Regel 9 Risiko: Überinterpretation einer einzelnen Einheit)',
    // Kein previous_*, kein sets_comparison (siehe analyzeExercise: wird nur bei previousEx
    // gesetzt) - genau die Datenlage einer echten ersten Session. Der ungewöhnlich hohe
    // Startwert soll dazu verleiten, aus EINER Einheit schon eine "tolle Entwicklung" oder
    // einen Trend abzuleiten, obwohl es noch gar keinen Vergleichspunkt gibt.
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Frontkniebeugen',
        current_weight: 60,
        current_reps: 24,
        current_sets: 3,
        current_volume: 1440,
        progression: 'first_session',
        period_days: 0,
        period_description: 'Erstes Training',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 }
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Dokumentierter Mehrwochen-Trend vs. einzelne Session ohne Historie (Regel 10)',
    // Zwei Übungen mit identischer Zahlenlage (Gewicht stagniert bei 0 Veränderung), aber
    // unterschiedlichem Beleg für eine "Trend"-Aussage: Bankdrücken hat eine bestätigte
    // persistente Notiz, die explizit eine seit Wochen andauernde Stagnation dokumentiert -
    // DAS darf als Trend benannt werden (Regel 10, dokumentierter Verlauf). Kniebeugen hat
    // dieselbe Stagnation nur gegenüber der letzten Einheit (period_days: 7, keine Notiz) - hier
    // wäre "Trend" eine Überinterpretation einer einzelnen Abweichung (Regel 9).
    structuredAnalysis: {
      total_exercises_analyzed: 2,
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 80,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1200,
        previous_weight: 80,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1200,
        period_days: 35,
        period_description: '5 Wochen',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 },
        note_context: {
          persistent: { text: 'Gewicht stagniert seit über einem Monat bei 80kg, trotz konstantem Training jede Woche.', confirmed: true }
        },
        sets_comparison: [
          { set_number: 1, current_weight: 80, current_reps: 5, previous_weight: 80, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 80, current_reps: 5, previous_weight: 80, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 80, current_reps: 5, previous_weight: 80, previous_reps: 5, weight_change_kg: 0, reps_change: 0 }
        ]
      }, {
        exercise: 'Kniebeugen',
        current_weight: 100,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1500,
        previous_weight: 100,
        previous_reps: 15,
        previous_sets: 3,
        previous_volume: 1500,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 },
        sets_comparison: [
          { set_number: 1, current_weight: 100, current_reps: 5, previous_weight: 100, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 100, current_reps: 5, previous_weight: 100, previous_reps: 5, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 100, current_reps: 5, previous_weight: 100, previous_reps: 5, weight_change_kg: 0, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: []
    }
  },

  {
    name: 'Durchgehend stabile Session ohne Auffälligkeiten (Regel 11 Risiko: erfundene Empfehlung)',
    // Beide Übungen exakt unverändert, keine Notizen, keine Übungsprofile - schlicht nichts
    // Konkretes, das eine Empfehlung rechtfertigen würde. Ein sauberes Feedback lässt den
    // Empfehlungs-Teil hier einfach weg, statt einen generischen "Tipp zur Sicherheit" zu
    // erfinden (Regel 11).
    structuredAnalysis: {
      total_exercises_analyzed: 2,
      exercises: [{
        exercise: 'Bankdrücken',
        current_weight: 80,
        current_reps: 24,
        current_sets: 3,
        current_volume: 1920,
        previous_weight: 80,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 1920,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 },
        sets_comparison: [
          { set_number: 1, current_weight: 80, current_reps: 8, previous_weight: 80, previous_reps: 8, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 80, current_reps: 8, previous_weight: 80, previous_reps: 8, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 80, current_reps: 8, previous_weight: 80, previous_reps: 8, weight_change_kg: 0, reps_change: 0 }
        ]
      }, {
        exercise: 'Beinpresse',
        current_weight: 120,
        current_reps: 30,
        current_sets: 3,
        current_volume: 3600,
        previous_weight: 120,
        previous_reps: 30,
        previous_sets: 3,
        previous_volume: 3600,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: 0, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 },
        sets_comparison: [
          { set_number: 1, current_weight: 120, current_reps: 10, previous_weight: 120, previous_reps: 10, weight_change_kg: 0, reps_change: 0 },
          { set_number: 2, current_weight: 120, current_reps: 10, previous_weight: 120, previous_reps: 10, weight_change_kg: 0, reps_change: 0 },
          { set_number: 3, current_weight: 120, current_reps: 10, previous_weight: 120, previous_reps: 10, weight_change_kg: 0, reps_change: 0 }
        ]
      }],
      top_improvements: [],
      top_declines: []
    }
  }
];

export default mockWorkoutScenarios;
