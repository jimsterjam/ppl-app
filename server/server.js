import express from "express";

import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { admin } from './utils/firebaseAdmin.js';
import workoutRoutes from "./routes/workouts.js";
import exerciseRoutes from "./routes/exercises.js";
import subscriptionRoutes from "./routes/subscription.js";
import accountRoutes from "./routes/account.js";
import authRoutes from "./routes/auth.js";
// Clerk-Import entfernt
import { firebaseAuthMiddleware } from './middleware/firebaseAuth.js';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import { validateEnv } from './utils/validateEnv.js';
import { logger } from './utils/logger.js';

// Verhindert Crash bei TTY/STDIN ReadStream-Fehlern (z. B. EIO in nodemon)
if (process.stdin && typeof process.stdin.on === 'function') {
  process.stdin.on('error', (err) => {
    try {
      logger.warn('STDIN stream error (ignored):', err?.code || err?.message || err)
    } catch {
      // ignore
    }
  })
}


// .env zuverlässig relativ zu dieser Datei laden (unabhängig vom CWD)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// Validiere Umgebungsvariablen (beendet Server bei fehlenden kritischen Vars)
validateEnv();

// Global handlers für nicht gefangene Fehler (hilfreich beim Debugging in Dev)
process.on('uncaughtException', (err) => {
  try {
    logger.critical('Uncaught Exception:', err.stack || err.message || err)
  } catch (e) {
    console.error('Uncaught Exception (and logger failed):', e)
    console.error(err)
  }
});

process.on('unhandledRejection', (reason, p) => {
  try {
    logger.critical('Unhandled Rejection at:', p, 'reason:', reason && (reason.stack || reason.message || reason))
  } catch (e) {
    console.error('Unhandled Rejection (and logger failed):', e)
    console.error(reason)
  }
});

const app = express();

// Clerk-Middleware entfernt

// CORS konfigurieren
// CORS: erlaube Vite-Dev-Server Ports 5173/5174 (Proxy), Capacitor App auf 3001, capacitor://localhost und fehlende Origin (Server-zu-Server/native Apps)
const allowedOrigins = new Set(["http://localhost:5173", "http://localhost:5174", "http://localhost:3001", "capacitor://localhost"]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Erlaube fehlende Origin (native Apps, Server-zu-Server)
    if (allowedOrigins.has(origin)) return cb(null, true);
    console.log('CORS blocked origin:', origin); // Debug-Logging
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// JSON-Parsing
app.use(express.json());

// Statische Auslieferung von Uploads
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Minimaler direkter Upload-Endpunkt (um Router-Match-Probleme auszuschließen)
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'exercises');
const uploadsDirWorkouts = path.join(__dirname, 'public', 'uploads', 'workouts');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(uploadsDirWorkouts, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Bildverarbeitung in Speicher (Buffer) für GridFS
async function processImageBuffers(fileBuffer) {
  // Hauptbild
  let mainBuffer = fileBuffer
  try {
    mainBuffer = await sharp(fileBuffer, { failOnError: false })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
      .toBuffer()
  } catch {}
  // Thumbnail
  let thumbBuffer = fileBuffer
  try {
    thumbBuffer = await sharp(fileBuffer, { failOnError: false })
      .rotate()
      .resize({ width: 256, height: 256, fit: 'cover' })
      .jpeg({ quality: 78 })
      .toBuffer()
  } catch {}
  return { mainBuffer, thumbBuffer }
}

function getExerciseBucket() {
  const db = mongoose.connection?.db
  if (!db) throw new Error('DB connection not ready')
  // GridFS Bucket-Name: exerciseImages
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'exerciseImages' })
}

async function saveToGridFS(buffer, filename, metadata) {
  const bucket = getExerciseBucket()
  return await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { contentType: 'image/jpeg', metadata })
    uploadStream.on('error', reject)
    uploadStream.on('finish', () => resolve(uploadStream.id))
    uploadStream.end(buffer)
  })
}

// Bildspeicherung für Workouts
async function processAndStoreWorkoutImage(fileBuffer, baseName) {
  const outPath = path.join(uploadsDirWorkouts, `${baseName}.jpg`);
  const thumbPath = path.join(uploadsDirWorkouts, `${baseName}_thumb.jpg`);
  let wroteMain = false;
  try {
    const img = sharp(fileBuffer, { failOnError: false });
    await img.rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
      .toFile(outPath);
    wroteMain = true;
  } catch {}
  if (!wroteMain) {
    fs.writeFileSync(outPath, fileBuffer);
  }
  try {
    const thumb = sharp(fileBuffer, { failOnError: false });
    await thumb.rotate().resize({ width: 256, height: 256, fit: 'cover' })
      .jpeg({ quality: 78 })
      .toFile(thumbPath);
  } catch { try { fs.copyFileSync(outPath, thumbPath); } catch {} }
  return {
    imageUrl: `/uploads/workouts/${baseName}.jpg`,
    thumbnailUrl: `/uploads/workouts/${baseName}_thumb.jpg`
  };
}

// Direkt: POST /api/exercises/:id/image
app.post('/api/exercises/:id/image', upload.single('image'), async (req, res) => {
  try {
    const { default: Exercise } = await import('./models/Exercise.js');
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    const { mainBuffer, thumbBuffer } = await processImageBuffers(req.file.buffer)
    // Bestehende GridFS-Dateien löschen, falls vorhanden
    if (ex.imageFileId) { try { getExerciseBucket().delete(new ObjectId(ex.imageFileId)) } catch {} }
    if (ex.thumbFileId) { try { getExerciseBucket().delete(new ObjectId(ex.thumbFileId)) } catch {} }
    const mainId = await saveToGridFS(mainBuffer, `${ex._id}.jpg`, { kind: 'main', exerciseId: String(ex._id) })
    const thumbId = await saveToGridFS(thumbBuffer, `${ex._id}_thumb.jpg`, { kind: 'thumb', exerciseId: String(ex._id) })
    ex.imageFileId = mainId
    ex.thumbFileId = thumbId
    ex.imageUrl = `/api/exercises/${ex._id}/image`
    ex.thumbnailUrl = `/api/exercises/${ex._id}/thumbnail`
    await ex.save();
    res.json({ success: true, exercise: ex });
  } catch (err) {
    logger.error('Direct upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Alias: POST /api/exercises/image/:id
app.post('/api/exercises/image/:id', upload.single('image'), async (req, res) => {
  try {
    const { default: Exercise } = await import('./models/Exercise.js');
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    const { mainBuffer, thumbBuffer } = await processImageBuffers(req.file.buffer)
    if (ex.imageFileId) { try { getExerciseBucket().delete(new ObjectId(ex.imageFileId)) } catch {} }
    if (ex.thumbFileId) { try { getExerciseBucket().delete(new ObjectId(ex.thumbFileId)) } catch {} }
    const mainId = await saveToGridFS(mainBuffer, `${ex._id}.jpg`, { kind: 'main', exerciseId: String(ex._id) })
    const thumbId = await saveToGridFS(thumbBuffer, `${ex._id}_thumb.jpg`, { kind: 'thumb', exerciseId: String(ex._id) })
    ex.imageFileId = mainId
    ex.thumbFileId = thumbId
    ex.imageUrl = `/api/exercises/${ex._id}/image`
    ex.thumbnailUrl = `/api/exercises/${ex._id}/thumbnail`
    await ex.save();
    res.json({ success: true, exercise: ex });
  } catch (err) {
    logger.error('Direct upload (alias) error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Workout-Cover: POST /api/workouts/:id/image (auth erforderlich)
app.post('/api/workouts/:id/image', firebaseAuthMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { default: Workout } = await import('./models/Workout.js');
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
});

// Alias: POST /api/workouts/image/:id
app.post('/api/workouts/image/:id', firebaseAuthMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { default: Workout } = await import('./models/Workout.js');
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    const { imageUrl, thumbnailUrl } = await processAndStoreWorkoutImage(req.file.buffer, String(workout._id));
    workout.imageUrl = imageUrl;
    workout.thumbnailUrl = thumbnailUrl;
    await workout.save();
    res.json({ success: true, workout });
  } catch (err) {
    logger.error('Workout upload (alias) error:', err);
    res.status(500).json({ error: err.message });
  }
});

// JSON-Fallback: PUT /api/workouts/:id/photo
app.put('/api/workouts/:id/photo', firebaseAuthMiddleware, express.json({ limit: '12mb' }), async (req, res) => {
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
    const { default: Workout } = await import('./models/Workout.js');
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
});

// Fallback (JSON-Route): PUT /api/exercises/:id/photo
// Erwartet { imageData: "data:image/...;base64,XXXXX" } im Body
app.put('/api/exercises/:id/photo', express.json({ limit: '12mb' }), async (req, res) => {
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
    const { default: Exercise } = await import('./models/Exercise.js');
    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    const { mainBuffer, thumbBuffer } = await processImageBuffers(buffer)
    if (ex.imageFileId) { try { getExerciseBucket().delete(new ObjectId(ex.imageFileId)) } catch {} }
    if (ex.thumbFileId) { try { getExerciseBucket().delete(new ObjectId(ex.thumbFileId)) } catch {} }
    const mainId = await saveToGridFS(mainBuffer, `${ex._id}.jpg`, { kind: 'main', exerciseId: String(ex._id) })
    const thumbId = await saveToGridFS(thumbBuffer, `${ex._id}_thumb.jpg`, { kind: 'thumb', exerciseId: String(ex._id) })
    ex.imageFileId = mainId
    ex.thumbFileId = thumbId
    ex.imageUrl = `/api/exercises/${ex._id}/image`
    ex.thumbnailUrl = `/api/exercises/${ex._id}/thumbnail`
    await ex.save();
    res.json({ success: true, exercise: ex });
  } catch (err) {
    logger.error('JSON photo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Bild aus GridFS streamen
app.get('/api/exercises/:id/image', async (req, res) => {
  try {
    const { default: Exercise } = await import('./models/Exercise.js');
    const ex = await Exercise.findById(req.params.id);
    if (!ex || !ex.imageFileId) return res.status(404).send('Not found')
    res.set('Content-Type', 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=604800, immutable')
    getExerciseBucket().openDownloadStream(new ObjectId(ex.imageFileId)).on('error', (e) => {
      logger.warn('Download error (image):', e)
      if (!res.headersSent) res.status(404).end()
    }).pipe(res)
  } catch (err) {
    res.status(500).send('Server error')
  }
})

app.get('/api/exercises/:id/thumbnail', async (req, res) => {
  try {
    const { default: Exercise } = await import('./models/Exercise.js');
    const ex = await Exercise.findById(req.params.id);
    if (!ex || !ex.thumbFileId) return res.status(404).send('Not found')
    res.set('Content-Type', 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=604800, immutable')
    getExerciseBucket().openDownloadStream(new ObjectId(ex.thumbFileId)).on('error', (e) => {
      logger.warn('Download error (thumb):', e)
      if (!res.headersSent) res.status(404).end()
    }).pipe(res)
  } catch (err) {
    res.status(500).send('Server error')
  }
})


// MongoDB verbinden (nur wenn MONGO_URI gesetzt ist)
if (process.env.MONGO_URI) {
  // Verbindungsaufbau mit defensiven Timeouts
  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    })
    .then(() => logger.info("MongoDB verbunden"))
    .catch(err => logger.error("DB Fehler:", err));

  // Connection Event-Logging & Reconnect-Monitoring
  const conn = mongoose.connection;
  conn.on('connected', () => logger.info('🟢 MongoDB connected'));
  conn.on('disconnected', () => logger.warn('🟠 MongoDB disconnected'));
  // 'reconnected' wird vom Treiber emittiert
  conn.on('reconnected', () => logger.info('🟢 MongoDB reconnected'));
  conn.on('error', (err) => logger.error('🔴 MongoDB error:', err));
} else {
  logger.warn("Hinweis: MONGO_URI ist nicht gesetzt – DB-Verbindung wird übersprungen.");
}

// Test-Route
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API funktioniert!", 
    timestamp: new Date().toISOString(),
    endpoints: {
      "GET /api/workouts": "Alle Workouts abrufen (Auth erforderlich)",
      "GET /api/workouts/:id": "Einzelnes Workout abrufen (Auth erforderlich)", 
      "POST /api/workouts": "Neues Workout erstellen (Auth erforderlich)",
      "PUT /api/workouts/:id": "Workout aktualisieren (Auth erforderlich)",
      "DELETE /api/workouts/:id": "Workout löschen (Auth erforderlich)",
      "GET /api/workouts/stats/overview": "Workout-Statistiken (Auth erforderlich)",
      "GET /api/exercises": "Alle Übungen abrufen",
      "GET /api/exercises/category/:category": "Übungen nach Kategorie abrufen",
      "GET /api/exercises/:id": "Einzelne Übung abrufen"
    }
  });
});

// Routen einbinden: Workouts-Router enthält bereits requireAuth pro Route
app.use("/api/auth", authRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/account", accountRoutes);

// Health Endpoint: erleichtert Diagnose (Client/Monitoring)
app.get('/api/health', (req, res) => {
  const state = mongoose.connection?.readyState; // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const map = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: 'ok',
    db: map[state] ?? 'unknown',
    readyState: state
  });
});

// Generischer Error-Handler (Clerk-Unauthenticated → 401 JSON; sonst 500)
app.use((err, req, res, _next) => {
  if (err && (err.message === "Unauthenticated" || err.status === 401 || err.code === "unauthenticated")) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  if (err) {
    logger.error("Unhandled error:", err);
    const body = { error: 'Internal Server Error' };
    if (process.env.NODE_ENV !== 'production') {
      body.message = err.message;
      body.stack = err.stack;
    }
    return res.status(500).json(body);
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// Server starten
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server läuft auf Port ${PORT}`);
  try {
    const opts = admin?.apps?.[0]?.options || {};
    logger.info(`[firebaseAdmin] Initialized for projectId: ${opts.projectId ?? 'unknown'}`);
  } catch (e) {
    logger.warn('[firebaseAdmin] Could not log projectId at startup:', e?.message || e);
  }
});