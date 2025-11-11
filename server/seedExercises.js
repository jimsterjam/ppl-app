// seedExercises.js
import { MongoClient } from 'mongodb';
import exercises from 'app/client/data/exercises.js'; // Stelle sicher: exercises.js exportiert `export default exercises`
import dotenv from 'dotenv';

dotenv.config();
// MongoDB URI aus .env oder direkt hier eintragen
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'bro-split-app';
const COLLECTION_NAME = 'exercises';

async function seed() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Alte Daten löschen
    await collection.deleteMany({});
    console.log('🗑️ Cleared existing exercises');

    // Alle Übungen einfügen
    const result = await collection.insertMany(exercises);
    console.log(`💪 Inserted ${result.insertedCount} exercises`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    await client.close();
    console.log('🔒 Connection closed');
  }
}

seed();
