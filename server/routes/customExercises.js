import express from "express";
import mongoose from "mongoose";
import CustomExercise from "../models/CustomExercise.js";
// Pfad ggf. anpassen, falls firebaseAuthMiddleware/logger anders importiert werden
// als in routes/workouts.js üblich.
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Alle eigenen Übungen des Users laden
router.get("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const exercises = await CustomExercise.find({ userId }).sort({ createdAt: -1 });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neue eigene Übung anlegen
router.post("/", firebaseAuthMiddleware, async (req, res) => {
  const requestId = `custom_ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const { userId } = req.auth;
    const { name, muscleGroup, notes } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name ist erforderlich" });
    }

    logger.info("[POST /api/custom-exercises] incoming", {
      requestId,
      userId,
      name
    });

    const exercise = await CustomExercise.create({
      userId,
      name: String(name).trim(),
      muscleGroup: muscleGroup || 'other',
      notes: notes || ''
    });

    logger.info("[POST /api/custom-exercises] saved", {
      requestId,
      exerciseId: exercise?._id,
      userId
    });

    res.status(201).json(exercise);
  } catch (err) {
    logger.error("[POST /api/custom-exercises] Fehler beim Speichern", {
      requestId,
      message: err?.message,
      stack: err?.stack
    });
    res.status(400).json({ error: err.message });
  }
});

// Eigene Übung löschen
router.delete("/:id", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Ungültige Übungs-ID' });
    }
    const exercise = await CustomExercise.findOneAndDelete({
      _id: req.params.id,
      userId
    });

    if (!exercise) {
      return res.status(404).json({ error: "Übung nicht gefunden" });
    }

    res.json({ message: "Übung erfolgreich gelöscht", exercise });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
