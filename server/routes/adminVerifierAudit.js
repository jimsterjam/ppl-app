import express from 'express';
import VerifierAudit from '../models/VerifierAudit.js';
import { requireAdminKey } from '../middleware/adminAuth.js';
import { getRuleLabel } from '../services/feedbackVerificationService.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Admin-Auswertung des Feedback-Qualitäts-Loops (Phase 1: Shadow-Modus, siehe
// feedbackVerificationService.js). Liest ausschließlich das anonyme, aggregierbare
// VerifierAudit-Protokoll (kein User-/Workout-Bezug, siehe Modell-Kommentar dort) - analog zu
// den bestehenden Admin-Routen (routes/feedback.js, routes/adminFeedbackInsights.js), gleicher
// Schutz per requireAdminKey.
//
// Baut die Klartext-Erklärung (Regel-Nummer -> Beschreibung) bereits hier serverseitig, statt
// dem Client nur die rohen Regel-Nummern zu liefern - der Admin soll im Panel direkt lesen
// können, was beanstandet wurde, ohne den System-Prompt danebenzulegen (User-Wunsch: "das JSON
// bringt mir da nichts").
const router = express.Router();

function summarizeEntry(entry) {
  const ruleDetails = (entry.triggeredRules || []).map((rule) => ({
    rule,
    label: getRuleLabel(rule)
  }));

  const parts = [];
  if (entry.deterministicViolation) {
    parts.push('Zahlen-/Wortbudget-Check hat etwas beanstandet');
  }
  if (entry.aiCheckFailed) {
    parts.push('KI-Prüfschritt ist fehlgeschlagen (kein Ergebnis)');
  } else if (entry.aiViolation) {
    parts.push('KI-Prüfschritt hat einen Regelverstoß gefunden');
  }

  const summary = parts.length > 0
    ? parts.join(' · ')
    : 'Keine Beanstandung - Entwurf hat beide Prüfungen bestanden';

  return {
    id: String(entry._id),
    mode: entry.mode,
    createdAt: entry.createdAt,
    deterministicViolation: !!entry.deterministicViolation,
    aiViolation: entry.aiCheckFailed ? null : !!entry.aiViolation,
    aiCheckFailed: !!entry.aiCheckFailed,
    revisionAttempted: !!entry.revisionAttempted,
    revisionSucceeded: entry.revisionSucceeded ?? null,
    ruleDetails,
    summary
  };
}

router.get('/', requireAdminKey, async (req, res) => {
  try {
    const filter = {};
    const ALLOWED_MODES = new Set(['shadow', 'active']);
    const mode = String(req.query?.mode || '').trim();
    if (mode && ALLOWED_MODES.has(mode)) {
      filter.mode = mode;
    }

    const onlyViolations = String(req.query?.onlyViolations || '') === '1';
    if (onlyViolations) {
      filter.$or = [{ deterministicViolation: true }, { aiViolation: true }];
    }

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '50', 10) || 50));

    const entries = await VerifierAudit.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json((entries || []).map(summarizeEntry));
  } catch (e) {
    logger.error('❌ VerifierAudit-Liste fehlgeschlagen', { message: e?.message });
    res.status(500).json({ error: 'Failed to load verifier audit entries', message: e?.message || String(e) });
  }
});

// Aggregierte Auswertung "welche Regel wurde in den letzten 30 Tagen wie oft beanstandet" -
// genau der Anwendungsfall aus dem ursprünglichen Plan (Priorisierung, welche Regeln überhaupt
// relevant sind). Zählt nur KI-Prüfschritt-Verstöße (triggeredRules), nicht den reinen
// Zahlen-Check separat, da der Admin hier primär an inhaltlichen Mustern interessiert ist.
router.get('/summary', requireAdminKey, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, Number.parseInt(req.query?.days || '30', 10) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalRuns, ruleCounts] = await Promise.all([
      VerifierAudit.countDocuments({ createdAt: { $gte: since } }),
      VerifierAudit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $unwind: '$triggeredRules' },
        { $group: { _id: '$triggeredRules', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      periodDays: days,
      totalRuns,
      rules: ruleCounts.map((r) => ({
        rule: r._id,
        label: getRuleLabel(r._id),
        count: r.count
      }))
    });
  } catch (e) {
    logger.error('❌ VerifierAudit-Summary fehlgeschlagen', { message: e?.message });
    res.status(500).json({ error: 'Failed to load verifier audit summary', message: e?.message || String(e) });
  }
});

export default router;
