/**
 * Central AI Service
 *
 * Abstrahiert AI-Aufrufe vom Rest der Anwendung.
 * Nutzt Provider-Pattern um zwischen OpenAI, Ollama, etc. zu wechseln.
 * Keine direkte Abhängigkeit von spezifischen AI-Providern.
 */

import { logger } from '../utils/logger.js';

class AIService {
  constructor(provider) {
    if (!provider) {
      throw new Error('AIService requires an AI provider');
    }
    this.provider = provider;
    logger.info(`✅ AI Service initialized with provider: ${this.provider.getName()}`);
  }

  /**
   * Generiere Trainings-Analyse-Feedback
   * Dies ist der HAUPT-EINSTIEGSPUNKT für AI-Anfragen
   *
   * @param {Object} trainingAnalysis - Strukturierte Trainingsanalyse
   * @param {Object} options - { requestId, temperature, ... }
   * @returns {Promise<Object>} { feedback, metadata }
   */
  async generateTrainingAnalysis(trainingAnalysis, options = {}) {
    const requestId = options.requestId || `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      logger.debug('🤖 AI Analysis requested', {
        requestId,
        provider: this.provider.getName(),
        exerciseCount: trainingAnalysis.total_exercises_analyzed
      });

      // Validiere Input
      if (!trainingAnalysis || typeof trainingAnalysis !== 'object') {
        throw new Error('Invalid training analysis data');
      }

      // Rufe Provider auf
      const feedback = await this.provider.generateTrainingAnalysis(trainingAnalysis, {
        requestId,
        ...options
      });

      if (!feedback || typeof feedback !== 'string') {
        throw new Error('Provider returned invalid feedback');
      }

      logger.debug('✅ AI Analysis completed', {
        requestId,
        provider: this.provider.getName(),
        feedbackLength: feedback.length
      });

      return {
        feedback,
        metadata: {
          requestId,
          provider: this.provider.getName(),
          model: this.provider.getModelName(),
          timestamp: new Date().toISOString(),
          exercisesAnalyzed: trainingAnalysis.total_exercises_analyzed
        }
      };

    } catch (error) {
      logger.error('❌ AI Analysis failed', {
        requestId,
        provider: this.provider.getName(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Health-Check
   */
  async healthCheck() {
    try {
      const healthy = await this.provider.healthCheck();
      logger.debug(`${healthy ? '✅' : '❌'} AI Provider health: ${this.provider.getName()}`);
      return healthy;
    } catch (error) {
      logger.warn(`⚠️ AI Provider health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Wechsle Provider (nur für Testing/Konfiguration)
   */
  setProvider(provider) {
    if (!provider) {
      throw new Error('Provider cannot be null');
    }
    this.provider = provider;
    logger.info(`✅ AI Provider switched to: ${provider.getName()}`);
  }

  /**
   * Gib aktuellen Provider-Namen zurück
   */
  getProviderName() {
    return this.provider.getName();
  }

  /**
   * Gib aktuelles Modell zurück
   */
  getModelName() {
    return this.provider.getModelName();
  }
}

// Singleton Instance
let aiServiceInstance = null;

/**
 * Initialisiere AI Service mit Provider
 * (wird beim Server-Start aufgerufen)
 */
export function initializeAIService(provider) {
  aiServiceInstance = new AIService(provider);
  return aiServiceInstance;
}

/**
 * Gib AI Service Instance zurück
 */
export function getAIService() {
  if (!aiServiceInstance) {
    throw new Error('AI Service not initialized. Call initializeAIService() first.');
  }
  return aiServiceInstance;
}

export default AIService;
