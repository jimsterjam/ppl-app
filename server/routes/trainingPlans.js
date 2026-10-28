import express from "express";
import TrainingPlan from "../models/TrainingPlan.js";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { logger } from "../utils/logger.js";
import { sanitizePlanPayload, isPlanLimitExceeded } from "../utils/trainingPlanValidation.js";

const router = express.Router();

// Alle Pläne des eingeloggten Users (höchstens 3).
router.get("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const plans = await TrainingPlan.find({ userId }).lean();
    res.json(plans);
  } catch (err) {
    logger.error("[GET /api/training-plans] Fehler", { message: err?.message });
    res.status(500).json({ error: "Pläne konnten nicht geladen werden" });
  }
});

// Plan anlegen ODER aktualisieren (Upsert nach clientId) - wiederholtes Syncen erzeugt nie Duplikate.
router.post("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { value, error } = sanitizePlanPayload(req.body);
    if (error) return res.status(400).json({ error });

    const existing = await TrainingPlan.findOne({ userId, clientId: value.clientId }).lean();
    if (!existing) {
      const count = await TrainingPlan.countDocuments({ userId });
      if (isPlanLimitExceeded(count)) {
        return res.status(409).json({ error: "Limit erreicht: maximal 3 Pläne", code: "LIMIT_REACHED" });
      }
    }

    const { clientId, ...fields } = value;
    const plan = await TrainingPlan.findOneAndUpdate(
      { userId, clientId },
      { $set: fields },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    // Genau ein aktiver Plan: wurde dieser aktiv gesetzt, werden die anderen inaktiv.
    if (fields.active) {
      await TrainingPlan.updateMany({ userId, clientId: { $ne: clientId }, active: true }, { $set: { active: false } });
    }
    res.status(existing ? 200 : 201).json(plan);
  } catch (err) {
    if (err?.code === 11000) {
      try {
        const current = await TrainingPlan.findOne({ userId: req.auth.userId, clientId: String(req.body?.clientId) }).lean();
        if (current) return res.status(200).json(current);
      } catch {}
    }
    logger.error("[POST /api/training-plans] Fehler", { message: err?.message });
    res.status(400).json({ error: "Plan konnte nicht gespeichert werden" });
  }
});

// Löschen nach clientId (nur eigene Pläne).
router.delete("/:clientId", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const plan = await TrainingPlan.findOneAndDelete({ userId, clientId: String(req.params.clientId) });
    if (!plan) return res.status(404).json({ error: "Plan nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    logger.error("[DELETE /api/training-plans/:clientId] Fehler", { message: err?.message });
    res.status(500).json({ error: "Plan konnte nicht gelöscht werden" });
  }
});

export default router;
