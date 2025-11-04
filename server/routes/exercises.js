import express from "express";
import Exercise from "../models/Exercise.js";
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

// Upload-Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'exercises');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    cb(ok ? null : new Error('Nur Bildformate erlaubt'), ok);
  }
});

// Debug: Logge eingehende Requests auf diesem Router (kann später entfernt werden)
router.use((req, _res, next) => {
  console.log(`[exercises] ${req.method} ${req.url}`);
  next();
});

// Alle Übungen abrufen
router.get("/", async (req, res) => {
  console.log("GET /api/exercises aufgerufen", req.headers);
  try {
    const { category, muscleGroup, equipment } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (muscleGroup) filter.muscleGroups = { $in: [muscleGroup] };
    if (equipment) filter.equipment = equipment;

    const exercises = await Exercise.find(filter).sort({ name: 1 });
    res.json(exercises);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Bild hochladen/ersetzen (bewusst vor :id-Route definiert)
router.post('/:id/image', /*requireAuth(),*/ upload.single('image'), async (req, res) => {
  try {
    console.log('POST /api/exercises/:id/image', req.params.id, req.headers['content-type']);
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });

    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });

    // Zielpfade
    const baseName = `${ex._id}.jpg`;
    const thumbName = `${ex._id}_thumb.jpg`;
    const outPath = path.join(uploadsDir, baseName);
    const thumbPath = path.join(uploadsDir, thumbName);

    // Verarbeitung mit sharp: konvertiere zu JPEG, max 1280px, moderates Quality
    let wroteMain = false;
    try {
      const img = sharp(req.file.buffer, { failOnError: false });
      await img.rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
        .toFile(outPath);
      wroteMain = true;
    } catch {}
    if (!wroteMain) {
      // Fallback: Schreibe Original-Buffer
      fs.writeFileSync(outPath, req.file.buffer);
    }

    // Thumbnail 256px (best effort)
    try {
      const img2 = sharp(req.file.buffer, { failOnError: false });
      await img2.rotate().resize({ width: 256, height: 256, fit: 'cover' })
        .jpeg({ quality: 78 })
        .toFile(thumbPath);
    } catch {
      // Fallback: skaliertes Thumbnail aus Hauptdatei weglassen
      try { fs.copyFileSync(outPath, thumbPath); } catch {}
    }

    // URLs (werden als statische Dateien über /uploads bedient)
    ex.imageUrl = `/uploads/exercises/${baseName}`;
    ex.thumbnailUrl = `/uploads/exercises/${thumbName}`;
    await ex.save();

    res.json({ success: true, exercise: ex });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Alias: /image/:id (falls Proxy/Router matching Probleme hat)
router.post('/image/:id', /*requireAuth(),*/ upload.single('image'), async (req, res) => {
  try {
    console.log('POST /api/exercises/image/:id', req.params.id, req.headers['content-type']);
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    const baseName = `${ex._id}.jpg`;
    const thumbName = `${ex._id}_thumb.jpg`;
    const outPath = path.join(uploadsDir, baseName);
    const thumbPath = path.join(uploadsDir, thumbName);
    let wroteMain = false;
    try {
      const img = sharp(req.file.buffer, { failOnError: false });
      await img.rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
        .toFile(outPath);
      wroteMain = true;
    } catch {}
    if (!wroteMain) {
      fs.writeFileSync(outPath, req.file.buffer);
    }
    try {
      const img2 = sharp(req.file.buffer, { failOnError: false });
      await img2.rotate().resize({ width: 256, height: 256, fit: 'cover' })
        .jpeg({ quality: 78 })
        .toFile(thumbPath);
    } catch {
      try { fs.copyFileSync(outPath, thumbPath); } catch {}
    }
    ex.imageUrl = `/uploads/exercises/${baseName}`;
    ex.thumbnailUrl = `/uploads/exercises/${thumbName}`;
    await ex.save();
    res.json({ success: true, exercise: ex });
  } catch (err) {
    console.error('Upload error (alias):', err);
    res.status(500).json({ error: err.message });
  }
});

// Einzelne Übung abrufen
router.get('/:id', async (req, res) => {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    res.json(ex);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bild löschen (optional)
router.delete('/:id/image', /*requireAuth(),*/ async (req, res) => {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    const db = mongoose.connection?.db
    if (db) {
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'exerciseImages' })
      if (ex.imageFileId) { try { await bucket.delete(new ObjectId(ex.imageFileId)) } catch {} }
      if (ex.thumbFileId) { try { await bucket.delete(new ObjectId(ex.thumbFileId)) } catch {} }
    }
    // Fallback: Alte Dateien vom Filesystem entfernen, falls noch vorhanden
    const toDelete = [ex.imageUrl, ex.thumbnailUrl]
      .filter(Boolean)
      .map(u => path.join(__dirname, '..', 'public', u.replace(/^\//, '')))
    for (const f of toDelete) { try { fs.unlinkSync(f) } catch {} }
    ex.imageUrl = undefined;
    ex.thumbnailUrl = undefined;
    ex.imageFileId = undefined;
    ex.thumbFileId = undefined;
    await ex.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
