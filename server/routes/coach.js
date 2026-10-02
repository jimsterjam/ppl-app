/**
 * Coach-Routen (Pro)
 *
 * GET    /api/coach/diagnosis      - Stillstand-Diagnose (utils/stagnationDiagnosis.js)
 * POST   /api/coach/diagnosis/ack  - "Ist so geplant": { key, cause } für ACK_DAYS ausblenden
 * DELETE /api/coach/diagnosis/ack  - "Nicht mehr geplant": { key } Bestätigung entfernen
 *
 * Schutz vor Missbrauch und unnötiger Last:
 * - nur Pro/Elite (403 pro_required) - geprüft auf dem Server, nicht nur in der App
 * - pro Nutzer höchstens DIAGNOSIS_RATE_LIMIT_MAX Anfragen je Stunde, alle Endpunkte zusammen
 *   (429 mit retryAfter), geprüft vor jedem Datenbankzugriff
 * - Ergebnis-Cache je Nutzer: neu gerechnet wird nur, wenn sich seine Workouts geändert haben
 *   (oder nach CACHE_TTL_MS)
 * - Datenbankabfrage begrenzt auf 12 Wochen, MAX_WORKOUTS Workouts und die nötigen Felder
 * - Eingaben: kein freier Text. Nur key + cause, streng geprüft (validateAckInput), und nur für
 *   Einträge, die gerade in der Diagnose des Nutzers stehen. Gespeichert wird die vom Server
 *   gebaute Liste (upsertAck), nie der Request-Body selbst.
 */
import express from 'express';
import Workout from '../models/Workout.js';
import UserProfile from '../models/UserProfile.js';
import {
  buildStagnationDiagnosis,
  applyAcknowledgements,
  validateAckInput,
  upsertAck,
  removeAck,
  WINDOW_DAYS
} from '../utils/stagnationDiagnosis.js';
import { createUserRateLimiter } from '../utils/userRateLimit.js';
import { resolvePlan } from '../utils/entitlements.js';
import { logger } from '../utils/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MAX_WORKOUTS = 300;
export const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_USERS = 2000;
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.DIAGNOSIS_RATE_LIMIT_MAX) || 20);
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const WORKOUT_FIELDS = 'date completedAt goal exercises.exerciseId exercises.name exercises.trainingType ' +
  'exercises.category exercises.equipment exercises.setDetails.reps exercises.setDetails.weight ' +
  'exercises.setDetails.isWarmup exercises.setDetails.done';

// Login-Prüfung erst beim ersten Aufruf laden: middleware/firebaseAuth.js initialisiert Firebase
// Admin schon beim Import (braucht Zugangsdaten) - so bleibt die Route ohne Firebase testbar.
async function lazyFirebaseAuth(req, res, next) {
  const { firebaseAuthMiddleware } = await import('../middleware/firebaseAuth.js');
  return firebaseAuthMiddleware(req, res, next);
}

const defaultDeps = {
  auth: lazyFirebaseAuth,
  async loadProfile(userId) {
    const profile = await UserProfile.findOne({ uid: userId }).select('subscription.plan coachDiagnosisAcks').lean();
    const { paid } = resolvePlan(profile?.subscription?.plan || 'free', userId);
    return { paid, acks: Array.isArray(profile?.coachDiagnosisAcks) ? profile.coachDiagnosisAcks : [] };
  },
  async saveAcks(userId, acks) {
    await UserProfile.updateOne({ uid: userId }, { $set: { coachDiagnosisAcks: acks } });
  },
  // Günstige Abfrage, um zu erkennen, ob sich seit dem letzten Ergebnis etwas geändert hat.
  async loadStamp(userId) {
    const [latest, count] = await Promise.all([
      Workout.findOne({ userId, completed: true }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
      Workout.countDocuments({ userId, completed: true })
    ]);
    return `${latest?.updatedAt ? new Date(latest.updatedAt).getTime() : 0}:${count}`;
  },
  async loadWorkouts(userId, now) {
    const since = new Date(now.getTime() - WINDOW_DAYS * MS_PER_DAY);
    return Workout.find({ userId, completed: true, date: { $gte: since, $lte: now } })
      .select(WORKOUT_FIELDS)
      .sort({ date: -1 })
      .limit(MAX_WORKOUTS)
      .lean();
  },
  diagnose: (workouts, options) => buildStagnationDiagnosis(workouts, options),
  now: () => new Date()
};

export function createCoachRouter(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const checkLimit = deps.limiter || createUserRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX });
  const cache = new Map();
  const router = express.Router();

  // Gemeinsamer Vorspann: Login, Limit (vor jedem DB-Zugriff), Pro. Legt req.coach an.
  async function guard(req, res, next) {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const limit = checkLimit(userId);
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ error: 'rate_limited', retryAfter: limit.retryAfterSec });
    }
    try {
      const profile = await deps.loadProfile(userId);
      if (!profile.paid) return res.status(403).json({ error: 'pro_required', locked: true });
      req.coach = { userId, acks: profile.acks, now: deps.now() };
      return next();
    } catch (error) {
      logger.error('[coach] Profil konnte nicht geladen werden', { error: error?.message });
      return res.status(500).json({ error: 'diagnosis_failed' });
    }
  }

  // Rohdiagnose (ohne Bestätigungen) aus dem Cache oder neu berechnet.
  async function getDiagnosis(userId, now) {
    const stamp = await deps.loadStamp(userId);
    const cached = cache.get(userId);
    if (cached && cached.stamp === stamp && now.getTime() - cached.at < CACHE_TTL_MS) {
      return { diagnosis: cached.diagnosis, cached: true };
    }
    const workouts = await deps.loadWorkouts(userId, now);
    const diagnosis = deps.diagnose(workouts, { now });
    if (!diagnosis.unavailable) {
      cache.delete(userId);
      cache.set(userId, { stamp, at: now.getTime(), diagnosis });
      if (cache.size > CACHE_MAX_USERS) cache.delete(cache.keys().next().value);
    }
    return { diagnosis, cached: false };
  }

  router.get('/diagnosis', deps.auth, guard, async (req, res) => {
    const { userId, acks, now } = req.coach;
    try {
      const { diagnosis, cached } = await getDiagnosis(userId, now);
      if (diagnosis.unavailable) return res.status(503).json({ error: 'diagnosis_unavailable' });
      const visible = applyAcknowledgements(diagnosis, acks, now);
      return res.json({
        locked: false,
        ...visible,
        analyzedExercises: diagnosis.analyzedExercises,
        windowDays: diagnosis.windowDays,
        generatedAt: now.toISOString(),
        cached
      });
    } catch (error) {
      logger.error('[coach/diagnosis] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'diagnosis_failed' });
    }
  });

  router.post('/diagnosis/ack', deps.auth, guard, async (req, res) => {
    const { userId, acks, now } = req.coach;
    const input = validateAckInput(req.body);
    if (!input) return res.status(400).json({ error: 'invalid_input' });
    try {
      const { diagnosis } = await getDiagnosis(userId, now);
      const exists = (diagnosis.items || []).some((i) => i.key === input.key && i.cause === input.cause);
      if (!exists) return res.status(404).json({ error: 'not_in_diagnosis' });
      const next = upsertAck(acks, input, now);
      await deps.saveAcks(userId, next);
      const saved = next.find((a) => a.key === input.key);
      return res.json({ ok: true, until: saved.until.toISOString() });
    } catch (error) {
      logger.error('[coach/diagnosis/ack] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'diagnosis_failed' });
    }
  });

  router.delete('/diagnosis/ack', deps.auth, guard, async (req, res) => {
    const { userId, acks } = req.coach;
    // Nur der Schlüssel zählt; cause wird für dieselbe Prüfung mitgeschickt.
    const input = validateAckInput(req.body);
    if (!input) return res.status(400).json({ error: 'invalid_input' });
    try {
      await deps.saveAcks(userId, removeAck(acks, input.key));
      return res.json({ ok: true });
    } catch (error) {
      logger.error('[coach/diagnosis/ack] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'diagnosis_failed' });
    }
  });

  return router;
}

export default createCoachRouter();
