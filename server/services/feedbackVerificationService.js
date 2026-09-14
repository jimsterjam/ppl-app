/**
 * feedbackVerificationService
 *
 * Feedback-Qualitäts-Loop: prüft den vom Coach-Prompt (OpenAIProvider.js) erzeugten Feedback-
 * Entwurf zusätzlich gegen die Regeln des System-Prompts, BEVOR der Nutzer das Feedback sieht.
 *
 * Zwei Prüfstufen:
 * 1. Deterministischer Zahlen-/Wortbudget-Check (reiner Code, kein KI-Aufruf, kostenlos) -
 *    jede im Entwurfstext genannte Zahl muss sich in den strukturierten Trainingsdaten
 *    (structuredAnalysis, siehe trainingAnalysisService.structureAnalysisForAI) wiederfinden.
 * 2. Kompakter KI-Prüfaufruf (zweiter, kleiner OpenAI-Call) gegen eine knappe Checkliste der
 *    17 Regeln aus dem Coach-System-Prompt, mit strukturierter JSON-Antwort statt Fließtext -
 *    hält Kosten/Tokens klein.
 *
 * Steuerung über AI_VERIFIER_MODE (Env-Variable): 'off' (Standard) | 'shadow' | 'active'.
 * - 'shadow' (Phase 1): findet die Prüfung einen Verstoß, wird das protokolliert (siehe
 *   models/VerifierAudit.js), aber NICHT in den Entwurf eingegriffen - der Nutzer sieht immer
 *   den ursprünglichen Text. Läuft fire-and-forget NACH dem Versenden der Antwort (siehe
 *   routes/workouts.js), verlängert also nie die Antwortzeit.
 * - 'active' (Phase 2): wird ein Verstoß gefunden, wird GENAU EIN gezielter Korrektur-Versuch
 *   unternommen (reviseFeedback()), der NUR die konkret beanstandeten Punkte behebt und den
 *   Rest des Textes unverändert lässt. Die Korrektur wird anschließend selbst erneut komplett
 *   geprüft (beide Stufen) - schlägt auch das fehl, wird sicherheitshalber der URSPRÜNGLICHE
 *   Entwurf ausgeliefert statt eines zweiten, ungeprüft schlechteren Textes. In diesem Modus
 *   MUSS der Aufrufer die Prüfung awaiten (verlängert die Antwortzeit nur dann, wenn tatsächlich
 *   ein Verstoß gefunden wurde - im Normalfall keine zusätzliche Latenz).
 */

import { logger } from '../utils/logger.js';
import { withAiRetry, parseJsonSafely } from '../utils/aiUtils.js';
import { createOpenAIClient, ensureRelayAwake, markRelayContact } from '../utils/aiClientFactory.js';
import { getCoachSystemPromptText } from './OpenAIProvider.js';
import VerifierAudit from '../models/VerifierAudit.js';

const MIN_EXPECTED_WORDS = 40;
const MAX_EXPECTED_WORDS = 220;

// Deterministisches Sicherheitsnetz gegen Regel-4-Fehlklassifizierung durch den KI-Verifier
// (siehe verifyFeedbackWithAI): trotz Few-Shot-Beispielen in getVerifierChecklistText() stempelte
// das Modell wiederholt reine Gewichts-/Wiederholungs-Empfehlungen ohne jeden Bezug zu
// Ausführung/Technik als Regel-4-Verstoß (per Quality-Loop-Batch-Analyse gefunden). Ein
// gemeldeter Regel-4-Fund wird deshalb NUR akzeptiert, wenn eines dieser Wörter im ZITAT
// (`quote`) selbst vorkommt - sonst wird der Fund verworfen (nicht: der ganze restliche
// Verifier-Lauf).
const RULE_4_REQUIRED_KEYWORDS = [
  'technik', 'ausführung', 'ausfuhrung', 'tempo', 'anfühlt', 'anfuhlt', 'fühlt sich', 'fuhlt sich',
  'schmerz', 'verletzung', 'bewegungsqualität', 'bewegungsqualitat', 'bewegungsgefühl', 'bewegungsgefuhl'
];

// Zweites deterministisches Sicherheitsnetz (per Quality-Loop-Roh-Antwort-Analyse gefunden): das
// Modell lieferte in Einzelfällen ein KOMPLETT ERFUNDENES `quote` - ein Zitat, das im Entwurfstext
// gar nicht vorkommt (z.B. "achte darauf, wie sich das Gewicht anfühlt" bei einem Text, der diesen
// Satz nirgends enthält). Enthält ein solches Fantasie-Zitat zufällig ein Regel-4-Keyword, rutscht
// es am Filter oben vorbei - die anschließende Korrektur kann dann naturgemäß nichts Passendes
// finden/entfernen und scheitert. Gilt für ALLE Regeln, nicht nur Regel 4: ein Zitat, das nicht
// (auch nicht ungefähr, Groß-/Kleinschreibung und Mehrfach-Leerzeichen egal) im Text vorkommt, ist
// keine verwertbare Grundlage für einen Verstoß.
export function isQuoteVerifiable(violation, feedbackText) {
  const quote = String(violation.quote || '').trim();
  if (!quote) return true; // kein Zitat angegeben - dieser Check greift dann einfach nicht
  const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  return normalize(feedbackText).includes(normalize(quote));
}

export function isKeywordBackedRule4Violation(violation) {
  // Bug-Fix Nr. 2 (Quality-Loop-Analyse, zweite Runde): NUR `quote` (das tatsächliche Zitat aus
  // dem Entwurf) zählt, NICHT `issue` (die Begründung). Grund: das Modell schreibt in `issue`
  // so gut wie immer pauschal "Aussage zur Technik/Ausführung" als Label - selbst wenn das
  // zitierte `quote` selbst gar nichts mit Technik zu tun hat (z.B. quote: "das läuft!" oder
  // "schau, ob du die Wiederholungen bei 8 halten kannst"). Mit `issue` im Suchtext griff der
  // Filter praktisch NIE, weil das Boilerplate-Label das Keyword fast immer enthält, unabhängig
  // vom eigentlichen Fund. Fehlt `quote` komplett (Modell hat keins geliefert), gilt der Fund als
  // NICHT belegt und wird verworfen - ein Regel-4-Vorwurf ohne Zitat ist nicht überprüfbar.
  const quote = String(violation.quote || '').trim().toLowerCase();
  if (!quote) return false;
  return RULE_4_REQUIRED_KEYWORDS.some((kw) => quote.includes(kw));
}

// ---------------------------------------------------------------------------------------------
// Stufe 1: Deterministischer Zahlen-Check (kein KI-Aufruf)
// ---------------------------------------------------------------------------------------------

/**
 * Extrahiert alle im Text vorkommenden Zahlen (deutsches und englisches Dezimalformat).
 * Vorzeichen ("+", "-") werden ignoriert - der Betrag reicht für den Abgleich, ob die Zahl
 * überhaupt in den Rohdaten vorkommt (Vorzeichenfehler sind eine andere Fehlerklasse als
 * "erfundene Zahl" und werden hier bewusst nicht unterschieden).
 *
 * @param {string} text
 * @returns {number[]}
 */
export function extractNumbersFromText(text) {
  const matches = String(text ?? '').match(/\d+(?:[.,]\d+)?/g) || [];
  return matches
    .map((m) => Number(m.replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/**
 * Sammelt alle Zahlen, die legitim aus den strukturierten Trainingsdaten stammen können - das
 * ist die "Wahrheitsmenge", gegen die extractNumbersFromText() abgeglichen wird. Bewusst
 * großzügig (inkl. gerundeter/abgeleiteter Varianten wie Wochen aus Tagen), um False Positives
 * durch legitime Umformulierungen (z.B. "seit 3 Wochen" statt "21 Tage") zu vermeiden - dieser
 * Check ist ein Signal für die Auswertung, kein hartes Gate.
 *
 * @param {Object} structuredAnalysis - Ergebnis von structureAnalysisForAI()
 * @returns {Set<number>}
 */
export function collectAllowedNumbers(structuredAnalysis) {
  const allowed = new Set();
  const add = (value) => {
    if (value === null || value === undefined) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    allowed.add(round1(n));
    allowed.add(round1(Math.abs(n)));
    allowed.add(Math.round(n));
    allowed.add(Math.round(Math.abs(n)));
  };

  if (!structuredAnalysis || typeof structuredAnalysis !== 'object') return allowed;

  add(structuredAnalysis.total_exercises_analyzed);
  add(structuredAnalysis.athlete_bodyweight_kg);

  for (const ex of structuredAnalysis.exercises || []) {
    add(ex.current_weight);
    add(ex.current_reps);
    add(ex.current_sets);
    add(ex.current_volume);
    add(ex.previous_weight);
    add(ex.previous_reps);
    add(ex.previous_sets);
    add(ex.previous_volume);
    add(ex.period_days);
    // Runden auf ganze Wochen - Prompt formuliert Zeiträume z.T. als "X Wochen" statt Tage
    // (siehe structureAnalysisForAI -> period_description), die AI kann diese Umrechnung im
    // Fließtext wiederholen.
    if (ex.period_days != null) add(Math.floor(Number(ex.period_days) / 7));

    add(ex.changes?.weight_change_kg);
    add(ex.changes?.reps_change);
    add(ex.changes?.sets_change);
    add(ex.changes?.volume_change_kg);
    add(ex.changes?.volume_change_percent);

    // Bug-Fix (Quality-Loop-Analyse): Zahlen, die direkt aus einer Nutzer-Notiz zitiert werden
    // (z.B. "Bewusster Deload alle 6 Wochen" in note_context.persistent.text), sind eine
    // legitime Quelle (Regel 12 verlangt sogar, Notizen zu berücksichtigen) - standen bisher
    // aber nicht in der erlaubten Zahlenmenge, wurden also fälschlich als "erfundene Zahl"
    // markiert, sobald der Coach sie im Fließtext wiederholte.
    const noteTexts = [
      ex.note_context?.persistent?.text,
      ex.note_context?.session,
      ex.note
    ].filter(Boolean);
    for (const noteText of noteTexts) {
      for (const n of extractNumbersFromText(noteText)) add(n);
    }

    for (const s of ex.sets_comparison || []) {
      add(s.set_number);
      add(s.current_weight);
      add(s.current_reps);
      add(s.previous_weight);
      add(s.previous_reps);
      add(s.weight_change_kg);
      add(s.reps_change);
      // Seit dem Umbau auf satzgenaue Prompts (buildPrompt() in OpenAIProvider.js) zeigt der
      // Prompt zusätzlich das Pro-Satz-Volumen (Gewicht × Wiederholungen) - diese abgeleitete
      // Zahl muss hier ebenfalls erlaubt sein, sonst würde der Verifier ein legitimes Zitat
      // dieser Zahl fälschlich als erfundenen Wert werten (Regel 1).
      if (s.current_weight != null && s.current_reps != null) {
        add(s.current_weight * s.current_reps);
      }
      if (s.previous_weight != null && s.previous_reps != null) {
        add(s.previous_weight * s.previous_reps);
      }
    }
  }

  for (const e of structuredAnalysis.top_improvements || []) {
    add(e.volume_change_percent);
    add(e.weight_change_kg);
  }
  for (const e of structuredAnalysis.top_declines || []) {
    add(e.volume_change_percent);
    add(e.weight_change_kg);
  }

  return allowed;
}

/**
 * Regel 1 (Datenwahrheit) mechanisch prüfbarer Teil: jede im Entwurfstext genannte Zahl muss in
 * den Rohdaten vorkommen. Reine Funktion, kein KI-Aufruf, kein Netzwerkzugriff - daher
 * kostenlos und immer ausführbar, unabhängig vom AI_VERIFIER_MODE-Flag.
 *
 * @param {string} feedbackText
 * @param {Object} structuredAnalysis
 * @returns {{ ok: boolean, violations: Array<{rule: number, issue: string, value: number}> }}
 */
export function checkNumberConsistency(feedbackText, structuredAnalysis) {
  const allowed = collectAllowedNumbers(structuredAnalysis);
  const found = extractNumbersFromText(feedbackText);
  const violations = [];

  for (const n of found) {
    if (allowed.has(round1(n)) || allowed.has(Math.round(n))) continue;
    violations.push({
      rule: 1,
      issue: 'Im Entwurf genannte Zahl kommt in den Trainingsdaten nicht vor',
      value: n
    });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Regel 17 (Wortbudget, ca. 80-150 Wörter) - grobzügiger Toleranzrahmen (40-220), da es hier
 * nur um klare Ausreißer geht (z.B. ein komplett zu langer Report-Text statt Chat-Nachricht),
 * nicht um eine exakte Wortzahl-Kontrolle.
 *
 * @param {string} feedbackText
 * @returns {{ ok: boolean, violations: Array<{rule: number, issue: string, value: number}> }}
 */
export function checkWordBudget(feedbackText) {
  const wordCount = String(feedbackText ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_EXPECTED_WORDS || wordCount > MAX_EXPECTED_WORDS) {
    return {
      ok: false,
      violations: [{
        rule: 17,
        issue: `Wortanzahl (${wordCount}) deutlich außerhalb des erwarteten Rahmens (ca. 80-150 Wörter)`,
        value: wordCount
      }]
    };
  }
  return { ok: true, violations: [] };
}

/**
 * Kombiniert alle deterministischen Checks.
 *
 * @param {string} feedbackText
 * @param {Object} structuredAnalysis
 * @returns {{ ok: boolean, violations: Array }}
 */
export function runDeterministicChecks(feedbackText, structuredAnalysis) {
  const numberCheck = checkNumberConsistency(feedbackText, structuredAnalysis);
  const wordBudgetCheck = checkWordBudget(feedbackText);
  const violations = [...numberCheck.violations, ...wordBudgetCheck.violations];
  return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------------------------
// Stufe 2: Kompakter KI-Prüfaufruf
// ---------------------------------------------------------------------------------------------

/**
 * Knappe, für den zweiten KI-Call optimierte Fassung der 17 Regeln aus getCoachSystemPromptText()
 * (OpenAIProvider.js) - bewusst KEIN vollständiger Nachdruck des Systemprompts (das würde den
 * Prüfaufruf unnötig teuer machen), sondern eine Stichpunkt-Checkliste mit den Regel-Nummern,
 * damit die Admin-Auswertung (VerifierAudit.triggeredRules) auf dieselben Nummern wie der
 * Haupt-Prompt referenzieren kann.
 */
export function getVerifierChecklistText() {
  return `Prüfe AUSSCHLIESSLICH, ob der Entwurfstext eines Fitness-Coaches gegen eine der
folgenden Regeln verstößt. Du bekommst die verbindlichen Trainingsdaten (JSON) und den
Entwurfstext. Du generierst KEIN neues Feedback, du prüfst nur.

1. Datenwahrheit: Zahlen im Text müssen exakt den gelieferten Daten entsprechen (nicht neu
   berechnet, nicht erfunden, nicht geschätzt und keine Durchschnittswerte berechnen).
2. Null-Annahmen: keine Aussage zu Werten, die nicht in den Daten stehen (z.B. Körpergewicht
   nur wenn athlete_bodyweight_kg vorhanden). WICHTIG: ein Satz, der explizit sagt, dass zu einer
   Übung KEINE Satzdaten/Werte vorliegen und DESHALB bewusst keine Gewichts-/Wiederholungsaussage
   getroffen wird (z.B. "Es liegen keine Satzdaten vor, daher kann ich dazu nichts sagen"), ist
   KEIN Regel-2-Verstoß, sondern genau das geforderte Verhalten bei fehlenden Daten - das
   Gegenteil einer unbelegten Behauptung. Melde Regel 2 nur, wenn der Text tatsächlich einen
   KONKRETEN Wert nennt/behauptet, der nicht in den Daten steht - nicht, wenn er das Fehlen von
   Daten nur beschreibt.
3. Keine halluzinierten Ursachen (z.B. "Fett verloren", "Muskeln gewachsen") ohne Beleg in den
   Daten - mögliche Ursachen nur als "könnte" formuliert.
4. Keine Aussage zu tatsächlicher Bewegungsausführung, Technik, Tempo, subjektivem Schmerz/
   Verletzung, außer eine Notiz erwähnt das explizit.
   BEISPIELE (wichtig, da hier häufig falsch zugeordnet wird):
   - VERSTÖSST gegen Regel 4: "Achte auf deine Technik", "achte darauf, wie sich das Gewicht
     anfühlt", "achte auf eine saubere Ausführung", "halte das Tempo langsam" - hier geht es um
     Ausführungsqualität, Bewegungsgefühl oder Tempo.
   - VERSTÖSST NICHT gegen Regel 4 (auch wenn es wie eine ähnliche "Für nächstes Mal..."-
     Empfehlung klingt): "steigere im dritten Satz das Gewicht", "versuch die Wiederholungen zu
     halten", "behalte das Gewicht im Auge und steigere es, wenn es passt" - das sind reine
     Gewichts-/Wiederholungs-/Satz-Empfehlungen OHNE ein Wort zu Technik/Ausführung/Tempo/
     Körperempfinden. Das fällt höchstens unter Regel 11 (falls ohne Datenbezug erfunden), NIEMALS
     unter Regel 4. Melde Regel 4 NUR, wenn das Zitat selbst ein Wort wie "Technik", "Ausführung",
     "Tempo", "anfühlt"/"fühlt sich", "Schmerz" oder "Verletzung" enthält.
5. Keine medizinischen Diagnosen (Verletzung, Überlastung, Gelenkproblem, Regenerationsproblem).
6. Fakt und Interpretation klar getrennt, keine Interpretation als Tatsache formuliert.
7. Keine endgültigen Urteile/Anweisungen bei mehrdeutiger Datenlage - nur bedingte Hinweise.
8. Keine automatische Wertung von Gewichts-/Volumenveränderung als per se positiv/negativ.
9. Keine Überinterpretation einer einzelnen Trainingseinheit als langfristige Entwicklung.
11. Keine erfundene/generische Empfehlung ohne konkreten Datenbezug; maximal 3 Hinweise.
12. Notizen des Nutzers korrekt berücksichtigt (z.B. Stagnation nicht negativ bewertet, wenn
    eine Notiz das erklärt).
13. Übungsprofil (profile_hint) beachtet, falls vorhanden (z.B. keine Gewichtsaussage bei
    externalLoadRelevant=false).
14/15. Technikfokus-/Speed-Übungen nicht anhand von Gewicht/Volumen bewertet.
16. Keine stumpfe Auflistung ALLER Rohzahlen je Übung (Dopplung zur separaten UI-Übersicht).
17. Ton/Format: warme, kurze Chat-Nachricht (~80-150 Wörter), keine Überschriften/Report-Stil.

Antworte AUSSCHLIESSLICH als valides JSON-Objekt, keine Erklärung davor/danach:
{
  "ok": true,
  "violations": []
}
oder, falls ein Verstoß gefunden wurde:
{
  "ok": false,
  "violations": [
    { "rule": 4, "issue": "kurze Begründung", "quote": "wortgenaues Zitat aus dem Entwurf" }
  ]
}`;
}

/**
 * Baut den User-Prompt für den Verifier-Call: dieselben strukturierten Trainingsdaten wie der
 * Generator (als kompaktes JSON statt der ausführlichen Prompt-Formatierung aus
 * OpenAIProvider.buildPrompt - spart Tokens, die Fakten sind identisch), der Entwurfstext sowie
 * optionale Hinweise aus der deterministischen Vorprüfung.
 *
 * @param {Object} structuredAnalysis
 * @param {string} feedbackText
 * @param {Array} [deterministicViolations]
 * @returns {string}
 */
export function buildVerifierUserPrompt(structuredAnalysis, feedbackText, deterministicViolations = []) {
  const hints = deterministicViolations.length > 0
    ? `\n\nHINWEISE AUS DER AUTOMATISCHEN VORPRÜFUNG (Verdachtsfälle, nicht abschließend, prüfe eigenständig weiter):\n${
      deterministicViolations.map((v) => `- Regel ${v.rule}: ${v.issue}${v.value !== undefined ? ` (Wert: ${v.value})` : ''}`).join('\n')
    }`
    : '';

  return `TRAININGSDATEN (JSON, verbindliche Fakten):
${JSON.stringify(structuredAnalysis)}

ENTWURFSTEXT DES COACHES:
<draft>${String(feedbackText ?? '').replace(/[<>]/g, '')}</draft>${hints}

Prüfe den Entwurfstext gegen die Checkliste und die Trainingsdaten.`;
}

// Nutzt denselben Relay-fähigen Client wie OpenAIProvider.js (siehe utils/aiClientFactory.js) -
// im Relay-Modus läuft der KI-Prüfaufruf also über denselben geschützten Relay wie die
// Haupt-Feedback-Generierung, ohne dass hier ein eigener OPENAI_API_KEY nötig ist.
function getClient() {
  return createOpenAIClient();
}

/**
 * Zweiter, kompakter OpenAI-Call: prüft den Entwurf gegen die Checkliste. Kleines max_tokens-
 * Budget, da nur strukturiertes JSON zurückkommt statt Fließtext.
 *
 * @param {Object} structuredAnalysis
 * @param {string} feedbackText
 * @param {Object} [options] - { requestId, deterministicViolations, onRawResponse }
 * @param {(raw: string) => void} [options.onRawResponse] - NUR für Diagnose (siehe
 *   scripts/qualityLoopRunner.js): bekommt, falls gesetzt, den unveränderten Rohtext der
 *   KI-Antwort (vor JSON-Parsing/Keyword-Filter). Im Produktions-Betrieb (routes/workouts.js)
 *   wird dieser Callback NIE übergeben - ohne ihn verhält sich diese Funktion exakt wie zuvor.
 * @returns {Promise<{ ok: boolean, violations: Array<{rule:number, issue:string, quote?:string}> }>}
 */
export async function verifyFeedbackWithAI(structuredAnalysis, feedbackText, options = {}) {
  const { requestId = `verify_${Date.now()}`, deterministicViolations = [], onRawResponse } = options;
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const userPrompt = buildVerifierUserPrompt(structuredAnalysis, feedbackText, deterministicViolations);

  // Siehe Kommentar in aiClientFactory.js - schützt vor demselben Render-Free-Kaltstart-502
  // wie beim Haupt-Generierungscall (in der Praxis meist ein No-Op, da dieser Verifier-Call
  // typischerweise direkt NACH einem bereits erfolgreichen Generierungscall läuft).
  await ensureRelayAwake();

  const response = await withAiRetry(async () => {
    return client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: getVerifierChecklistText() },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    });
  });

  markRelayContact();

  const raw = response.choices?.[0]?.message?.content?.trim();
  if (typeof onRawResponse === 'function') {
    try { onRawResponse(raw); } catch { /* Diagnose-Callback darf den Verifier nie stören */ }
  }
  const parsed = parseJsonSafely(raw, { requestId, context: 'feedback-verifier' });

  const rawViolations = Array.isArray(parsed?.violations)
    ? parsed.violations
      .map((v) => ({
        rule: Number(v?.rule) || 0,
        issue: String(v?.issue || '').trim().slice(0, 400),
        quote: String(v?.quote || '').trim().slice(0, 400)
      }))
      .filter((v) => v.issue)
    : [];

  // Filter 1: Zitat-Existenz-Check (siehe isQuoteVerifiable oben) - gilt für ALLE Regeln. Zuerst,
  // damit ein erfundenes Zitat gar nicht erst durch den Regel-4-Keyword-Filter rutschen kann.
  const droppedHallucinatedQuote = rawViolations.filter((v) => !isQuoteVerifiable(v, feedbackText));
  if (droppedHallucinatedQuote.length > 0) {
    logger.debug('🧹 Verifier: Verstoß mit nicht im Text vorkommendem Zitat verworfen (Halluzinations-Filter)', {
      requestId,
      dropped: droppedHallucinatedQuote.map((v) => ({ rule: v.rule, issue: v.issue, quote: v.quote }))
    });
  }
  const verifiableViolations = rawViolations.filter((v) => isQuoteVerifiable(v, feedbackText));

  // Filter 2: Keyword-Filter (siehe RULE_4_REQUIRED_KEYWORDS oben) - nur Regel-4-Funde ohne jeden
  // Bezug zu Ausführung/Technik/Tempo/Körperempfinden werden verworfen, alle anderen Regeln
  // unberührt.
  const droppedRule4 = verifiableViolations.filter((v) => v.rule === 4 && !isKeywordBackedRule4Violation(v));
  if (droppedRule4.length > 0) {
    logger.debug('🧹 Verifier: Regel-4-Fund ohne Ausführungs-/Technik-Bezug verworfen (Keyword-Filter)', {
      requestId,
      dropped: droppedRule4.map((v) => ({ issue: v.issue, quote: v.quote }))
    });
  }
  const violations = verifiableViolations.filter((v) => v.rule !== 4 || isKeywordBackedRule4Violation(v));

  // Bug-Fix (per Quality-Loop-Batch-Analyse gefunden, scripts/qualityLoopRunner.js): `ok`
  // ausschließlich anhand der tatsächlich benannten `violations` bestimmen, NICHT zusätzlich am
  // rohen `parsed.ok`-Flag der KI. Grund: bei der Re-Prüfung nach einer Korrektur lieferte das
  // Modell in ca. der Hälfte der Fälle ein in sich widersprüchliches Ergebnis - `"ok": false`
  // bei gleichzeitig LEERER `violations`-Liste (keine einzige konkret benannte Regel). Mit der
  // alten Logik (`parsed?.ok !== false && violations.length === 0`) wurde das als Ablehnung
  // gewertet, obwohl kein einziger konkreter Verstoß vorlag - dadurch scheiterte die aktive
  // Korrektur (reviseFeedback, siehe runVerificationLoop) an ihrer eigenen Re-Prüfung, obwohl der
  // korrigierte Text laut den einzelnen Prüfpunkten sauber war. Jetzt zählt ausschließlich, ob
  // die KI mindestens einen KONKRETEN Verstoß benennen konnte - ein pauschales "ok: false" ohne
  // Begründung wird nicht mehr als Verstoß gewertet (das reine Vorhandensein von `violations` ist
  // ohnehin die einzige nutzbare/nachvollziehbare Information aus dieser Antwort).
  return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------------------------
// Stufe 3 (nur AI_VERIFIER_MODE=active): gezielte Korrektur eines beanstandeten Entwurfs
// ---------------------------------------------------------------------------------------------

/**
 * Baut den User-Prompt für den Korrektur-Call: anders als der Verifier-Prompt (der nur prüft)
 * bekommt dieser Call den Auftrag, NUR die konkret aufgelisteten Punkte zu beheben und sonst
 * NICHTS am Text zu ändern - bewusst kein "schreib das Feedback nochmal neu", weil eine
 * komplette Neugenerierung neue, andere Fehler einführen könnte, statt gezielt den bekannten zu
 * beheben.
 *
 * @param {Object} structuredAnalysis
 * @param {string} feedbackText
 * @param {Array<{rule:number, issue:string, quote?:string, value?:number}>} violations
 * @returns {string}
 */
export function buildRevisionUserPrompt(structuredAnalysis, feedbackText, violations = []) {
  const violationList = violations
    .map((v) => `- Regel ${v.rule}${v.quote ? ` (betroffene Stelle: "${v.quote}")` : ''}: ${v.issue}`)
    .join('\n');

  // Bug-Fix (Quality-Loop-Analyse, scripts/qualityLoopRunner.js): bei Regel-4-/11-Verstößen
  // ("Aussage zu Ausführung/Technik/Tempo/Schmerz" bzw. "erfundene/generische Empfehlung ohne
  // Datenbezug") ersetzte das Modell die beanstandete Stelle in der Praxis sehr häufig durch eine
  // ANDERE, ähnlich geartete Formulierung (z.B. "achte auf die Technik" -> "achte darauf, wie
  // sich das Gewicht anfühlt" - beides eine unzulässige Aussage zu subjektivem Empfinden/
  // Ausführung) - die Re-Prüfung schlug dadurch mit derselben Regel erneut fehl. Explizite
  // Gegenmaßnahme unten: bei diesen beiden Regeln lieber ersatzlos weglassen statt umformulieren.
  const hasExecutionOrGenericAdviceViolation = violations.some((v) => v.rule === 4 || v.rule === 11);
  // Bug-Fix Nr. 2 (Quality-Loop-Analyse): "ersatzlos weglassen" führte in der Praxis oft dazu,
  // dass der Text auf 30-40 Wörter zusammenschrumpfte und dadurch NEU gegen Regel 17
  // (Wortbudget ~80-150) verstieß - eine Regel wurde behoben, eine andere dafür provoziert.
  // Deshalb jetzt an die tatsächliche aktuelle Wortzahl gekoppelt: nur wirklich ersatzlos
  // weglassen, wenn danach noch genug Text übrig bleibt, sonst durch eine kurze, aus den Daten
  // ableitbare Aussage ersetzen (damit die Länge erhalten bleibt).
  const currentWordCount = String(feedbackText ?? '').trim().split(/\s+/).filter(Boolean).length;
  const closeToMinWords = currentWordCount < MIN_EXPECTED_WORDS + 25;
  const executionAdviceWarning = hasExecutionOrGenericAdviceViolation
    ? `\n\nWICHTIG bei Regel 4/11: ersetze eine beanstandete Ausführungs-/Technik-/Gefühls-Aussage
oder eine generische Empfehlung NICHT durch eine ähnlich geartete neue Formulierung (z.B. "achte
auf die Technik" durch "achte darauf, wie sich das Gewicht anfühlt" zu ersetzen behebt den
Verstoß NICHT, da beides eine unzulässige Aussage zu subjektivem Empfinden/Ausführung ist).
${closeToMinWords
    ? `Der Entwurf hat aktuell nur ca. ${currentWordCount} Wörter (Ziel: ca. 80-150) - lass die
beanstandete Stelle deshalb NICHT ersatzlos weg (der Text würde sonst zu kurz werden und gegen
Regel 17 verstoßen), sondern ERSETZE sie durch eine kurze, rein aus den Trainingsdaten
ableitbare, konkrete Aussage (z.B. eine Zahl oder einen Trend aus den Daten), die ungefähr
gleich lang ist wie die gestrichene Stelle.`
    : `Lass die Stelle ERSATZLOS weg (der Text ist lang genug, das verkraftet die Wortzahl) oder
ersetze sie durch eine rein aus den Trainingsdaten ableitbare, konkrete Aussage (z.B. eine Zahl
oder einen Trend aus den Daten) - beides ist hier möglich.`}`
    : '';

  return `TRAININGSDATEN (JSON, verbindliche Fakten):
${JSON.stringify(structuredAnalysis)}

BISHERIGER ENTWURFSTEXT (enthält mindestens einen bestätigten Regelverstoß):
<draft>${String(feedbackText ?? '').replace(/[<>]/g, '')}</draft>

BEANSTANDETE PUNKTE (nur diese beheben, sonst NICHTS am Text ändern):
${violationList}

Schreibe den Entwurfstext neu und behebe dabei AUSSCHLIESSLICH die oben genannten Punkte (z.B.
eine falsche Zahl korrigieren oder ganz entfernen, eine pauschale Aussage differenzieren oder
weglassen). Ton, Länge, Struktur und alle nicht beanstandeten Aussagen bleiben unverändert.
Erfinde KEINE neue Zahl, um eine entstehende Lücke zu füllen - ist eine Aussage ohne die falsche
Zahl nicht mehr haltbar, lass sie ersatzlos weg, statt sie zu ersetzen.${executionAdviceWarning}
Antworte NUR mit dem neuen Feedback-Text selbst, keine Erklärung, kein JSON, keine
Anführungszeichen darum.`;
}

/**
 * Dritter OpenAI-Call (nur bei AI_VERIFIER_MODE=active UND tatsächlich gefundenem Verstoß):
 * korrigiert einen beanstandeten Entwurf gezielt. Nutzt denselben System-Prompt wie die
 * Haupt-Generierung (getCoachSystemPromptText), damit Ton/Regeln konsistent bleiben - nur der
 * User-Prompt unterscheidet sich (Korrektur-Auftrag statt Trainingsdaten-Analyse).
 *
 * @param {Object} structuredAnalysis
 * @param {string} feedbackText
 * @param {Array} violations
 * @param {Object} [options] - { requestId }
 * @returns {Promise<string>} korrigierter Feedback-Text
 */
export async function reviseFeedback(structuredAnalysis, feedbackText, violations, options = {}) {
  const { requestId = `revise_${Date.now()}` } = options;
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const userPrompt = buildRevisionUserPrompt(structuredAnalysis, feedbackText, violations);

  logger.debug('🔧 Feedback-Revision gestartet', {
    requestId,
    model,
    violationCount: violations.length,
    rules: violations.map((v) => v.rule)
  });

  await ensureRelayAwake();

  const response = await withAiRetry(async () => client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: getCoachSystemPromptText() },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 500
  }));

  markRelayContact();

  const revised = response.choices?.[0]?.message?.content?.trim();
  if (!revised) {
    const err = new Error('Revision lieferte leere Antwort');
    err.code = 'AI_EMPTY_REVISION';
    throw err;
  }
  return revised;
}

// ---------------------------------------------------------------------------------------------
// Orchestrierung (Shadow-Modus Phase 1 + aktive Korrektur Phase 2)
// ---------------------------------------------------------------------------------------------

/**
 * Klartext-Bezeichnungen der Regeln aus getCoachSystemPromptText() (OpenAIProvider.js) - für
 * die Admin-Auswertung (VerifierAudit.triggeredRules enthält nur Regel-Nummern). Nummerierung
 * identisch zum System-Prompt, damit ein Admin eine dort beanstandete Regel direkt im
 * Prompt-Text wiederfindet.
 */
export const RULE_LABELS = {
  1: 'Datenwahrheit (Zahlen im Text stimmen mit den Rohdaten überein)',
  2: 'Null-Annahmen-Prinzip (keine Aussage zu nicht vorhandenen Werten)',
  3: 'Keine halluzinierten Ursachen für eine Veränderung',
  4: 'Keine Aussage zu Ausführung/Technik/Tempo/Schmerz ohne explizite Notiz',
  5: 'Keine medizinischen Diagnosen',
  6: 'Fakten und Interpretation nicht klar genug getrennt',
  7: 'Endgültiges Urteil statt bedingtem Hinweis bei mehrdeutiger Datenlage',
  8: 'Automatische Wertung einer Gewichts-/Volumenveränderung als positiv/negativ',
  9: 'Einzelne Trainingseinheit überinterpretiert',
  10: 'Trend über mehrere Einheiten unzulässig verallgemeinert',
  11: 'Erfundene Empfehlung ohne Datenbezug oder mehr als 3 Hinweise',
  12: 'Notiz des Nutzers nicht korrekt berücksichtigt',
  13: 'Übungsprofil (profile_hint) nicht beachtet',
  14: 'Technikfokus-Übung anhand von Gewicht/Volumen bewertet',
  15: 'Speed-/Power-Übung anhand von Volumen/Wiederholungen bewertet',
  16: 'Rohzahlen einer Übung stumpf wiederholt (Dopplung zur UI-Übersicht)',
  17: 'Ton/Format: liest sich wie ein Report statt einer kurzen Chat-Nachricht'
};

export function getRuleLabel(ruleNumber) {
  return RULE_LABELS[Number(ruleNumber)] || `Regel ${ruleNumber} (keine Beschreibung hinterlegt)`;
}

export function getVerifierMode() {
  const raw = String(process.env.AI_VERIFIER_MODE || 'off').trim().toLowerCase();
  return raw === 'shadow' || raw === 'active' ? raw : 'off';
}

/**
 * Führt den kompletten Prüf-Loop aus.
 *
 * 'shadow': verhält sich wie bisher - es wird NIE in den Entwurf eingegriffen, egal was
 * gefunden wird. Gedacht als Fire-and-Forget-Aufruf NACH dem Versenden der eigentlichen
 * AI-Antwort an den Nutzer, damit die Prüfung die Antwortzeit nicht verlängert (siehe Aufruf in
 * routes/workouts.js) - `feedbackText` im Rückgabewert entspricht in diesem Modus immer exakt
 * dem übergebenen Text.
 *
 * 'active' (Phase 2): wird ein Verstoß gefunden, unternimmt diese Funktion GENAU EINEN
 * Korrektur-Versuch (reviseFeedback()) und prüft dessen Ergebnis erneut vollständig (beide
 * Stufen). Nur wenn diese Re-Prüfung sauber ist, wird der korrigierte Text zurückgegeben -
 * andernfalls sicherheitshalber der URSPRÜNGLICHE Entwurf (kein zweiter, ungeprüft
 * möglicherweise schlechterer Text). In diesem Modus MUSS der Aufrufer awaiten UND den
 * zurückgegebenen `feedbackText` verwenden (statt des selbst übergebenen), siehe Aufruf in
 * routes/workouts.js.
 *
 * Schlägt ein KI-Aufruf (Prüfung oder Korrektur) selbst fehl (Netzwerk, Timeout, ungültiges
 * JSON), wird das geloggt/protokolliert, aber NIE nach oben geworfen - ein fehlgeschlagener
 * Prüf-/Korrektur-Loop darf niemals den eigentlichen Analyse-Flow beeinträchtigen; der Nutzer
 * bekommt in diesem Fall einfach den ursprünglichen (ungeprüften/unkorrigierten) Entwurf.
 *
 * @param {Object} params
 * @param {Object} params.structuredAnalysis
 * @param {string} params.feedbackText
 * @param {string} [params.requestId]
 * @returns {Promise<{ mode: string, ran: boolean, ok: boolean, triggeredRules: number[], revisionAttempted: boolean, revisionSucceeded: boolean|null, feedbackText: string }>}
 */
export async function runVerificationLoop({ structuredAnalysis, feedbackText, requestId = 'unknown' }) {
  const mode = getVerifierMode();
  if (mode === 'off') {
    return { mode, ran: false, ok: true, triggeredRules: [], revisionAttempted: false, revisionSucceeded: null, feedbackText };
  }

  const deterministic = runDeterministicChecks(feedbackText, structuredAnalysis);

  let aiResult = null;
  let aiCheckFailed = false;
  try {
    aiResult = await verifyFeedbackWithAI(structuredAnalysis, feedbackText, {
      requestId,
      deterministicViolations: deterministic.violations
    });
  } catch (error) {
    aiCheckFailed = true;
    logger.warn('⚠️ Feedback-Verifier: KI-Prüfaufruf fehlgeschlagen', {
      requestId,
      mode,
      error: error.message
    });
  }

  let allViolations = [
    ...deterministic.violations,
    ...(aiResult?.violations || [])
  ];
  let triggeredRules = [...new Set(allViolations.map((v) => v.rule).filter(Boolean))].sort((a, b) => a - b);
  let finalFeedbackText = feedbackText;
  let revisionAttempted = false;
  let revisionSucceeded = null;

  const hasViolation = !deterministic.ok || (aiCheckFailed ? false : !(aiResult?.ok ?? true));

  // Phase 2: aktive Korrektur - nur im 'active'-Modus, nur bei tatsächlich gefundenem Verstoß,
  // nur EIN Versuch (kein Loop/keine mehrfache Selbstkorrektur), um Kosten/Latenz kontrolliert
  // zu halten. Im Normalfall (kein Verstoß) läuft dieser Block gar nicht - keine zusätzlichen
  // Kosten/Latenz gegenüber Shadow-Modus, wenn der Entwurf ohnehin sauber ist.
  if (mode === 'active' && hasViolation && allViolations.length > 0) {
    revisionAttempted = true;
    try {
      const revisedText = await reviseFeedback(structuredAnalysis, feedbackText, allViolations, { requestId });

      // Re-Prüfung der Korrektur (beide Stufen) - ohne das wüssten wir nicht, ob sie
      // tatsächlich gewirkt hat oder das Problem nur verschoben/ein neues erzeugt wurde.
      const revisedDeterministic = runDeterministicChecks(revisedText, structuredAnalysis);
      let revisedAiResult = null;
      let revisedAiCheckFailed = false;
      try {
        revisedAiResult = await verifyFeedbackWithAI(structuredAnalysis, revisedText, {
          requestId,
          deterministicViolations: revisedDeterministic.violations
        });
      } catch (error) {
        revisedAiCheckFailed = true;
        logger.warn('⚠️ Feedback-Verifier: Re-Prüfung der Korrektur fehlgeschlagen', {
          requestId,
          error: error.message
        });
      }

      const revisedOk = revisedDeterministic.ok && (revisedAiCheckFailed || (revisedAiResult?.ok ?? true));

      if (revisedOk) {
        finalFeedbackText = revisedText;
        revisionSucceeded = true;
        triggeredRules = [];
        allViolations = [];
      } else {
        // Sicherheitsentscheidung: lieber den geprüft-fehlerhaften ORIGINALTEXT behalten als
        // einen zweiten, nicht sauber verifizierten Text auszuliefern.
        revisionSucceeded = false;
        const revisedViolations = [
          ...revisedDeterministic.violations,
          ...(revisedAiResult?.violations || [])
        ];
        triggeredRules = [...new Set([
          ...triggeredRules,
          ...revisedViolations.map((v) => v.rule).filter(Boolean)
        ])].sort((a, b) => a - b);
      }
    } catch (error) {
      revisionSucceeded = false;
      logger.warn('⚠️ Feedback-Revision fehlgeschlagen', { requestId, error: error.message });
    }
  }

  logger.debug('🔍 Feedback-Verifier: Prüfung abgeschlossen', {
    requestId,
    mode,
    deterministicOk: deterministic.ok,
    aiOk: aiResult?.ok ?? null,
    aiCheckFailed,
    triggeredRules,
    revisionAttempted,
    revisionSucceeded
  });

  // Anonymisierte, fire-and-forget Protokollierung (siehe VerifierAudit.js) - darf den
  // Aufrufer nicht blockieren oder bei Fehlschlag stören.
  VerifierAudit.create({
    mode,
    deterministicViolation: !deterministic.ok,
    aiViolation: aiCheckFailed ? null : !(aiResult?.ok ?? true),
    triggeredRules,
    revisionAttempted,
    revisionSucceeded,
    aiCheckFailed
  }).catch((e) => {
    logger.warn('⚠️ Konnte VerifierAudit nicht schreiben', { requestId, error: e.message });
  });

  return {
    mode,
    ran: true,
    ok: triggeredRules.length === 0,
    triggeredRules,
    revisionAttempted,
    revisionSucceeded,
    feedbackText: finalFeedbackText
  };
}

export default {
  extractNumbersFromText,
  collectAllowedNumbers,
  checkNumberConsistency,
  checkWordBudget,
  runDeterministicChecks,
  isKeywordBackedRule4Violation,
  isQuoteVerifiable,
  getVerifierChecklistText,
  buildVerifierUserPrompt,
  verifyFeedbackWithAI,
  buildRevisionUserPrompt,
  reviseFeedback,
  getVerifierMode,
  runVerificationLoop,
  RULE_LABELS,
  getRuleLabel
};
