/**
 * Vergleicht zwei Läufe des Qualitäts-Loops (JSONL aus scripts/qualityLoopRunner.js), z. B. vor/nach einer
 * Prompt-, Modell- oder Regeländerung. Kostet nichts (reine Auswertung, kein KI-Aufruf).
 *
 * Ablauf:
 *   1. Baseline: npm run quality-loop -- --iterations=3 --out=./baseline.jsonl     (echte KI-Aufrufe, kostet Geld)
 *   2. Änderung machen
 *   3. Neuer Lauf: npm run quality-loop -- --iterations=3 --out=./neu.jsonl
 *   4. npm run eval:compare -- --a=./baseline.jsonl --b=./neu.jsonl [--out=./vergleich.md]
 *
 * Exit-Code 1, wenn eine Verschlechterung (>= 10 Prozentpunkte mehr Verstöße) gefunden wurde.
 */
import fs from 'fs';
import path from 'path';
import { readEntries } from './lib/qualityLoopReportBuilder.js';
import { compareRuns, formatComparison } from './lib/evalCompare.js';

function parseArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? path.resolve(process.cwd(), found.slice(prefix.length)) : null;
}

const aPath = parseArg('a');
const bPath = parseArg('b');
const outPath = parseArg('out');

if (!aPath || !bPath) {
  console.log('Aufruf: node scripts/evalCompare.js --a=<baseline.jsonl> --b=<neu.jsonl> [--out=<vergleich.md>]');
  process.exit(2);
}

const entriesA = readEntries(aPath);
const entriesB = readEntries(bPath);
if (entriesA.length === 0 || entriesB.length === 0) {
  console.log(`Keine Einträge gefunden (a: ${entriesA.length}, b: ${entriesB.length}). Pfade prüfen.`);
  process.exit(2);
}

const result = compareRuns(entriesA, entriesB);
const text = formatComparison(result);
console.log(text);
if (outPath) {
  fs.writeFileSync(outPath, text, 'utf8');
  console.log(`Gespeichert: ${outPath}`);
}
process.exit(result.regressions.length ? 1 : 0);
