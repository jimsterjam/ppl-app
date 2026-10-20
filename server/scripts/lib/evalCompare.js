/**
 * Vergleich zweier Läufe des Qualitäts-Loops (scripts/qualityLoopRunner.js, JSONL-Dateien): z. B. vor und nach
 * einer Prompt-, Modell- oder Regeländerung. Reine Auswertung, kein KI-Aufruf, keine Kosten.
 */

const REGRESSION_POINTS = 10; // ab so vielen Prozentpunkten mehr Verstöße gilt ein Szenario/eine Regel als Verschlechterung

function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function pct(part, total) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function summarize(entries) {
  const valid = entries.filter((e) => !e.error);
  const runs = valid.length;
  const withViolation = valid.filter((e) => (e.originalTriggeredRules || []).length > 0).length;
  const finalViolation = valid.filter((e) => (e.triggeredRules || []).length > 0).length;
  const revisions = valid.filter((e) => e.revisionAttempted).length;
  const revisionOk = valid.filter((e) => e.revisionSucceeded === true).length;
  const wordCounts = valid.map((e) => words(e.finalFeedbackText));
  const byRule = {};
  for (const e of valid) {
    for (const rule of new Set(e.originalTriggeredRules || [])) byRule[rule] = (byRule[rule] || 0) + 1;
  }
  return {
    runs,
    errors: entries.length - runs,
    violationRate: pct(withViolation, runs),
    finalViolationRate: pct(finalViolation, runs),
    revisionRate: pct(revisions, runs),
    revisionSuccessRate: pct(revisionOk, revisions),
    avgWords: runs ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / runs) : 0,
    byRule: Object.fromEntries(Object.entries(byRule).map(([rule, n]) => [rule, { count: n, rate: pct(n, runs) }]))
  };
}

/**
 * @param {Array<Object>} entriesA - Baseline (vorher)
 * @param {Array<Object>} entriesB - neuer Lauf (nachher)
 * @returns {{a:Object,b:Object,rules:Array,scenarios:Array,regressions:Array<string>}}
 */
export function compareRuns(entriesA, entriesB) {
  const a = summarize(entriesA);
  const b = summarize(entriesB);

  const ruleIds = [...new Set([...Object.keys(a.byRule), ...Object.keys(b.byRule)])].sort((x, y) => Number(x) - Number(y));
  const rules = ruleIds.map((rule) => {
    const before = a.byRule[rule]?.rate ?? 0;
    const after = b.byRule[rule]?.rate ?? 0;
    return { rule: Number(rule), before, after, delta: Math.round((after - before) * 10) / 10 };
  });

  const names = [...new Set([...entriesA, ...entriesB].map((e) => e.scenario))].sort();
  const scenarios = names.map((name) => {
    const sa = summarize(entriesA.filter((e) => e.scenario === name));
    const sb = summarize(entriesB.filter((e) => e.scenario === name));
    return {
      scenario: name,
      runsBefore: sa.runs,
      runsAfter: sb.runs,
      before: sa.violationRate,
      after: sb.violationRate,
      delta: Math.round((sb.violationRate - sa.violationRate) * 10) / 10
    };
  });

  const regressions = [];
  if (b.violationRate - a.violationRate >= REGRESSION_POINTS) {
    regressions.push(`Gesamt: Verstoßrate ${a.violationRate} % -> ${b.violationRate} %`);
  }
  for (const r of rules) {
    if (r.delta >= REGRESSION_POINTS) regressions.push(`Regel ${r.rule}: ${r.before} % -> ${r.after} %`);
  }
  for (const s of scenarios) {
    if (s.runsBefore && s.runsAfter && s.delta >= REGRESSION_POINTS) {
      regressions.push(`Szenario „${s.scenario}“: ${s.before} % -> ${s.after} %`);
    }
  }
  if (b.errors > a.errors) regressions.push(`Mehr fehlgeschlagene Läufe: ${a.errors} -> ${b.errors}`);

  return { a, b, rules, scenarios, regressions };
}

export function formatComparison(result) {
  const { a, b, rules, scenarios, regressions } = result;
  const arrow = (x, y) => `${x} -> ${y}`;
  const lines = [
    '# Vergleich der Qualitäts-Loop-Läufe',
    '',
    '| Kennzahl | Vorher | Nachher |',
    '|---|---|---|',
    `| Läufe (ohne Fehler) | ${a.runs} | ${b.runs} |`,
    `| Fehlgeschlagene Läufe | ${a.errors} | ${b.errors} |`,
    `| Verstoßrate (Original-Text) | ${a.violationRate} % | ${b.violationRate} % |`,
    `| Verstoßrate nach Korrektur | ${a.finalViolationRate} % | ${b.finalViolationRate} % |`,
    `| Korrekturversuche | ${a.revisionRate} % | ${b.revisionRate} % |`,
    `| Korrektur erfolgreich | ${a.revisionSuccessRate} % | ${b.revisionSuccessRate} % |`,
    `| Ø Wörter | ${a.avgWords} | ${b.avgWords} |`,
    ''
  ];
  if (rules.length) {
    lines.push('## Verstöße je Regel', '', '| Regel | Vorher | Nachher | Änderung |', '|---|---|---|---|');
    for (const r of rules) lines.push(`| ${r.rule} | ${r.before} % | ${r.after} % | ${r.delta > 0 ? '+' : ''}${r.delta} |`);
    lines.push('');
  }
  lines.push('## Je Szenario', '', '| Szenario | Läufe | Vorher | Nachher | Änderung |', '|---|---|---|---|---|');
  for (const s of scenarios) {
    lines.push(`| ${s.scenario} | ${arrow(s.runsBefore, s.runsAfter)} | ${s.before} % | ${s.after} % | ${s.delta > 0 ? '+' : ''}${s.delta} |`);
  }
  lines.push('', regressions.length ? '## ⚠️ Verschlechterungen' : '## Keine Verschlechterung ab 10 Prozentpunkten', '');
  for (const r of regressions) lines.push(`- ${r}`);
  return lines.join('\n') + '\n';
}
