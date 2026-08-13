/**
 * AIProvider Interface/Base Class
 *
 * Definiert die Schnittstelle die alle AI-Provider implementieren müssen.
 * Erlaubt austausch zwischen OpenAI, Ollama, etc. ohne Code-Änderungen.
 */

export class AIProvider {
  /**
   * Generiere Trainings-Feedback aus strukturierten Backend-Daten
   *
   * @param {Object} analysisData - Strukturierte Trainingsanalyse (von trainingAnalysisService)
   * @param {Object} options - { requestId, temperature, ... }
   * @returns {Promise<string>} Generiertes Feedback
   * @throws {Error} Bei Fehler
   */
  async generateTrainingAnalysis(analysisData, options = {}) {
    throw new Error('generateTrainingAnalysis() must be implemented by subclass');
  }

  /**
   * Health-Check: Ist dieser Provider erreichbar?
   *
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented by subclass');
  }

  /**
   * Name des Providers (für Logging/Debugging)
   *
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }

  /**
   * Model-Name (für Logging)
   *
   * @returns {string}
   */
  getModelName() {
    throw new Error('getModelName() must be implemented by subclass');
  }
}

export default AIProvider;
