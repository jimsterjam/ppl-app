/**
 * Baut aus den JSONL-Rohdaten des Qualitäts-Loop-Runners (scripts/qualityLoopRunner.js,
 * scripts/evalResults/quality-loop-log.jsonl) einen einzelnen, eigenständigen HTML-Report -
 * keine externen Abhängigkeiten, kein Server nötig, einfach lokal im Browser öffnen
 * (file://.../quality-loop-report.html).
 *
 * Bewusst als eigenständiges, wiederverwendbares Modul (statt Code-Duplikat in
 * qualityLoopRunner.js und qualityLoopReport.js): der Runner generiert nach jedem Lauf
 * automatisch einen aktuellen Report, das separate CLI-Skript (qualityLoopReport.js) erlaubt
 * es zusätzlich, den Report jederzeit ohne neuen Durchlauf neu zu erzeugen (z.B. nach manuellem
 * Editieren/Zusammenführen mehrerer JSONL-Dateien).
 */

import fs from 'fs';
import path from 'path';

/**
 * @param {string} jsonlPath
 * @returns {Array<Object>} geparste Zeilen, fehlerhafte/leere Zeilen werden übersprungen
 */
export function readEntries(jsonlPath) {
  if (!fs.existsSync(jsonlPath)) return [];
  const raw = fs.readFileSync(jsonlPath, 'utf8');
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Unvollständige letzte Zeile (z.B. Skript währenddessen abgebrochen) - überspringen statt
      // den ganzen Report daran scheitern zu lassen.
    }
  }
  return entries;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {Array<Object>} entries
 * @param {Object<string, Array>} [learnedExamplesByRule] - aktueller Stand der Selbstlern-
 *   Bibliothek (scripts/lib/learnedExamplesStore.js), nur zur Anzeige.
 * @returns {string} vollständiges HTML-Dokument
 */
export function buildReportHtml(entries, learnedExamplesByRule = {}) {
  const validEntries = entries.filter((e) => !e.error);
  const errorEntries = entries.filter((e) => e.error);

  const scenarios = [...new Set(entries.map((e) => e.scenario))].sort();
  const allRules = [...new Set(validEntries.flatMap((e) => e.triggeredRules || []))].sort((a, b) => a - b);

  const totalRuns = validEntries.length;
  const violationRuns = validEntries.filter((e) => (e.triggeredRules || []).length > 0).length;
  const revisionAttempts = validEntries.filter((e) => e.revisionAttempted).length;
  const revisionSuccesses = validEntries.filter((e) => e.revisionSucceeded === true).length;

  const ruleCounts = {};
  for (const e of validEntries) {
    for (const rule of e.triggeredRules || []) {
      ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
    }
  }

  const dataJson = JSON.stringify(entries).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Qualitäts-Loop-Report</title>
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --border: #2a2e38; --text: #e6e8ec; --muted: #93989f;
    --ok: #3ecf8e; --warn: #f5a623; --bad: #ef5b5b; --accent: #6c8cff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
  header { padding: 20px 28px; border-bottom: 1px solid var(--border); }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .sub { color: var(--muted); font-size: 13px; }
  .stats { display: flex; gap: 14px; flex-wrap: wrap; padding: 16px 28px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; min-width: 140px; }
  .card .num { font-size: 22px; font-weight: 600; }
  .card .label { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .rules { padding: 0 28px 16px; }
  .rule-chip { display: inline-block; background: var(--panel); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; margin: 3px 4px 3px 0; font-size: 12px; }
  .rule-chip b { color: var(--warn); }
  .controls { display: flex; gap: 10px; padding: 0 28px 16px; flex-wrap: wrap; align-items: center; }
  select, input[type=text] { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
  input[type=text] { min-width: 220px; }
  label.chk { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: top; }
  th { color: var(--muted); font-weight: 500; position: sticky; top: 0; background: var(--bg); }
  tr.row { cursor: pointer; }
  tr.row:hover { background: rgba(255,255,255,0.03); }
  .status-ok { color: var(--ok); }
  .status-fixed { color: var(--accent); }
  .status-bad { color: var(--bad); }
  .status-err { color: var(--warn); }
  .rule-badge { display: inline-block; background: rgba(239,91,91,0.12); color: var(--bad); border-radius: 5px; padding: 1px 6px; margin: 1px; font-size: 11px; }
  .detail { display: none; background: var(--panel); }
  .detail.open { display: table-row; }
  .detail td { padding: 14px 16px; }
  .textblock { white-space: pre-wrap; background: #10131a; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-top: 6px; font-size: 13px; line-height: 1.5; }
  .textlabel { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 10px; }
  .textlabel:first-child { margin-top: 0; }
  .empty { padding: 40px 28px; color: var(--muted); text-align: center; }
  .container { padding: 0 28px 40px; overflow-x: auto; }
</style>
</head>
<body>
<header>
  <h1>Qualitäts-Loop-Report</h1>
  <div class="sub">Feedback-Generierung + Verifier + aktive Korrektur, ${escapeHtml(String(totalRuns))} Durchläufe${errorEntries.length ? `, ${errorEntries.length} fehlgeschlagen` : ''} · erzeugt am ${new Date().toLocaleString('de-DE')}</div>
</header>

<div class="stats">
  <div class="card"><div class="num">${totalRuns}</div><div class="label">Durchläufe gesamt</div></div>
  <div class="card"><div class="num">${totalRuns ? Math.round((violationRuns / totalRuns) * 100) : 0}%</div><div class="label">mit Regelverstoß (${violationRuns}/${totalRuns})</div></div>
  <div class="card"><div class="num">${revisionAttempts ? Math.round((revisionSuccesses / revisionAttempts) * 100) : 0}%</div><div class="label">Korrektur erfolgreich (${revisionSuccesses}/${revisionAttempts})</div></div>
  <div class="card"><div class="num">${scenarios.length}</div><div class="label">Szenarien</div></div>
</div>

${allRules.length ? `<div class="rules">${allRules.map((r) => `<span class="rule-chip">Regel <b>${r}</b>: ${ruleCounts[r]}×</span>`).join('')}</div>` : ''}

${(() => {
  const learnedRuleCount = Object.keys(learnedExamplesByRule).length;
  const learnedTotal = Object.values(learnedExamplesByRule).reduce((sum, list) => sum + list.length, 0);
  if (learnedTotal === 0) return '';
  const rows = Object.entries(learnedExamplesByRule)
    .flatMap(([rule, list]) => list.map((e) => ({ rule, ...e })))
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
    .map((e) => `<div class="textlabel">Regel ${escapeHtml(e.rule)}${e.issue ? ` - ${escapeHtml(e.issue)}` : ''}</div>
      <div class="textblock">FALSCH: ${escapeHtml(e.badText)}\n\nBESSER: ${escapeHtml(e.goodText)}</div>`).join('');
  return `<div class="rules" style="padding-top:0;">
    <details>
      <summary style="cursor:pointer; color: var(--muted); font-size: 13px;">🧠 Gelernte Beispiele-Bibliothek (${learnedTotal} Beispiele über ${learnedRuleCount} Regel(n)) - beeinflusst nur die Generierungs-Calls dieses Quality-Loops, nicht die Produktion</summary>
      <div style="margin-top:10px;">${rows}</div>
    </details>
  </div>`;
})()}

<div class="controls">
  <select id="filterScenario"><option value="">Alle Szenarien</option>${scenarios.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select>
  <select id="filterRule"><option value="">Alle Regeln</option>${allRules.map((r) => `<option value="${r}">Regel ${r}</option>`).join('')}</select>
  <input type="text" id="filterText" placeholder="Volltextsuche im Feedback...">
  <label class="chk"><input type="checkbox" id="filterViolationsOnly"> nur mit Verstoß</label>
</div>

<div class="container">
  <table id="table">
    <thead><tr>
      <th>Zeit</th><th>Szenario</th><th>#</th><th>Status</th><th>Regeln</th>
    </tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="empty" id="emptyMsg" style="display:none;">Keine Durchläufe passen zum Filter.</div>
</div>

<script>
const DATA = ${dataJson};

function statusOf(e) {
  if (e.error) return { cls: 'status-err', text: 'Fehler: ' + e.error };
  const rules = e.triggeredRules || [];
  if (rules.length === 0 && e.revisionAttempted) return { cls: 'status-fixed', text: 'korrigiert' };
  if (rules.length === 0) return { cls: 'status-ok', text: 'sauber' };
  return { cls: 'status-bad', text: 'Verstoß' };
}

function fmtTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('de-DE'); } catch { return iso; }
}

function render() {
  const scenario = document.getElementById('filterScenario').value;
  const rule = document.getElementById('filterRule').value;
  const text = document.getElementById('filterText').value.trim().toLowerCase();
  const violationsOnly = document.getElementById('filterViolationsOnly').checked;

  const filtered = DATA.filter((e) => {
    if (scenario && e.scenario !== scenario) return false;
    if (rule && !(e.triggeredRules || []).includes(Number(rule))) return false;
    if (violationsOnly && (e.triggeredRules || []).length === 0) return false;
    if (text) {
      const hay = [e.originalFeedbackText, e.revisedFeedbackText, e.finalFeedbackText, e.scenario].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  document.getElementById('emptyMsg').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach((e, i) => {
    const st = statusOf(e);
    const row = document.createElement('tr');
    row.className = 'row';
    row.innerHTML = \`
      <td>\${fmtTime(e.startedAt)}</td>
      <td>\${(e.scenario || '').replace(/</g, '&lt;')}\${e.usedLearnedExamples ? ' 🧠' : ''}</td>
      <td>\${e.iteration ?? ''}</td>
      <td class="\${st.cls}">\${st.text}</td>
      <td>\${(e.triggeredRules || []).map((r) => \`<span class="rule-badge">Regel \${r}</span>\`).join('') || '–'}</td>
    \`;
    const detail = document.createElement('tr');
    detail.className = 'detail';
    const blocks = [];
    if (e.originalFeedbackText) blocks.push(\`<div class="textlabel">Original-Feedback\${(e.originalTriggeredRules||[]).length ? ' - Regel(n) ' + e.originalTriggeredRules.join(', ') : ''}</div><div class="textblock">\${e.originalFeedbackText.replace(/</g, '&lt;')}</div>\`);
    if (e.revisedFeedbackText) blocks.push(\`<div class="textlabel">Korrekturversuch\${e.revisionSucceeded ? ' - übernommen' : ' - VERWORFEN (Original bleibt final)'}</div><div class="textblock">\${e.revisedFeedbackText.replace(/</g, '&lt;')}</div>\`);
    if (e.revisionAttempted && e.revisionSucceeded === false) {
      const recheck = (e.revisionRecheckRules || []).length ? 'Regel(n) ' + e.revisionRecheckRules.join(', ') : 'keine (Re-Prüfung selbst ist fehlgeschlagen/uneindeutig, siehe Konsolen-Log dieses Laufs)';
      blocks.push(\`<div class="textlabel">Warum verworfen - Re-Prüfung der Korrektur ergab</div><div class="textblock">\${recheck}</div>\`);
    }
    if (e.error) blocks.push(\`<div class="textlabel">Fehler</div><div class="textblock">\${e.error.replace(/</g, '&lt;')}</div>\`);
    detail.innerHTML = \`<td colspan="5">\${blocks.join('') || '(keine Details)'}</td>\`;
    row.addEventListener('click', () => detail.classList.toggle('open'));
    tbody.appendChild(row);
    tbody.appendChild(detail);
  });
}

['filterScenario', 'filterRule', 'filterText', 'filterViolationsOnly'].forEach((id) => {
  document.getElementById(id).addEventListener('input', render);
});
render();
</script>
</body>
</html>
`;
}

/**
 * @param {Object} params
 * @param {string} params.inPath - Pfad zur quality-loop-log.jsonl
 * @param {string} params.outPath - Zielpfad der HTML-Datei
 * @param {string} [params.learnedPath] - Pfad zur learned-examples.json (Standard: gleicher
 *   Ordner wie inPath) - fehlt die Datei, wird die Bibliothek im Report einfach leer angezeigt.
 * @returns {{ entryCount: number, outPath: string }}
 */
export function generateReport({ inPath, outPath, learnedPath }) {
  const entries = readEntries(inPath);
  const resolvedLearnedPath = learnedPath || path.join(path.dirname(inPath), 'learned-examples.json');
  let learnedExamplesByRule = {};
  if (fs.existsSync(resolvedLearnedPath)) {
    try {
      learnedExamplesByRule = JSON.parse(fs.readFileSync(resolvedLearnedPath, 'utf8'));
    } catch {
      learnedExamplesByRule = {};
    }
  }
  const html = buildReportHtml(entries, learnedExamplesByRule);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  return { entryCount: entries.length, outPath };
}

export default { readEntries, buildReportHtml, generateReport };
