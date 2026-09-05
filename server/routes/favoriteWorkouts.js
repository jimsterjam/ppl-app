import express from "express";
import FavoriteWorkout from "../models/FavoriteWorkout.js";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { logger } from "../utils/logger.js";
import {
  normalizeFavoriteType,
  validateFavoritePayload,
  isFavoriteLimitExceeded
} from "../services/favoriteWorkoutValidation.js";

const router = express.Router();

// Alle Favoriten des eingeloggten Users laden (alle Typen, Client gruppiert selbst).
router.get("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const favorites = await FavoriteWorkout.find({ userId }).lean();
    res.json(favorites);
  } catch (err) {
    logger.error("[GET /api/favorite-workouts] Fehler", { message: err?.message });
    res.status(500).json({ error: err.message });
  }
});

// Favorit anlegen ODER aktualisieren (Upsert nach clientId) - damit wiederholtes Syncen
// (z.B. nach Netzwerkfehler erneut versucht) niemals Duplikate erzeugt.
router.post("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { clientId, type, name, workout } = req.body || {};

    const validationError = validateFavoritePayload({ clientId, type, name, workout });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const normalizedType = normalizeFavoriteType(type);
    const existing = await FavoriteWorkout.findOne({ userId, clientId: String(clientId) }).lean();

    if (!existing) {
      const countForType = await FavoriteWorkout.countDocuments({ userId, type: normalizedType });
      if (isFavoriteLimitExceeded(countForType)) {
        return res.status(409).json({
          error: `Limit erreicht: maximal 10 Favoriten pro Typ`,
          code: 'LIMIT_REACHED'
        });
      }
    }

    const favorite = await FavoriteWorkout.findOneAndUpdate(
      { userId, clientId: String(clientId) },
      {
        $set: {
          type: normalizedType,
          name: String(name).trim(),
          workout
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(existing ? 200 : 201).json(favorite);
  } catch (err) {
    if (err?.code === 11000) {
      // Race zwischen zwei parallelen Upserts für denselben clientId - unkritisch, einfach
      // den jetzt vorhandenen Stand zurückgeben.
      try {
        const { userId } = req.auth;
        const { clientId } = req.body || {};
        const current = await FavoriteWorkout.findOne({ userId, clientId: String(clientId) }).lean();
        if (current) return res.status(200).json(current);
      } catch {}
    }
    logger.error("[POST /api/favorite-workouts] Fehler", { message: err?.message, stack: err?.stack });
    res.status(400).json({ error: err.message });
  }
});

// Löschen nach clientId (nur eigene Favoriten).
router.delete("/:clientId", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const favorite = await FavoriteWorkout.findOneAndDelete({ userId, clientId: String(req.params.clientId) });
    if (!favorite) {
      return res.status(404).json({ error: "Favorit nicht gefunden" });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error("[DELETE /api/favorite-workouts/:clientId] Fehler", { message: err?.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
