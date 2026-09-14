/**
 * Erzeugt (bzw. aktualisiert) den lokalen HTML-Report für den Qualitäts-Loop-Runner, ohne einen
 * neuen (kostenpflichtigen) Durchlauf zu starten - liest einfach die bestehende
 * scripts/evalResults/quality-loop-log.jsonl neu ein. qualityLoopRunner.js ruft dieselbe Logik
 * (lib/qualityLoopReportBuilder.js) bereits automatisch nach jedem Lauf auf; dieses Skript ist
 * für den Fall gedacht, dass man den Report erneut sehen möchte (z.B. nach manuellem
 * Zusammenführen mehrerer JSONL-Dateien), ohne extra einen neuen Lauf zu starten.
 *
 * Aufruf:
 *   node server/scripts/qualityLoopReport.js
 *   node server/scripts/qualityLoopReport.js --in=./meine-ergebnisse.jsonl --out=./report.html
 *
 * (npm-Skript: npm run quality-loop:report)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { generateReport } from './lib/qualityLoopReportBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : defaultValue;
}

const inPath = path.resolve(process.cwd(), parseArg('in', path.join(__dirname, 'evalResults', 'quality-loop-log.jsonl')));
const outPath = path.resolve(process.cwd(), parseArg('out', path.join(__dirname, 'evalResults', 'quality-loop-report.html')));

const { entryCount, outPath: written } = generateReport({ inPath, outPath });

if (entryCount === 0) {
  console.log(`⚠️  Keine Einträge in ${inPath} gefunden - Report wurde trotzdem (leer) erzeugt.`);
} else {
  console.log(`✅ Report mit ${entryCount} Einträgen erzeugt: ${written}`);
}
console.log(`Im Browser öffnen: file://${written}`);
