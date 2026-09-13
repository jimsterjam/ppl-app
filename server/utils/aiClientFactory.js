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

// ---------------------------------------------------------------------------
// Relay-Wake-Up (Kostenkompromiss: Render Free-Plan statt Starter, siehe Diskussion mit User -
// ein Upgrade auf Starter (kein Einschlafen des Dienstes) würde das Problem strukturell lösen,
// kostet aber ~25€/Monat zusätzlich und ist in der aktuellen Testphase bewusst nicht gewünscht).
// ---------------------------------------------------------------------------
// Render Free-Web-Services schlafen nach ~15 Min. Inaktivität ein und brauchen beim Aufwachen
// mehrere zehn Sekunden - eine einzelne echte Chat-Completion-Anfrage (die dabei zusätzlich noch
// echtes OpenAI-Geld kostet) ist dafür der falsche Wecker: sie hat ein festes Timeout/Retry-Budget
// und Renders eigenes Edge-Gateway kann währenddessen bereits mit einer 502-HTML-Seite aufgeben,
// bevor der Relay-Container überhaupt bereit ist (beobachtetes Symptom: 502 nach ~4-5s, obwohl der
// Relay laut Render-Dashboard "live" ist - er war schlicht noch am Hochfahren).
//
// Fix: VOR dem eigentlichen (kostenpflichtigen) Completion-Call wird der Relay separat über seinen
// unauthentifizierten /healthz-Endpunkt (siehe relay/app.js) "geweckt" und wiederholt angefragt,
// bis er antwortet oder maxWaitMs erreicht ist - kostet kein OpenAI-Token, nur Zeit. Ein
// Zeitstempel des letzten erfolgreichen Kontakts wird gemerkt, damit nicht JEDE Anfrage diesen
// Wake-Up-Umweg nehmen muss, solange der Relay mit hoher Wahrscheinlichkeit noch wach ist
// (deutliche Sicherheitsmarge unter den ~15 Min., nach denen Render ihn einschlafen lässt).
//
// Nachtrag (2026-09-13, User-Report "seit dem Umbau mit dem Relay funktioniert es nicht mehr"):
// ursprünglich war maxWaitMs=50s/pollIntervalMs=3s - live per Browser nachgestellt (direkter
// Aufruf von /healthz während des Hochfahrens) dauerte ein Kaltstart dabei einmal ÜBER 50
// Sekunden (Renders eigene "Application loading"-Zwischenseite). Production-Logs zeigten
// mehrfach GENAU dieses Muster: alle ~17 Versuche über die vollen 50s scheiterten mit Status
// 502, der Relay-Dienst selbst loggte in der gesamten Zeit nichts (bestätigt: die Anfragen
// erreichten den Container nie, sie wurden von Renders Edge-Gateway abgewiesen, während der
// Container noch hochfuhr) - das Zeitbudget war schlicht zu knapp bemessen. Ohne kostenpflichtiges
// Starter-Upgrade (siehe Kommentar oben) bleibt das ein Wahrscheinlichkeits-Kompromiss: 100s
// deckt die bisher beobachteten Fälle ab, kann aber bei einem noch längeren Kaltstart erneut
// nicht ausreichen. Empfehlung an den User: einen externen, kostenlosen Keep-Alive-Pinger (z.B.
// cron-job.org, UptimeRobot) alle 5-10 Minuten auf https://ppl-app-ai-relay.onrender.com/healthz
// einrichten - das hält den Dienst dauerhaft wach und umgeht das Problem strukturell, ohne für
// Render Starter zu bezahlen.
let lastRelayContactAt = 0;
const RELAY_WARM_ASSUMPTION_MS = 8 * 60 * 1000;

/**
 * Merkt sich, dass der Relay gerade erfolgreich reagiert hat (Healthcheck ODER ein echter,
 * erfolgreicher Completion-Call) - von Aufrufern nach jedem erfolgreichen Request aufzurufen.
 */
export function markRelayContact() {
  lastRelayContactAt = Date.now();
}

/**
 * Wartet ggf., bis der Relay erreichbar ist (siehe Kommentar oben). No-op im Direkt-Modus
 * (kein Relay konfiguriert) und no-op, wenn der letzte bekannte Kontakt noch "frisch" ist.
 * Wirft NICHT bei Ausbleiben der Antwort - der eigentliche Call versucht es danach trotzdem
 * (klassifiziert einen erneuten 502 ganz normal über classifyAiError/withAiRetry), diese
 * Funktion verschafft ihm nur eine deutlich bessere Ausgangslage.
 *
 * @param {Object} [options]
 * @param {number} [options.maxWaitMs] - maximale Wartezeit insgesamt (Default 100s - live
 *   beobachtet, dass ein Render-Free-Kaltstart gelegentlich deutlich über 50s dauert, siehe
 *   Kommentar am Dateianfang zur Diagnose vom 2026-09-13)
 * @param {number} [options.pollIntervalMs] - Abstand zwischen Healthcheck-Versuchen (Default 4s,
 *   etwas entzerrt gegenüber vorher 3s, um ein mögliches gegenseitiges Stören durch zu dichte
 *   Anfragen während des Hochfahrens zu vermeiden - nicht bestätigt, aber als Vorsichtsmaßnahme
 *   günstig)
 */
export async function ensureRelayAwake({ maxWaitMs = 100000, pollIntervalMs = 4000 } = {}) {
  if (getAiClientMode() !== 'relay') return;
  if (Date.now() - lastRelayContactAt < RELAY_WARM_ASSUMPTION_MS) return;

  const healthUrl = `${String(process.env.AI_RELAY_URL).trim().replace(/\/+$/, '')}/healthz`;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;
  let lastErrorMessage = '';

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        markRelayContact();
        if (attempt > 1) {
          logger.info('✅ Relay aufgeweckt', { attempt, elapsedMs: Date.now() - (deadline - maxWaitMs) });
        }
        return;
      }
      lastErrorMessage = `Status ${response.status}`;
    } catch (error) {
      lastErrorMessage = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  logger.warn('⚠️ Relay antwortete auch nach Wake-Up-Versuchen nicht - versuche echten Call trotzdem', {
    attempts: attempt,
    lastError: lastErrorMessage
  });
}

export default {
  getAiClientMode,
  describeAiClientMode,
  createOpenAIClient,
  logAiClientMode,
  ensureRelayAwake,
  markRelayContact
};
