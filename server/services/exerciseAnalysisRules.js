/**
 * exerciseAnalysisRules
 *
 * Korrektheits-Regel-Engine für den KI-Coach (Konzept-PDF Kap. 24-26, "Verbindliche
 * Korrektur der KI-Feedbackanalyse"). Stufenweise Umsetzung per User-Entscheidung:
 * NUR Korrektheit in dieser Phase - liefert weiterhin Plain-Text-taugliche Daten,
 * KEIN JSON-Schema, KEIN evidenceRefs/statementType, KEIN F-01-F10-Validator (das ist
 * eine spätere, separate Phase).
 *
 * Reine Funktionen, keine DB-Zugriffe - Aufrufer (trainingAnalysisService.js, später die
 * /ai-analysis Route in Phase 3) übergeben bereits geladene Exercise.metricProfile- bzw.
 * UserExerciseNote-Dokumente.
 */

/**
 * Bestimme den Trend unter Berücksichtigung des metricProfile einer Übung.
 * Fällt auf das bisherige, rein gewicht-/volumenbasierte Verhalten zurück, wenn kein
 * Profil vorliegt (exerciseType null/undefined) - 100% rückwärtskompatibel zu
 * determineTrend() für den bestehenden Datenbestand ohne metricProfile.
 *
 * Kap. 26 Regeln:
 * - technique: externalLoadRelevant=false -> Gewichtsänderung darf NICHT in die Bewertung
 *   einfließen (z.B. reine Technikübungen wie Handstand-Progressionen).
 * - power: higherRepsAreProgress=false -> mehr Wiederholungen sind KEIN Fortschritt
 *   (z.B. Speed Squats - dort zählt Ausführungsgeschwindigkeit, nicht Volumen).
 * - trainingVolumeRelevant=false -> Volumenveränderung fließt nicht in die Bewertung ein.
 *
 * @param {Object} params
 * @param {number} params.weightChange - Kg-Differenz
 * @param {number} params.volumeChangePercent - Prozentuale Volumenveränderung
 * @param {number} [params.repsChange] - Differenz Wiederholungen
 * @param {Object|null} [params.profile] - Exercise.metricProfile (ggf. durch resolveEffectiveProfile gemergt)
 * @returns {string} 'positive' | 'negative' | 'stable'
 */
export function determineTrendWithProfile({ weightChange, volumeChangePercent, repsChange = 0, profile = null }) {
  // Kein Profil hinterlegt -> bisheriges generisches Verhalten (Null-Annahmen-Prinzip:
  // ohne Profildaten darf keine übungsspezifische Annahme getroffen werden).
  if (!profile || !profile.exerciseType) {
    return genericTrend(weightChange, volumeChangePercent);
  }

  const externalLoadRelevant = profile.externalLoadRelevant !== false;
  const volumeRelevant = profile.trainingVolumeRelevant !== false;
  const higherRepsAreProgress = profile.higherRepsAreProgress !== false;

  const effectiveWeightChange = externalLoadRelevant ? weightChange : 0;
  const effectiveVolumeChangePercent = volumeRelevant ? volumeChangePercent : 0;
  const effectiveRepsChange = higherRepsAreProgress ? repsChange : 0;

  // Reine Technikübung ohne relevante externe Last und ohne Volumenbewertung:
  // Backend kann ohne zusätzliche Qualitäts-/Erfolgsdaten (noch nicht erfasst) keinen
  // Trend ableiten -> 'stable' statt einer unbelegten Aussage (Null-Annahmen-Prinzip).
  if (!externalLoadRelevant && !volumeRelevant && profile.exerciseType === 'technique') {
    return 'stable';
  }

  if (effectiveWeightChange > 0 || effectiveVolumeChangePercent > 5 || effectiveRepsChange > 0 && higherRepsAreProgress && profile.exerciseType !== 'power') {
    return 'positive';
  }
  if (effectiveWeightChange < -2 || effectiveVolumeChangePercent < -5) {
    return 'negative';
  }
  return 'stable';
}

function genericTrend(weightChange, volumeChange) {
  if (weightChange > 0 || volumeChange > 5) return 'positive';
  if (weightChange < -2 || volumeChange < -5) return 'negative';
  return 'stable';
}

/**
 * Mische globales metricProfile (Rang 3) mit einer optionalen UserExerciseNote (Rang 1/2)
 * gemäß der Prioritätsreihenfolge aus Kap. 25.1. Eine BESTÄTIGTE Nutzer-Notiz (isConfirmed)
 * überschreibt einzelne Felder des globalen Profils; eine unbestätigte hat schwächere
 * Priorität, überschreibt aber weiterhin ein fehlendes/generisches globales Profil.
 *
 * @param {Object|null} globalProfile - Exercise.metricProfile (Rang 3) oder null
 * @param {Object|null} userNote - UserExerciseNote-Dokument (Rang 1/2) oder null
 * @returns {Object|null} effektives Profil für determineTrendWithProfile(), oder null wenn nichts vorliegt
 */
export function resolveEffectiveProfile(globalProfile = null, userNote = null) {
  if (!globalProfile && !userNote) return null;

  const merged = globalProfile ? { ...globalProfile } : {};
  const overrides = userNote?.overrides;

  if (overrides) {
    if (overrides.exerciseType) merged.exerciseType = overrides.exerciseType;
    if (overrides.externalLoadRelevant !== null && overrides.externalLoadRelevant !== undefined) {
      merged.externalLoadRelevant = overrides.externalLoadRelevant;
    }
    if (overrides.targetRepRange && (overrides.targetRepRange.min != null || overrides.targetRepRange.max != null)) {
      merged.targetRepRange = overrides.targetRepRange;
    }
  }

  // Ohne mindestens einen exerciseType ist kein spezifisches Profil auswertbar ->
  // Aufrufer soll dann wie "kein Profil" (generischer Fallback) behandelt werden.
  if (!merged.exerciseType) return null;

  return merged;
}

/**
 * Merge persistente exerciseNote (Rang 1/2, session-übergreifend) mit der sessionNote
 * dieses einen Workouts (bestehendes Feld Workout.exercises[].note) zu einem einzigen,
 * für den AI-Prompt verwendbaren Notiz-Kontext. Beide werden ausgegeben und mit ihrer
 * Priorität/Herkunft gekennzeichnet, statt sich gegenseitig zu ersetzen - eine bestätigte
 * persistente Einschränkung ("Knieprobleme, keine tiefen Kniebeugen") bleibt auch dann
 * gültig, wenn diese Session keine eigene Notiz enthält, und umgekehrt.
 *
 * @param {Object} params
 * @param {string|null} [params.sessionNote] - Workout.exercises[].note dieser Session
 * @param {Object|null} [params.userNote] - UserExerciseNote-Dokument (persistent)
 * @returns {Object|null} { persistent: {text, confirmed}|null, session: string|null } oder null wenn beides leer
 */
export function buildNoteContext({ sessionNote = null, userNote = null } = {}) {
  const trimmedSession = typeof sessionNote === 'string' ? sessionNote.trim() : '';
  const persistent = userNote?.noteText
    ? { text: userNote.noteText, confirmed: !!userNote.isConfirmed }
    : null;

  if (!trimmedSession && !persistent) return null;

  return {
    persistent,
    session: trimmedSession || null
  };
}

export default {
  determineTrendWithProfile,
  resolveEffectiveProfile,
  buildNoteContext
};
