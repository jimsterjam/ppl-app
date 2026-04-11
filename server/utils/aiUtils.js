/**
 * KI-Hilfsfunktionen: Fehlerklassifizierung, Retry-Logik, Burst-Limiter, JSON-Parsing.
 * Hält den In-Memory-Burst-Rate-Bucket (resettet bei Server-Neustart).
 */

import { logger } from './logger.js';

const AI_RETRY_ATTEMPTS = Math.max(0, Math.min(3, Number(process.env.AI_RETRY_ATTEMPTS) || 1));
const AI_RETRY_BASE_DELAY_MS = Math.max(200, Number(process.env.AI_RETRY_BASE_DELAY_MS) || 700);
const AI_BURST_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.AI_BURST_LIMIT_WINDOW_MS) || 60000);
const AI_BURST_LIMIT_MAX_REQUESTS = Math.max(1, Number(process.env.AI_BURST_LIMIT_MAX_REQUESTS) || 6);

// In-Memory-Bucket: wird bei Server-Neustart zurückgesetzt (bekanntes Limit)
const aiBurstRateBucket = new Map();

export function classifyAiError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const code = String(error?.code || '').toUpperCase();
  const msg = String(error?.message || '').toLowerCase();

  if (status === 429) return 'rate_limited';
  if (status >= 500 && status < 600) return 'provider_server_error';
  if (code.includes('TIMEOUT') || code === 'ABORT_ERR' || msg.includes('timeout')) return 'timeout';
  if (msg.includes('json') && msg.includes('parse')) return 'invalid_json';
  if (status >= 400 && status < 500) return 'provider_client_error';
  return 'unknown';
}

export function isRetryableAiError(error) {
  const type = classifyAiError(error);
  return type === 'timeout' || type === 'rate_limited' || type === 'provider_server_error';
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAiRetry(fn, { attempts = AI_RETRY_ATTEMPTS, baseDelayMs = AI_RETRY_BASE_DELAY_MS } = {}) {
  let currentAttempt = 0;
  let lastError;

  while (currentAttempt <= attempts) {
    try {
      return await fn(currentAttempt);
    } catch (error) {
      lastError = error;
      if (currentAttempt >= attempts || !isRetryableAiError(error)) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, currentAttempt);
      await sleep(delay);
      currentAttempt += 1;
    }
  }

  throw lastError;
}

export function parseJsonSafely(rawPayload = '', { requestId = '', context = 'ai' } = {}) {
  const source = String(rawPayload || '').trim();
  if (!source) {
    const err = new Error('Empty JSON payload');
    err.code = 'AI_EMPTY_JSON';
    throw err;
  }

  const candidates = [source];
  const fenced = source.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  if (fenced && fenced !== source) candidates.push(fenced);

  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const extracted = source.slice(start, end + 1);
    if (extracted && extracted !== source) candidates.push(extracted);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }

  const err = new Error('Invalid JSON payload from AI provider');
  err.code = 'AI_INVALID_JSON';
  logger.error('❌ AI JSON parse failed', {
    requestId,
    context,
    payloadPreview: source.slice(0, 400)
  });
  throw err;
}

export function validateAiSuggestionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    const err = new Error('AI payload missing');
    err.code = 'AI_INVALID_PAYLOAD';
    throw err;
  }

  if (!Array.isArray(payload.exercises) || payload.exercises.length === 0) {
    const err = new Error('AI payload has no exercises');
    err.code = 'AI_INVALID_EXERCISES';
    throw err;
  }

  if (payload.exercises.length > 8) {
    payload.exercises = payload.exercises.slice(0, 8);
  }

  return payload;
}

export function checkAiBurstLimit(userId = '') {
  const now = Date.now();
  const safeUser = userId || 'anonymous';
  const history = (aiBurstRateBucket.get(safeUser) || []).filter((ts) => now - ts < AI_BURST_LIMIT_WINDOW_MS);

  if (history.length >= AI_BURST_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = Math.max(0, AI_BURST_LIMIT_WINDOW_MS - (now - history[0]));
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  history.push(now);
  aiBurstRateBucket.set(safeUser, history);
  return { allowed: true, retryAfterSec: 0 };
}
