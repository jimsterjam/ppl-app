import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import CustomExercise from "../models/CustomExercise.js";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB — Client komprimiert bereits vor, das ist nur ein Hard-Limit
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const exerciseImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES }
});

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

    logger.info("[POST /api/custom-exercises] incoming", { requestId, userId, name });

    const exercise = await CustomExercise.create({
      userId,
      name: String(name).trim(),
      muscleGroup: muscleGroup || 'other',
      notes: notes || ''
    });

    logger.info("[POST /api/custom-exercises] saved", { requestId, exerciseId: exercise?._id, userId });

    res.status(201).json(exercise);
  } catch (err) {
    logger.error("[POST /api/custom-exercises] Fehler beim Speichern", {
      requestId, message: err?.message, stack: err?.stack
    });
    res.status(400).json({ error: err.message });
  }
});

// Eigene Übung bearbeiten (Name, Muskelgruppe, Notiz — kein Bild, dafür siehe /:id/image)
router.put("/:id", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Ungültige Übungs-ID' });
    }
    const { name, muscleGroup, notes } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: "Name darf nicht leer sein" });
    }

    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (muscleGroup !== undefined) update.muscleGroup = muscleGroup || 'other';
    if (notes !== undefined) update.notes = notes || '';

    const exercise = await CustomExercise.findOneAndUpdate(
      { _id: req.params.id, userId },
      update,
      { new: true, runValidators: true }
    );

    if (!exercise) {
      return res.status(404).json({ error: "Übung nicht gefunden" });
    }

    res.json(exercise);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bild zu einer eigenen Übung hochladen (überschreibt vorhandenes Bild)
router.post("/:id/image", firebaseAuthMiddleware, exerciseImageUpload.single('image'), async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Ungültige Übungs-ID' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Kein Bild übermittelt' });
    }
    const mime = String(req.file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      return res.status(400).json({
        error: 'Nicht unterstützter Bildtyp',
        allowed: Array.from(ALLOWED_IMAGE_MIME)
      });
    }

    // Existenz + Eigentümerschaft vor dem Schreiben auf die Platte prüfen
    const existing = await CustomExercise.findOne({ _id: req.params.id, userId });
    if (!existing) {
      return res.status(404).json({ error: "Übung nicht gefunden" });
    }

    // Serverseitig nochmal komprimieren/normalisieren, unabhängig von der
    // Client-Kompression — schützt vor übergroßen/fehlerhaften Uploads.
    const out = await sharp(req.file.buffer, { failOnError: false })
      .rotate()
      .resize(480, 480, { fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const imagesDir = path.join(__dirname, '../public/uploads/custom-exercises');
    await fs.mkdir(imagesDir, { recursive: true });
    const filename = `${req.params.id}.jpg`;
    const absPath = path.join(imagesDir, filename);
    await fs.writeFile(absPath, out);

    const imageUrl = `/uploads/custom-exercises/${filename}`;
    const exercise = await CustomExercise.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { imageUrl } },
      { new: true }
    );

    res.json(exercise);
  } catch (err) {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Bild zu groß', maxBytes: IMAGE_MAX_BYTES });
    }
    logger.error("[POST /api/custom-exercises/:id/image] Fehler", { message: err?.message, stack: err?.stack });
    res.status(500).json({ error: err.message });
  }
});

// Eigene Übung löschen
router.delete("/:id", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Ungültige Übungs-ID' });
    }
    const exercise = await CustomExercise.findOneAndDelete({ _id: req.params.id, userId });

    if (!exercise) {
      return res.status(404).json({ error: "Übung nicht gefunden" });
    }

    // Zugehöriges Bild ebenfalls entfernen, falls vorhanden
    if (exercise.imageUrl) {
      try {
        const imagesDir = path.join(__dirname, '../public/uploads/custom-exercises');
        await fs.unlink(path.join(imagesDir, `${exercise._id}.jpg`));
      } catch {}
    }

    res.json({ message: "Übung erfolgreich gelöscht", exercise });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;