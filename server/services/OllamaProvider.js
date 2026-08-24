/**
 * Ollama Provider
 *
 * Optionale lokale Implementation des AI Providers.
 * Nutzt Ollama API für lokale Entwicklung/Tests mit Qwen3.5.
 * NICHT für Produktion – nur für lokale Entwicklung.
 */

import { logger } from '../utils/logger.js';
import AIProvider from './AIProvider.js';

// WICHTIG: Lazy-Load von ENV-Variablen (nicht beim Import)

export class OllamaProvider extends AIProvider {
  constructor() {
    super();

    // Lazy-Load: Lies ENV-Variablen hier im Constructor
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen3:4b';
    this.timeout = Math.max(5000, Number(process.env.OLLAMA_TIMEOUT_MS) || 120000);

    logger.info(`✅ Ollama Provider initialized (model: ${this.model}, url: ${this.baseUrl})`);
  }

  /**
   * Generiere Trainings-Analyse mittels Ollama
   *
   * @param {Object} trainingAnalysis - Strukturierte Trainingsanalyse
   * @param {Object} options - { requestId, temperature }
   * @returns {Promise<string>} Generiertes Feedback
   */
  async generateTrainingAnalysis(trainingAnalysis, options = {}) {
    const { requestId = 'unknown', temperature = 0.7 } = options;

    try {
      logger.debug('🔄 Ollama request started', {
        requestId,
        model: this.model,
        exerciseCount: trainingAnalysis.total_exercises_analyzed
      });

      // Baue strukturierten Prompt
      const prompt = this.buildPrompt(trainingAnalysis);

      // Rufe Ollama auf
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature,
          top_k: 40,
          top_p: 0.9
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const feedback = data?.response || '';

      if (!feedback) {
        throw new Error('Ollama returned empty response');
      }

      logger.debug('✅ Ollama request completed', {
        requestId,
        model: this.model,
        feedbackLength: feedback.length
      });

      return feedback;

    } catch (error) {
      logger.error('❌ Ollama request failed', {
        requestId,
        model: this.model,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Baue Prompt aus strukturierten Trainings-Daten
   */
  buildPrompt(trainingAnalysis) {
    const exercises = trainingAnalysis.exercises || [];
    const topImprovements = trainingAnalysis.top_improvements || [];
    const topDeclines = trainingAnalysis.top_declines || [];

    let prompt = `Du bist ein sachlicher Fitness-Coach.
Analysiere diese Trainingsdaten und erstelle kurzes, ehrliches Feedback (300-400 Wörter).

WICHTIG zu Notizen: Wenn eine Übung eine Notiz vom Nutzer hat, erkläre ihre Zahlen im
Licht dieser Notiz, bevor du sie bewertest. Stagnation oder fehlendes Gewicht NICHT als
negative Entwicklung werten, wenn die Notiz das erklärt (z.B. technikfokussierte Übung,
bewusstes Deload, Formfokus). Nutze nur, was explizit in der Notiz steht.

# Trainingsfortschritt-Analyse

## Zusammenfassung
- Analysierte Übungen: ${trainingAnalysis.total_exercises_analyzed}
- Positive Entwicklungen: ${trainingAnalysis.progression_summary.positive}
- Stabile Entwicklungen: ${trainingAnalysis.progression_summary.stable}
- Negative Entwicklungen: ${trainingAnalysis.progression_summary.negative}

## Top-Fortschritte
${topImprovements.length > 0
  ? topImprovements.map(e => `- ${e.exercise}: +${e.volume_change_percent}%`).join('\n')
  : '- Keine signifikanten Verbesserungen'}

## Top-Rückgänge
${topDeclines.length > 0
  ? topDeclines.map(e => `- ${e.exercise}: ${e.volume_change_percent}%`).join('\n')
  : '- Keine signifikanten Rückgänge'}

## Detaillierte Übungsanalyse
${exercises
  .map(ex => {
    let exPrompt = `### ${ex.exercise}
- Progression: ${ex.progression}
- Zeitraum: ${ex.period_description}

**Aktuelle Leistung:**
- Gewicht: ${ex.current_weight}kg
- Wiederholungen: ${ex.current_reps}`;

    if (ex.previous_weight !== undefined) {
      exPrompt += `

**Vorherige Leistung:**
- Gewicht: ${ex.previous_weight}kg
- Wiederholungen: ${ex.previous_reps}

**Veränderung:**
- Gewicht: ${ex.changes.weight_change_kg > 0 ? '+' : ''}${ex.changes.weight_change_kg}kg
- Wiederholungen: ${ex.changes.reps_change > 0 ? '+' : ''}${ex.changes.reps_change}
- Volumen: ${ex.changes.volume_change_percent > 0 ? '+' : ''}${ex.changes.volume_change_percent}%`;
    }

    if (ex.note) {
      exPrompt += `

**Notiz des Nutzers zu dieser Übung:** "${ex.note}"`;
    }

    return exPrompt;
  })
  .join('\n\n')}

Erstelle strukturiertes Feedback in dieser Struktur:
### Gesamtentwicklung
(Kurze Zusammenfassung)

### Was läuft gut?
(2-3 positive Punkte)

### Was fällt auf?
(2-3 Auffälligkeiten)

### Empfehlungen
(Max 3 konkrete Tipps)

### Fazit
(2-3 Sätze, keine neuen Infos)

Sprich den Nutzer direkt an (Du/Dein). Deutsch. Sachlich.`;

    return prompt;
  }

  /**
   * Health Check
   */
  async healthCheck() {
    // Bug: `timeout` ist keine gültige fetch()-Option (weder Browser noch Node/undici) und
    // wurde bisher stillschweigend ignoriert — ein unerreichbares Ollama (z.B. Handy nicht im
    // Heimnetzwerk) konnte den "5s-Check" faktisch bis zum TCP-eigenen Timeout blockieren.
    // Jetzt mit echtem AbortController-Timeout, damit die Health-Check-Antwort verlässlich
    // schnell kommt, unabhängig vom eigentlichen (120s) Generierungs-Timeout.
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      return response.ok;
    } catch (error) {
      logger.warn('❌ Ollama health check failed:', error.message);
      return false;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Provider-Name
   */
  getName() {
    return 'Ollama';
  }

  /**
   * Modell-Name
   */
  getModelName() {
    return this.model;
  }
}

export default OllamaProvider;
