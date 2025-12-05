import express from 'express';
import admin from 'firebase-admin';
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
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Delete account and all associated data
router.post('/delete', verifyToken, async (req, res) => {
  const { confirmation } = req.body;
  const userId = req.userId;

  // Check confirmation
  if (confirmation !== 'ACCOUNT LÖSCHEN') {
    return res.status(400).json({ error: 'Invalid confirmation text' });
  }

  try {
    console.log(`Starting account deletion for user: ${userId}`);

    // 1. Delete all workouts
    const workoutDeleteResult = await Workout.deleteMany({ userId });
    console.log(`Deleted ${workoutDeleteResult.deletedCount} workouts`);

    // 2. Delete all custom exercises
    const exerciseDeleteResult = await Exercise.deleteMany({ userId });
    console.log(`Deleted ${exerciseDeleteResult.deletedCount} exercises`);

    // 3. Delete uploaded images
    const uploadsDir = path.join(__dirname, '../public/uploads');
    try {
      const files = await fs.readdir(uploadsDir);
      const userFiles = files.filter(file => file.startsWith(userId + '_'));
      for (const file of userFiles) {
        await fs.unlink(path.join(uploadsDir, file));
        console.log(`Deleted file: ${file}`);
      }
    } catch (error) {
      console.error('Error deleting files:', error);
      // Continue with deletion even if file deletion fails
    }

    // 4. Delete Firebase Auth account
    await admin.auth().deleteUser(userId);
    console.log(`Deleted Firebase Auth account for user: ${userId}`);

    // Log the deletion (for audit purposes)
    console.log(`Account deletion completed for user: ${userId}`);

    res.json({ success: true, message: 'Account and all data deleted successfully' });

  } catch (error) {
    console.error('Account deletion failed:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;