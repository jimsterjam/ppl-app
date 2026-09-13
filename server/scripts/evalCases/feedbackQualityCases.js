/**
 * Testfälle für scripts/evalRunner.js (Eval-Runner des Feedback-Qualitäts-Loops).
 *
 * Jeder Fall besteht aus denselben strukturierten Trainingsdaten, die auch der echte Coach-
 * Prompt bekommt (siehe trainingAnalysisService.structureAnalysisForAI), sowie einem
 * FERTIGEN Entwurfstext (so, wie ihn OpenAIProvider.generateTrainingAnalysis zurückgeben
 * würde) - der Eval-Runner generiert bewusst KEIN neues Feedback per KI (das wäre nicht
 * reproduzierbar), sondern prüft, ob der Verifier (feedbackVerificationService.js) einen
 * FESTEN, von Hand konstruierten Entwurf korrekt bewertet.
 *
 * `expectedDeterministicRules`: welche Regel-Nummern der reine Code-Check
 * (runDeterministicChecks, kein KI-Call, kein API-Key nötig) für diesen Fall finden MUSS -
 * das ist ein hartes Kriterium (Eval-Runner beendet sich mit Exit-Code 1 bei Abweichung).
 *
 * `expectSeverity`: 'clean' | 'violation' - grobe Erwartung für den optionalen KI-Prüfaufruf
 * (--with-ai, braucht OPENAI_API_KEY oder Relay). Da LLM-Antworten nicht 100% deterministisch
 * sind, ist das ein WEICHES Kriterium (nur Warnung, kein Exit-Code-Fehler) - siehe evalRunner.js.
 */

export const feedbackQualityCases = [
  {
    name: 'Saubere Nachricht ohne Verstoß',
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
        changes: {
          weight_change_kg: 2.5,
          reps_change: 0,
          sets_change: 0,
          volume_change_kg: 60,
          volume_change_percent: 3.1
        }
      }],
      top_improvements: [],
      top_declines: []
    },
    draftText: `Guter Trainingstag 💪 Kurz zusammengefasst: Beim Bankdrücken hast du 2,5kg mehr
aufgelegt bei gleichbleibenden Wiederholungen - das Volumen ist damit um etwa 3,1% gestiegen,
macht ordentlich was her. Bleib bei der Technik so, wie es diese Woche gelaufen ist, das hat
gut funktioniert und sauber ausgesehen. Für die nächste Einheit: Wenn sich die 82,5kg weiterhin
angenehm bewegen lassen, kannst du beim nächsten Mal wieder in kleinen Schritten steigern - ganz
entspannt, kein Grund zur Eile. Insgesamt ein stabiler, unaufgeregter Fortschritt, genau das,
was du in dieser Phase brauchst, um dranzubleiben und langfristig weiterzukommen, ohne dich zu
überlasten oder unnötige Rückschritte zu riskieren.`.replace(/\s+/g, ' ').trim(),
    expectedDeterministicRules: [],
    expectSeverity: 'clean'
  },

  {
    name: 'Erfundene Zahl (Regel 1 - Datenwahrheit)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Kniebeuge',
        current_weight: 100,
        current_reps: 24,
        current_sets: 3,
        current_volume: 2400,
        previous_weight: 95,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 2280,
        period_days: 7,
        period_description: '1 Woche',
        changes: {
          weight_change_kg: 5,
          reps_change: 0,
          sets_change: 0,
          volume_change_kg: 120,
          volume_change_percent: 5.3
        }
      }],
      top_improvements: [],
      top_declines: []
    },
    // 999 kommt in KEINEM der obigen Werte vor -> muss von checkNumberConsistency erkannt werden.
    draftText: Array(70).fill('Wort').join(' ') + ' Du hast satte 999kg mehr aufgelegt, absolute Bestleistung!',
    expectedDeterministicRules: [1],
    expectSeverity: 'violation'
  },

  {
    name: 'Deutlich zu kurzer Text (Regel 17 - Report statt Chat-Nachricht)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Klimmzug',
        current_weight: 0,
        current_reps: 40,
        current_sets: 4,
        current_volume: 0,
        period_days: 7,
        period_description: '1 Woche'
      }],
      top_improvements: [],
      top_declines: []
    },
    draftText: 'Solide Session, weiter so 💪',
    expectedDeterministicRules: [17],
    expectSeverity: 'violation'
  },

  {
    name: 'Deutlich zu langer Text (Regel 17 - Report statt Chat-Nachricht)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Kreuzheben',
        current_weight: 120,
        current_reps: 15,
        current_sets: 3,
        current_volume: 1800,
        period_days: 7,
        period_description: '1 Woche'
      }],
      top_improvements: [],
      top_declines: []
    },
    draftText: Array(280).fill('Wort').join(' '),
    expectedDeterministicRules: [17],
    expectSeverity: 'violation'
  },

  {
    name: 'Halluzinierte Ursache (Regel 3 - nur KI-Prüfung erkennt das, deterministisch unsichtbar)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      athlete_bodyweight_kg: 80,
      exercises: [{
        exercise: 'Körpergewicht',
        current_weight: 78.6,
        current_reps: 0,
        current_sets: 0,
        current_volume: 0,
        previous_weight: 80,
        previous_reps: 0,
        previous_sets: 0,
        previous_volume: 0,
        period_days: 14,
        period_description: '2 Wochen',
        changes: { weight_change_kg: -1.4, reps_change: 0, sets_change: 0, volume_change_kg: 0, volume_change_percent: 0 }
      }],
      top_improvements: [],
      top_declines: []
    },
    // Alle Zahlen sind korrekt (1.4kg, 80kg) - der deterministische Check findet daher NICHTS,
    // obwohl der Text inhaltlich klar gegen Regel 3 verstößt (unbelegte Ursache "Fett verloren").
    draftText: Array(60).fill('Wort').join(' ') + ` Du hast in den letzten 2 Wochen 1,4kg Fett
verloren bei einem Ausgangsgewicht von 80kg - dein Trainingsplan zahlt sich aus!`,
    expectedDeterministicRules: [],
    expectSeverity: 'violation'
  },

  {
    name: 'Medizinische Diagnose (Regel 5 - nur KI-Prüfung erkennt das)',
    structuredAnalysis: {
      total_exercises_analyzed: 1,
      exercises: [{
        exercise: 'Schulterdrücken',
        current_weight: 20,
        current_reps: 24,
        current_sets: 3,
        current_volume: 480,
        previous_weight: 22.5,
        previous_reps: 24,
        previous_sets: 3,
        previous_volume: 540,
        period_days: 7,
        period_description: '1 Woche',
        changes: { weight_change_kg: -2.5, reps_change: 0, sets_change: 0, volume_change_kg: -60, volume_change_percent: -11.1 }
      }],
      top_improvements: [],
      top_declines: []
    },
    draftText: Array(60).fill('Wort').join(' ') + ` Beim Schulterdrücken hast du 2,5kg weniger
aufgelegt (-11%) - das deutet auf eine beginnende Rotatorenmanschetten-Reizung hin, geh das
lieber vorsichtig an.`,
    expectedDeterministicRules: [],
    expectSeverity: 'violation'
  }
];

export default feedbackQualityCases;
