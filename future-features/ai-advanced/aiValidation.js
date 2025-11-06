// AI Response Validation Pipeline
export default class AIValidationService {
  constructor() {
    // Gefährliche Begriffe die nie empfohlen werden sollten
    this.dangerousTerms = [
      'extreme', 'maximum', 'bis zum versagen', 'schmerz ignorieren',
      'täglich trainieren', 'ohne pause', 'verletzung egal'
    ];

    // Sichere Übungsparameter
    this.safeRanges = {
      sets: { min: 1, max: 6 },
      reps: { min: 1, max: 20 },
      weight: { min: 0, max: 300 }, // kg
      restTime: { min: 30, max: 300 } // sekunden
    };
  }

  // Haupt-Validierungsmethode
  async validateAIResponse(aiResponse, userContext) {
    const validation = {
      isValid: true,
      confidence: 0,
      warnings: [],
      modifications: []
    };

    // 1. Gefährliche Inhalte prüfen
    this.checkDangerousContent(aiResponse, validation);
    
    // 2. Übungsparameter validieren
    this.validateExerciseParameters(aiResponse, validation);
    
    // 3. Benutzerspezifische Sicherheit
    this.checkUserSafety(aiResponse, userContext, validation);
    
    // 4. Fitness-Logik überprüfen
    this.validateFitnessLogic(aiResponse, validation);

    // 5. Gesamtbewertung
    validation.confidence = this.calculateConfidence(validation);

    return validation;
  }

  checkDangerousContent(response, validation) {
    const text = JSON.stringify(response).toLowerCase();
    
    this.dangerousTerms.forEach(term => {
      if (text.includes(term)) {
        validation.isValid = false;
        validation.warnings.push(`Gefährlicher Begriff erkannt: "${term}"`);
      }
    });

    // Prüfe auf unrealistische Versprechungen
    const dangerousPromises = [
      'in einer woche', 'sofortiger erfolg', 'ohne anstrengung',
      'garantiert', '100% erfolg'
    ];

    dangerousPromises.forEach(promise => {
      if (text.includes(promise)) {
        validation.warnings.push(`Unrealistische Versprechung: "${promise}"`);
        validation.confidence -= 20;
      }
    });
  }

  validateExerciseParameters(response, validation) {
    // Suche nach Übungsempfehlungen im Response
    if (response.exercises) {
      response.exercises.forEach((exercise, index) => {
        // Sets validieren
        if (exercise.sets && (exercise.sets < this.safeRanges.sets.min || 
                            exercise.sets > this.safeRanges.sets.max)) {
          validation.warnings.push(`Übung ${index + 1}: Unsichere Sets-Anzahl (${exercise.sets})`);
          validation.modifications.push({
            exercise: index,
            field: 'sets',
            original: exercise.sets,
            suggested: Math.min(Math.max(exercise.sets, this.safeRanges.sets.min), this.safeRanges.sets.max)
          });
        }

        // Reps validieren
        if (exercise.reps && (exercise.reps < this.safeRanges.reps.min || 
                             exercise.reps > this.safeRanges.reps.max)) {
          validation.warnings.push(`Übung ${index + 1}: Unsichere Wiederholungen (${exercise.reps})`);
        }
      });
    }
  }

  checkUserSafety(response, userContext, validation) {
    // Anfänger-Sicherheit
    if (userContext.experienceLevel === 'beginner') {
      if (response.exercises && response.exercises.length > 6) {
        validation.warnings.push('Zu viele Übungen für Anfänger empfohlen');
        validation.confidence -= 15;
      }
    }

    // Verletzungshistorie berücksichtigen
    if (userContext.injuries && userContext.injuries.length > 0) {
      const injuryAreas = userContext.injuries.map(i => i.area.toLowerCase());
      
      if (response.exercises) {
        response.exercises.forEach(exercise => {
          const targetMuscles = exercise.targetMuscles || [];
          const hasConflict = targetMuscles.some(muscle => 
            injuryAreas.includes(muscle.toLowerCase())
          );
          
          if (hasConflict) {
            validation.warnings.push(`Übung "${exercise.name}" könnte Verletzungsbereich betreffen`);
            validation.confidence -= 25;
          }
        });
      }
    }
  }

  validateFitnessLogic(response, validation) {
    // Prüfe auf logische Fitness-Prinzipien
    if (response.exercises) {
      const muscleGroups = response.exercises.map(e => e.primaryMuscle).filter(Boolean);
      const uniqueMuscles = [...new Set(muscleGroups)];
      
      // Zu viele Muskelgruppen an einem Tag?
      if (uniqueMuscles.length > 5) {
        validation.warnings.push('Zu viele Muskelgruppen für ein Workout');
        validation.confidence -= 10;
      }

      // Antagonistische Muskeln balanciert?
      const hasChest = muscleGroups.includes('chest');
      const hasBack = muscleGroups.includes('back');
      
      if (hasChest && !hasBack) {
        validation.warnings.push('Unausgewogenes Training: Brust ohne Rücken');
        validation.confidence -= 15;
      }
    }
  }

  calculateConfidence(validation) {
    let confidence = 100;
    
    // Reduziere Confidence basierend auf Warnungen
    confidence -= validation.warnings.length * 10;
    
    // Schwerwiegende Probleme
    if (!validation.isValid) {
      confidence = Math.min(confidence, 30);
    }
    
    return Math.max(0, confidence);
  }

  // Menschliche Review erforderlich?
  requiresHumanReview(validation) {
    return validation.confidence < 70 || !validation.isValid;
  }
}