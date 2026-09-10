import express from 'express';
import mongoose from 'mongoose';
import FeedbackRating from '../models/FeedbackRating.js';
import PromptImprovementProposal from '../models/PromptImprovementProposal.js';
import { requireAdminKey } from '../middleware/adminAuth.js';
import { selectUnanalyzedRatings, generateInsightProposal } from '../services/feedbackInsightService.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Admin-only: KI-gestützte Analyse von negativ bewerteten/korrigierten KI-Trainingsfeedbacks
// (FeedbackRating), die daraus einen Verbesserungsvorschlag für den Analyse-System-Prompt
// ableitet (PromptImprovementProposal). Komplett getrennt von routes/feedback.js (AppFeedback
// = allgemeines App-Feedback der Nutzer, hier geht es um die Qualität des KI-Coach-Textes).
// Jede Route ist per requireAdminKey geschützt - keine normale Nutzer-Authentifizierung, da
// hier bewusst userübergreifend und mit personenbezogenem correctionText gelesen wird (siehe
// Datenschutz-Hinweis in models/FeedbackRating.js und feedbackInsightService.js).
const router = express.Router();

// Kandidaten: alles, was auf ein Problem hindeutet (nicht hilfreich ODER mit Korrekturtext),
// und noch aktiv gültig ist (siehe isCountedStatus-Konzept in feedbackRatingService.js - hier
// direkt inline, da diese Route bewusst unabhängig von der personenbezogenen Bewertungslogik
// bleibt). Von /analyze UND /pending-count genutzt, damit beide exakt dieselbe Definition von
// "relevante Bewertung" verwenden und nicht auseinanderlaufen können.
async function findUnanalyzedRatings() {
  const candidates = await FeedbackRating.find({
    status: { $in: ['active', 'edited'] },
    $or: [
      { rating: 'not_helpful' },
      { correctionText: { $nin: [null, ''] } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const existingProposals = await PromptImprovementProposal.find({}, { sourceRatingIds: 1 }).lean();
  const alreadyIncludedIds = new Set(
    existingProposals.flatMap((p) => (Array.isArray(p.sourceRatingIds) ? p.sourceRatingIds : []))
  );

  return selectUnanalyzedRatings(candidates, alreadyIncludedIds);
}

// Zeigt an, ob es neue, noch nicht in einen Vorschlag eingeflossene Bewertungen gibt - ohne
// gleich eine (kostenpflichtige) Analyse anzustoßen. Wichtig für die Admin-UI: "Aktualisieren"
// lädt nur die bestehende Vorschlagsliste neu, zeigt also KEINE rohen Bewertungen an - ohne
// diesen Zähler war für den Admin nicht erkennbar, ob überhaupt neue Daten für eine Analyse
// vorliegen (siehe Rückmeldung: neue Bewertung landet zwar in FeedbackRating, aber "erscheint"
// nirgends in der Oberfläche, bis man aktiv "Neue Analyse starten" klickt).
router.get('/pending-count', requireAdminKey, async (req, res) => {
  try {
    const pending = await findUnanalyzedRatings();
    res.json({ count: pending.length });
  } catch (e) {
    logger.error('❌ Feedback-Insight pending-count fehlgeschlagen', { message: e?.message });
    res.status(500).json({ error: 'Failed to count pending ratings', message: e?.message || String(e) });
  }
});

router.post('/analyze', requireAdminKey, async (req, res) => {
  try {
    const selected = await findUnanalyzedRatings();

    if (selected.length === 0) {
      return res.json({ skipped: true, message: 'Keine neuen Bewertungen seit der letzten Analyse.' });
    }

    const { summary, proposalText } = await generateInsightProposal(selected);

    const created = await PromptImprovementProposal.create({
      summary,
      proposalText,
      sourceRatingCount: selected.length,
      sourceRatingIds: selected.map((r) => String(r._id))
    });

    logger.info('🔍 Feedback-Insight-Analyse erstellt', {
      proposalId: String(created._id),
      sourceRatingCount: selected.length
    });

    res.status(201).json({
      skipped: false,
      id: String(created._id),
      status: created.status,
      summary: created.summary,
      proposalText: created.proposalText,
      sourceRatingCount: created.sourceRatingCount,
      createdAt: created.createdAt
    });
  } catch (e) {
    logger.error('❌ Feedback-Insight-Analyse fehlgeschlagen', { message: e?.message, code: e?.code });
    res.status(500).json({ error: 'Analysis failed', message: e?.message || String(e) });
  }
});

router.get('/', requireAdminKey, async (req, res) => {
  try {
    const filter = {};
    const ALLOWED_STATUS = new Set(['pending', 'approved', 'rejected']);
    const status = String(req.query?.status || '').trim();
    if (status && ALLOWED_STATUS.has(status)) {
      filter.status = status;
    }

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '50', 10) || 50));

    const proposals = await PromptImprovementProposal.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(
      (proposals || []).map((p) => ({
        id: String(p._id),
        status: p.status,
        summary: p.summary,
        proposalText: p.proposalText,
        sourceRatingCount: p.sourceRatingCount,
        reviewedAt: p.reviewedAt,
        reviewNote: p.reviewNote,
        createdAt: p.createdAt
      }))
    );
  } catch (e) {
    logger.error('❌ Feedback-Insight-Liste fehlgeschlagen', { message: e?.message });
    res.status(500).json({ error: 'Failed to load proposals', message: e?.message || String(e) });
  }
});

router.patch('/:id', requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const status = String(req.body?.status || '').trim();
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', allowed: ['approved', 'rejected'] });
    }

    const reviewNote = req.body?.reviewNote != null ? String(req.body.reviewNote).trim().slice(0, 1000) : null;

    const updated = await PromptImprovementProposal.findByIdAndUpdate(
      id,
      { status, reviewNote, reviewedAt: new Date() },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json({
      id: String(updated._id),
      status: updated.status,
      reviewedAt: updated.reviewedAt,
      reviewNote: updated.reviewNote
    });
  } catch (e) {
    logger.error('❌ Feedback-Insight-Update fehlgeschlagen', { message: e?.message });
    res.status(500).json({ error: 'Failed to update proposal', message: e?.message || String(e) });
  }
});

export default router;
