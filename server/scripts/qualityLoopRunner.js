/**
 * Qualitäts-Loop-Runner: der ursprünglich vorgeschlagene "Loop" (siehe Kommentar unten) - im
 * Unterschied zu evalRunner.js (reines Regressionswerkzeug gegen feste, handgeschriebene
 * Entwurfstexte) macht DIESER Runner pro Durchlauf einen ECHTEN Generierungs-Call gegen die
 * OpenAI API (über den Relay, siehe utils/aiClientFactory.js), lässt das Ergebnis prüfen und bei
 * Bedarf korrigieren (feedbackVerificationService.js), und wiederholt das über mehrere
 * Durchläufe je Mock-Workout-Szenario (evalCases/mockWorkoutScenarios.js) - um dabei zu
 * beobachten, WIE OFT und bei WELCHEN Regeln der echte Generator abweicht, und wie zuverlässig
 * die aktive Korrektur (reviseFeedback) das behebt.
 *
 * Das ist bewusst ein eigenständiges, manuell gestartetes Skript, KEIN Teil von CI oder des
 * Produktions-Requests (routes/workouts.js) - jeder Durchlauf kostet einen echten (bzw. bei
 * gefundenem Verstoß bis zu drei) OpenAI-Calls, und der Relay-Kaltstart (Render Free-Tier) kann
 * die Laufzeit spürbar verlängern (siehe ensureRelayAwake in utils/aiClientFactory.js).
 *
 * WICHTIG: schreibt NICHTS in die Produktions-Datenbank (VerifierAudit) - Ergebnisse landen
 * ausschließlich in einer lokalen JSONL-Datei (server/scripts/evalResults/quality-loop-log.jsonl,
 * anhängend, ein JSON-Objekt pro Zeile), damit Test-Läufe nicht mit echten Nutzer-Statistiken
 * vermischt werden. Läuft daher auch OHNE MongoDB-Verbindung.
 *
 * Aufruf:
 *   node server/scripts/qualityLoopRunner.js
 *   node server/scripts/qualityLoopRunner.js --iterations=5
 *   node server/scripts/qualityLoopRunner.js --scenarios="Gemischte Sätze,Speed Squats"
 *   node server/scripts/qualityLoopRunner.js --out=./meine-ergebnisse.jsonl
 *
 * (npm-Skript: npm run quality-loop -- --iterations=5)
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAIProvider } from '../services/OpenAIProvider.js';
import {
  runDeterministicChecks,
  verifyFeedbackWithAI,
  reviseFeedback,
  getRuleLabel
} from '../services/feedbackVerificationService.js';
import { mockWorkoutScenarios } from './evalCases/mockWorkoutScenarios.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// --- CLI-Argumente -------------------------------------------------------------------------
function parseArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : defaultValue;
}

const ITERATIONS = Math.max(1, Number(parseArg('iterations', 3)) || 3);
const OUT_PATH = path.resolve(process.cwd(), parseArg('out', path.join(__dirname, 'evalResults', 'quality-loop-log.jsonl')));
const scenarioFilterRaw = parseArg('scenarios', null);
const scenarioFilter = scenarioFilterRaw
  ? scenarioFilterRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : null;

const scenarios = scenarioFilter
  ? mockWorkoutScenarios.filter((s) => scenarioFilter.some((f) => s.name.toLowerCase().includes(f)))
  : mockWorkoutScenarios;

function sortedUnique(nums) {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function formatRules(rules) {
  if (rules.length === 0) return '(keine)';
  return rules.map((r) => `${r} [${getRuleLabel(r)}]`).join(', ');
}

function appendResult(entry) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.appendFileSync(OUT_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * Ein einzelner Durchlauf: echte Generierung -> Prüfung -> ggf. EIN Korrekturversuch mit
 * Re-Prüfung. Spiegelt die Orchestrierung aus feedbackVerificationService.runVerificationLoop()
 * ('active'-Zweig), aber ohne die dortige VerifierAudit-Persistierung (siehe Modul-Kommentar
 * oben) - stattdessen wird hier der komplette Datensatz (inkl. Originaltext) lokal protokolliert.
 */
async function runOnce(provider, scenario, iteration) {
  const requestId = `qloop_${scenario.name.slice(0, 20).replace(/\W+/g, '_')}_${iteration}_${Date.now()}`;
  const startedAt = new Date().toISOString();

  const originalFeedbackText = await provider.generateTrainingAnalysis(scenario.structuredAnalysis, { requestId });

  const deterministic = runDeterministicChecks(originalFeedbackText, scenario.structuredAnalysis);

  let aiResult = null;
  let aiCheckFailed = false;
  try {
    aiResult = await verifyFeedbackWithAI(scenario.structuredAnalysis, originalFeedbackText, {
      requestId,
      deterministicViolations: deterministic.violations
    });
  } catch (error) {
    aiCheckFailed = true;
    console.log(`    ⚠️  KI-Prüfung fehlgeschlagen: ${error.message}`);
  }

  const allViolations = [...deterministic.violations, ...(aiResult?.violations || [])];
  let triggeredRules = sortedUnique(allViolations.map((v) => v.rule).filter(Boolean));
  const hasViolation = !deterministic.ok || (aiCheckFailed ? false : !(aiResult?.ok ?? true));

  let revisionAttempted = false;
  let revisionSucceeded = null;
  let revisedFeedbackText = null;
  let finalFeedbackText = originalFeedbackText;

  if (hasViolation && allViolations.length > 0) {
    revisionAttempted = true;
    try {
      revisedFeedbackText = await reviseFeedback(scenario.structuredAnalysis, originalFeedbackText, allViolations, { requestId });

      const revisedDeterministic = runDeterministicChecks(revisedFeedbackText, scenario.structuredAnalysis);
      let revisedAiResult = null;
      let revisedAiCheckFailed = false;
      try {
        revisedAiResult = await verifyFeedbackWithAI(scenario.structuredAnalysis, revisedFeedbackText, {
          requestId,
          deterministicViolations: revisedDeterministic.violations
        });
      } catch (error) {
        revisedAiCheckFailed = true;
        console.log(`    ⚠️  Re-Prüfung der Korrektur fehlgeschlagen: ${error.message}`);
      }

      const revisedOk = revisedDeterministic.ok && (revisedAiCheckFailed || (revisedAiResult?.ok ?? true));
      if (revisedOk) {
        revisionSucceeded = true;
        finalFeedbackText = revisedFeedbackText;
        triggeredRules = [];
      } else {
        revisionSucceeded = false;
        const revisedViolations = [...revisedDeterministic.violations, ...(revisedAiResult?.violations || [])];
        triggeredRules = sortedUnique([...triggeredRules, ...revisedViolations.map((v) => v.rule).filter(Boolean)]);
      }
    } catch (error) {
      revisionSucceeded = false;
      console.log(`    ⚠️  Korrektur fehlgeschlagen: ${error.message}`);
    }
  }

  const entry = {
    requestId,
    startedAt,
    scenario: scenario.name,
    iteration,
    deterministicOk: deterministic.ok,
    aiOk: aiCheckFailed ? null : (aiResult?.ok ?? null),
    aiCheckFailed,
    triggeredRules,
    revisionAttempted,
    revisionSucceeded,
    originalFeedbackText,
    revisedFeedbackText,
    finalFeedbackText
  };

  appendResult(entry);
  return entry;
}

async function main() {
  if (scenarios.length === 0) {
    console.log('❌ Kein Szenario passt zum --scenarios-Filter. Verfügbare Szenarien:');
    mockWorkoutScenarios.forEach((s) => console.log(`  - ${s.name}`));
    process.exitCode = 1;
    return;
  }

  const totalRuns = scenarios.length * ITERATIONS;
  console.log(`Qualitäts-Loop-Runner: ${scenarios.length} Szenario(s) × ${ITERATIONS} Durchlauf/Durchläufe = ${totalRuns} echte(r) Generierungs-Call(s).`);
  console.log(`Ergebnisse werden angehängt an: ${OUT_PATH}\n`);

  if (!process.env.OPENAI_API_KEY && !process.env.AI_RELAY_URL) {
    console.log('❌ Weder OPENAI_API_KEY noch AI_RELAY_URL konfiguriert - Generierung wird fehlschlagen. Abbruch.');
    process.exitCode = 1;
    return;
  }

  const provider = new OpenAIProvider();
  if (!provider.client) {
    console.log('❌ OpenAI-Client konnte nicht initialisiert werden (siehe Log oben). Abbruch.');
    process.exitCode = 1;
    return;
  }

  const ruleCounts = {};
  let violationRuns = 0;
  let revisionAttempts = 0;
  let revisionSuccesses = 0;
  let hardFailures = 0;
  let completedRuns = 0;

  for (const scenario of scenarios) {
    console.log(`▶ ${scenario.name}`);
    for (let i = 1; i <= ITERATIONS; i++) {
      try {
        const result = await runOnce(provider, scenario, i);
        completedRuns++;

        if (result.triggeredRules.length > 0) {
          violationRuns++;
          for (const rule of result.triggeredRules) {
            ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
          }
        }
        if (result.revisionAttempted) {
          revisionAttempts++;
          if (result.revisionSucceeded) revisionSuccesses++;
        }

        const status = result.triggeredRules.length === 0
          ? (result.revisionAttempted ? '✅ korrigiert' : '✅ sauber')
          : `❌ Regel(n) ${formatRules(result.triggeredRules)}`;
        console.log(`  [${i}/${ITERATIONS}] ${status}`);
      } catch (error) {
        hardFailures++;
        console.log(`  [${i}/${ITERATIONS}] ⚠️  Durchlauf abgebrochen (Fehler): ${error.message}`);
        appendResult({
          requestId: `qloop_error_${Date.now()}`,
          startedAt: new Date().toISOString(),
          scenario: scenario.name,
          iteration: i,
          error: error.message
        });
      }
    }
  }

  console.log('\n--- Zusammenfassung -------------------------------------------------------');
  console.log(`Abgeschlossene Durchläufe: ${completedRuns}/${totalRuns}${hardFailures > 0 ? ` (${hardFailures} Fehler/Abbrüche)` : ''}`);
  console.log(`Durchläufe mit mind. einem (letztlich ungelösten) Regelverstoß: ${violationRuns}/${completedRuns}`);
  if (revisionAttempts > 0) {
    console.log(`Korrektur-Versuche: ${revisionAttempts}, davon erfolgreich: ${revisionSuccesses} (${Math.round((revisionSuccesses / revisionAttempts) * 100)}%)`);
  } else {
    console.log('Korrektur-Versuche: 0 (kein Durchlauf hat einen Verstoß ausgelöst)');
  }

  const sortedRules = Object.keys(ruleCounts).map(Number).sort((a, b) => ruleCounts[b] - ruleCounts[a]);
  if (sortedRules.length > 0) {
    console.log('\nHäufigkeit je Regel (nach ggf. gescheiterter Korrektur):');
    for (const rule of sortedRules) {
      console.log(`  Regel ${rule}: ${ruleCounts[rule]}× - ${getRuleLabel(rule)}`);
    }
  }

  console.log(`\nVollständige Rohdaten (ein JSON-Objekt pro Durchlauf): ${OUT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Qualitäts-Loop-Runner abgebrochen:', error);
    process.exit(1);
  });
