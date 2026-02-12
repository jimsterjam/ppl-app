import express from 'express';
import { admin } from '../utils/firebaseAdmin.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import Exercise from '../models/Exercise.js';
import UserProfile from '../models/UserProfile.js';
import CoachInvite from '../models/CoachInvite.js';
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

async function isCoachOf(coachUid, clientUid) {
  if (!coachUid || !clientUid) return false;
  const profile = await UserProfile.findOne({ uid: clientUid, coaches: coachUid }).select({ _id: 1 }).lean();
  return !!profile;
}

function normalizeEmailLower(input) {
  return String(input ?? '').trim().toLowerCase();
}

function normalizeChatText(input) {
  const raw = String(input ?? '').replace(/\r\n/g, '\n').trim();
  // avoid huge payloads; keep it simple/plain text
  const collapsed = raw.replace(/[\t\r]/g, '');
  return collapsed.slice(0, 1500);
}

function computeInviteExpiry() {
  const days = 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function isInviteExpired(invite) {
  const exp = invite?.expiresAt ? new Date(invite.expiresAt) : null;
  return !!(exp && exp.getTime() && exp.getTime() < Date.now());
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
    res.json({ uid, username: profile.username || '', avatarUrl: profile.avatarUrl || '', coaches: profile.coaches || [] });
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

    res.json({ uid, username: updated?.username || '', avatarUrl: updated?.avatarUrl || '', coaches: updated?.coaches || [] });
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

// ---------------------------
// Coach Beziehungen
// ---------------------------

async function createOrReuseInvite({ clientUid, coachUid, coachEmailLower, consentTextVersion, consentLocale }) {
  // Reuse an existing pending invite if still valid
  const pending = await CoachInvite.findOne({ clientUid, coachUid, status: 'pending' }).sort({ createdAt: -1 }).lean();
  if (pending && !isInviteExpired(pending)) return pending;

  // If an accepted invite exists, return it (idempotent)
  const accepted = await CoachInvite.findOne({ clientUid, coachUid, status: 'accepted' }).sort({ acceptedAt: -1 }).lean();
  if (accepted) return accepted;

  const doc = await CoachInvite.create({
    clientUid,
    coachUid,
    coachEmailLower: coachEmailLower || '',
    status: 'pending',
    consentTextVersion: consentTextVersion || '',
    consentLocale: consentLocale || '',
    consentGivenAt: new Date(),
    expiresAt: computeInviteExpiry()
  });
  return doc.toObject();
}

// User erstellt eine Coach-Einladung (Coach muss bestätigen)
router.post('/coach/invite', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const coachEmailLower = normalizeEmailLower(req.body?.coachEmail);
    const consentTextVersion = String(req.body?.consentTextVersion || '').slice(0, 64);
    const consentLocale = String(req.body?.consentLocale || '').slice(0, 16);

    if (!coachEmailLower) return res.status(400).json({ error: 'coachEmail required' });

    const coachUser = await admin.auth().getUserByEmail(coachEmailLower);
    const coachUid = coachUser?.uid;
    if (!coachUid) return res.status(404).json({ error: 'Coach not found' });
    if (coachUid === clientUid) return res.status(400).json({ error: 'Cannot invite yourself as coach' });

    const invite = await createOrReuseInvite({
      clientUid,
      coachUid,
      coachEmailLower,
      consentTextVersion,
      consentLocale
    });

    res.json({
      inviteId: String(invite._id),
      status: invite.status,
      coachUid: invite.coachUid,
      coachEmailLower: invite.coachEmailLower,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt || null
    });
  } catch (e) {
    const code = e?.code || '';
    if (code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Coach not found' });
    }
    res.status(500).json({ error: 'Failed to create invite', message: e?.message || String(e) });
  }
});

// Legacy alias: /coach/add -> /coach/invite (pending)
router.post('/coach/add', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const coachUidRaw = (req.body?.coachUid || '').toString().trim();
    const coachEmailLower = normalizeEmailLower(req.body?.coachEmail);
    const consentTextVersion = String(req.body?.consentTextVersion || '').slice(0, 64);
    const consentLocale = String(req.body?.consentLocale || '').slice(0, 16);

    let coachUid = coachUidRaw;
    let emailLower = coachEmailLower;

    if (!coachUid && coachEmailLower) {
      const coachUser = await admin.auth().getUserByEmail(coachEmailLower);
      coachUid = coachUser?.uid;
      emailLower = coachEmailLower;
    }

    if (coachUid && !emailLower) {
      const coachUser = await admin.auth().getUser(coachUid);
      emailLower = normalizeEmailLower(coachUser?.email || '');
    }

    if (!coachUid) return res.status(400).json({ error: 'coachUid or coachEmail required' });
    if (coachUid === clientUid) return res.status(400).json({ error: 'Cannot invite yourself as coach' });

    // validate coach exists
    await admin.auth().getUser(coachUid);

    const invite = await createOrReuseInvite({
      clientUid,
      coachUid,
      coachEmailLower: emailLower,
      consentTextVersion,
      consentLocale
    });

    res.json({
      inviteId: String(invite._id),
      status: invite.status,
      coachUid: invite.coachUid,
      coachEmailLower: invite.coachEmailLower,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt || null
    });
  } catch (e) {
    const code = e?.code || '';
    if (code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Coach not found' });
    }
    res.status(500).json({ error: 'Failed to create invite', message: e?.message || String(e) });
  }
});

// Client: ausgehende Einladungen ansehen
router.get('/coach/invites/outgoing', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '50', 10) || 50));
    const invites = await CoachInvite.find({ clientUid })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // mark expired (best effort)
    const out = [];
    for (const inv of invites || []) {
      if (inv.status === 'pending' && isInviteExpired(inv)) {
        try {
          await CoachInvite.updateOne({ _id: inv._id, status: 'pending' }, { $set: { status: 'expired' } });
          inv.status = 'expired';
        } catch {}
      }
      out.push({
        inviteId: String(inv._id),
        status: inv.status,
        coachUid: inv.coachUid,
        coachEmailLower: inv.coachEmailLower || '',
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt || null,
        revokedAt: inv.revokedAt || null,
        canceledAt: inv.canceledAt || null
      });
    }

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load outgoing invites', message: e?.message || String(e) });
  }
});

// Coach: eingehende Einladungen ansehen
router.get('/coach/invites/incoming', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '50', 10) || 50));
    const invites = await CoachInvite.find({ coachUid, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const clientUids = (invites || []).map(i => i.clientUid);
    const profiles = await UserProfile.find({ uid: { $in: clientUids } }).select({ uid: 1, username: 1 }).lean();
    const usernameByUid = new Map((profiles || []).map(p => [p.uid, p.username || '']));

    const out = [];
    for (const inv of invites || []) {
      if (isInviteExpired(inv)) {
        try {
          await CoachInvite.updateOne({ _id: inv._id, status: 'pending' }, { $set: { status: 'expired' } });
        } catch {}
        continue;
      }
      out.push({
        inviteId: String(inv._id),
        clientUid: inv.clientUid,
        clientUsername: usernameByUid.get(inv.clientUid) || '',
        coachUid: inv.coachUid,
        coachEmailLower: inv.coachEmailLower || '',
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        consentTextVersion: inv.consentTextVersion || '',
        consentLocale: inv.consentLocale || '',
        consentGivenAt: inv.consentGivenAt || null
      });
    }

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load incoming invites', message: e?.message || String(e) });
  }
});

// Coach akzeptiert Einladung
router.post('/coach/invites/:inviteId/accept', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const inviteId = req.params.inviteId;
    const invite = await CoachInvite.findById(inviteId).lean();
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.coachUid !== coachUid) return res.status(403).json({ error: 'Forbidden' });

    if (invite.status === 'accepted') {
      return res.json({ status: 'accepted', inviteId: String(invite._id), clientUid: invite.clientUid, coachUid: invite.coachUid });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invite not pending', status: invite.status });
    }
    if (isInviteExpired(invite)) {
      await CoachInvite.updateOne({ _id: invite._id, status: 'pending' }, { $set: { status: 'expired' } });
      return res.status(400).json({ error: 'Invite expired' });
    }

    const now = new Date();
    await CoachInvite.updateOne(
      { _id: invite._id, status: 'pending' },
      { $set: { status: 'accepted', acceptedAt: now } }
    );

    await UserProfile.findOneAndUpdate(
      { uid: invite.clientUid },
      { $addToSet: { coaches: coachUid } },
      { upsert: true, new: true }
    ).lean();

    res.json({ status: 'accepted', inviteId: String(invite._id), clientUid: invite.clientUid, coachUid });
  } catch (e) {
    res.status(500).json({ error: 'Failed to accept invite', message: e?.message || String(e) });
  }
});

// Client storniert eine ausgehende Einladung (pending)
router.post('/coach/invites/:inviteId/cancel', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const inviteId = req.params.inviteId;
    const invite = await CoachInvite.findById(inviteId).lean();
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.clientUid !== clientUid) return res.status(403).json({ error: 'Forbidden' });

    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invite not pending', status: invite.status });
    }

    await CoachInvite.updateOne(
      { _id: invite._id, status: 'pending' },
      { $set: { status: 'canceled', canceledAt: new Date() } }
    );

    res.json({ status: 'canceled', inviteId: String(invite._id) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to cancel invite', message: e?.message || String(e) });
  }
});

// Client entzieht einem Coach den Zugriff (revokes active relationship)
router.post('/coach/revoke', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const coachUid = (req.body?.coachUid || '').toString().trim();
    if (!coachUid) return res.status(400).json({ error: 'coachUid required' });

    await UserProfile.updateOne({ uid: clientUid }, { $pull: { coaches: coachUid } });
    await CoachInvite.updateMany(
      { clientUid, coachUid, status: 'accepted' },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );

    res.json({ status: 'revoked', coachUid });
  } catch (e) {
    res.status(500).json({ error: 'Failed to revoke coach', message: e?.message || String(e) });
  }
});

// Client: aktive (akzeptierte) Coaches mit Kontext anzeigen
router.get('/coach/active', firebaseAuthMiddleware, async (req, res) => {
  try {
    const clientUid = req.auth?.userId;
    if (!clientUid) return res.status(401).json({ error: 'Unauthenticated' });

    const invites = await CoachInvite.find({ clientUid, status: 'accepted' })
      .sort({ acceptedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    res.json((invites || []).map(inv => ({
      inviteId: String(inv._id),
      coachUid: inv.coachUid,
      coachEmailLower: inv.coachEmailLower || '',
      acceptedAt: inv.acceptedAt || null
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load active coaches', message: e?.message || String(e) });
  }
});

// Coach sieht seine Clients (alle User, die ihn als Coach hinzugefügt haben)
router.get('/coach/clients', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const clients = await UserProfile.find({ coaches: coachUid })
      .select({ uid: 1, username: 1, updatedAt: 1, createdAt: 1 })
      .lean();

    res.json((clients || []).map(p => ({ uid: p.uid, username: p.username || '' })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load clients', message: e?.message || String(e) });
  }
});

// Coach darf Workouts eines Clients lesen (nur wenn er hinzugefügt wurde)
router.get('/coach/clients/:clientUid/workouts', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    const clientUid = req.params.clientUid;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const ok = await isCoachOf(coachUid, clientUid);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '100', 10) || 100));
    const workouts = await Workout.find({ userId: clientUid }).sort({ date: -1 }).limit(limit).lean();
    res.json(workouts || []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load client workouts', message: e?.message || String(e) });
  }
});

// Coach: Workout-Details eines Clients lesen
router.get('/coach/clients/:clientUid/workouts/:workoutId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    const clientUid = req.params.clientUid;
    const workoutId = req.params.workoutId;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const ok = await isCoachOf(coachUid, clientUid);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    if (!mongoose.Types.ObjectId.isValid(workoutId)) return res.status(400).json({ error: 'Invalid workoutId' });

    const workout = await Workout.findOne({ _id: workoutId, userId: clientUid }).lean();
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    res.json(workout);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load client workout detail', message: e?.message || String(e) });
  }
});

// Coach: Chat/Notizen zu einem Workout (Coach <-> Client)
router.get('/coach/clients/:clientUid/workouts/:workoutId/chat', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    const clientUid = req.params.clientUid;
    const workoutId = req.params.workoutId;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const ok = await isCoachOf(coachUid, clientUid);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    if (!mongoose.Types.ObjectId.isValid(workoutId)) return res.status(400).json({ error: 'Invalid workoutId' });

    // Ensure workout belongs to client
    const workoutExists = await Workout.findOne({ _id: workoutId, userId: clientUid }).select({ _id: 1 }).lean();
    if (!workoutExists) return res.status(404).json({ error: 'Workout not found' });

    const limit = Math.max(1, Math.min(200, Number.parseInt(req.query?.limit || '100', 10) || 100));
    const msgs = await CoachChatMessage.find({
      clientUid,
      workoutId,
      $or: [{ coachUid }, { coachUid: '' }]
    })
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
    res.status(500).json({ error: 'Failed to load coach chat', message: e?.message || String(e) });
  }
});

router.post('/coach/clients/:clientUid/workouts/:workoutId/chat', firebaseAuthMiddleware, async (req, res) => {
  try {
    const coachUid = req.auth?.userId;
    const clientUid = req.params.clientUid;
    const workoutId = req.params.workoutId;
    if (!coachUid) return res.status(401).json({ error: 'Unauthenticated' });

    const ok = await isCoachOf(coachUid, clientUid);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    if (!mongoose.Types.ObjectId.isValid(workoutId)) return res.status(400).json({ error: 'Invalid workoutId' });

    const text = normalizeChatText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'text required' });

    const workoutExists = await Workout.findOne({ _id: workoutId, userId: clientUid }).select({ _id: 1 }).lean();
    if (!workoutExists) return res.status(404).json({ error: 'Workout not found' });

    const doc = await CoachChatMessage.create({
      clientUid,
      coachUid,
      workoutId,
      sender: 'coach',
      text
    });

    res.status(201).json({ id: String(doc._id), sender: 'coach', text: doc.text, coachUid, createdAt: doc.createdAt });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send coach chat message', message: e?.message || String(e) });
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