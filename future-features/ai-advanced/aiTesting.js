// A/B Testing für AI Empfehlungen
export default class AITestingService {
  constructor() {
    this.feedbackDB = new Map(); // In production: echte DB
    this.testGroups = {
      control: 'rule_based',    // Regelbasierte Empfehlungen
      test_a: 'gpt4_basic',     // GPT-4 mit wenig Kontext
      test_b: 'gpt4_advanced'   // GPT-4 mit vollem Kontext
    };
  }

  // User zu Testgruppe zuordnen
  assignUserToTestGroup(userId) {
    const hash = this.hashUserId(userId);
    const groups = Object.keys(this.testGroups);
    const groupIndex = hash % groups.length;
    return groups[groupIndex];
  }

  // Empfehlung mit Tracking generieren
  async generateRecommendationWithTesting(userId, workoutContext) {
    const testGroup = this.assignUserToTestGroup(userId);
    const recommendationId = `rec_${Date.now()}_${Math.random().toString(36)}`;
    
    let recommendation;
    
    switch (testGroup) {
      case 'control':
        recommendation = await this.generateRuleBasedRecommendation(workoutContext);
        break;
      case 'test_a':
        recommendation = await this.generateGPT4BasicRecommendation(workoutContext);
        break;
      case 'test_b':
        recommendation = await this.generateGPT4AdvancedRecommendation(workoutContext);
        break;
    }

    // Tracking-Metadaten hinzufügen
    recommendation.metadata = {
      recommendationId,
      testGroup,
      algorithm: this.testGroups[testGroup],
      timestamp: new Date().toISOString(),
      userId: userId
    };

    return recommendation;
  }

  // User Feedback sammeln
  async collectFeedback(recommendationId, feedback) {
    const feedbackData = {
      recommendationId,
      rating: feedback.rating, // 1-5 Sterne
      used: feedback.used, // Hat user das Workout gemacht?
      completed: feedback.completed, // Komplett durchgezogen?
      difficulty: feedback.difficulty, // Zu schwer/leicht?
      injury: feedback.injury, // Verletzung aufgetreten?
      comments: feedback.comments,
      timestamp: new Date().toISOString()
    };

    this.feedbackDB.set(recommendationId, feedbackData);
    
    // Analysiere Feedback sofort
    this.analyzeFeedback(recommendationId, feedbackData);
  }

  // Live Feedback Analyse
  analyzeFeedback(recommendationId, feedback) {
    // Kritische Probleme sofort erkennen
    if (feedback.injury) {
      console.error(`🚨 VERLETZUNG GEMELDET für Recommendation ${recommendationId}`);
      this.flagRecommendation(recommendationId, 'INJURY_REPORTED');
    }

    if (feedback.rating <= 2) {
      console.warn(`⚠️ SCHLECHTE BEWERTUNG für Recommendation ${recommendationId}`);
      this.flagRecommendation(recommendationId, 'LOW_RATING');
    }

    // Positive Signale
    if (feedback.used && feedback.completed && feedback.rating >= 4) {
      console.log(`✅ ERFOLGREICHE EMPFEHLUNG ${recommendationId}`);
      this.markAsSuccessful(recommendationId);
    }
  }

  // A/B Test Ergebnisse analysieren
  async analyzeTestResults() {
    const results = {};
    
    for (const [group, algorithm] of Object.entries(this.testGroups)) {
      const groupFeedback = Array.from(this.feedbackDB.values())
        .filter(f => this.getTestGroupFromRecommendation(f.recommendationId) === group);
      
      results[group] = {
        algorithm,
        totalRecommendations: groupFeedback.length,
        averageRating: this.calculateAverage(groupFeedback, 'rating'),
        usageRate: this.calculateUsageRate(groupFeedback),
        completionRate: this.calculateCompletionRate(groupFeedback),
        injuryRate: this.calculateInjuryRate(groupFeedback),
        confidence: this.calculateGroupConfidence(groupFeedback)
      };
    }

    return results;
  }

  // Automatische Qualitätskontrolle
  async performQualityCheck() {
    const results = await this.analyzeTestResults();
    const recommendations = {};

    Object.entries(results).forEach(([group, data]) => {
      // Sicherheit ist Priority #1
      if (data.injuryRate > 0.01) { // Mehr als 1% Verletzungen
        recommendations[group] = {
          action: 'DISABLE_IMMEDIATELY',
          reason: `Zu hohe Verletzungsrate: ${(data.injuryRate * 100).toFixed(2)}%`
        };
      }
      // Schlechte User Experience
      else if (data.averageRating < 3.0) {
        recommendations[group] = {
          action: 'REDUCE_TRAFFIC',
          reason: `Niedrige Bewertung: ${data.averageRating.toFixed(1)}/5`
        };
      }
      // Gute Performance
      else if (data.averageRating > 4.0 && data.completionRate > 0.8) {
        recommendations[group] = {
          action: 'INCREASE_TRAFFIC',
          reason: `Ausgezeichnete Performance: ${data.averageRating.toFixed(1)}/5 Rating, ${(data.completionRate * 100).toFixed(1)}% Completion`
        };
      }
    });

    return recommendations;
  }

  // Helper Methods
  calculateAverage(data, field) {
    const values = data.map(item => item[field]).filter(val => val != null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  calculateUsageRate(data) {
    const used = data.filter(item => item.used).length;
    return data.length > 0 ? used / data.length : 0;
  }

  calculateCompletionRate(data) {
    const completed = data.filter(item => item.used && item.completed).length;
    const used = data.filter(item => item.used).length;
    return used > 0 ? completed / used : 0;
  }

  calculateInjuryRate(data) {
    const injuries = data.filter(item => item.injury).length;
    return data.length > 0 ? injuries / data.length : 0;
  }

  hashUserId(userId) {
    // Simple hash für Test-Gruppierung
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer
    }
    return Math.abs(hash);
  }
}