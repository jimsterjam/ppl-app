/**
 * Bereinigt Übungs-Dubletten in der Datenbank (einmalig von Paul auszuführen).
 *
 * Hintergrund: Der Workout-Generator hat Übungen unter Namen angefragt, die im Katalog
 * (client/public/data/default-exercises.json) anders heißen - z.B. "Barbell Bench Press" statt
 * "bench press barbell". Der Server fand keinen exakten Treffer und legte dafür eine NEUE Übung
 * (source: 'ai_suggestion') mit eigener Datenbank-ID an. Folge: Workouts/Favoriten zeigen die
 * Übung doppelt und ohne Video, weil Videos über die Katalog-ID gefunden werden (0025.v1.mp4).
 *
 * Das Skript
 *   1. ordnet jede 'ai_suggestion'-Übung einem Katalogeintrag zu - Namensvergleich unabhängig von
 *      Wortreihenfolge und Satzzeichen ("Barbell Bench Press" == "bench press barbell"),
 *   2. stellt Workouts und Favoriten, die diese Übung enthalten, auf die Katalog-ID und den
 *      Katalognamen um (dadurch gibt es wieder Video, Verlauf und Fortschritt),
 *   3. benennt passende Übungsnotizen (UserExerciseNote, z.B. 1RM) um,
 *   4. löscht auf Wunsch (--delete) die zugeordneten 'ai_suggestion'-Übungen.
 * Nicht zuordenbare 'ai_suggestion'-Übungen werden nur aufgelistet (manuell prüfen).
 *
 * Aufruf (im Ordner server):
 *   node scripts/cleanupDuplicateExercises.mjs              # Probelauf: zeigt nur, was passieren würde
 *   node scripts/cleanupDuplicateExercises.mjs --apply      # Workouts/Favoriten/Notizen umstellen
 *   node scripts/cleanupDuplicateExercises.mjs --apply --delete   # zusätzlich Dubletten löschen
 * Optional: --catalog-merges stellt zusätzlich die im Katalog zusammengeführten Einträge um
 * (CATALOG_ID_MERGES unten) - erst verwenden, wenn die Katalog-Bereinigung live ist.
 *
 * Voraussetzung: MONGO_URI in server/.env (wie normalizeWorkouts.js). Vorher Datenbank-Backup!
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import Exercise from '../models/Exercise.js';
import FavoriteWorkout from '../models/FavoriteWorkout.js';
import UserExerciseNote from '../models/UserExerciseNote.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CATALOG_PATH = path.resolve(__dirname, '..', '..', 'client', 'public', 'data', 'default-exercises.json');

// Katalog-Einträge, die bei der Katalog-Bereinigung zusammengeführt werden: entfernte ID -> bleibende ID.
// (Nur echte Dubletten mit gleicher Übung im Video - siehe Liste im Chat vom 30.09.)
const CATALOG_ID_MERGES = {
  '1731': '0296' // dumbbell close grip press -> dumbbell close-grip press
};

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DELETE = args.has('--delete');
const CATALOG_MERGES = args.has('--catalog-merges');

// Name -> Vergleichsschlüssel unabhängig von Reihenfolge, Groß-/Kleinschreibung und Satzzeichen.
export function tokenKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function loadCatalog() {
  const list = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const byKey = new Map();
  const ambiguous = new Set();
  for (const entry of list) {
    for (const name of [entry.name_en, entry.name, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]) {
      const key = tokenKey(name);
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing && existing.id !== entry.id) ambiguous.add(key);
      else byKey.set(key, entry);
    }
  }
  for (const key of ambiguous) byKey.delete(key); // mehrdeutig -> lieber nicht automatisch zuordnen
  const byId = new Map(list.map((entry) => [String(entry.id), entry]));
  return { byKey, byId, ambiguous };
}

function catalogRef(entry) {
  return { exerciseId: String(entry._id || `ex_${entry.id}`), name: String(entry.name_en || entry.name) };
}

// Ersetzt Übungen in einer Liste; liefert die Zahl der Änderungen.
function rewriteExercises(exercises, { idMap, keyMap }) {
  let changes = 0;
  for (const ex of Array.isArray(exercises) ? exercises : []) {
    if (!ex) continue;
    const byId = ex.exerciseId ? idMap.get(String(ex.exerciseId)) : null;
    const byName = keyMap.get(tokenKey(ex.name));
    const target = byId || byName;
    if (!target) continue;
    if (ex.exerciseId === target.exerciseId && ex.name === target.name) continue;
    ex.exerciseId = target.exerciseId;
    ex.name = target.name;
    changes += 1;
  }
  return changes;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI fehlt (server/.env). Abbruch.');
    process.exit(1);
  }
  console.log(APPLY ? '⚠️  ÄNDERUNGSLAUF (--apply)' : 'ℹ️  Probelauf - es wird nichts geändert (mit --apply ausführen)');
  const catalog = loadCatalog();
  await mongoose.connect(process.env.MONGO_URI);

  // 1. ai_suggestion-Übungen dem Katalog zuordnen
  const aiDocs = await Exercise.find({ source: 'ai_suggestion' }).lean();
  const idMap = new Map();   // alte Exercise-ID -> { exerciseId, name } aus dem Katalog
  const keyMap = new Map();  // Namensschlüssel der Dublette -> Katalog-Referenz
  const unmatched = [];
  for (const doc of aiDocs) {
    const names = [doc.name, doc.names?.en, doc.names?.de].filter(Boolean);
    const entry = names.map((n) => catalog.byKey.get(tokenKey(n))).find(Boolean);
    if (!entry) { unmatched.push(doc); continue; }
    const ref = catalogRef(entry);
    idMap.set(String(doc._id), ref);
    names.forEach((n) => keyMap.set(tokenKey(n), ref));
    console.log(`  ↪ "${doc.name}" (${doc._id}) -> Katalog ${entry.id} "${entry.name_en}"`);
  }

  // Optional: zusammengeführte Katalog-Einträge
  if (CATALOG_MERGES) {
    for (const [fromId, toId] of Object.entries(CATALOG_ID_MERGES)) {
      const from = catalog.byId.get(fromId);
      const to = catalog.byId.get(toId);
      if (!to) { console.warn(`  ! Katalog-ID ${toId} fehlt - Merge ${fromId} übersprungen`); continue; }
      const ref = catalogRef(to);
      idMap.set(`ex_${fromId}`, ref);
      idMap.set(fromId, ref);
      if (from?.name_en) keyMap.set(tokenKey(from.name_en), ref);
      console.log(`  ↪ Katalog ${fromId} -> ${toId} "${to.name_en}"`);
    }
  }

  // 2. Workouts
  let workoutsChanged = 0;
  let exercisesChanged = 0;
  for await (const workout of Workout.find({}).cursor()) {
    const changes = rewriteExercises(workout.exercises, { idMap, keyMap });
    if (!changes) continue;
    workoutsChanged += 1;
    exercisesChanged += changes;
    if (APPLY) {
      workout.markModified('exercises');
      await workout.save();
    }
  }

  // 3. Favoriten (workout ist ein freies Objekt -> markModified nötig)
  let favoritesChanged = 0;
  for await (const fav of FavoriteWorkout.find({}).cursor()) {
    const changes = rewriteExercises(fav.workout?.exercises, { idMap, keyMap });
    if (!changes) continue;
    favoritesChanged += 1;
    if (APPLY) {
      fav.markModified('workout');
      await fav.save();
    }
  }

  // 4. Übungsnotizen (1RM, persistente Notizen) - pro Nutzer eindeutig, Konflikte nur melden
  let notesChanged = 0;
  const noteConflicts = [];
  for await (const note of UserExerciseNote.find({}).cursor()) {
    const ref = keyMap.get(tokenKey(note.exerciseName));
    if (!ref || note.exerciseName === ref.name) continue;
    const clash = await UserExerciseNote.findOne({ userId: note.userId, exerciseName: ref.name }).lean();
    if (clash) { noteConflicts.push(`${note.userId}: "${note.exerciseName}" -> "${ref.name}" existiert schon`); continue; }
    notesChanged += 1;
    if (APPLY) {
      note.exerciseName = ref.name;
      await note.save();
    }
  }

  // 5. Dubletten löschen
  let deleted = 0;
  if (APPLY && DELETE && idMap.size) {
    const ids = [...idMap.keys()].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const result = await Exercise.deleteMany({ _id: { $in: ids }, source: 'ai_suggestion' });
    deleted = result.deletedCount || 0;
  }

  console.log('\n=== Ergebnis ===');
  console.log(`ai_suggestion-Übungen: ${aiDocs.length} (zugeordnet ${aiDocs.length - unmatched.length}, offen ${unmatched.length})`);
  console.log(`Workouts ${APPLY ? 'geändert' : 'betroffen'}: ${workoutsChanged} (${exercisesChanged} Übungen)`);
  console.log(`Favoriten ${APPLY ? 'geändert' : 'betroffen'}: ${favoritesChanged}`);
  console.log(`Übungsnotizen ${APPLY ? 'umbenannt' : 'betroffen'}: ${notesChanged}`);
  if (noteConflicts.length) console.log(`Notiz-Konflikte (nicht geändert):\n  ${noteConflicts.join('\n  ')}`);
  if (DELETE) console.log(`Gelöschte Dubletten: ${deleted}`);
  if (unmatched.length) {
    console.log('\nNicht zuordenbar (bitte manuell prüfen, bleiben bestehen):');
    unmatched.forEach((doc) => console.log(`  - "${doc.name}" (${doc._id})`));
  }
  await mongoose.disconnect();
}

// Nur beim direkten Aufruf ausführen (Import in Tests führt nichts aus).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(async (error) => {
    console.error('Fehler:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
