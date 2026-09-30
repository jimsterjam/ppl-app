import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Zuordnung von Übungsnamen zum Katalog - dieselbe Logik wie in der App
// (client/src/utils/exerciseMatch.js: ID, Namen, frühere Namen, unabhängig von der Wortreihenfolge).
// Fehlt die Client-Datei, gibt es einfach keine Katalog-Zuordnung (bisheriges Verhalten).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATCH_PATH = path.resolve(__dirname, '..', '..', 'client', 'src', 'utils', 'exerciseMatch.js');

let matcher = null;
try {
  matcher = await import(pathToFileURL(MATCH_PATH).href);
} catch {
  matcher = null;
}

const indexCache = new WeakMap();

function indexFor(catalog) {
  if (!matcher || !Array.isArray(catalog)) return null;
  if (!indexCache.has(catalog)) indexCache.set(catalog, matcher.buildCatalogIndex(catalog));
  return indexCache.get(catalog);
}

/** Katalogeintrag zu einem Namen oder null. */
export function findCatalogEntryForName(catalog, name) {
  const index = indexFor(catalog);
  return index ? matcher.findCatalogEntryByName(index, name) : null;
}

/** Katalog-Referenz für Workouts: { exerciseId: 'ex_0025', name: 'bench press barbell' }. */
export function catalogReference(entry) {
  if (!entry) return null;
  return {
    exerciseId: String(entry._id || `ex_${entry.id}`),
    name: String(entry.name_en || entry.name)
  };
}
