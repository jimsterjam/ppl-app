import { logger } from './logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b';
const OLLAMA_TIMEOUT_MS = Math.max(5000, Number(process.env.OLLAMA_TIMEOUT_MS) || 120000); // 120 Sekunden für qwen3:4b

/**
 * Health check: Ist Ollama erreichbar?
 */
export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    logger.warn('❌ Ollama health check failed:', error.message);
    return false;
  }
}

/**
 * Rufe Ollama auf – Non-Streaming (wartet auf komplette Response)
 * @param {string} prompt - Der Text-Prompt für das Modell
 * @param {Object} options - Konfigurationsoptionen
 * @returns {Promise<string>} - Die Antwort des Modells
 */
export async function generateWithOllama(prompt, options = {}) {
  const {
    model = OLLAMA_MODEL,
    temperature = 0.7,
    timeout = OLLAMA_TIMEOUT_MS,
    requestId = 'unknown'
  } = options;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }

  try {
    logger.debug('🔄 Ollama request started', {
      requestId,
      model,
      promptLength: prompt.length
    });

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
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
    const result = data?.response || '';

    if (!result) {
      throw new Error('Ollama returned empty response');
    }

    logger.debug('✅ Ollama request completed', {
      requestId,
      responseLength: result.length,
      model
    });

    return result;
  } catch (error) {
    logger.error('❌ Ollama generation error', {
      requestId,
      model,
      error: error.message,
      type: error.name
    });
    throw error;
  }
}

/**
 * Spezialisiert für Feedback-Generierung
 * Nimmt einen Mini-Datensatz (JSON) und generiert natürliches Feedback
 * @param {Object} trainingData - z.B. { exercise, period, weight_change, rep_change, volume_change, progression }
 * @param {Object} options - Konfigurationsoptionen
 * @returns {Promise<string>} - Das generierte Feedback
 */
export async function generateProgressFeedback(trainingData, options = {}) {
  const { requestId = 'unknown', ...otherOptions } = options;

  // Baue einen strukturierten Prompt (deutsches Feedback)
  const prompt = `Du bist ein sachlicher und ehrlicher Fitness-Coach. Analysiere diese Trainingsdaten und gib kurzes, prägnantes deutsches Feedback (2-3 Sätze). Sei konkret und nutze die Zahlen:

Übung: ${trainingData.exercise || 'Unbekannt'}
Zeitraum: ${trainingData.period || '7 Tage'}
Gewichtsveränderung: ${trainingData.weight_change || 0} kg
Wiederholungen-Veränderung: ${trainingData.rep_change || 0}
Volumenveränderung: ${trainingData.volume_change || 0}%
Trend: ${trainingData.progression || 'stabil'}

Kurzes, ehrliches Feedback auf Deutsch:`;

  try {
    const result = await generateWithOllama(prompt, {
      temperature: 0.6,
      ...otherOptions,
      requestId
    });

    return result.trim();
  } catch (error) {
    logger.error('❌ Progress feedback generation failed', {
      requestId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Batch-Prompt für mehrere Übungen
 * @param {Array} exercises - Array von Trainingsdaten-Objekten
 * @param {Object} options
 * @returns {Promise<Object>} - { exercise_name: feedback_text }
 */
export async function generateBatchFeedback(exercises, options = {}) {
  const { requestId = 'unknown', ...otherOptions } = options;
  const feedbackMap = {};

  for (const exercise of exercises) {
    try {
      const feedback = await generateProgressFeedback(exercise, {
        requestId: `${requestId}_${exercise.exercise}`,
        ...otherOptions
      });
      feedbackMap[exercise.exercise] = feedback;
    } catch (error) {
      logger.error('❌ Batch feedback generation failed for exercise', {
        exercise: exercise.exercise,
        error: error.message
      });
      feedbackMap[exercise.exercise] = `Fehler bei Feedback-Generierung: ${error.message}`;
    }
  }

  return feedbackMap;
}

export default {
  checkOllamaHealth,
  generateWithOllama,
  generateProgressFeedback,
  generateBatchFeedback
};
