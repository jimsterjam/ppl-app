/**
 * aiClientFactory
 *
 * Zentrale Stelle, die einen konfigurierten OpenAI-SDK-Client zurückgibt - genutzt von
 * services/OpenAIProvider.js (Haupt-Feedback-Generierung) UND
 * services/feedbackVerificationService.js (KI-Prüfaufruf, Stufe 2 des Feedback-Qualitäts-
 * Loops). Vorher instanziierten beide Stellen `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
 * unabhängig voneinander - das hätte den geschützten Relay (siehe unten) an zwei Stellen
 * duplizieren müssen.
 *
 * GESCHÜTZTER RELAY (optional, siehe /relay im Projektwurzelverzeichnis):
 * Statt den echten OpenAI-Key auf diesem Server zu halten, kann stattdessen ein separat
 * gehosteter, kleiner Relay-Dienst dazwischengeschaltet werden, der den echten Key nur bei sich
 * hält und Anfragen an OpenAI durchleitet. Dieser Server spricht den Relay dann exakt wie
 * OpenAI selbst an (der Relay bildet dieselbe /v1/chat/completions- bzw. /v1/models-Schnittstelle
 * nach) - das OpenAI-SDK unterstützt dafür nativ eine alternative `baseURL`, es muss an den
 * Aufrufstellen (buildPrompt, chat.completions.create, ...) NICHTS geändert werden.
 *
 * Authentifizierung gegenüber dem Relay: das SDK schickt den `apiKey`-Wert ohnehin als
 * `Authorization: Bearer <apiKey>`-Header - im Relay-Modus wird dort statt des echten
 * OpenAI-Keys ein separat generiertes, geteiltes Secret (AI_RELAY_SHARED_SECRET) übertragen.
 * Der Relay prüft dieses Secret gegen seine eigene Kopie und hängt erst DANN, auf seiner
 * eigenen Infrastruktur, den echten OPENAI_API_KEY an die Weiterleitung an OpenAI an. Der echte
 * Key verlässt also nie diesen Server/dessen Deployment-Umgebung.
 *
 * Moduswahl (siehe getAiClientMode()):
 * - 'relay':  AI_RELAY_URL ist gesetzt -> Client zeigt auf den Relay, sendet AI_RELAY_SHARED_SECRET
 *             als apiKey. OPENAI_API_KEY wird in diesem Modus auf DIESEM Server nicht benötigt.
 * - 'direct': AI_RELAY_URL ist NICHT gesetzt (Standard, z.B. lokale Entwicklung) -> Client
 *             spricht OpenAI direkt an, wie bisher, mit OPENAI_API_KEY.
 */

import { OpenAI } from 'openai';
import { logger } from './logger.js';

/**
 * @returns {'relay'|'direct'}
 */
export function getAiClientMode() {
  const relayUrl = String(process.env.AI_RELAY_URL || '').trim();
  return relayUrl ? 'relay' : 'direct';
}

/**
 * Liefert eine kurze, sensible-Werte-freie Beschreibung des aktiven Modus - für Logging/
 * Health-Checks (z.B. beim Server-Start oder in /api/health), NICHT für Endnutzer-Antworten.
 */
export function describeAiClientMode() {
  const mode = getAiClientMode();
  if (mode === 'relay') {
    return `relay (${new URL(process.env.AI_RELAY_URL).host})`;
  }
  return 'direct (api.openai.com)';
}

/**
 * Baut einen OpenAI-SDK-Client, wahlweise gegen die echte OpenAI-API oder gegen den
 * geschützten Relay. Wirft einen Fehler mit `err.code = 'AI_NOT_CONFIGURED'`, wenn im
 * jeweiligen Modus die nötige(n) Variable(n) fehlen - Aufrufer (OpenAIProvider,
 * feedbackVerificationService) fangen das bereits ab bzw. lassen ihn kontrolliert
 * durchreichen.
 *
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - überschreibt den Default-Timeout
 * @returns {import('openai').OpenAI}
 */
export function createOpenAIClient(options = {}) {
  const mode = getAiClientMode();
  const timeout = Math.max(5000, Number(options.timeoutMs) || Number(process.env.OPENAI_TIMEOUT_MS) || 30000);

  if (mode === 'relay') {
    const baseURL = String(process.env.AI_RELAY_URL).trim().replace(/\/+$/, '');
    const sharedSecret = process.env.AI_RELAY_SHARED_SECRET;

    if (!sharedSecret) {
      const err = new Error('AI_RELAY_SHARED_SECRET not configured (required when AI_RELAY_URL is set)');
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }

    return new OpenAI({
      apiKey: sharedSecret,
      baseURL,
      timeout
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY not configured');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  return new OpenAI({ apiKey, timeout });
}

/**
 * Einmaliges Start-Log (Provider-Init, Server-Start), damit im Betrieb sofort sichtbar ist,
 * ob der Server gerade direkt gegen OpenAI oder über den Relay läuft - ohne Secrets zu loggen.
 */
export function logAiClientMode(context = '') {
  const mode = getAiClientMode();
  const label = describeAiClientMode();
  logger.info(`🔌 AI-Client-Modus${context ? ` (${context})` : ''}: ${label} [${mode}]`);
}

export default { getAiClientMode, describeAiClientMode, createOpenAIClient, logAiClientMode };
