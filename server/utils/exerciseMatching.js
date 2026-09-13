/**
 * exerciseMatching
 *
 * Fuzzy-Namensabgleich für vom KI-Quick-Generator (routes/workouts.js, POST /quick-generator)
 * vorgeschlagene Übungsnamen gegen die bestehende Exercise-Datenbank.
 *
 * Hintergrund: der Quick-Generator schickt der KI keine Übungsliste zur Auswahl - sie liefert
 * Übungsnamen frei formuliert zurück (siehe generateQuickGeneratorWithOpenAI). Bisher wurde nur
 * exakt (case-insensitive) gegen die DB abgeglichen (validateAndMapExercisesWithAutoAdd); ein
 * abweichender Name blieb unverknüpfter Freitext ohne exerciseId - kein Icon, keine
 * Muskelgruppen-Auswertung, keine profilbasierten Coaching-Regeln für diese Übung.
 *
 * Diese reinen, DB-freien Funktionen entscheiden für einen Namen, welcher von drei Fällen
 * vorliegt (die eigentliche DB-Anbindung - Suche der Kandidaten, Anlegen neuer Übungen - sitzt
 * bewusst in routes/workouts.js, damit diese Kernlogik hier isoliert testbar bleibt, siehe
 * __tests__/exerciseMatching.test.js):
 *
 * 1. 'exact'   - Name entspricht (nach Normalisierung) exakt einer vorhandenen Übung.
 *                -> vorhandene Übung wiederverwenden, NICHTS Neues anlegen.
 * 2. 'similar' - Name ähnelt einer vorhandenen Übung deutlich (z.B. "Schrägbankdrücken" bei
 *                vorhandenem "Bankdrücken"), ist aber keine bloße Schreib-/Mehrsprachigkeits-
 *                variante. -> wird als NEUE Übung angelegt, mit einem Verweis (similarTo) auf
 *                die ähnlichste bestehende Übung - bewusst KEIN automatisches Merge/Update der
 *                bestehenden Übung, da eine Namens-Ähnlichkeit allein nicht beweist, dass es
 *                dieselbe Bewegung ist.
 * 3. 'none'    - keine nennenswerte Ähnlichkeit zu irgendeiner vorhandenen Übung.
 *                -> wird als komplett neue Übung angelegt, similarTo bleibt null.
 */

// Ab diesem Ähnlichkeitswert (0-1) gilt ein Name als "ähnlich" (Fall 2) statt "neu" (Fall 3).
// Empirisch gewählt (siehe __tests__/exerciseMatching.test.js): deutsche Übungsnamen-Varianten
// wie "Bankdrücken"/"Schrägbankdrücken" (0.65) oder "Kniebeuge"/"Kniebeugen" (0.90) liegen
// darüber, komplett unterschiedliche Übungsnamen (z.B. "Bankdrücken" vs. "Kreuzheben", 0.18)
// deutlich darunter. Bekannte Grenze: rein zeichenbasierte Levenshtein-Ähnlichkeit erkennt
// Komposita mit vertauschter Wortreihenfolge nicht (z.B. "Kurzhantelrudern" vs.
// "Rudern Langhantel" landet unter der Schwelle, obwohl beides Rudervarianten sind) - das ist
// als bekannte Einschränkung akzeptiert, kein Blocker für diese erste Stufe.
export const SIMILARITY_THRESHOLD = 0.6;

// Ab hier gilt ein Treffer als "exakt" - knapp unter 1, damit rein numerische Rundungsfehler
// (hier eigentlich nicht relevant, da similarityRatio exakt gleiche normalisierte Strings immer
// zu genau 1 macht) keine falschen 'similar'-Einstufungen für eigentlich identische Namen
// erzeugen.
const EXACT_THRESHOLD = 0.999;

/**
 * Normalisiert einen Übungsnamen für den Vergleich: trimmen, klein schreiben, Binde-/
 * Unterstriche zu Leerzeichen, mehrfache Leerzeichen zusammenfassen. Bewusst KEINE Umlaut-
 * Transliteration (ä->ae etc.) - das würde z.B. "Überzüge" und "Uberzuge" gleichsetzen, aber
 * auch das Risiko falscher Gleichsetzungen erhöhen; die Levenshtein-Ähnlichkeit toleriert
 * einzelne abweichende Zeichen ohnehin.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeExerciseName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Klassische Levenshtein-Distanz (minimale Anzahl Einfügungen/Löschungen/Ersetzungen, um
 * String a in String b zu verwandeln). Keine externe Abhängigkeit nötig für diese
 * Größenordnung (kurze Übungsnamen, wenige Wörter).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  const s1 = String(a ?? '');
  const s2 = String(b ?? '');
  const rows = s1.length + 1;
  const cols = s2.length + 1;

  // Nur zwei Zeilen statt der vollen Matrix halten - reicht für Levenshtein und spart
  // Speicher, ist bei den hier üblichen kurzen Namen aber ohnehin nicht spürbar.
  let previousRow = Array.from({ length: cols }, (_, j) => j);
  let currentRow = new Array(cols).fill(0);

  for (let i = 1; i < rows; i++) {
    currentRow[0] = i;
    for (let j = 1; j < cols; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        currentRow[j] = previousRow[j - 1];
      } else {
        currentRow[j] = Math.min(
          previousRow[j] + 1,     // Löschen
          currentRow[j - 1] + 1,  // Einfügen
          previousRow[j - 1] + 1  // Ersetzen
        );
      }
    }
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[cols - 1];
}

/**
 * Ähnlichkeit zweier Namen als Wert zwischen 0 (komplett verschieden) und 1 (identisch nach
 * Normalisierung), auf Basis der Levenshtein-Distanz relativ zur Länge des längeren Namens.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function similarityRatio(a, b) {
  const n1 = normalizeExerciseName(a);
  const n2 = normalizeExerciseName(b);
  if (!n1 && !n2) return 1;
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;

  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(n1, n2);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Vergleicht einen (von der KI vorgeschlagenen) Übungsnamen gegen eine Liste bestehender
 * Übungen und entscheidet, welcher der drei Fälle (siehe Modul-Kommentar) vorliegt. Prüft pro
 * Kandidat ALLE bekannten Namensvarianten (name, names.de, names.en) und nimmt die beste
 * Übereinstimmung über alle Kandidaten/Varianten hinweg.
 *
 * @param {string} candidateName - Name aus dem KI-Vorschlag
 * @param {Array<{ id: string, names: string[] }>} existingExercises - vorhandene Übungen
 * @returns {{
 *   matchType: 'exact'|'similar'|'none',
 *   match: { id: string, names: string[] } | null,
 *   score: number
 * }}
 */
export function decideExerciseMatch(candidateName, existingExercises = []) {
  let best = null;
  let bestScore = 0;

  for (const existing of existingExercises) {
    for (const name of existing?.names || []) {
      const score = similarityRatio(candidateName, name);
      if (score > bestScore) {
        bestScore = score;
        best = existing;
      }
    }
  }

  if (best && bestScore >= EXACT_THRESHOLD) {
    return { matchType: 'exact', match: best, score: bestScore };
  }
  if (best && bestScore >= SIMILARITY_THRESHOLD) {
    return { matchType: 'similar', match: best, score: bestScore };
  }
  return { matchType: 'none', match: null, score: bestScore };
}

export default {
  SIMILARITY_THRESHOLD,
  normalizeExerciseName,
  levenshteinDistance,
  similarityRatio,
  decideExerciseMatch
};
