import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Sprache und Übungsnamen für das KI-Feedback (User-Report: App auf Englisch, Feedback-Text
// trotzdem Deutsch; Übungsnamen teils deutsch). Produktentscheidung: Übungsnamen sind in der
// gesamten App immer englisch (siehe client/src/utils/exerciseTranslation.js); der
// Feedback-Text folgt der App-Sprache.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(__dirname, '..', '..', 'client', 'public', 'data', 'default-exercises.json');

let catalogMap = null;

// Katalog bewusst ungefiltert laden (data/exercises.js kuratiert/filtert) - hier geht es nur um
// die Namenszuordnung, auch für Übungen, die aus der Auswahl-Liste herausgefiltert sind.
function loadCatalogMap() {
  if (catalogMap) return catalogMap;
  catalogMap = new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    for (const entry of Array.isArray(parsed) ? parsed : []) {
      const en = String(entry?.name_en || '').trim();
      if (!en) continue;
      const de = String(entry?.name || '').trim().toLowerCase();
      if (de) catalogMap.set(de, en);
      catalogMap.set(en.toLowerCase(), en);
    }
  } catch {
    // Kein Katalog verfügbar -> Namen bleiben unverändert (siehe resolveEnglishExerciseName).
  }
  return catalogMap;
}

// Nur für Tests: Katalog gezielt setzen.
export function __setCatalogForTests(entries) {
  catalogMap = new Map();
  for (const entry of entries || []) {
    const en = String(entry?.name_en || '').trim();
    if (!en) continue;
    if (entry.name) catalogMap.set(String(entry.name).trim().toLowerCase(), en);
    catalogMap.set(en.toLowerCase(), en);
  }
}

// Katalognamen sind klein geschrieben ("barbell romanian deadlift") - für den Fließtext
// "Barbell Romanian Deadlift".
export function toTitleCase(name) {
  return String(name || '')
    .split(/(\s+|-)/)
    .map((part) => (/^[a-zäöü]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

// Englischer Anzeigename einer Übung: DB-Feld names.en > Katalog > Originalname (eigene Übungen
// behalten den vom Nutzer vergebenen Namen).
export function resolveEnglishExerciseName(name, dbEnglishName = null) {
  const raw = String(name || '').trim();
  const fromDb = String(dbEnglishName || '').trim();
  if (fromDb) return toTitleCase(fromDb);
  const fromCatalog = loadCatalogMap().get(raw.toLowerCase());
  if (fromCatalog) return toTitleCase(fromCatalog);
  return raw;
}

// Sprache des Feedback-Texts aus dem Request: Body-Feld `language`, sonst Header
// `x-app-language`, sonst Accept-Language. Alles außer Englisch -> Deutsch (bisheriges Verhalten).
export function resolveFeedbackLanguage(req) {
  const candidates = [
    req?.body?.language,
    typeof req?.get === 'function' ? req.get('x-app-language') : req?.headers?.['x-app-language'],
    typeof req?.get === 'function' ? req.get('accept-language') : req?.headers?.['accept-language']
  ];
  for (const value of candidates) {
    const v = String(value || '').trim().toLowerCase();
    if (!v) continue;
    return v.startsWith('en') ? 'en' : 'de';
  }
  return 'de';
}

// Bringt die Aufzählungszeilen ("- Übung: ...") des Feedbacks in die Reihenfolge des Workouts
// (User-Report: Zusammenfassung begann mit der letzten Übung, weil der Prompt die Übungen auch
// nach Größe der Veränderung sortiert auflistet). Deterministisch statt nur per Prompt-Regel:
// jede zusammenhängende Gruppe von Aufzählungszeilen wird stabil nach der Position der darin
// genannten Übung sortiert. Zeilen ohne erkennbare Übung behalten ihre relative Position am
// Ende der Gruppe; der übrige Text bleibt unverändert.
export function reorderBulletLinesByExerciseOrder(text, orderedExerciseNames) {
  const names = (orderedExerciseNames || [])
    .map((n) => String(n || '').trim().toLowerCase())
    .filter(Boolean);
  if (!text || names.length < 2) return text;

  const lines = String(text).split('\n');
  const isBullet = (line) => /^\s*[-•*]\s+/.test(line);

  const positionOf = (line) => {
    const head = line.replace(/^\s*[-•*]\s+/, '').split(':')[0].replace(/\*\*/g, '').trim().toLowerCase();
    let best = -1;
    let bestLength = 0;
    names.forEach((name, index) => {
      // Längster Treffer gewinnt (z.B. "barbell squat" vs. "squat").
      const matches = head.includes(name) || (head.length >= 4 && name.includes(head));
      if (head && matches && name.length > bestLength) {
        best = index;
        bestLength = name.length;
      }
    });
    return best;
  };

  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (!isBullet(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    const group = [];
    while (i < lines.length && isBullet(lines[i])) {
      group.push({ line: lines[i], pos: positionOf(lines[i]), idx: group.length });
      i += 1;
    }
    group.sort((a, b) => {
      const pa = a.pos === -1 ? Number.MAX_SAFE_INTEGER : a.pos;
      const pb = b.pos === -1 ? Number.MAX_SAFE_INTEGER : b.pos;
      return pa - pb || a.idx - b.idx;
    });
    out.push(...group.map((g) => g.line));
  }
  return out.join('\n');
}

// Zusatz-Anweisung für die System-Prompts (Coach, Verifier, Korrektur). Der eigentliche Prompt
// ist deutsch formuliert und endet mit "Deutsch, warm, direkt..." - bei englischer App-Sprache
// wird das hier ausdrücklich überschrieben. Deutsch = bisheriges Verhalten, kein Zusatz.
export function languageDirective(language, role = 'coach') {
  if (language !== 'en') return '';
  if (role === 'verifier') {
    return `\n\nSPRACHE: Der zu prüfende Entwurf ist absichtlich auf ENGLISCH geschrieben (App-Sprache des Nutzers). Die Sprache selbst ist KEIN Regelverstoß; prüfe die Regeln inhaltlich wie gewohnt.`;
  }
  return `\n\nSPRACHE (hat Vorrang vor der Sprachangabe oben): Schreibe die GESAMTE Antwort auf ENGLISCH - natürliches, lockeres Englisch im selben warmen Coach-Ton, Dezimalzahlen mit Punkt (z.B. 2.5kg). Übungsnamen exakt so übernehmen, wie sie in den Daten stehen (englisch). Kein einziges deutsches Wort.`;
}

// Reihenfolge-Regel als Prompt-Zusatz (ergänzt die deterministische Sortierung oben).
export const EXERCISE_ORDER_DIRECTIVE = `\n\nREIHENFOLGE: Nenne die Übungen in den Aufzählungszeilen in derselben Reihenfolge wie im Workout (Nummerierung unter "Detaillierte Übungsdaten") - NICHT nach Größe der Veränderung sortieren.`;
