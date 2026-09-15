import express from 'express';
import { admin } from '../utils/firebaseAdmin.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import Exercise from '../models/Exercise.js';
import CustomExercise from '../models/CustomExercise.js';
import FavoriteWorkout from '../models/FavoriteWorkout.js';
import FeedbackRating from '../models/FeedbackRating.js';
import UserExerciseNote from '../models/UserExerciseNote.js';
import AppFeedback from '../models/AppFeedback.js';
import UserProfile from '../models/UserProfile.js';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
import { requireAdminKey } from '../middleware/adminAuth.js';
import multer from 'multer';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Smartphones erzeugen oft 3–10MB Fotos; wir akzeptieren größer, speichern aber trotzdem klein (256x256 JPEG).
const AVATAR_MAX_BYTES = 12 * 1024 * 1024; // 12MB
const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES }
});

function normalizeUsername(input) {
  const raw = String(input ?? '').trim();
  // sehr konservativ: kein HTML, max 24 Zeichen
  const stripped = raw.replace(/[\r\n\t]/g, ' ');
  return stripped.slice(0, 24);
}

async function getOrCreateProfile(uid) {
  const existing = await UserProfile.findOne({ uid }).lean();
  if (existing) return existing;
  try {
    const created = await UserProfile.create({ uid });
    return created.toObject();
  } catch (e) {
    // Race: second request creates first
    const again = await UserProfile.findOne({ uid }).lean();
    if (again) return again;
    throw e;
  }
}

// NOTE: use centralized `firebaseAuthMiddleware` (sets `req.auth.userId`)

// ---------------------------------------------------------------------------
// Datenexport (DSGVO Art. 15 Auskunftsrecht / Art. 20 Datenübertragbarkeit).
// Liefert alle personenbezogenen Daten des angemeldeten Nutzers als herunterladbare JSON-Datei
// - maschinenlesbar, deckt Art. 20 direkt mit ab. Umfasst bewusst genau die Collections, die
// tatsächlich eine userId/uid-Bindung an diesen Nutzer haben:
//   UserProfile (uid), Workout, Exercise (eigene Übungen), CustomExercise, FavoriteWorkout,
//   FeedbackRating, UserExerciseNote, AppFeedback.
// Bewusst NICHT enthalten: FeedbackQualitySignal (laut eigenem Modell-Kommentar absichtlich
// nicht mit einer userId verknüpfbar/anonymisiert) und PromptImprovementProposal (aggregierter
// Admin-Vorschlag ohne userId-Feld - kein personenbezogenes Datum dieses Nutzers).
router.get('/export', firebaseAuthMiddleware, async (req, res) => {
  const tokenUid = req.auth?.userId;
  if (!tokenUid) {
    return res.status(400).json({ error: 'Invalid token: no UID' });
  }

  try {
    const [
      profile,
      workouts,
      exercises,
      customExercises,
      favoriteWorkouts,
      feedbackRatings,
      exerciseNotes,
      appFeedback
    ] = await Promise.all([
      UserProfile.findOne({ uid: tokenUid }).lean(),
      Workout.find({ userId: tokenUid }).lean(),
      Exercise.find({ userId: tokenUid }).lean(),
      CustomExercise.find({ userId: tokenUid }).lean(),
      FavoriteWorkout.find({ userId: tokenUid }).lean(),
      FeedbackRating.find({ userId: tokenUid }).lean(),
      UserExerciseNote.find({ userId: tokenUid }).lean(),
      AppFeedback.find({ userId: tokenUid }).lean()
    ]);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      uid: tokenUid,
      profile: profile || null,
      workouts,
      customExercises: [...exercises, ...customExercises],
      favoriteWorkouts,
      feedbackRatings,
      exerciseNotes,
      appFeedback
    };

    console.info(`[account/export] Datenexport erstellt (uid=${tokenUid}, workouts=${workouts.length})`);

    res.set('Content-Disposition', `attachment; filename="ppl-fundamentals-daten-${tokenUid}.json"`);
    res.json(exportPayload);
  } catch (error) {
    console.error('[account/export] Datenexport fehlgeschlagen:', error?.message || error);
    res.status(500).json({ error: 'Failed to export account data', message: error?.message });
  }
});

// Delete account and all associated data

// Purge user data without deleting the account
router.post('/delete', firebaseAuthMiddleware, async (req, res) => {
  const { confirmation } = req.body;

  // `firebaseAuthMiddleware` setzt `req.auth.userId`
  const tokenUid = req.auth?.userId;
  // decoded token may be available on req.auth (not guaranteed)
  const decoded = req.auth || {};
  const audience = decoded?.aud || decoded?.azp || 'unknown';

  // Minimal audit log: start deletion for UID (avoid logging full token)
  console.info(`[account/delete] Request to delete account for UID: ${tokenUid}`);

  if (!tokenUid) {
    return res.status(400).json({ error: 'Invalid token: no UID' });
  }

  // Warnung, falls Google OAuth Audience abweicht
  const adminOpts = admin.apps?.[0]?.options || {};
  const adminProjectId = adminOpts.projectId || 'unknown';
  if (typeof audience === 'string' && audience.includes('.apps.googleusercontent.com')) {
    console.warn(`[account/delete] Google OAuth audience detected (${audience}). Ensure iOS app uses Firebase project matching adminProjectId (${adminProjectId})`);
  }

  // Check confirmation
  // Normalize confirmation: allow different casing and remove diacritics (e.g. LÖSCHEN vs LOESCHEN)
  const normalizeConfirm = (s) => {
    if (!s) return '';
    const up = s.toString().toUpperCase().trim();
    try {
      return up.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      return up;
    }
  };

  const normalized = normalizeConfirm(confirmation);
  const compact = normalized.replace(/\s+/g, '');
  // Accept flexible variants: e.g. 'ACCOUNTLOSCHEN', 'ACCOUNTLOESCHEN', 'DELETEACCOUNT'
  const ok = /ACCOUNT.*(?:LOESCH|LOSCH)/.test(compact) || compact === 'DELETEACCOUNT' || compact === 'DELETE';
  if (!ok) {
    console.warn('[account/delete] Invalid confirmation text received:', { received: confirmation, normalized, compact });
    return res.status(400).json({ error: 'Invalid confirmation text', received: confirmation, normalized, compact });
  }

  try {
    console.info(`[account/delete] Starting account deletion (uid=${tokenUid}, project=${adminProjectId})`);

    // --- Step 1: Read records (so we can delete media references) ---
    const userWorkouts = await Workout.find({ userId: tokenUid }).lean();
    const userExercises = await Exercise.find({ userId: tokenUid }).lean();

    const report = {
      workoutsFound: userWorkouts.length,
      exercisesFound: userExercises.length,
      filesDeleted: [],
      gridfsDeleted: [],
      // Bug-Fix (DSGVO Art. 17 "Recht auf Vergessenwerden"): dbDeleted deckte bisher NUR
      // workouts/exercises ab - UserProfile (inkl. username/avatarImage und seit Kurzem auch den
      // freiwilligen personalData-Angaben Alter/Geschlecht/Größe/Gewicht) sowie CustomExercise/
      // FavoriteWorkout/FeedbackRating/UserExerciseNote/AppFeedback blieben nach "Account
      // löschen" dauerhaft in der Datenbank stehen, obwohl GET /export (siehe oben) genau diese
      // Collections als "an diesen Nutzer gebundene Daten" behandelt. Jetzt symmetrisch zum
      // Export: alle sieben dort gelisteten Collections werden hier auch tatsächlich gelöscht.
      dbDeleted: {
        workouts: 0,
        exercises: 0,
        userProfile: 0,
        customExercises: 0,
        favoriteWorkouts: 0,
        feedbackRatings: 0,
        exerciseNotes: 0,
        appFeedback: 0
      },
      deletedAuth: false,
      errors: []
    };

    // --- Step 2: Delete filesystem images for workouts & exercises ---
    const uploadsRoot = path.join(__dirname, '../public/uploads');
    // Ensure deterministic paths for known patterns
    for (const w of userWorkouts) {
      try {
        const main = path.join(uploadsRoot, 'workouts', `${w._id}.jpg`);
        const thumb = path.join(uploadsRoot, 'workouts', `${w._id}_thumb.jpg`);
        try { await fs.unlink(main); report.filesDeleted.push(main); } catch (e) {}
        try { await fs.unlink(thumb); report.filesDeleted.push(thumb); } catch (e) {}
      } catch (e) { report.errors.push(String(e)); }
    }

    for (const ex of userExercises) {
      try {
        const exMain = path.join(uploadsRoot, 'exercises', `${ex._id}.jpg`);
        const exThumb = path.join(uploadsRoot, 'exercises', `${ex._id}_thumb.jpg`);
        try { await fs.unlink(exMain); report.filesDeleted.push(exMain); } catch (e) {}
        try { await fs.unlink(exThumb); report.filesDeleted.push(exThumb); } catch (e) {}
      } catch (e) { report.errors.push(String(e)); }
    }

    // Also try previous loose pattern: files starting with `${userId}_` in uploads root
    try {
      const rootFiles = await fs.readdir(uploadsRoot);
      for (const f of rootFiles) {
        if (f.startsWith(`${tokenUid}_`)) {
          const p = path.join(uploadsRoot, f);
          try { await fs.unlink(p); report.filesDeleted.push(p); } catch (e) { report.errors.push(`unlink ${p}: ${e}`); }
        }
      }
    } catch (e) { /* ignore if folder missing */ }

    // --- Step 3: Delete GridFS files for exercises (exercise images stored in GridFS bucket 'exerciseImages') ---
    try {
      const db = mongoose.connection?.db;
      if (db) {
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'exerciseImages' });
        for (const ex of userExercises) {
          try {
            if (ex.imageFileId) {
              const oid = typeof ex.imageFileId === 'string' ? new mongoose.Types.ObjectId(ex.imageFileId) : ex.imageFileId;
              await bucket.delete(oid);
              report.gridfsDeleted.push({ exercise: ex._id, id: String(oid) });
            }
            if (ex.thumbFileId) {
              const oid2 = typeof ex.thumbFileId === 'string' ? new mongoose.Types.ObjectId(ex.thumbFileId) : ex.thumbFileId;
              await bucket.delete(oid2);
              report.gridfsDeleted.push({ exercise: ex._id, id: String(oid2) });
            }
          } catch (e) {
            // ignore individual deletion errors but record
            report.errors.push(`gridfs delete ex ${ex._id}: ${e?.message || e}`);
          }
        }
      } else {
        report.errors.push('No DB connection - skipped GridFS cleanup');
      }
    } catch (e) { report.errors.push(`GridFS cleanup failed: ${e?.message || e}`); }

    // --- Step 4: Delete DB documents ---
    try {
      const workoutDeleteResult = await Workout.deleteMany({ userId: tokenUid });
      const exerciseDeleteResult = await Exercise.deleteMany({ userId: tokenUid });
      report.dbDeleted.workouts = workoutDeleteResult.deletedCount || 0;
      report.dbDeleted.exercises = exerciseDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`DB delete failed: ${e?.message || e}`);
    }

    // --- Step 4b: Weitere an diesen Nutzer gebundene Collections löschen (siehe Kommentar bei
    // report.dbDeleted oben - bisher fehlte dieser Schritt komplett). Jede Collection einzeln in
    // try/catch, damit ein Fehler bei einer Collection nicht die Löschung der übrigen verhindert
    // (gleiches Prinzip wie die bestehenden Steps 2/3 oben, die auch einzeln fehlertolerant sind).
    try {
      const userProfileDeleteResult = await UserProfile.deleteOne({ uid: tokenUid });
      report.dbDeleted.userProfile = userProfileDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`UserProfile delete failed: ${e?.message || e}`);
    }
    try {
      const customExerciseDeleteResult = await CustomExercise.deleteMany({ userId: tokenUid });
      report.dbDeleted.customExercises = customExerciseDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`CustomExercise delete failed: ${e?.message || e}`);
    }
    try {
      const favoriteWorkoutDeleteResult = await FavoriteWorkout.deleteMany({ userId: tokenUid });
      report.dbDeleted.favoriteWorkouts = favoriteWorkoutDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`FavoriteWorkout delete failed: ${e?.message || e}`);
    }
    try {
      const feedbackRatingDeleteResult = await FeedbackRating.deleteMany({ userId: tokenUid });
      report.dbDeleted.feedbackRatings = feedbackRatingDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`FeedbackRating delete failed: ${e?.message || e}`);
    }
    try {
      const exerciseNoteDeleteResult = await UserExerciseNote.deleteMany({ userId: tokenUid });
      report.dbDeleted.exerciseNotes = exerciseNoteDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`UserExerciseNote delete failed: ${e?.message || e}`);
    }
    try {
      const appFeedbackDeleteResult = await AppFeedback.deleteMany({ userId: tokenUid });
      report.dbDeleted.appFeedback = appFeedbackDeleteResult.deletedCount || 0;
    } catch (e) {
      report.errors.push(`AppFeedback delete failed: ${e?.message || e}`);
    }

    // --- Step 5: Delete Firebase Auth account (best effort) ---
    try {
      await admin.auth().deleteUser(tokenUid);
      report.deletedAuth = true;
    } catch (e) {
      const code = e?.code || '<no-code>';
      const message = e?.message || String(e);
      const stack = e?.stack || '<no-stack>';
      const errString = `Firebase deleteUser failed: ${code} -- ${message}`;
      report.errors.push({ code, message, stack });
      console.error('[account/delete] Firebase deleteUser error:', errString);
      console.error(stack);
    }

    console.info(`[account/delete] Account deletion completed for UID: ${tokenUid}`);
    res.json({ success: true, uid: tokenUid, adminProjectId, tokenAudience: audience, report });

  } catch (error) {
    console.error('[account/delete] Account deletion failed:', error?.message || error);
    res.status(500).json({ error: 'Failed to delete account', message: error?.message });
  }
});

// ---------------------------
// Profile (Username)
// ---------------------------

// Reine Ableitung, kein eigenes DB-Feld: "erledigt" bedeutet bewusst abgeschlossen ODER
// übersprungen - beides soll die automatische erneute Anzeige gleichermaßen verhindern
// (siehe Onboarding-Auftrag "Verhalten: Nach Abschluss oder Überspringen darf der Flow beim
// nächsten App-Start nicht erneut automatisch erscheinen").
function summarizeOnboarding(profile) {
  const onboarding = profile?.onboarding || {};
  return {
    completed: !!(onboarding.completedAt || onboarding.skippedAt),
    completedAt: onboarding.completedAt || null,
    skippedAt: onboarding.skippedAt || null,
    dismissedHints: Array.isArray(onboarding.dismissedHints) ? onboarding.dismissedHints : []
  };
}

// Freiwillige persönliche Angaben (siehe UserProfile.js personalData) - jedes Feld einzeln
// null/'unspecified', wenn (noch) nicht angegeben, damit das Frontend zwischen "bewusst leer"
// und "0 eingetragen" unterscheiden kann.
function summarizePersonalData(profile) {
  const personalData = profile?.personalData || {};
  return {
    ageYears: personalData.ageYears ?? null,
    gender: personalData.gender || 'unspecified',
    heightCm: personalData.heightCm ?? null,
    weightKg: personalData.weightKg ?? null
  };
}

router.get('/profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const profile = await getOrCreateProfile(uid);
    res.json({
      uid,
      username: profile.username || '',
      avatarUrl: profile.avatarUrl || '',
      // Additiv: bestehende Konsumenten von GET /profile (settingsStore.js) lesen nur
      // username/avatarUrl und ignorieren unbekannte Felder - kein Breaking Change.
      onboarding: summarizeOnboarding(profile),
      personalData: summarizePersonalData(profile)
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile', message: e?.message || String(e) });
  }
});

// ---------------------------
// Onboarding-Status
// ---------------------------
// Getrennt von /profile (PUT), da hier ausschließlich der Onboarding-Teilbaum geschrieben wird -
// vermeidet versehentliches Überschreiben von username/avatarUrl durch einen unvollständigen
// Onboarding-Request und umgekehrt.

router.post('/onboarding/complete', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $set: { 'onboarding.completedAt': new Date() } },
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, onboarding: summarizeOnboarding(updated) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to complete onboarding', message: e?.message || String(e) });
  }
});

router.post('/onboarding/skip', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $set: { 'onboarding.skippedAt': new Date() } },
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, onboarding: summarizeOnboarding(updated) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to skip onboarding', message: e?.message || String(e) });
  }
});

// Für "Einführungsguide erneut starten" in den Einstellungen - setzt NUR completedAt/skippedAt
// zurück, nicht dismissedHints (die kontextuellen Einzel-Hinweise sind ein separates Feature,
// siehe Onboarding-Auftrag: "erneut starten" bezieht sich explizit auf den 5-seitigen Guide).
router.post('/onboarding/restart', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $set: { 'onboarding.completedAt': null, 'onboarding.skippedAt': null } },
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, onboarding: summarizeOnboarding(updated) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to restart onboarding', message: e?.message || String(e) });
  }
});

router.post('/onboarding/dismiss-hint', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const hintId = String(req.body?.hintId || '').trim().slice(0, 100);
    if (!hintId) return res.status(400).json({ error: 'hintId required' });

    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $addToSet: { 'onboarding.dismissedHints': hintId } },
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, onboarding: summarizeOnboarding(updated) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to dismiss hint', message: e?.message || String(e) });
  }
});

router.put('/profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const username = normalizeUsername(req.body?.username);

    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $set: { username } },
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, username: updated?.username || '', avatarUrl: updated?.avatarUrl || '' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update profile', message: e?.message || String(e) });
  }
});

// ---------------------------
// Persönliche Angaben (freiwillig, siehe UserProfile.js personalData)
// ---------------------------
// Eigener Endpunkt statt Erweiterung von PUT /profile oben: dort wird bei jedem Aufruf
// bedingungslos `username` neu gesetzt (auch leer, falls nicht mitgeschickt) - ein
// Personal-Data-Request soll das niemals versehentlich überschreiben können, analog zur
// bestehenden Trennung der Onboarding-Endpunkte (siehe Kommentar oben).
const GENDER_VALUES = new Set(['male', 'female', 'diverse', 'unspecified']);

// undefined -> Feld im Request gar nicht mitgeschickt (bleibt unverändert, $set wird für dieses
// Feld übersprungen); null/'' -> Nutzer hat das Feld bewusst geleert (explizit auf null setzen).
// Nur ein tatsächlich vorhandener, gültiger Wert wird übernommen; ungültige Werte (z.B. Text im
// Zahlenfeld, Zahl außerhalb des Schema-min/max) werden statt eines 400-Fehlers still ignoriert
// (Feld bleibt unverändert) - für ein rein freiwilliges Komfort-Feld unnötig streng.
function parseOptionalNumberField(value, { min, max }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return undefined;
  return Math.round(num * 10) / 10;
}

router.put('/profile/personal-data', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const body = req.body || {};
    const set = {};

    const ageYears = parseOptionalNumberField(body.ageYears, { min: 10, max: 120 });
    if (ageYears !== undefined) set['personalData.ageYears'] = ageYears;

    if (body.gender !== undefined) {
      const gender = GENDER_VALUES.has(body.gender) ? body.gender : 'unspecified';
      set['personalData.gender'] = gender;
    }

    const heightCm = parseOptionalNumberField(body.heightCm, { min: 100, max: 250 });
    if (heightCm !== undefined) set['personalData.heightCm'] = heightCm;

    const weightKg = parseOptionalNumberField(body.weightKg, { min: 30, max: 300 });
    if (weightKg !== undefined) set['personalData.weightKg'] = weightKg;

    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      Object.keys(set).length > 0 ? { $set: set } : {},
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, personalData: summarizePersonalData(updated) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update personal data', message: e?.message || String(e) });
  }
});

// ---------------------------
// Profile Avatar Upload
// ---------------------------

router.post('/profile/avatar', firebaseAuthMiddleware, avatarUpload.single('image'), async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const mime = String(req.file.mimetype || '').toLowerCase();
    if (!ALLOWED_AVATAR_MIME.has(mime)) {
      return res.status(400).json({
        error: 'Unsupported image type',
        allowed: Array.from(ALLOWED_AVATAR_MIME)
      });
    }

    // Process to square-ish avatar, strip metadata, output jpeg.
    const out = await sharp(req.file.buffer, { failOnError: false })
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // Bug-Fix: nicht mehr auf lokale Festplatte schreiben (siehe Kommentar bei
    // avatarImage in models/UserProfile.js - Render-Dateisystem ist flüchtig und wird bei
    // jedem Deploy zurückgesetzt, wodurch hochgeladene Avatare verschwanden). Stattdessen
    // Bild-Binärdaten direkt im UserProfile-Dokument speichern; avatarUrl bleibt als
    // Auslieferungs-Pfad bestehen (siehe GET /uploads/avatars/:filename in app.js).
    const filename = `${uid}.jpg`;
    const avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $set: { avatarUrl, avatarImage: { data: out, contentType: 'image/jpeg' } } },
      { upsert: true, new: true }
    ).lean();

    res.json({ uid, avatarUrl: updated?.avatarUrl || avatarUrl });
  } catch (e) {
    // Multer file size errors
    if (e?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image too large', maxBytes: AVATAR_MAX_BYTES });
    }
    res.status(500).json({ error: 'Failed to upload avatar', message: e?.message || String(e) });
  }
});

// Admin status diagnostic
// Sicherheitslücke geschlossen: gab bisher ohne jede Auth Infrastruktur-Details preis (Firebase
// Project ID, ob die Server-Credentials gültig sind) - jetzt wie andere Admin-Diagnose-Routen
// per requireAdminKey geschützt.
router.get('/admin-status', requireAdminKey, async (req, res) => {
  try {
    const apps = admin.apps || [];
    const opts = apps[0]?.options || {};
    const projectId = opts.projectId || 'unknown';
    // Try a lightweight call
    let canListUsers = false;
    try {
      // Do not actually list, just call with limit 1 to validate credentials
      const it = await admin.auth().listUsers(1);
      canListUsers = Array.isArray(it?.users);
    } catch {}
    res.json({
      apps: apps.length,
      projectId,
      canListUsers
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;