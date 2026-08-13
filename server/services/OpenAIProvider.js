/**
 * OpenAI Provider
 *
 * Produktions-Implementation des AI Providers.
 * Nutzt OpenAI API für Trainings-Feedback-Generierung.
 * Sendet NUR strukturierte Backend-Daten, keine Rohdaten.
 */

import { OpenAI } from 'openai';
import { logger } from '../utils/logger.js';
import AIProvider from './AIProvider.js';

// WICHTIG: Lazy-Load von ENV-Variablen (nicht beim Import)
// Sonst sind sie noch undefined wenn dotenv.config() nicht aufgerufen wurde

export class OpenAIProvider extends AIProvider {
  constructor() {
    super();

    // Lazy-Load: Lies ENV-Variablen hier im Constructor, nicht beim Module-Import
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const timeout = Math.max(5000, Number(process.env.OPENAI_TIMEOUT_MS) || 30000);

    this.model = model;
    this.timeout = timeout;

    if (!apiKey) {
      logger.warn('⚠️ OPENAI_API_KEY not configured. OpenAI provider will not work.');
      this.client = null;
    } else {
      try {
        this.client = new OpenAI({
          apiKey: apiKey,
          timeout: timeout
        });
        logger.info(`✅ OpenAI Provider initialized (model: ${model})`);
      } catch (error) {
        logger.error('❌ Failed to initialize OpenAI client:', error.message);
        this.client = null;
      }
    }
  }

  /**
   * Generiere Trainings-Analyse mittels OpenAI
   *
   * @param {Object} trainingAnalysis - Strukturierte Trainingsanalyse von Backend
   * @param {Object} options - { requestId, temperature }
   * @returns {Promise<string>} Generiertes Feedback
   */
  async generateTrainingAnalysis(trainingAnalysis, options = {}) {
    const { requestId = 'unknown', temperature = 0.7 } = options;

    if (!this.client) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY.');
    }

    try {
      logger.debug('🔄 OpenAI request started', {
        requestId,
        model: this.model,
        exerciseCount: trainingAnalysis.total_exercises_analyzed
      });

      // Baue strukturierten Prompt
      const prompt = this.buildPrompt(trainingAnalysis);

      // Rufe OpenAI auf
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        max_tokens: 800,
        timeout: this.timeout
      });

      const feedback = response.choices?.[0]?.message?.content?.trim();

      if (!feedback) {
        throw new Error('OpenAI returned empty response');
      }

      logger.debug('✅ OpenAI request completed', {
        requestId,
        model: this.model,
        feedbackLength: feedback.length,
        tokensUsed: response.usage?.total_tokens
      });

      return feedback;

    } catch (error) {
      logger.error('❌ OpenAI request failed', {
        requestId,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * System-Prompt mit Regeln
   * Definiert was das Modell darf und darf nicht
   */
  getSystemPrompt() {
    return `Du bist ein sachlicher und präziser Fitness-Coach.
Deine Aufgabe: Interpretiere Trainingsfortschritt basierend auf Backend-Berechnungen und erstelle verständliches Feedback.

KRITISCHE REGELN:
1. Die vom Backend gelieferten Zahlen sind VERBINDLICH. Berechne sie NICHT neu.
   - Wenn Backend sagt "+15,4%", nutze "+15,4%", nicht "ungefähr 15%"
   - Ändere keine Prozentwerte, Differenzen oder Durchschnitte
   - Keine neuen Kennzahlen erfinden

2. KEINE Halluzinierten Ursachen:
   - Nicht: "Du hast Fett verloren" (wenn nur Gewichtsverlust in den Daten)
   - Ja: "Dein Körpergewicht ist um 1,7% gesunken. Die Ursache ist anhand der Daten nicht bestimmbar."

3. KEINE Medizinischen Diagnosen:
   - Behaupte nicht: Verletzungen, Überlastungen, Gelenkprobleme, Regenerationsprobleme
   - Diese dürfen nur erwähnt werden, wenn sie explizit in den Daten stehen

4. KEINE Unbelegten Physiologischen Erklärungen:
   - Nicht automatisch behaupten: Muskelaufbau, Fettabbau, Nervensystem-Anpassung, Ermüdung
   - Nur erwähnen, wenn in den Daten belegt

5. Empfehlungen müssen aus den Backend-Erkenntnissen ableitbar sein:
   - Wenn Gewicht +22%, Reps -30%: Könnte sinnvoll sein, erst wieder Reps zu erhöhen
   - Immer Grund angeben, aber keine ärztlichen Begründungen

OUTPUT-FORMAT:
Ungefähr 300-500 Wörter. Struktur:
- Gesamtentwicklung (kurze Zusammenfassung)
- Was läuft gut? (2-3 positive Punkte)
- Was fällt auf? (2-3 Auffälligkeiten/Bedenken)
- Empfehlungen (max 3 konkrete, ableitbar)
- Fazit (2-3 Sätze, keine neuen Infos)

Priorisiere statt alle Daten zu wiederholen.
Spreche den Nutzer direkt an (Du/Dein, nicht "Der Nutzer").
Deutsch, sachlich, konkret.`;
  }

  /**
   * Baue Prompt aus strukturierten Trainings-Daten
   * Sendeet NUR Mini-Datensatz, nicht Rohdaten
   */
  buildPrompt(trainingAnalysis) {
    const exercises = trainingAnalysis.exercises || [];
    const topImprovements = trainingAnalysis.top_improvements || [];
    const topDeclines = trainingAnalysis.top_declines || [];

    let prompt = `# Trainingsfortschritt-Analyse

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
- Zeitraum: ${ex.period_description} (${ex.period_days} Tage)

**Aktuelle Leistung:**
- Gewicht: ${ex.current_weight}kg
- Wiederholungen: ${ex.current_reps}
- Volumen: ${ex.current_volume}kg (kumulativ)`;

    if (ex.previous_weight !== undefined) {
      exPrompt += `

**Vorherige Leistung:**
- Gewicht: ${ex.previous_weight}kg
- Wiederholungen: ${ex.previous_reps}
- Volumen: ${ex.previous_volume}kg

**Veränderung:**
- Gewicht: ${ex.changes.weight_change_kg > 0 ? '+' : ''}${ex.changes.weight_change_kg}kg
- Wiederholungen: ${ex.changes.reps_change > 0 ? '+' : ''}${ex.changes.reps_change}
- Volumen: ${ex.changes.volume_change_percent > 0 ? '+' : ''}${ex.changes.volume_change_percent}%`;
    }

    return exPrompt;
  })
  .join('\n\n')}

Analysiere diese Daten und erstelle strukturiertes Feedback nach den Regeln.`;

    return prompt;
  }

  /**
   * Health Check
   */
  async healthCheck() {
    if (!this.client) {
      return false;
    }

    try {
      // Versuche Liste der Modelle zu abrufen (schneller Check)
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.warn('OpenAI health check failed:', error.message);
      return false;
    }
  }

  /**
   * Provider-Name
   */
  getName() {
    return 'OpenAI';
  }

  /**
   * Modell-Name
   */
  getModelName() {
    return this.model;
  }
}

export default OpenAIProvider;
