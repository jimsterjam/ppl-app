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
      // WICHTIG: `timeout` ist beim openai-SDK ein Request-OPTIONS-Parameter (2. Argument),
      // kein Feld des Request-Bodys. Stand er im Body-Objekt, schickte der SDK-Client ihn als
      // unbekanntes JSON-Feld mit an die API -> "400 Unrecognized request argument supplied:
      // timeout". Der Client-Timeout (this.timeout) greift ohnehin schon global über die
      // `new OpenAI({ timeout })`-Konfiguration im Constructor; hier zusätzlich als
      // Options-Argument gesetzt, falls ein Request abweichend länger/kürzer dauern soll.
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
        max_tokens: 800
      }, {
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

6. Notizen des Nutzers sind verbindlicher Kontext, keine Meinung:
   - Wenn eine Übung eine Notiz hat, erkläre die Zahlen dieser Übung im Licht der Notiz,
     bevor du sie bewertest
   - Stagnation oder fehlende Gewichtssteigerung NICHT als "negative Progression" werten,
     wenn die Notiz das erklärt (z.B. technikfokussierte Übung ohne Zusatzgewicht,
     bewusstes Deload, Verletzung/Vorsicht, Formfokus)
   - Notizen nicht überinterpretieren oder verallgemeinern - nutze nur, was explizit dasteht
   - Übungen ohne Notiz weiterhin normal anhand der Zahlen bewerten
   - Manche Übungen haben ZWEI Notiz-Ebenen: "Persönliche Notiz" (dauerhaft, gilt für den
     Nutzer bei dieser Übung generell) und "Notiz zu dieser Session" (gilt nur für dieses
     eine Training). Eine BESTÄTIGTE persönliche Notiz ist eine feste Einschränkung/ein
     fester Kontext und bleibt auch dann gültig, wenn die aktuelle Session keine eigene
     Notiz enthält. Widersprich ihr nicht und ignoriere sie nicht, nur weil die Session-Notiz
     fehlt oder etwas anderes betont.

7. Null-Annahmen-Prinzip - was nicht in den Daten steht, existiert für diese Analyse nicht:
   - Körpergewicht (athlete_bodyweight_kg) wird NUR erwähnt/bewertet, wenn es explizit in der
     Zusammenfassung angegeben ist. Fehlt es, triff KEINE Aussage über das Körpergewicht des
     Nutzers - auch nicht andeutungsweise ("dein Gewicht scheint..."). Verwechsle es niemals
     mit Trainingsgewicht (kg auf der Hantel) - das sind zwei komplett unabhängige Werte.
   - Fehlende Felder/Werte NICHT plausibel auffüllen oder erraten. Wenn eine Information für
     eine Aussage fehlt, lass die Aussage weg statt sie zu vermuten.

8. Übungsprofil (profile_hint) - falls angegeben, ist es VERBINDLICH für die Bewertung
   dieser Übung:
   - exerciseType "technique": Ausführungsqualität steht im Fokus, nicht Gewicht/Volumen.
     Bewerte KEINE Gewichtssteigerung als Fortschritt und empfiehl KEINE Gewichtssteigerung,
     wenn externalLoadRelevant=false.
   - exerciseType "power": Bei higherRepsAreProgress=false sind mehr Wiederholungen KEIN
     Fortschritt (z.B. Schnellkraft-/Sprungübungen) - werte sie nicht als solchen und
     empfiehl nicht "mehr Wiederholungen" als Ziel.
   - trainingVolumeRelevant=false: Verändertes Trainingsvolumen fließt nicht in die Bewertung
     dieser Übung ein.
   - Übungen ohne profile_hint weiterhin normal anhand von Gewicht/Volumen bewerten (Rückfall
     auf generische Bewertung, kein Blockieren der Analyse).

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
- Negative Entwicklungen: ${trainingAnalysis.progression_summary.negative}${
  trainingAnalysis.athlete_bodyweight_kg != null
    ? `\n- Körpergewicht des Nutzers (diese Session): ${trainingAnalysis.athlete_bodyweight_kg}kg`
    : ''
}

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

    if (ex.profile_hint?.exerciseType) {
      const p = ex.profile_hint;
      const relevantMetrics = [
        p.externalLoadRelevant ? 'Gewicht' : null,
        p.trainingVolumeRelevant ? 'Volumen' : null,
        p.higherRepsAreProgress ? 'Wiederholungen' : null
      ].filter(Boolean);
      exPrompt += `

**Übungsprofil:** Typ "${p.exerciseType}"${p.targetRepRange?.min != null || p.targetRepRange?.max != null
        ? `, Ziel-Wiederholungsbereich ${p.targetRepRange?.min ?? '?'}-${p.targetRepRange?.max ?? '?'}`
        : ''}. Relevante Fortschrittsmetriken: ${relevantMetrics.length > 0 ? relevantMetrics.join(', ') : 'keine der üblichen (Gewicht/Volumen/Reps) - siehe Regel 8'}.`;
    }

    // Kap. 25: persistente Notiz (Rang 1/2) und Session-Notiz getrennt ausgeben, damit die AI
    // sie gemäß Regel 6 unterschiedlich gewichtet, statt sie zu vermischen.
    if (ex.note_context?.persistent) {
      exPrompt += `

**Persönliche Notiz${ex.note_context.persistent.confirmed ? ' (bestätigt)' : ' (nicht bestätigt)'}:** "${ex.note_context.persistent.text}"`;
    }
    if (ex.note_context?.session) {
      exPrompt += `

**Notiz zu dieser Session:** "${ex.note_context.session}"`;
    } else if (ex.note && !ex.note_context?.persistent) {
      // Rückfallebene für den Fall, dass note_context aus irgendeinem Grund fehlt, aber das
      // ältere "note"-Feld gesetzt ist (Rückwärtskompatibilität).
      exPrompt += `

**Notiz des Nutzers zu dieser Übung:** "${ex.note}"`;
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
