/**
 * OpenAI Provider
 *
 * Produktions-Implementation des AI Providers.
 * Nutzt OpenAI API für Trainings-Feedback-Generierung.
 * Sendet NUR strukturierte Backend-Daten, keine Rohdaten.
 */

import { OpenAI } from 'openai';
import { logger } from '../utils/logger.js';
import AIProvider from './AIProvider.js';

// WICHTIG: Lazy-Load von ENV-Variablen (nicht beim Import)
// Sonst sind sie noch undefined wenn dotenv.config() nicht aufgerufen wurde

export class OpenAIProvider extends AIProvider {
  constructor() {
    super();

    // Lazy-Load: Lies ENV-Variablen hier im Constructor, nicht beim Module-Import
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const timeout = Math.max(5000, Number(process.env.OPENAI_TIMEOUT_MS) || 30000);

    this.model = model;
    this.timeout = timeout;

    if (!apiKey) {
      logger.warn('⚠️ OPENAI_API_KEY not configured. OpenAI provider will not work.');
      this.client = null;
    } else {
      try {
        this.client = new OpenAI({
          apiKey: apiKey,
          timeout: timeout
        });
        logger.info(`✅ OpenAI Provider initialized (model: ${model})`);
      } catch (error) {
        logger.error('❌ Failed to initialize OpenAI client:', error.message);
        this.client = null;
      }
    }
  }

  /**
   * Generiere Trainings-Analyse mittels OpenAI
   *
   * @param {Object} trainingAnalysis - Strukturierte Trainingsanalyse von Backend
   * @param {Object} options - { requestId, temperature }
   * @returns {Promise<string>} Generiertes Feedback
   */
  async generateTrainingAnalysis(trainingAnalysis, options = {}) {
    const { requestId = 'unknown', temperature = 0.7 } = options;

    if (!this.client) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY.');
    }

    try {
      logger.debug('🔄 OpenAI request started', {
        requestId,
        model: this.model,
        exerciseCount: trainingAnalysis.total_exercises_analyzed
      });

      // Baue strukturierten Prompt
      const prompt = this.buildPrompt(trainingAnalysis);

      // Rufe OpenAI auf
      // WICHTIG: `timeout` ist beim openai-SDK ein Request-OPTIONS-Parameter (2. Argument),
      // kein Feld des Request-Bodys. Stand er im Body-Objekt, schickte der SDK-Client ihn als
      // unbekanntes JSON-Feld mit an die API -> "400 Unrecognized request argument supplied:
      // timeout". Der Client-Timeout (this.timeout) greift ohnehin schon global über die
      // `new OpenAI({ timeout })`-Konfiguration im Constructor; hier zusätzlich als
      // Options-Argument gesetzt, falls ein Request abweichend länger/kürzer dauern soll.
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        max_tokens: 800
      }, {
        timeout: this.timeout
      });

      const feedback = response.choices?.[0]?.message?.content?.trim();

      if (!feedback) {
        throw new Error('OpenAI returned empty response');
      }

      logger.debug('✅ OpenAI request completed', {
        requestId,
        model: this.model,
        feedbackLength: feedback.length,
        tokensUsed: response.usage?.total_tokens
      });

      return feedback;

    } catch (error) {
      logger.error('❌ OpenAI request failed', {
        requestId,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * System-Prompt mit Regeln
   * Definiert was das Modell darf und darf nicht
   */
  getSystemPrompt() {
    return `Du bist ein sachlicher und präziser Fitness-Coach.
Deine Aufgabe: Beschreibe den Trainingsverlauf rein neutral und wertfrei anhand der
Backend-Berechnungen - keine Bewertung als gut/schlecht, positiv/negativ, nur Fakten und
nachvollziehbare Einordnung. Das Ziel des Nutzers ist langfristige körperliche Entwicklung
(Kraft, Leistungsfähigkeit) - deine Aufgabe ist NICHT, aus den Trainingsdaten definitive
Aussagen über seine tatsächliche Leistungsfähigkeit oder deren Ursachen abzuleiten (die App
erfasst nur einen Ausschnitt des Trainings, siehe Regel 4).

Dabei gehst du so vor:
1. Relevante Veränderungen in den Daten erkennen.
2. Sie im Kontext der Übung und vorhandener Notizen einordnen.
3. Fakten und mögliche Interpretationen klar trennen.
4. Auf relevante Punkte aufmerksam machen.
5. Hilfreiche, unaufdringliche Hinweise für künftige Einheiten geben.

KRITISCHE REGELN:
1. DATENWAHRHEIT:
   - Die vom Backend gelieferten Zahlen sind VERBINDLICH. Berechne sie NICHT neu (z.B.
     "+15,4%" bleibt "+15,4%", nicht "ungefähr 15%").
   - Keine neuen Kennzahlen erfinden, keine fehlenden Werte schätzen oder plausibel ergänzen.
   - Nur Informationen verwenden, die explizit in den bereitgestellten Daten stehen.

2. NULL-ANNAHMEN-PRINZIP - was nicht in den Daten steht, existiert für diese Analyse nicht:
   - Körpergewicht (athlete_bodyweight_kg) NUR erwähnen/bewerten, wenn explizit angegeben.
     Verwechsle es niemals mit Trainingsgewicht (kg auf der Hantel) - komplett unabhängige
     Werte.
   - Fehlende Felder/Trainingsdaten NICHT rekonstruieren oder vermuten. Fehlt eine
     Information für eine Aussage, lass die Aussage weg statt sie zu erraten.

3. KEINE Halluzinierten Ursachen - eine Veränderung darf nicht automatisch mit einer nicht
   belegten Ursache erklärt werden:
   - Nicht: "Du hast Fett verloren" / "Deine Muskeln sind gewachsen" (wenn nur
     Gewichtsverlust bzw. nur eine Zahl in den Daten steht)
   - Ja: "Dein Körpergewicht ist um 1,7% gesunken. Die Ursache ist anhand der Daten nicht
     bestimmbar."
   - Mögliche Ursachen dürfen nur als Möglichkeit genannt werden ("könnte an ... liegen"),
     niemals als feststehende Erklärung.

4. BEGRENZTE DATENPERSPEKTIVE - die App erfasst nur einen Teil des tatsächlichen Trainings.
   Nicht zuverlässig beurteilbar sind u.a.: Ausführungsqualität, Bewegungstempo, Technik,
   subjektive Anstrengung/Tagesform, Schmerzen (sofern nicht dokumentiert), ob eine
   Belastungsänderung bewusst gewählt wurde.
   - Eine Veränderung der aufgezeichneten Trainingsdaten ist deshalb NICHT automatisch eine
     Verbesserung oder Verschlechterung der tatsächlichen Leistungsfähigkeit.
   - Bevorzuge Formulierungen wie "In den aufgezeichneten Daten zeigt sich..." oder
     "Dokumentiert ist..." statt "Du bist stärker/schwächer geworden".

5. KEINE Medizinischen Diagnosen:
   - Behaupte nicht: Verletzungen, Überlastungen, Gelenkprobleme, Regenerationsprobleme
   - Diese dürfen nur erwähnt werden, wenn sie explizit in den Daten stehen - auch dann
     keine Diagnose, nur Wiedergabe.

6. FAKTEN UND INTERPRETATION TRENNEN, wo sinnvoll:
   - Fakt: was steht in den Daten (z.B. "Trainingsgewicht erhöht, Wiederholungszahl
     gesunken").
   - Interpretation: was diese Veränderung bedeuten könnte, niemals als Tatsache formuliert.
   - Hinweis: worauf der Nutzer bei den nächsten Einheiten achten könnte.
   Ohne ausreichende Grundlage NICHT ableiten: "Du bist stärker geworden" oder "Du musst das
   Gewicht wieder reduzieren".

7. HINWEISE STATT ENDGÜLTIGER URTEILE - bei nicht eindeutig interpretierbaren Daten keine
   definitive Anweisung, sondern eine bedingte Formulierung. Statt "Reduziere das Gewicht":
   "Falls die Ausführung unter der höheren Belastung gelitten hat, könnte es sinnvoll sein,
   die Belastung zunächst zu halten." Halte solche Hinweise knapp (Wortbudget beachten) -
   nicht jede theoretisch mögliche Variante aufzählen, nur die für die konkrete Situation
   relevante.

8. KEINE AUTOMATISCHE BEWERTUNG VON GEWICHTS-/VOLUMENVERÄNDERUNGEN - weder eine
   Gewichtssteigerung noch ein Volumenrückgang sind automatisch positiv bzw. negativ, auch
   nicht in Kombination. Mehr Gewicht bei weniger Wiederholungen/Sätzen kann ein bewusster
   Tausch von Volumen gegen Intensität sein, keine Abweichung, die korrigiert werden muss.
   Ohne Angaben zu Ausführung/Technik lässt sich das allein anhand der Zahlen nicht
   bewerten - beide Fakten neutral nebeneinanderstellen, nicht gegeneinander aufrechnen.
   Gleiches gilt umgekehrt für eine Gewichtsreduzierung.

9. EINZELNE EINHEIT NICHT ÜBERINTERPRETIEREN - eine einzelne Trainingseinheit ist keine
   langfristige Entwicklung. Abweichungen können mit Tagesform, Müdigkeit oder bewusster
   Trainingssteuerung zusammenhängen - als mögliche Erklärung nennen, wenn relevant, niemals
   als tatsächliche Ursache behaupten, wenn nicht dokumentiert.

10. TRENDS ÜBER MEHRERE EINHEITEN - bei vorhandenem Verlauf über mehrere Einheiten: einzelne
    Abweichungen nicht überinterpretieren, wiederkehrende Veränderungen dürfen als Trend
    bezeichnet werden. Ein Trend beschreibt nur die dokumentierten Trainingsdaten, nicht
    automatisch die körperliche Entwicklung. Bei widersprüchlichen Daten keine eindeutige
    Entwicklung behaupten.

11. Keine Empfehlung ohne konkreten Handlungsbedarf:
    - Nicht jede Übung oder jeder Abschnitt braucht eine Empfehlung. Gibt es nichts
      Konkretes, das der Nutzer ändern sollte, dann keine Empfehlung erfinden, sondern
      weglassen.
    - Eine Empfehlung nur aussprechen, wenn sie sich direkt aus einer Zahl, einem Trend oder
      einem Datenpunkt ableiten lässt (siehe Regel 7) - keine generischen Trainingstipps
      "zur Sicherheit". Maximal 3 Hinweise insgesamt.

12. Notizen des Nutzers sind verbindlicher Kontext, keine Meinung:
    - Wenn eine Übung eine Notiz hat, erkläre die Zahlen dieser Übung im Licht der Notiz,
      bevor du sie einordnest
    - Stagnation oder fehlende Gewichtssteigerung NICHT wertend kommentieren, wenn die Notiz
      das erklärt (z.B. technikfokussierte Übung ohne Zusatzgewicht, bewusstes Deload,
      Verletzung/Vorsicht, Formfokus) - einfach neutral benennen, was die Notiz sagt
    - Notizen nicht überinterpretieren oder verallgemeinern - nutze nur, was explizit dasteht
    - Übungen ohne Notiz weiterhin normal anhand der Zahlen bewerten
    - Manche Übungen haben ZWEI Notiz-Ebenen: "Persönliche Notiz" (dauerhaft, gilt für den
      Nutzer bei dieser Übung generell) und "Notiz zu dieser Session" (gilt nur für dieses
      eine Training). Eine BESTÄTIGTE persönliche Notiz ist eine feste Einschränkung/ein
      fester Kontext und bleibt auch dann gültig, wenn die aktuelle Session keine eigene
      Notiz enthält. Widersprich ihr nicht und ignoriere sie nicht, nur weil die
      Session-Notiz fehlt oder etwas anderes betont.

13. Übungsprofil (profile_hint) - falls angegeben, ist es VERBINDLICH dafür, welche Metriken
    bei dieser Übung überhaupt erwähnt werden dürfen:
    - exerciseType "technique": Ausführungsqualität steht im Fokus, nicht Gewicht/Volumen.
      Gewichtsänderungen bei dieser Übung nicht kommentieren/empfehlen, wenn
      externalLoadRelevant=false.
    - exerciseType "power": Bei higherRepsAreProgress=false sind Wiederholungszahl-Änderungen
      bei dieser Übung nicht die relevante Metrik (z.B. Schnellkraft-/Sprungübungen) - nicht
      kommentieren, nicht "mehr Wiederholungen" als Ziel empfehlen.
    - trainingVolumeRelevant=false: Verändertes Trainingsvolumen fließt nicht in die
      Beschreibung dieser Übung ein.
    - Übungen ohne profile_hint weiterhin normal anhand von Gewicht/Volumen beschreiben
      (Rückfall auf generische Darstellung, kein Blockieren der Analyse).

14. Übungen, deren Notiz auf Technikfokus hinweist (auch wenn kein profile_hint mit
    exerciseType "technique" vorliegt - reicht ein Hinweis wie "Technik", "Form",
    "Bewegungsqualität" in der Notiz selbst):
    - Aus der zahlenbasierten Beschreibung ausschließen. Keine Gewichts-/Prozent-Angaben für
      diese Übung.
    - Maximal EIN neutraler Satz dazu, ohne Empfehlung (z.B. "Bankdrücken war diese Session
      technikfokussiert" reicht, keine weiteren Ausführungen).

15. Speed-/Power-basierte Übungen (Speed Squats, Speed Deadlift und vergleichbare, erkennbar
    an Name oder Notiz):
    - Primäre Metrik ist Ausführungsqualität/Geschwindigkeit, NICHT Volumen oder
      Wiederholungszahl.
    - Weniger Wiederholungen bei gleichzeitig mehr Gewicht rein neutral/deskriptiv angeben
      (z.B. "Gewicht +5kg, Wiederholungen -2"), NIEMALS als Rückgang oder Verschlechterung
      formulieren (weniger Volumen bedeutet hier gerade nicht weniger Leistung).

16. Rohzahlen je Übung NICHT wiederholen - die App zeigt Sätze/Wiederholungen/Gewicht pro
    Übung (aktuell vs. vorherige Session, als reine +/- Zahl) bereits in einer eigenen,
    separaten Übersicht direkt neben deinem Text an. Zähle sie deshalb NICHT nochmal einzeln
    für jede Übung auf ("Bankdrücken: Gewicht 60kg→65kg, Wiederholungen 8→8, Volumen +12%"
    o.ä.) - das wäre eine reine Dopplung.
    - Nenne eine konkrete Zahl nur dort, wo sie zur ERKLÄRUNG/Einordnung gebraucht wird - z.B.
      um eine Notiz, ein Übungsprofil (Regel 13), eine Technikfokus- (Regel 14) oder
      Speed-Übung (Regel 15) verständlich zu machen, oder als Grundlage eines Hinweises
      (Regel 7/11).
    - Die Gesamt-Zusammenfassung (Summe über alle Übungen: Anzahl Übungen, grober Überblick)
      bleibt erlaubt und sinnvoll - gemeint ist die Vermeidung der Einzelübungs-Wiederholung.

17. STRIKT NEUTRALE, WERTFREIE SPRACHE - das ist die wichtigste Stilregel:
    - Gib Veränderungen (Gewicht, Wiederholungen, Volumen, Sätze) ausschließlich als reine
      Fakten wieder: "Gewicht: 60kg → 65kg (+5kg)", "Volumen: +12%", "Wiederholungen
      unverändert bei 8". Keine Einordnung, ob das gut, schlecht, viel oder wenig ist.
    - Verwende KEINE wertenden Begriffe oder Formulierungen - weder positiv noch negativ -
      wie z.B. "gut", "schlecht", "stark", "schwach", "leider", "erfreulich", "solide",
      "moderat", "deutlich verbessert/verschlechtert", "Fortschritt", "Rückgang",
      "Verbesserung", "Verschlechterung", "Erfolg", "Problem".
    - Auch keine impliziten Wertungen durch Tonfall, Ausrufezeichen, Lob oder Relativierung
      ("nur", "immerhin", "schon", "leider nur").
    - Kein Fitness-Influencer-Sprech, keine Motivationsfloskeln, keine künstliche
      Positivität oder Negativität.
    - Der Nutzer soll die Zahlen selbst einordnen - deine Aufgabe ist es, sie klar,
      vollständig und ohne Einfärbung darzustellen, nicht sie zu bewerten.
    - Das gilt auch für die Gesamtzusammenfassung und das Fazit: keine Gesamteinschätzung
      wie "insgesamt ein gutes Training" - stattdessen eine neutrale Zusammenfassung der
      wichtigsten Zahlen.

OUTPUT-FORMAT:
Ungefähr 150-300 Wörter (kürzer als bisher, da die Einzelzahlen je Übung nicht mehr im Text
stehen - siehe Regel 16). Struktur - durchgehend neutral, siehe Regel 17. Die folgenden
Punkte sind Gliederungshilfen für dich, KEINE sichtbaren Überschriften im Ausgabetext:
- Zusammenfassung (kurz, wertfrei: wie viele Übungen analysiert, grober Überblick über
  dokumentierte Veränderungen - keine Einzelübungs-Zahlen, die stehen bereits in der
  separaten Übersicht)
- Einordnung/Kontext je Übung, wo nötig (nur wenn eine Notiz, ein Übungsprofil, Technikfokus,
  eine Speed-Übung oder ein Trend über mehrere Einheiten eine Erklärung braucht, damit die
  Zahlen in der separaten Übersicht nicht falsch verstanden werden - siehe Regel 16.
  Übungen ohne besonderen Kontext brauchen keinen eigenen Absatz.)
- Hinweise (max 3, nur wenn konkret ableitbar - siehe Regel 11, sonst weglassen), als
  Entscheidungshilfe formuliert (Regel 7), nicht als absolute Anweisung
- Abschluss (1-2 Sätze, kein Zahlen-Recap, keine Gesamteinschätzung, keine neuen Infos)

Priorisiere statt alle Daten zu wiederholen.
Spreche den Nutzer direkt an (Du/Dein, nicht "Der Nutzer").
Deutsch, sachlich, konkret, wertfrei.`;
  }

  /**
   * Baue Prompt aus strukturierten Trainings-Daten
   * Sendeet NUR Mini-Datensatz, nicht Rohdaten
   */
  buildPrompt(trainingAnalysis) {
    const exercises = trainingAnalysis.exercises || [];
    const topImprovements = trainingAnalysis.top_improvements || [];
    const topDeclines = trainingAnalysis.top_declines || [];

    let prompt = `# Trainingsdaten-Übersicht

## Zusammenfassung
- Analysierte Übungen: ${trainingAnalysis.total_exercises_analyzed}${
  trainingAnalysis.athlete_bodyweight_kg != null
    ? `\n- Körpergewicht des Nutzers (diese Session): ${trainingAnalysis.athlete_bodyweight_kg}kg`
    : ''
}

## Größte Volumenveränderungen nach oben
${topImprovements.length > 0
  ? topImprovements.map(e => `- ${e.exercise}: Volumen +${e.volume_change_percent}%, Gewicht ${e.weight_change_kg > 0 ? '+' : ''}${e.weight_change_kg}kg`).join('\n')
  : '- Keine nennenswerten Veränderungen'}

## Größte Volumenveränderungen nach unten
${topDeclines.length > 0
  ? topDeclines.map(e => `- ${e.exercise}: Volumen ${e.volume_change_percent}%, Gewicht ${e.weight_change_kg > 0 ? '+' : ''}${e.weight_change_kg}kg`).join('\n')
  : '- Keine nennenswerten Veränderungen'}

## Detaillierte Übungsdaten
${exercises
  .map(ex => {
    let exPrompt = `### ${ex.exercise}
- Zeitraum: ${ex.period_description} (${ex.period_days} Tage)

**Aktuelle Leistung:**
- Gewicht: ${ex.current_weight}kg
- Wiederholungen: ${ex.current_reps}
- Volumen: ${ex.current_volume}kg (kumulativ)`;

    if (ex.previous_weight !== undefined) {
      exPrompt += `

**Vorherige Leistung:**
- Gewicht: ${ex.previous_weight}kg
- Wiederholungen: ${ex.previous_reps}
- Volumen: ${ex.previous_volume}kg

**Veränderung:**
- Gewicht: ${ex.changes.weight_change_kg > 0 ? '+' : ''}${ex.changes.weight_change_kg}kg
- Wiederholungen: ${ex.changes.reps_change > 0 ? '+' : ''}${ex.changes.reps_change}
- Volumen: ${ex.changes.volume_change_percent > 0 ? '+' : ''}${ex.changes.volume_change_percent}%`;
    }

    if (ex.profile_hint?.exerciseType) {
      const p = ex.profile_hint;
      const relevantMetrics = [
        p.externalLoadRelevant ? 'Gewicht' : null,
        p.trainingVolumeRelevant ? 'Volumen' : null,
        p.higherRepsAreProgress ? 'Wiederholungen' : null
      ].filter(Boolean);
      exPrompt += `

**Übungsprofil:** Typ "${p.exerciseType}"${p.targetRepRange?.min != null || p.targetRepRange?.max != null
        ? `, Ziel-Wiederholungsbereich ${p.targetRepRange?.min ?? '?'}-${p.targetRepRange?.max ?? '?'}`
        : ''}. Relevante Metriken für diese Übung: ${relevantMetrics.length > 0 ? relevantMetrics.join(', ') : 'keine der üblichen (Gewicht/Volumen/Reps) - siehe Übungsprofil-Regel'}.`;
    }

    // Kap. 25: persistente Notiz (Rang 1/2) und Session-Notiz getrennt ausgeben, damit die AI
    // sie gemäß Notizen-Regel unterschiedlich gewichtet, statt sie zu vermischen.
    if (ex.note_context?.persistent) {
      exPrompt += `

**Persönliche Notiz${ex.note_context.persistent.confirmed ? ' (bestätigt)' : ' (nicht bestätigt)'}:** "${ex.note_context.persistent.text}"`;
    }
    if (ex.note_context?.session) {
      exPrompt += `

**Notiz zu dieser Session:** "${ex.note_context.session}"`;
    } else if (ex.note && !ex.note_context?.persistent) {
      // Rückfallebene für den Fall, dass note_context aus irgendeinem Grund fehlt, aber das
      // ältere "note"-Feld gesetzt ist (Rückwärtskompatibilität).
      exPrompt += `

**Notiz des Nutzers zu dieser Übung:** "${ex.note}"`;
    }

    return exPrompt;
  })
  .join('\n\n')}

Analysiere diese Daten und erstelle strukturiertes Feedback nach den Regeln.`;

    return prompt;
  }

  /**
   * Health Check
   */
  async healthCheck() {
    if (!this.client) {
      return false;
    }

    try {
      // Versuche Liste der Modelle zu abrufen (schneller Check)
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.warn('OpenAI health check failed:', error.message);
      return false;
    }
  }

  /**
   * Provider-Name
   */
  getName() {
    return 'OpenAI';
  }

  /**
   * Modell-Name
   */
  getModelName() {
    return this.model;
  }
}

export default OpenAIProvider;
