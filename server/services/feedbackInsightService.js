/**
 * feedbackInsightService
 *
 * Analysiert negativ bewertete/korrigierte FeedbackRating-Einträge (KI-Trainingsanalyse) und
 * leitet daraus einen Verbesserungsvorschlag für den System-Prompt (OpenAIProvider.js) ab.
 * Admin-only Feature, siehe routes/adminFeedbackInsights.js.
 *
 * Bewusste, freigegebene Ausnahme von der sonst geltenden Regel "FeedbackRating wird niemals
 * für globale Auswertungen gelesen" (siehe Kommentar in models/FeedbackRating.js): Diese
 * Analyse liest correctionText/reasonCodes admin-only, zeigt sie NIE anderen Nutzern und
 * übergibt bewusst NIE userId/feedbackId an OpenAI - nur die reine Bewertungsinhalte.
 */

import { OpenAI } from 'openai';
import { logger } from '../utils/logger.js';
import { withAiRetry, parseJsonSafely } from '../utils/aiUtils.js';

const MAX_RATINGS_PER_ANALYSIS = 40;
const MAX_CORRECTION_LENGTH = 400;

/**
 * Wählt aus allen relevanten Ratings (rating='not_helpful' ODER correctionText vorhanden,
 * status aktiv/geändert) diejenigen aus, die noch in keinem bisherigen Proposal referenziert
 * wurden - reine Funktion, keine DB-Zugriffe, daher gut testbar.
 *
 * @param {Array} allRatings - Kandidaten (bereits serverseitig nach rating/status gefiltert)
 * @param {Set<string>} alreadyIncludedIds - IDs aus sourceRatingIds bisheriger Proposals
 * @param {number} limit
 * @returns {Array}
 */
export function selectUnanalyzedRatings(allRatings = [], alreadyIncludedIds = new Set(), limit = MAX_RATINGS_PER_ANALYSIS) {
  const safeRatings = Array.isArray(allRatings) ? allRatings : [];
  const fresh = safeRatings.filter((r) => !alreadyIncludedIds.has(String(r._id)));
  return fresh.slice(0, Math.max(1, limit));
}

function truncate(text, maxLength) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw;
}

/**
 * Baut den User-Prompt für die Analyse aus den ausgewählten Ratings. Übergibt NIE userId oder
 * feedbackId - nur rating, reasonCodes, correctionText (gekürzt) und feedbackVersion, jeweils
 * als anonymes, durchnummeriertes Listenelement.
 *
 * @param {Array} ratings - FeedbackRating-artige Objekte { rating, reasonCodes, correctionText, feedbackVersion }
 * @returns {string}
 */
export function buildInsightPrompt(ratings = []) {
  const safeRatings = Array.isArray(ratings) ? ratings : [];

  const items = safeRatings.map((r, idx) => {
    const lines = [`${idx + 1}. Bewertung: ${r.rating === 'not_helpful' ? 'nicht hilfreich' : 'hilfreich'}`];
    if (Array.isArray(r.reasonCodes) && r.reasonCodes.length > 0) {
      lines.push(`   Gründe: ${r.reasonCodes.join(', ')}`);
    }
    const correction = truncate(r.correctionText, MAX_CORRECTION_LENGTH);
    if (correction) {
      lines.push(`   Korrektur des Nutzers: "${correction}"`);
    }
    return lines.join('\n');
  });

  return `Hier sind ${safeRatings.length} anonymisierte Nutzer-Bewertungen des KI-Trainingsfeedbacks (kein Nutzerbezug, keine Trainingsdaten):

${items.join('\n\n')}

Analysiere diese Bewertungen und leite daraus einen konkreten Verbesserungsvorschlag für den System-Prompt ab, der dieses Feedback generiert.`;
}

export function getInsightSystemPrompt() {
  return `Du analysierst Nutzer-Bewertungen (Daumen runter + optionale Freitext-Korrektur) zu
KI-generiertem Fitness-Trainingsfeedback einer App. Ziel: wiederkehrende Muster erkennen und
einen konkreten, umsetzbaren Vorschlag formulieren, wie der System-Prompt, der dieses Feedback
erzeugt, angepasst werden sollte, um diese Kritikpunkte künftig zu vermeiden.

Regeln:
- Nur auf Basis der gegebenen Bewertungen argumentieren, keine Annahmen über Daten erfinden,
  die nicht genannt wurden.
- Bei nur 1-2 Bewertungen: trotzdem eine konkrete, spezifische Einschätzung abgeben statt
  "nicht genug Daten" zu antworten - auch ein einzelner klar formulierter Kritikpunkt ist
  verwertbar.
- Konkret und umsetzbar formulieren (z.B. "Regel X ergänzen um: ...", nicht "Ton verbessern").
- Kein Bezug auf einzelne Nutzer, keine Vermutungen über deren Identität.

Antworte AUSSCHLIESSLICH als valides JSON-Objekt, keine Erklärung davor/danach:
{
  "summary": "Kurzer Titel, max. 15 Wörter",
  "proposalText": "Ausführlicher, konkreter Vorschlag (mehrere Sätze), was am System-Prompt geändert werden sollte und warum, basierend auf den genannten Bewertungen"
}`;
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY not configured');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  const timeout = Math.max(5000, Number(process.env.OPENAI_TIMEOUT_MS) || 30000);
  return new OpenAI({ apiKey, timeout });
}

/**
 * Ruft OpenAI auf und liefert { summary, proposalText } zurück.
 *
 * @param {Array} ratings - vorgefilterte, ausgewählte FeedbackRating-artige Objekte
 * @param {Object} options - { requestId }
 */
export async function generateInsightProposal(ratings, options = {}) {
  const { requestId = `insight_${Date.now()}` } = options;
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const userPrompt = buildInsightPrompt(ratings);

  const response = await withAiRetry(async () => {
    return client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: getInsightSystemPrompt() },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });
  });

  const raw = response.choices?.[0]?.message?.content?.trim();
  const parsed = parseJsonSafely(raw, { requestId, context: 'feedback-insight' });

  const summary = String(parsed?.summary || '').trim().slice(0, 200);
  const proposalText = String(parsed?.proposalText || '').trim().slice(0, 4000);

  if (!summary || !proposalText) {
    logger.error('❌ Feedback-Insight: unvollständige AI-Antwort', { requestId, parsed });
    const err = new Error('AI response missing summary or proposalText');
    err.code = 'AI_INCOMPLETE_INSIGHT';
    throw err;
  }

  return { summary, proposalText };
}

export default {
  selectUnanalyzedRatings,
  buildInsightPrompt,
  getInsightSystemPrompt,
  generateInsightProposal
};
