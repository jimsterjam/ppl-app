// Hauptmuskelgruppe je Übung für den Monatsbericht ("Sätze pro Muskelgruppe").
// Workouts speichern entweder eine Datenbank-ID (24 Hex-Zeichen, eigene/ergänzte Übungen) oder eine ID des
// mitgelieferten Katalogs ("ex_0001", client/public/data/default-exercises.json); ohne ID hilft der Name.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(__dirname, '..', '..', 'client', 'public', 'data', 'default-exercises.json');

export const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
export const CATALOG_ID_PATTERN = /^ex_[a-z0-9]+$/i;

let cached = null;

/** Katalog als { byId, byName }; fehlt die Datei, bleibt der Abschnitt leer statt den Bericht zu stoppen. */
export function loadCatalogMuscles(catalog = null) {
  if (!catalog && cached) return cached;
  let entries = catalog;
  if (!entries) {
    try {
      entries = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    } catch {
      entries = [];
    }
  }
  const byId = new Map();
  const byName = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const muscle = entry?.muscleGroup;
    if (!muscle) continue;
    if (entry._id) byId.set(String(entry._id), muscle);
    for (const name of [entry.name, entry.name_en]) {
      const key = String(name || '').trim().toLowerCase();
      if (key && !byName.has(key)) byName.set(key, muscle);
    }
  }
  const result = { byId, byName };
  if (!catalog) cached = result;
  return result;
}

export const nameKey = (name) => `name:${String(name || '').trim().toLowerCase()}`;

/** Datenbank-IDs, die nachgeschlagen werden müssen (nur echte ObjectIds). */
export function collectObjectIds(workouts) {
  const ids = new Set();
  for (const workout of workouts || []) {
    for (const ex of workout.exercises || []) {
      const id = String(ex?.exerciseId || '');
      if (OBJECT_ID_PATTERN.test(id)) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Map für buildMuscleSetFindings: Schlüssel = exerciseId bzw. "name:<kleingeschrieben>" (Fallback ohne ID).
 * @param {Array} workouts
 * @param {{ dbById?: Map<string,string>, catalog?: {byId: Map, byName: Map} }} sources
 */
export function buildMuscleMap(workouts, { dbById = new Map(), catalog = loadCatalogMuscles() } = {}) {
  const map = new Map();
  for (const workout of workouts || []) {
    for (const ex of workout.exercises || []) {
      const id = String(ex?.exerciseId || '');
      const muscle = (id && (dbById.get(id) || catalog.byId.get(id))) || catalog.byName.get(String(ex?.name || '').trim().toLowerCase());
      if (!muscle) continue;
      if (id) map.set(id, muscle);
      map.set(nameKey(ex?.name), muscle);
    }
  }
  return map;
}
