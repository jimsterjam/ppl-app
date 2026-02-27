import sharp from 'sharp';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Bildverarbeitung für Exercises (Buffer → main/thumbnail)
export async function processImageBuffers(fileBuffer) {
  let mainBuffer = fileBuffer;
  try {
    mainBuffer = await sharp(fileBuffer, { failOnError: false })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch {}
  let thumbBuffer = fileBuffer;
  try {
    thumbBuffer = await sharp(fileBuffer, { failOnError: false })
      .rotate()
      .resize({ width: 256, height: 256, fit: 'cover' })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch {}
  return { mainBuffer, thumbBuffer };
}

export function getExerciseBucket() {
  const db = mongoose.connection?.db;
  if (!db) throw new Error('DB connection not ready');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'exerciseImages' });
}

export async function saveToGridFS(buffer, filename, metadata) {
  const bucket = getExerciseBucket();
  return await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { contentType: 'image/jpeg', metadata });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}

// Bildspeicherung für Workouts (Buffer → JPG + Thumbnail auf Disk)
export async function processAndStoreWorkoutImage(fileBuffer, baseName) {
  const uploadsDirWorkouts = path.join(process.cwd(), 'server', 'public', 'uploads', 'workouts');
  fs.mkdirSync(uploadsDirWorkouts, { recursive: true });
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
