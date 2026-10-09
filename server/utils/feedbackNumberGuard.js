// Letzte Sicherung vor dem Ausliefern eines KI-Feedbacks: Nennt der Text eine Zahl, die in den
// Trainingsdaten nicht vorkommt (checkNumberConsistency, Regel 1 "Datenwahrheit"), wird er NICHT
// ausgeliefert - auch dann nicht, wenn die Korrektur im Verifier-Loop gescheitert ist.
//
// User-Report 04.10.: "du hast dich auf 27,5 kg gesteigert" bei Weighted Pull-Ups - die Zahl
// stand nirgends in den Daten. Der Verifier erkannte das, lieferte nach gescheiterter Korrektur
// aber bewusst den Originaltext aus. Stattdessen jetzt ein fester Hinweis; die Zahlen zeigt die
// App ohnehin deterministisch in der Übersicht darüber (AiFeedbackDeltaSummary.vue), die
// "Nächstes Mal"-Zeile (nextSessionFocus.js) wird wie sonst angehängt.

import { checkNumberConsistency } from '../services/feedbackVerificationService.js';

const WITHHELD_TEXT = {
  de: 'Die KI-Auswertung hat eine Zahl genannt, die nicht zu deinen Trainingsdaten passt, und wird deshalb nicht angezeigt. Deine Werte im Vergleich zur letzten Session siehst du in der Übersicht oben.',
  en: "The AI summary mentioned a number that doesn't match your training data, so it isn't shown. Your numbers compared to your last session are in the overview above."
};

export function withheldFeedbackText(language = 'de') {
  return language === 'en' ? WITHHELD_TEXT.en : WITHHELD_TEXT.de;
}

/**
 * @param {string} feedbackText - KI-Text (nach Verifier, vor der "Nächstes Mal"-Zeile)
 * @param {Object} structuredAnalysis - Ergebnis von structureAnalysisForAI()
 * @returns {{ text: string, withheld: boolean, invalidNumbers: number[] }}
 */
export function guardFeedbackNumbers(feedbackText, structuredAnalysis, { forceWithhold = false } = {}) {
  const check = checkNumberConsistency(feedbackText, structuredAnalysis);
  // forceWithhold: der Verifier-Loop hat einen Zahlen-Fund (z.B. falsche kg-Angabe der Prüf-KI)
  // nicht korrigieren können (runVerificationLoop -> withholdText).
  if (check.ok && !forceWithhold) return { text: feedbackText, withheld: false, invalidNumbers: [] };
  return {
    text: withheldFeedbackText(structuredAnalysis?.response_language),
    withheld: true,
    invalidNumbers: check.violations.map((v) => v.value)
  };
}
