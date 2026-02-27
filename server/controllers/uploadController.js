import Exercise from '../models/Exercise.js';
import Workout from '../models/Workout.js';
import { processImageBuffers, saveToGridFS, processAndStoreWorkoutImage } from '../utils/imageProcessing.js';
import { ObjectId } from 'mongodb';
import { logger } from '../utils/logger.js';

export async function uploadExerciseImage(req, res) {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    const { mainBuffer, thumbBuffer } = await processImageBuffers(req.file.buffer);
    // Bestehende GridFS-Dateien löschen, falls vorhanden
    if (ex.imageFileId) { try { await ex.constructor.db.db.collection('exerciseImages.files').deleteOne({ _id: new ObjectId(ex.imageFileId) }); } catch {} }
    if (ex.thumbFileId) { try { await ex.constructor.db.db.collection('exerciseImages.files').deleteOne({ _id: new ObjectId(ex.thumbFileId) }); } catch {} }
    const mainId = await saveToGridFS(mainBuffer, `${ex._id}.jpg`, { kind: 'main', exerciseId: String(ex._id) });
    const thumbId = await saveToGridFS(thumbBuffer, `${ex._id}_thumb.jpg`, { kind: 'thumb', exerciseId: String(ex._id) });
    ex.imageFileId = mainId;
    ex.thumbFileId = thumbId;
    ex.imageUrl = `/api/exercises/${ex._id}/image`;
    ex.thumbnailUrl = `/api/exercises/${ex._id}/thumbnail`;
    await ex.save();
    res.json({ success: true, exercise: ex });
  } catch (err) {
    logger.error('Direct upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function uploadWorkoutImage(req, res) {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    const { imageUrl, thumbnailUrl } = await processAndStoreWorkoutImage(req.file.buffer, String(workout._id));
    workout.imageUrl = imageUrl;
    workout.thumbnailUrl = thumbnailUrl;
    await workout.save();
    res.json({ success: true, workout });
  } catch (err) {
    logger.error('Workout upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function uploadExercisePhotoJSON(req, res) {
  try {
    const { imageData } = req.body || {};
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'imageData (Data-URL) fehlt' });
    }
    const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Ungültiges Data-URL-Format' });
    }
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    const { mainBuffer, thumbBuffer } = await processImageBuffers(buffer);
    if (ex.imageFileId) { try { await ex.constructor.db.db.collection('exerciseImages.files').deleteOne({ _id: new ObjectId(ex.imageFileId) }); } catch {} }
    if (ex.thumbFileId) { try { await ex.constructor.db.db.collection('exerciseImages.files').deleteOne({ _id: new ObjectId(ex.thumbFileId) }); } catch {} }
    const mainId = await saveToGridFS(mainBuffer, `${ex._id}.jpg`, { kind: 'main', exerciseId: String(ex._id) });
    const thumbId = await saveToGridFS(thumbBuffer, `${ex._id}_thumb.jpg`, { kind: 'thumb', exerciseId: String(ex._id) });
    ex.imageFileId = mainId;
    ex.thumbFileId = thumbId;
    ex.imageUrl = `/api/exercises/${ex._id}/image`;
    ex.thumbnailUrl = `/api/exercises/${ex._id}/thumbnail`;
    await ex.save();
    res.json({ success: true, exercise: ex });
  } catch (err) {
    logger.error('JSON photo upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function uploadWorkoutPhotoJSON(req, res) {
  try {
    const { imageData } = req.body || {};
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'imageData (Data-URL) fehlt' });
    }
    const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Ungültiges Data-URL-Format' });
    }
    const buffer = Buffer.from(match[2], 'base64');
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    const { imageUrl, thumbnailUrl } = await processAndStoreWorkoutImage(buffer, String(workout._id));
    workout.imageUrl = imageUrl;
    workout.thumbnailUrl = thumbnailUrl;
    await workout.save();
    res.json({ success: true, workout });
  } catch (err) {
    logger.error('Workout JSON upload error:', err);
    res.status(500).json({ error: err.message });
  }
}
