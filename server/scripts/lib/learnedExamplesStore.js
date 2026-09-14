/**
 * Selbstlern-Bibliothek für den Qualitäts-Loop (scripts/qualityLoopRunner.js).
 *
 * Kernidee (User-Vorgabe): der Loop soll nicht nur einzelne Texte korrigieren, sondern über
 * mehrere Durchläufe hinweg tatsächlich BESSER werden - jede erfolgreich verifizierte Korrektur
 * (revisionSucceeded === true) ist ein konkretes "So nicht → So besser"-Beispiel für die Regel,
 * die vorher verletzt wurde. Diese Beispiele werden hier gesammelt und dem Coach-System-Prompt
 * NUR innerhalb des Quality-Loops als zusätzliche Few-Shot-Beispiele angehängt (siehe
 * buildLearnedExamplesSection) - der echte Produktions-Prompt (OpenAIProvider.getSystemPrompt,
 * von routes/workouts.js verwendet) bleibt davon komplett unberührt (bewusste Entscheidung, um
 * die Produktion nicht unbeaufsichtigt/automatisch zu verändern - siehe Doku).
 *
 * Über genügend Durchläufe hinweg sollte dadurch die Verstoßrate pro Regel im Loop selbst
 * sinken (messbar über den bestehenden Report) - das ist die Bestätigung, dass sich ein Beispiel
 * "bewährt". Eine spätere, bewusste Übernahme der reifsten Beispiele in den echten Produktions-
 * Prompt ist ein separater, manueller Schritt (nicht Teil dieses Moduls).
 *
 * Persistiert als lokale JSON-Datei (server/scripts/evalResults/learned-examples.json,
 * .gitignore't wie der Rest von evalResults/ - reine Testlauf-Daten).
 */

import fs from 'fs';
import path from 'path';

// Pro Regel maximal so viele Beispiele behalten (älteste zuerst verdrängt) - begrenzt sowohl das
// Datenwachstum als auch, wie viele Tokens die Beispiele im Prompt des Quality-Loops kosten.
const MAX_EXAMPLES_PER_RULE = 2;
// Insgesamt maximal so viele Beispiele gleichzeitig in EINEN Prompt einfließen lassen (über alle
// Regeln hinweg) - falls die Bibliothek über die Zeit für viele verschiedene Regeln wächst, soll
// der Prompt trotzdem nicht unbegrenzt größer werden. Priorisiert die zuletzt gelernten.
const MAX_EXAMPLES_PER_PROMPT = 6;
// Textlänge, auf die Original-/korrigierter Text für ein Beispiel gekürzt werden (reicht für den
// Kontrast, ohne den Prompt mit einer kompletten 150-Wörter-Nachricht pro Beispiel zu belasten).
const MAX_EXAMPLE_TEXT_LENGTH = 260;

function truncate(text, maxLength = MAX_EXAMPLE_TEXT_LENGTH) {
  const t = String(text ?? '').trim();
  return t.length > maxLength ? `${t.slice(0, maxLength)}…` : t;
}

/**
 * @param {string} storePath
 * @returns {Object<string, Array>} Map Regel-Nummer (als String) -> Array von Beispielen
 */
export function loadLearnedExamples(storePath) {
  if (!fs.existsSync(storePath)) return {};
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Korrupte/leere Datei - lieber bei null anfangen als den ganzen Lauf abbrechen zu lassen.
    return {};
  }
}

function saveLearnedExamples(storePath, examplesByRule) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(examplesByRule, null, 2), 'utf8');
}

/**
 * Fügt ein neu gelerntes Beispiel hinzu (nur aufrufen, wenn eine Korrektur tatsächlich
 * erfolgreich re-verifiziert wurde) und schreibt die Bibliothek sofort auf Platte, damit auch
 * spätere Szenarien/Durchläufe INNERHALB desselben Laufs bereits davon profitieren.
 *
 * @param {string} storePath
 * @param {Object<string, Array>} examplesByRule - bisherige Bibliothek (wird mutiert UND
 *   zurückgegeben, damit der Aufrufer nicht erneut von Platte laden muss)
 * @param {number} rule
 * @param {Object} params - { badText, goodText, scenario, issue }
 * @returns {Object<string, Array>} aktualisierte Bibliothek
 */
export function addLearnedExample(storePath, examplesByRule, rule, { badText, goodText, scenario, issue }) {
  const key = String(rule);
  const list = examplesByRule[key] || [];

  const newExample = {
    badText: truncate(badText),
    goodText: truncate(goodText),
    scenario,
    issue: issue ? truncate(issue, 200) : undefined,
    capturedAt: new Date().toISOString()
  };

  // Keine exakten Duplikate (z.B. wenn dasselbe Szenario in mehreren Iterationen dieselbe
  // Formulierung erzeugt) - sonst würde die Bibliothek nur mit Wiederholungen vollaufen, statt
  // Vielfalt an Fehlerarten abzudecken.
  if (list.some((e) => e.badText === newExample.badText)) {
    return examplesByRule;
  }

  list.push(newExample);
  // Älteste zuerst verdrängen, wenn das Limit pro Regel überschritten ist.
  while (list.length > MAX_EXAMPLES_PER_RULE) list.shift();

  examplesByRule[key] = list;
  saveLearnedExamples(storePath, examplesByRule);
  return examplesByRule;
}

/**
 * Baut den Prompt-Zusatzblock aus der aktuellen Bibliothek - wird an den Coach-System-Prompt
 * angehängt (NUR im Quality-Loop, siehe Modul-Kommentar oben). Leerer String, wenn noch nichts
 * gelernt wurde (Prompt bleibt dann exakt wie das Original).
 *
 * @param {Object<string, Array>} examplesByRule
 * @returns {string}
 */
export function buildLearnedExamplesSection(examplesByRule) {
  const allExamples = Object.entries(examplesByRule)
    .flatMap(([rule, list]) => list.map((e) => ({ rule, ...e })))
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
    .slice(0, MAX_EXAMPLES_PER_PROMPT);

  if (allExamples.length === 0) return '';

  const lines = allExamples.map((e) => `- Regel ${e.rule}${e.issue ? ` (${e.issue})` : ''}:
  FALSCH (so NICHT schreiben): "${e.badText}"
  BESSER (so macht es der Coach stattdessen): "${e.goodText}"`).join('\n');

  return `

GELERNTE BEISPIELE AUS FRÜHEREN, BESTÄTIGTEN KORREKTUREN (nur zur Orientierung, ersetzen keine
der obigen Regeln, sollen aber helfen, denselben Fehlertyp künftig von vornherein zu vermeiden):
${lines}`;
}

export default { loadLearnedExamples, addLearnedExample, buildLearnedExamplesSection };
