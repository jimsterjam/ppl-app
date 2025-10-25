import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function normalizeType(input, name, firstExerciseCategory) {
  const src = [input, name, firstExerciseCategory]
    .map(v => (v ?? '').toString().toLowerCase())
    .find(s => s && s.trim().length > 0) || '';

  if (src.includes('push')) return 'push';
  if (src.includes('pull')) return 'pull';
  if (src.includes('leg')) return 'legs';
  if (src.includes('brust') || src.includes('schulter') || src.includes('trizeps')) return 'push';
  if (src.includes('rücken') || src.includes('bizeps')) return 'pull';
  if (src.includes('bein') || src.includes('quadrizeps') || src.includes('hamstrings') || src.includes('waden')) return 'legs';
  return 'push';
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI fehlt. Abbruch.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const cursor = Workout.find({}).cursor();
  let updated = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const firstCat = Array.isArray(doc.exercises) && doc.exercises[0]?.category
      ? doc.exercises[0].category
      : undefined;
    const newType = normalizeType(doc.type, doc.name, firstCat);
    if (doc.type !== newType) {
      doc.type = newType;
      await doc.save();
      updated++;
    }
  }
  console.log(`Normalisierung abgeschlossen. Aktualisierte Workouts: ${updated}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
