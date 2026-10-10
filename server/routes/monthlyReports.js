/**
 * Monatsbericht-Routen (Pro)
 *
 * POST /api/reports/monthly/check     - erzeugt den Bericht, wenn er fällig ist (utils/monthlyReport.js)
 * GET  /api/reports/monthly           - Liste der eigenen Berichte (neueste zuerst)
 * GET  /api/reports/monthly/:id       - ein Bericht mit allen Zahlen
 * POST /api/reports/monthly/:id/seen  - als gesehen markieren (Dashboard-Zeile "neu" verschwindet)
 *
 * Schutz (wie routes/coach.js):
 * - nur Pro/Elite (403 pro_required), auf dem Server geprüft
 * - Anfragen pro Nutzer und Stunde begrenzt (429), geprüft vor jedem Datenbankzugriff
 * - Eingaben: keine Texte. Die Berichts-ID kommt aus der URL und wird als ObjectId geprüft; der
 *   Bericht gehört immer zum angemeldeten Nutzer (userId in jeder Abfrage). Gespeichert wird nur,
 *   was der Server selbst berechnet hat - nie der Request-Body.
 * - Ein Bericht je Nutzer und Tag der Erzeugung (eindeutiger Index): gleichzeitige Anfragen
 *   erzeugen keine Doppelten.
 */
import express from 'express';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import UserProfile from '../models/UserProfile.js';
import MonthlyReport from '../models/MonthlyReport.js';
import {
  buildMonthlyReport,
  countSessionsInPeriod,
  evaluateReportDue,
  REPORT_HISTORY_DAYS
} from '../utils/monthlyReport.js';
import { createUserRateLimiter } from '../utils/userRateLimit.js';
import { resolvePlan } from '../utils/entitlements.js';
import { logger } from '../utils/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MAX_WORKOUTS = 400;
export const MAX_LIST = 24;
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.REPORT_RATE_LIMIT_MAX) || 30);
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const WORKOUT_FIELDS = 'date completedAt goal exercises.exerciseId exercises.name exercises.trainingType ' +
  'exercises.category exercises.equipment exercises.setDetails.reps exercises.setDetails.weight ' +
  'exercises.setDetails.isWarmup exercises.setDetails.done';

// Login-Prüfung erst beim ersten Aufruf laden (siehe routes/coach.js).
async function lazyFirebaseAuth(req, res, next) {
  const { firebaseAuthMiddleware } = await import('../middleware/firebaseAuth.js');
  return firebaseAuthMiddleware(req, res, next);
}

function summaryOf(report) {
  return {
    id: String(report._id),
    periodStart: new Date(report.periodStart).toISOString(),
    periodEnd: new Date(report.periodEnd).toISOString(),
    generatedAt: report.generatedAt ? new Date(report.generatedAt).toISOString() : null,
    seenAt: report.seenAt ? new Date(report.seenAt).toISOString() : null
  };
}

const defaultDeps = {
  auth: lazyFirebaseAuth,
  async loadProfile(userId) {
    const profile = await UserProfile.findOne({ uid: userId }).select('subscription.plan').lean();
    return { paid: resolvePlan(profile?.subscription?.plan || 'free', userId).paid };
  },
  async loadLastReport(userId) {
    return MonthlyReport.findOne({ userId }).sort({ periodEnd: -1 }).select('periodEnd').lean();
  },
  async loadFirstWorkoutDate(userId) {
    const first = await Workout.findOne({ userId, completed: true }).sort({ date: 1 }).select('date').lean();
    return first?.date || null;
  },
  async loadWorkouts(userId, now) {
    const since = new Date(now.getTime() - REPORT_HISTORY_DAYS * MS_PER_DAY);
    return Workout.find({ userId, completed: true, date: { $gte: since, $lte: now } })
      .select(WORKOUT_FIELDS)
      .sort({ date: -1 })
      .limit(MAX_WORKOUTS)
      .lean();
  },
  async saveReport(userId, { periodStart, periodEnd, facts }, now) {
    return MonthlyReport.create({
      userId,
      periodKey: now.toISOString().slice(0, 10),
      periodStart,
      periodEnd,
      facts,
      generatedAt: now
    });
  },
  async listReports(userId) {
    return MonthlyReport.find({ userId }).sort({ periodEnd: -1 }).limit(MAX_LIST)
      .select('periodStart periodEnd generatedAt seenAt').lean();
  },
  async getReport(userId, id) {
    return MonthlyReport.findOne({ _id: id, userId }).lean();
  },
  async markSeen(userId, id, now) {
    await MonthlyReport.updateOne({ _id: id, userId, seenAt: null }, { $set: { seenAt: now } });
  },
  now: () => new Date()
};

export function createMonthlyReportsRouter(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const checkLimit = deps.limiter || createUserRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX });
  const router = express.Router();

  // Gemeinsamer Vorspann: Login, Limit (vor jedem DB-Zugriff), Pro. Legt req.report an.
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
      req.report = { userId, now: deps.now() };
      return next();
    } catch (error) {
      logger.error('[reports] Profil konnte nicht geladen werden', { error: error?.message });
      return res.status(500).json({ error: 'report_failed' });
    }
  }

  function idParam(req, res, next) {
    const id = String(req.params.id || '');
    if (!/^[a-f0-9]{24}$/i.test(id) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'not_found' });
    }
    return next();
  }

  router.post('/monthly/check', deps.auth, guard, async (req, res) => {
    const { userId, now } = req.report;
    try {
      const last = await deps.loadLastReport(userId);
      const firstWorkoutDate = last ? null : await deps.loadFirstWorkoutDate(userId);
      const gate = evaluateReportDue({ now, lastPeriodEnd: last?.periodEnd, firstWorkoutDate });
      if (!gate.due) return res.json({ created: false, reason: gate.reason });

      const workouts = await deps.loadWorkouts(userId, now);
      const sessionsInPeriod = countSessionsInPeriod(workouts, now);
      const due = evaluateReportDue({ now, lastPeriodEnd: last?.periodEnd, firstWorkoutDate, sessionsInPeriod });
      if (!due.due) return res.json({ created: false, reason: due.reason });

      const built = buildMonthlyReport(workouts, { now });
      if (built.unavailable) return res.status(503).json({ error: 'report_unavailable' });

      try {
        const saved = await deps.saveReport(userId, built, now);
        return res.json({ created: true, report: summaryOf(saved) });
      } catch (error) {
        // Eindeutiger Index (Nutzer + Tag): ein anderes Gerät war gleichzeitig schneller.
        if (error?.code === 11000) return res.json({ created: false, reason: 'exists' });
        throw error;
      }
    } catch (error) {
      logger.error('[reports/monthly/check] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'report_failed' });
    }
  });

  router.get('/monthly', deps.auth, guard, async (req, res) => {
    try {
      const reports = await deps.listReports(req.report.userId);
      return res.json({ reports: reports.map(summaryOf) });
    } catch (error) {
      logger.error('[reports/monthly] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'report_failed' });
    }
  });

  router.get('/monthly/:id', deps.auth, guard, idParam, async (req, res) => {
    try {
      const report = await deps.getReport(req.report.userId, req.params.id);
      if (!report) return res.status(404).json({ error: 'not_found' });
      return res.json({ ...summaryOf(report), facts: report.facts });
    } catch (error) {
      logger.error('[reports/monthly/:id] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'report_failed' });
    }
  });

  router.post('/monthly/:id/seen', deps.auth, guard, idParam, async (req, res) => {
    try {
      const report = await deps.getReport(req.report.userId, req.params.id);
      if (!report) return res.status(404).json({ error: 'not_found' });
      await deps.markSeen(req.report.userId, req.params.id, req.report.now);
      return res.json({ ok: true });
    } catch (error) {
      logger.error('[reports/monthly/:id/seen] Fehler', { error: error?.message });
      return res.status(500).json({ error: 'report_failed' });
    }
  });

  return router;
}

export default createMonthlyReportsRouter();
