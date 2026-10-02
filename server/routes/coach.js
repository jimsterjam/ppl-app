/**
 * Coach-Routen (Pro)
 *
 * GET /api/coach/diagnosis - Stillstand-Diagnose (utils/stagnationDiagnosis.js)
 *
 * Schutz vor Missbrauch und unnötiger Last:
 * - nur Pro/Elite (403 pro_required) - geprüft auf dem Server, nicht nur in der App
 * - pro Nutzer höchstens DIAGNOSIS_RATE_LIMIT_MAX Abrufe je Stunde (429 mit retryAfter)
 * - Ergebnis-Cache je Nutzer: neu gerechnet wird nur, wenn sich seine Workouts geändert haben
 *   (oder nach CACHE_TTL_MS)
 * - Datenbankabfrage begrenzt auf 12 Wochen, MAX_WORKOUTS Workouts und die nötigen Felder
 */
import express from 'express';
import Workout from '../models/Workout.js';
import UserProfile from '../models/UserProfile.js';
import { buildStagnationDiagnosis, WINDOW_DAYS } from '../utils/stagnationDiagnosis.js';
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
  async loadPlan(userId) {
    const profile = await UserProfile.findOne({ uid: userId }).select('subscription.plan').lean();
    return resolvePlan(profile?.subscription?.plan || 'free', userId);
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

  router.get('/diagnosis', deps.auth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    // Limit vor jedem Datenbankzugriff - auch Anfragen ohne Pro zählen mit.
    const limit = checkLimit(userId);
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ error: 'rate_limited', retryAfter: limit.retryAfterSec });
    }

    try {
      const { paid } = await deps.loadPlan(userId);
      if (!paid) return res.status(403).json({ error: 'pro_required', locked: true });

      const now = deps.now();
      const stamp = await deps.loadStamp(userId);
      const cached = cache.get(userId);
      if (cached && cached.stamp === stamp && now.getTime() - cached.at < CACHE_TTL_MS) {
        return res.json({ ...cached.result, cached: true });
      }

      const workouts = await deps.loadWorkouts(userId, now);
      const diagnosis = deps.diagnose(workouts, { now });
      if (diagnosis.unavailable) return res.status(503).json({ error: 'diagnosis_unavailable' });
      const result = { locked: false, ...diagnosis, generatedAt: now.toISOString() };

      cache.delete(userId);
      cache.set(userId, { stamp, at: now.getTime(), result });
      if (cache.size > CACHE_MAX_USERS) cache.delete(cache.keys().next().value);

      return res.json({ ...result, cached: false });
    } catch (error) {
      logger.error('[coach/diagnosis] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'diagnosis_failed' });
    }
  });

  return router;
}

export default createCoachRouter();
