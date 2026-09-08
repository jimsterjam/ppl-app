import express from 'express';
import AppFeedback from '../models/AppFeedback.js';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Allgemeines App-Feedback (Fehler/Idee/Unklarheit) - erreichbar über Einstellungen ->
// "Feedback geben" sowie die einmalige Einladung nach dem ersten gespeicherten Workout.
// KOMPLETT GETRENNT von der Bewertung einzelner KI-Feedbacks (feedbackRatingService.js /
// routes/workouts.js /:id/feedback-rating) - diese Route fasst die bestehende Bewertungslogik
// nicht an.
const router = express.Router();

const ALLOWED_CATEGORIES = new Set(['bug', 'idea', 'unclear']);
const MAX_TEXT_LENGTH = 2000;

function sanitizeText(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  return raw.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').slice(0, MAX_TEXT_LENGTH);
}

// Nur die vier explizit vorgesehenen, rein technischen Felder übernehmen - alles andere im
// Request-Body wird ignoriert. Verhindert, dass über einen manipulierten Client-Request
// zusätzliche (z.B. personenbezogene) Felder ins context-Objekt gelangen.
function sanitizeContext(input) {
  if (!input || typeof input !== 'object') return null;
  const pick = (value) => {
    const str = String(value ?? '').trim();
    return str ? str.slice(0, 200) : null;
  };
  const context = {
    appVersion: pick(input.appVersion),
    platform: pick(input.platform),
    osVersion: pick(input.osVersion),
    deviceModel: pick(input.deviceModel),
    screenContext: pick(input.screenContext)
  };
  const hasAnyValue = Object.values(context).some(Boolean);
  return hasAnyValue ? context : null;
}

router.post('/', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const category = String(req.body?.category || '').trim();
    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        code: 'INVALID_CATEGORY',
        allowed: Array.from(ALLOWED_CATEGORIES)
      });
    }

    const text = sanitizeText(req.body?.text);
    // Kontextdaten nur übernehmen, wenn der Nutzer explizit zugestimmt hat (consentGiven=true) -
    // ohne Zustimmung wird context immer null, selbst wenn der Client versehentlich welche
    // mitschickt (Datenschutz-Vorgabe: "Diese Daten dürfen nur nach einer klaren Zustimmung
    // mitgesendet werden").
    const consentGiven = req.body?.consentGiven === true;
    const context = consentGiven ? sanitizeContext(req.body?.context) : null;

    const created = await AppFeedback.create({
      userId: uid,
      category,
      text,
      context,
      consentGiven: !!(consentGiven && context)
    });

    logger.info('📝 App-Feedback erhalten', {
      userId: uid,
      category,
      hasText: !!text,
      consentGiven: !!(consentGiven && context)
    });

    res.status(201).json({ success: true, id: created._id });
  } catch (e) {
    logger.error('❌ Failed to save app feedback', { message: e?.message });
    res.status(500).json({ error: 'Failed to save feedback', message: e?.message || String(e) });
  }
});

export default router;
