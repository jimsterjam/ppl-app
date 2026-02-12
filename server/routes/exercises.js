import express from "express";
import Exercise from "../models/Exercise.js";
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
// Clerk-Import entfernt
import { logger } from '../utils/logger.js';

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

// Alle Übungen abrufen (aus Datenbank + fallback zur statischen Liste)
router.get("/", async (req, res) => {
  try {
    const { category, muscleGroup, equipment, source, includeStatic } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (muscleGroup) filter.muscleGroups = { $in: [muscleGroup] };
    if (equipment) filter.equipment = equipment;
    if (source) filter.source = source;

    // Lade Übungen aus der Datenbank
    const dbExercises = await Exercise.find(filter).sort({ name: 1 });
    
    // Optional: Statische Übungen als Fallback hinzufügen (für Rückwärtskompatibilität)
    let allExercises = [...dbExercises];
    
    // Wenn keine DB-Übungen gefunden oder explizit angefordert, füge statische hinzu
    if (dbExercises.length === 0 || includeStatic === 'true') {
      const staticExercises = await import('../data/exercises.js').then(m => m.default);
      
      // Formatiere statische Übungen für Konsistenz
      const formattedStaticExercises = staticExercises
        .filter(exercise => {
          if (category && exercise.category !== category) return false;
          if (muscleGroup && exercise.muscleGroup !== muscleGroup) return false;
          if (equipment && exercise.equipment !== equipment) return false;
          return true;
        })
        .map(exercise => ({
          _id: `static_${exercise.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: exercise.name,
          names: {
            de: exercise.name,
            en: exercise.name // Statische sind bereits deutsch
          },
          category: exercise.category,
          muscleGroups: [exercise.muscleGroup],
          equipment: exercise.equipment,
          difficulty: 'Anfänger',
          source: 'static',
          isStatic: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      
      // Füge nur statische hinzu, die nicht bereits in der DB existieren
      const dbNames = new Set(dbExercises.flatMap(ex => [
        ex.name,
        ex.names?.de,
        ex.names?.en
      ].filter(Boolean)));
      
      const uniqueStaticExercises = formattedStaticExercises.filter(staticEx => 
        !dbNames.has(staticEx.name)
      );
      
      allExercises = [...dbExercises, ...uniqueStaticExercises];
    }
    
    // Sortiere final nach Namen
    allExercises.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(allExercises);
  } catch (err) {
    logger.error('❌ GET /exercises error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Neue Übung erstellen
router.post("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth();
    
    const {
      name,
      names,
      category,
      muscleGroups,
      equipment,
      difficulty,
      instructions,
      tips
    } = req.body;

    // Prüfe, ob Übung bereits existiert
    const existingExercise = await Exercise.findOne({
      $or: [
        { name: name },
        { 'names.de': names?.de },
        { 'names.en': names?.en }
      ]
    });

    if (existingExercise) {
      return res.status(400).json({ 
        error: 'Übung mit diesem Namen existiert bereits',
        existingExercise: existingExercise 
      });
    }

    // Erstelle neue Übung
    const newExercise = new Exercise({
      name: name,
      names: names || { de: name, en: name },
      category: category,
      muscleGroups: muscleGroups || [],
      equipment: equipment || 'Körpergewicht',
      difficulty: difficulty || 'Anfänger',
      instructions: instructions || '',
      tips: tips || '',
      source: 'user_created',
      addedBy: userId
    });

    await newExercise.save();
    
    logger.debug(`✅ Neue Übung erstellt: ${newExercise.name} by User ${userId}`);
    
    res.status(201).json({
      message: 'Übung erfolgreich erstellt',
      exercise: newExercise
    });

  } catch (err) {
    logger.error('❌ POST /exercises error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bild hochladen/ersetzen
router.post('/:id/image', firebaseAuthMiddleware, upload.single('image'), async (req, res) => {
  try {
    logger.debug('POST /api/exercises/:id/image', req.params.id);
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });

    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });

    // Zielpfade
    const baseName = `${ex._id}.jpg`;
    const thumbName = `${ex._id}_thumb.jpg`;
    const outPath = path.join(uploadsDir, baseName);
    const thumbPath = path.join(uploadsDir, thumbName);

    // Hauptbild verarbeitung
    try {
      const img = sharp(req.file.buffer, { failOnError: false });
      await img.rotate().resize({ 
        width: 1280, 
        height: 1280, 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
      .toFile(outPath);
    } catch {
      // Fallback: Schreibe Original-Buffer
      fs.writeFileSync(outPath, req.file.buffer);
    }

    // Thumbnail erstellen
    try {
      const img2 = sharp(req.file.buffer, { failOnError: false });
      await img2.rotate().resize({ width: 256, height: 256, fit: 'cover' })
        .jpeg({ quality: 78 })
        .toFile(thumbPath);
    } catch {
      // Fallback: Kopiere Hauptbild
      try { fs.copyFileSync(outPath, thumbPath); } catch {}
    }

    // URLs aktualisieren
    ex.imageUrl = `/uploads/exercises/${baseName}`;
    ex.thumbnailUrl = `/uploads/exercises/${thumbName}`;
    await ex.save();

    res.json({ success: true, exercise: ex });
  } catch (err) {
    logger.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Kategorie-Route explizit
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    // Finde alle Übungen mit passender Kategorie
    const exercises = await Exercise.find({ category });
    // Optional: Fallback zu statischen Übungen
    let allExercises = [...exercises];
    if (exercises.length === 0) {
      const staticExercises = await import('../data/exercises.js').then(m => m.default);
      const filteredStatic = staticExercises.filter(ex => ex.category === category).map(ex => ({
        _id: `static_${ex.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: ex.name,
        names: { de: ex.name, en: ex.name },
        category: ex.category,
        muscleGroups: [ex.muscleGroup],
        equipment: ex.equipment,
        difficulty: 'Anfänger',
        source: 'static',
        isStatic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      allExercises = [...filteredStatic];
    }
    allExercises.sort((a, b) => a.name.localeCompare(b.name));
    res.json(allExercises);
  } catch (err) {
    logger.error('❌ GET /exercises/category/:category error:', err);
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

// Bild löschen
router.delete('/:id/image', firebaseAuthMiddleware, async (req, res) => {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    
    // Lokale Dateien entfernen
    const filesToDelete = [ex.imageUrl, ex.thumbnailUrl]
      .filter(Boolean)
      .map(url => path.join(__dirname, '..', 'public', url.replace(/^\//, '')));
    
    for (const filePath of filesToDelete) {
      try { 
        fs.unlinkSync(filePath); 
      } catch (err) {
        logger.debug(`File ${filePath} not found or already deleted`);
      }
    }
    
    // URLs aus Datenbank entfernen
    ex.imageUrl = undefined;
    ex.thumbnailUrl = undefined;
    ex.imageFileId = undefined;
    ex.thumbFileId = undefined;
    await ex.save();
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete image error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔧 Admin: Alle Übungen löschen und neu befüllen (für Testing)
router.post('/admin/reset-all', async (req, res) => {
  try {
    logger.debug('🧹 Admin: Lösche alle Übungen aus der Datenbank...');
    
    // Lösche alle Übungen
    const deleteResult = await Exercise.deleteMany({});
    logger.debug(`✅ Gelöscht: ${deleteResult.deletedCount} Übungen`);
    
    // Importiere statische Übungen als Fallback
    const staticExercises = await import('../data/exercises.js').then(m => m.default);
    logger.debug(`📋 Statische Übungen verfügbar: ${staticExercises.length}`);
    
    // Erstelle neue Übungen aus statischen Daten
    const newExercises = [];
    for (const staticEx of staticExercises) {
      try {
        const newEx = new Exercise({
          name: staticEx.name,
          names: {
            de: staticEx.name,
            en: staticEx.name
          },
          category: staticEx.category,
          muscleGroups: [staticEx.muscleGroup],
          equipment: staticEx.equipment,
          difficulty: 'Anfänger',
          instructions: staticEx.instructions || '',
          tips: staticEx.tips || '',
          source: 'static_reset',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await newEx.save();
        newExercises.push(newEx);
        logger.debug(`✅ Neue Übung hinzugefügt: ${newEx.name}`);
      } catch (err) {
        logger.warn(`⚠️ Fehler beim Hinzufügen von ${staticEx.name}:`, err.message);
      }
    }
    
    logger.debug(`✅ Fertig: ${newExercises.length} Übungen neu hinzugefügt`);
    
    res.json({
      message: 'Datenbank erfolgreich zurückgesetzt',
      deletedCount: deleteResult.deletedCount,
      addedCount: newExercises.length,
      exercises: newExercises.map(ex => ({ _id: ex._id, name: ex.name, category: ex.category }))
    });
  } catch (err) {
    logger.error('❌ Admin Reset Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
