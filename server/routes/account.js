import express from 'express';
import { admin } from '../utils/firebaseAdmin.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import Exercise from '../models/Exercise.js';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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