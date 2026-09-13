/**
 * Eval-Runner: Feedback-Qualitäts-Loop (services/feedbackVerificationService.js)
 *
 * Reines Regressionswerkzeug für die Verifier-Logik selbst - prüft anhand fester,
 * handkuratierter Fälle (scripts/evalCases/feedbackQualityCases.js), ob der Verifier bekannte
 * Regelverstöße weiterhin (bzw. noch) erkennt. Kein Test-Framework-Ersatz für die reinen
 * Funktionstests (die liegen in utils/__tests__/feedbackVerificationService.test.js) - dieser
 * Runner ist eher ein Eval/Dashboard-Skript: es soll auf einen Blick zeigen, WELCHE Fälle
 * bestehen, in menschenlesbarer Form, und optional live gegen die echte KI-Prüfung laufen.
 *
 * Zwei Modi:
 * 1. Standard (kein Flag): nur der deterministische Check (runDeterministicChecks) - braucht
 *    KEINEN OPENAI_API_KEY, läuft komplett offline/lokal. Das ist ein HARTES Kriterium: weicht
 *    ein Fall vom erwarteten Ergebnis ab, beendet sich der Runner mit Exit-Code 1 (z.B. für CI).
 * 2. `--with-ai`: zusätzlich der echte KI-Prüfaufruf (verifyFeedbackWithAI) - braucht
 *    OPENAI_API_KEY (oder AI_RELAY_URL+AI_RELAY_SHARED_SECRET, siehe utils/aiClientFactory.js).
 *    Das Ergebnis ist NUR eine Warnung (kein Exit-Code-Fehler), da LLM-Antworten nicht 100%
 *    reproduzierbar sind - hier geht es darum, grobe Regressionen sichtbar zu machen (z.B.
 *    "die KI-Prüfung erkennt Regel-3-Verstöße plötzlich gar nicht mehr").
 *
 * Aufruf:
 *   node server/scripts/evalRunner.js                 (npm run eval)
 *   node server/scripts/evalRunner.js --with-ai        (npm run eval:ai)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  runDeterministicChecks,
  verifyFeedbackWithAI,
  getRuleLabel
} from '../services/feedbackVerificationService.js';
import { feedbackQualityCases } from './evalCases/feedbackQualityCases.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const withAi = process.argv.includes('--with-ai');

function sortedUnique(nums) {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function formatRules(rules) {
  if (rules.length === 0) return '(keine)';
  return rules.map((r) => `${r} [${getRuleLabel(r)}]`).join(', ');
}

async function runCase(testCase) {
  const { name, structuredAnalysis, draftText, expectedDeterministicRules, expectSeverity } = testCase;

  console.log(`\n▶ ${name}`);

  // --- Stufe 1: deterministischer Check (immer, kein API-Key nötig) ---------------------------
  const deterministic = runDeterministicChecks(draftText, structuredAnalysis);
  const foundDetRules = sortedUnique(deterministic.violations.map((v) => v.rule));
  const detOk = arraysEqual(foundDetRules, sortedUnique(expectedDeterministicRules));

  if (detOk) {
    console.log(`  ✅ deterministisch: wie erwartet (${formatRules(foundDetRules)})`);
  } else {
    console.log(`  ❌ deterministisch: erwartet ${formatRules(expectedDeterministicRules)}, gefunden ${formatRules(foundDetRules)}`);
  }

  // --- Stufe 2: optionaler KI-Prüfaufruf (nur mit --with-ai) -----------------------------------
  let aiWarning = false;
  if (withAi) {
    try {
      const aiResult = await verifyFeedbackWithAI(structuredAnalysis, draftText, {
        requestId: `eval_${Date.now()}`,
        deterministicViolations: deterministic.violations
      });
      const aiRules = sortedUnique(aiResult.violations.map((v) => v.rule));
      const expectedClean = expectSeverity === 'clean';
      const matchesExpectation = expectedClean ? aiResult.ok : !aiResult.ok;

      if (matchesExpectation) {
        console.log(`  ✅ KI-Prüfung: wie erwartet (ok=${aiResult.ok}, Regeln: ${formatRules(aiRules)})`);
      } else {
        aiWarning = true;
        console.log(`  ⚠️  KI-Prüfung: WEICHT AB von Erwartung "${expectSeverity}" (ok=${aiResult.ok}, Regeln: ${formatRules(aiRules)}) - nur Warnung, kein Hard-Fail (LLM-Nichtdeterminismus)`);
      }
    } catch (error) {
      aiWarning = true;
      console.log(`  ⚠️  KI-Prüfung fehlgeschlagen: ${error.message}`);
    }
  }

  return { detOk, aiWarning };
}

async function main() {
  console.log(`Eval-Runner: Feedback-Qualitäts-Loop (${feedbackQualityCases.length} Fälle, Modus: ${withAi ? 'deterministisch + KI' : 'nur deterministisch'})`);

  if (withAi && !process.env.OPENAI_API_KEY && !process.env.AI_RELAY_URL) {
    console.log('⚠️  --with-ai gesetzt, aber weder OPENAI_API_KEY noch AI_RELAY_URL konfiguriert - KI-Prüfungen werden fehlschlagen.');
  }

  let detFailures = 0;
  let aiWarnings = 0;

  for (const testCase of feedbackQualityCases) {
    const { detOk, aiWarning } = await runCase(testCase);
    if (!detOk) detFailures++;
    if (aiWarning) aiWarnings++;
  }

  console.log(`\n${feedbackQualityCases.length - detFailures}/${feedbackQualityCases.length} Fälle deterministisch wie erwartet.`);
  if (withAi) {
    console.log(`${feedbackQualityCases.length - aiWarnings}/${feedbackQualityCases.length} Fälle KI-Prüfung wie erwartet (weiche Kennzahl).`);
  }

  if (detFailures > 0) {
    console.log('\n❌ Eval fehlgeschlagen: mindestens ein deterministischer Fall weicht vom erwarteten Ergebnis ab.');
    process.exitCode = 1;
  } else {
    console.log('\n✅ Alle deterministischen Fälle bestanden.');
  }
}

main().catch((error) => {
  console.error('Eval-Runner abgebrochen:', error);
  process.exitCode = 1;
});
