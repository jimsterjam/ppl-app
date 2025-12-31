import express from 'express';
import { admin } from '../utils/firebaseAdmin.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Workout from '../models/Workout.js';
import Exercise from '../models/Exercise.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.userId = decodedToken.uid;
    req.decodedToken = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error?.message || error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Delete account and all associated data

// Purge user data without deleting the account
router.post('/delete', verifyToken, async (req, res) => {
  const { confirmation } = req.body;

  // decodedToken kommt aus verifyToken Middleware
  const decoded = req.decodedToken || {};
  const tokenUid = decoded?.uid || decoded?.sub; // UID aus Firebase Token
  const audience = decoded?.aud || decoded?.azp || 'unknown';

  console.log('[account/delete] Decoded token:', decoded);
  console.log('[account/delete] Token UID:', tokenUid);
  console.log('[account/delete] Token audience:', audience);

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
  const ok = confirmation === 'ACCOUNT LÖSCHEN' || confirmation === 'DELETE ACCOUNT';
  if (!ok) {
    return res.status(400).json({ error: 'Invalid confirmation text' });
  }

  try {
    console.log(`[account/delete] Starting account deletion for UID: ${tokenUid} (audience: ${audience}, adminProjectId: ${adminProjectId})`);

    // 1. Delete all workouts
    const workoutDeleteResult = await Workout.deleteMany({ userId: tokenUid });
    console.log(`[account/delete] Deleted ${workoutDeleteResult.deletedCount} workouts`);

    // 2. Delete all custom exercises
    const exerciseDeleteResult = await Exercise.deleteMany({ userId: tokenUid });
    console.log(`[account/delete] Deleted ${exerciseDeleteResult.deletedCount} exercises`);

    // 3. Delete uploaded images
    const uploadsDir = path.join(__dirname, '../public/uploads');
    let deletedFiles = [];
    try {
      const files = await fs.readdir(uploadsDir);
      const userFiles = files.filter(file => file.startsWith(tokenUid + '_'));
      for (const file of userFiles) {
        await fs.unlink(path.join(uploadsDir, file));
        deletedFiles.push(file);
      }
      if (deletedFiles.length) {
        console.log(`[account/delete] Deleted ${deletedFiles.length} uploaded files`);
      }
    } catch (error) {
      console.error('[account/delete] Error deleting files:', error?.message || error);
    }

    // 4. Delete Firebase Auth account
    let deletedAuth = false;
    try {
      console.log('[account/delete] Deleting Firebase Auth user...');
      await admin.auth().deleteUser(tokenUid);
      deletedAuth = true;
      console.log(`[account/delete] Firebase Auth account deleted for UID: ${tokenUid}`);
    } catch (e) {
      console.error('[account/delete] Firebase deleteUser failed:', e?.code || e?.message || e);
      return res.status(500).json({ error: 'Failed to delete Firebase user', code: e?.code, message: e?.message });
    }

    console.log(`[account/delete] Account deletion completed for UID: ${tokenUid}`);
    res.json({
      success: true,
      uid: tokenUid,
      adminProjectId,
      tokenAudience: audience,
      deleted: {
        workouts: workoutDeleteResult.deletedCount,
        exercises: exerciseDeleteResult.deletedCount,
        files: deletedFiles
      },
      deletedAuth
    });

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