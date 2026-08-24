import express from 'express';
import { admin } from '../utils/firebaseAdmin.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import Exercise from '../models/Exercise.js';
import UserProfile from '../models/UserProfile.js';
import CoachChatMessage from '../models/CoachChatMessage.js';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
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

function normalizeChatText(input) {
  const raw = String(input ?? '').replace(/\r\n/g, '\n').trim();
  // avoid huge payloads; keep it simple/plain text
  const collapsed = raw.replace(/[\t\r]/g, '');
  return collapsed.slice(0, 1500);
}

// NOTE: use centralized `firebaseAuthMiddleware` (sets `req.auth.userId`)

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
      dbDeleted: { workouts: 0, exercises: 0 },
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

router.get('/profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.auth?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const profile = await getOrCreateProfile(uid);
    res.json({ uid, username: profile.username || '', avatarUrl: profile.avatarUrl || '' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile', message: e?.message || String(e) });
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

    const avatarsDir = path.join(__dirname, '../public/uploads/avatars');
    await fs.mkdir(avatarsDir, { recursive: true });

    const filename = `${uid}.jpg`;
    const absPath = path.join(avatarsDir, filename);
    await fs.writeFile(absPath, out);

    const avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await UserProfile.findOneAndUpdate(
      { uid },
      { $set: { avatarUrl } },
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

// Client: Chat/Notizen zu einem eigenen Workout (Client <-> Coaches)
router.get('/workouts/:workoutId/chat', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    const workoutId = req.params.workoutId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });
    if (!mongoose.Types.ObjectId.isValid(workoutId)) return res.status(400).json({ error: 'Invalid workoutId' });

    const workoutExists = await Workout.findOne({ _id: workoutId, userId: clientUid }).select({ _id: 1 }).lean();
    if (!workoutExists) return res.status(404).json({ error: 'Workout not found' });

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '100', 10) || 100));
    const msgs = await CoachChatMessage.find({ clientUid, workoutId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json((msgs || []).map(m => ({
      id: String(m._id),
      sender: m.sender,
      text: m.text,
      coachUid: m.coachUid || '',
      createdAt: m.createdAt
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load workout chat', message: e?.message || String(e) });
  }
});

router.post('/workouts/:workoutId/chat', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    const workoutId = req.params.workoutId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });
    if (!mongoose.Types.ObjectId.isValid(workoutId)) return res.status(400).json({ error: 'Invalid workoutId' });

    const text = normalizeChatText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'text required' });

    const workoutExists = await Workout.findOne({ _id: workoutId, userId: clientUid }).select({ _id: 1 }).lean();
    if (!workoutExists) return res.status(404).json({ error: 'Workout not found' });

    const doc = await CoachChatMessage.create({
      clientUid,
      coachUid: '',
      workoutId,
      sender: 'client',
      text
    });

    res.status(201).json({ id: String(doc._id), sender: 'client', text: doc.text, coachUid: '', createdAt: doc.createdAt });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send workout chat message', message: e?.message || String(e) });
  }
});

// Client: Inbox/Threads (letzte Nachricht pro Workout)
router.get('/workouts/chat/threads', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query?.limit || '30', 10) || 30));

    const rows = await CoachChatMessage.aggregate([
      { $match: { clientUid } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$workoutId',
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'workouts',
          let: { wid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$wid'] },
                    { $eq: ['$userId', clientUid] }
                  ]
                }
              }
            },
            { $project: { _id: 1, name: 1, date: 1, type: 1, completed: 1 } }
          ],
          as: 'workout'
        }
      },
      { $unwind: { path: '$workout', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          workoutId: '$_id',
          workoutName: '$workout.name',
          workoutDate: '$workout.date',
          workoutType: '$workout.type',
          workoutCompleted: '$workout.completed',
          lastMessageText: '$lastMessage.text',
          lastMessageSender: '$lastMessage.sender',
          lastMessageAt: '$lastMessage.createdAt'
        }
      },
      { $sort: { lastMessageAt: -1 } },
      { $limit: limit }
    ]);

    res.json(
      (rows || []).map(r => ({
        workoutId: String(r.workoutId),
        workout: {
          name: r.workoutName || '',
          date: r.workoutDate || null,
          type: r.workoutType || '',
          completed: Boolean(r.workoutCompleted)
        },
        lastMessage: {
          text: r.lastMessageText || '',
          sender: r.lastMessageSender || 'coach',
          createdAt: r.lastMessageAt || null
        }
      }))
    );
  } catch (e) {
    res.status(500).json({ error: 'Failed to load chat threads', message: e?.message || String(e) });
  }
});



// Admin status diagnostic
router.get('/admin-status', async (req, res) => {
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