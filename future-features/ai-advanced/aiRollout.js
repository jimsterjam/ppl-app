// Progressive AI Feature Rollout
export default class AIRolloutManager {
  constructor() {
    this.rolloutPhases = {
      // Phase 1: Nur für Entwickler/Beta-Tester
      phase1: {
        name: 'Internal Testing',
        userTypes: ['developer', 'beta_tester'],
        percentage: 100,
        features: ['basic_suggestions'],
        safeguards: ['human_review_all', 'detailed_logging']
      },
      
      // Phase 2: Power User mit hohem Engagement
      phase2: {
        name: 'Power User Preview',
        userTypes: ['power_user', 'premium_long_term'],
        percentage: 20,
        features: ['basic_suggestions', 'progress_analysis'],
        safeguards: ['human_review_sample', 'auto_validation']
      },
      
      // Phase 3: Alle Premium User
      phase3: {
        name: 'Premium Rollout',
        userTypes: ['premium'],
        percentage: 50,
        features: ['basic_suggestions', 'progress_analysis'],
        safeguards: ['auto_validation', 'user_feedback_required']
      },
      
      // Phase 4: Alle User
      phase4: {
        name: 'General Availability',
        userTypes: ['all'],
        percentage: 100,
        features: ['basic_suggestions', 'progress_analysis', 'plateau_detection'],
        safeguards: ['auto_validation']
      }
    };

    this.currentPhase = 'phase1'; // Start konservativ
  }

  // Prüfe ob User AI Features bekommen soll
  shouldUserGetAIFeatures(user) {
    const phase = this.rolloutPhases[this.currentPhase];
    
    // User Type Check
    if (!this.userMatchesPhase(user, phase)) {
      return false;
    }

    // Percentage Rollout (für graduelle Einführung)
    const userHash = this.hashUserId(user.id);
    const userPercentile = userHash % 100;
    
    return userPercentile < phase.percentage;
  }

  // Welche AI Features sind verfügbar?
  getAvailableFeatures(user) {
    if (!this.shouldUserGetAIFeatures(user)) {
      return [];
    }

    const phase = this.rolloutPhases[this.currentPhase];
    return phase.features;
  }

  // Welche Sicherheitsmaßnahmen gelten?
  getSafeguards(user) {
    const phase = this.rolloutPhases[this.currentPhase];
    return phase.safeguards;
  }

  // Phase-spezifische Sicherheitschecks
  async processAIRequest(user, requestType, data) {
    const safeguards = this.getSafeguards(user);
    
    // 1. Basis-Validierung (immer)
    const validation = await this.validateRequest(data);
    if (!validation.isValid) {
      throw new Error(`AI Request validation failed: ${validation.errors.join(', ')}`);
    }

    // 2. Human Review erforderlich?
    if (safeguards.includes('human_review_all')) {
      return await this.queueForHumanReview(user, requestType, data);
    }

    if (safeguards.includes('human_review_sample') && Math.random() < 0.1) {
      return await this.queueForHumanReview(user, requestType, data);
    }

    // 3. Auto-Validation mit höheren Standards
    if (safeguards.includes('auto_validation')) {
      const autoValidation = await this.advancedValidation(data);
      if (autoValidation.confidence < 80) {
        return await this.queueForHumanReview(user, requestType, data);
      }
    }

    // 4. User Feedback required?
    const response = await this.generateAIResponse(requestType, data);
    
    if (safeguards.includes('user_feedback_required')) {
      response.feedbackRequired = true;
      response.feedbackQuestions = [
        'War diese Empfehlung hilfreich?',
        'Würdest du dieses Workout ausprobieren?',
        'Erscheint dir die Schwierigkeit angemessen?'
      ];
    }

    return response;
  }

  // Fortschritts-Monitoring für Phase-Übergänge
  async evaluatePhaseProgress() {
    const metrics = await this.collectPhaseMetrics();
    
    const phaseEvaluation = {
      currentPhase: this.currentPhase,
      readyForNext: false,
      metrics: metrics,
      concerns: []
    };

    // Sicherheits-Kriterien (KO-Kriterien)
    if (metrics.injuryReports > 0) {
      phaseEvaluation.concerns.push('Verletzungen gemeldet - Phase stoppen');
      phaseEvaluation.recommendation = 'ROLLBACK';
      return phaseEvaluation;
    }

    if (metrics.averageRating < 3.5) {
      phaseEvaluation.concerns.push('Zu niedrige User-Bewertungen');
      phaseEvaluation.recommendation = 'PAUSE_ROLLOUT';
      return phaseEvaluation;
    }

    // Erfolgs-Kriterien für nächste Phase
    const successCriteria = {
      minimumUsers: 50,
      minimumRating: 4.0,
      minimumUsageRate: 0.6,
      minimumTime: 7 * 24 * 60 * 60 * 1000 // 1 Woche
    };

    const meetsAllCriteria = 
      metrics.totalUsers >= successCriteria.minimumUsers &&
      metrics.averageRating >= successCriteria.minimumRating &&
      metrics.usageRate >= successCriteria.minimumUsageRate &&
      metrics.phaseRuntime >= successCriteria.minimumTime;

    if (meetsAllCriteria && this.hasNextPhase()) {
      phaseEvaluation.readyForNext = true;
      phaseEvaluation.recommendation = 'ADVANCE_PHASE';
    } else {
      phaseEvaluation.recommendation = 'CONTINUE_CURRENT_PHASE';
    }

    return phaseEvaluation;
  }

  // Notfall-Rollback
  async emergencyRollback(reason) {
    console.error(`🚨 EMERGENCY AI ROLLBACK: ${reason}`);
    
    // Alle AI Features sofort deaktivieren
    this.currentPhase = 'disabled';
    
    // Benachrichtigungen senden
    await this.notifyTeam({
      type: 'EMERGENCY_ROLLBACK',
      reason: reason,
      timestamp: new Date().toISOString(),
      affectedUsers: await this.getAffectedUserCount()
    });

    // Logs sammeln für Post-Mortem
    await this.collectEmergencyLogs();
  }

  // Helper Methods
  userMatchesPhase(user, phase) {
    if (phase.userTypes.includes('all')) return true;
    
    return phase.userTypes.some(type => {
      switch (type) {
        case 'developer':
          return user.email?.includes('@company.com') || user.role === 'developer';
        case 'beta_tester':
          return user.betaTester === true;
        case 'power_user':
          return user.workoutCount > 100 && user.lastActive > Date.now() - 7*24*60*60*1000;
        case 'premium':
          return user.subscription === 'premium' || user.subscription === 'pro';
        case 'premium_long_term':
          return user.subscription === 'premium' && user.subscriptionStart < Date.now() - 30*24*60*60*1000;
        default:
          return false;
      }
    });
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  hasNextPhase() {
    const phases = Object.keys(this.rolloutPhases);
    const currentIndex = phases.indexOf(this.currentPhase);
    return currentIndex < phases.length - 1;
  }
}