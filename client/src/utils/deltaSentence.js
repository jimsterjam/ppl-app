// Vergleichssatz je Übung (aktuelle vs. letzte Session) für die Feedback-Übersicht
// (AiFeedbackDeltaSummary.vue). Ausgelagert, damit die Regeln ohne Vue testbar sind.
//
// Gewicht (siehe resolveSatzgenauWeightChange in server/services/trainingAnalysisService.js):
//   uniform / partial      -> eine Zahl (bei partial mit Satznummern)
//   increased / decreased  -> alle Sätze gleiche Richtung, unterschiedlich viel: Spanne
//   mixed                  -> Sätze gegenläufig (z.B. verschobene Pyramide): kein Satz-für-Satz-
//                             Vergleich, sondern schwerster Satz + insgesamt bewegtes Gewicht
//                             (alte Einträge ohne top_weight_kg: neutraler Hinweis + Gesamtbilanz)
//
// "eine klare Steigerung" nur, wenn mindestens ein Wert gestiegen und keiner gesunken ist.

// Gesamtbilanz erst ab dieser Änderung (in %) erwähnen/werten.
export const VOLUME_MENTION_MIN_PERCENT = 1

/**
 * @param {object} item - Eintrag aus ai_analysis_snapshot
 * @param {(key:string, params?:object)=>string} t - i18n
 * @param {(value:number)=>string} fmt - Zahl formatieren (Betrag, Locale)
 */
export function buildDeltaSentence(item = {}, t, fmt) {
  const setsChange = Number(item.sets_change) || 0
  const repsChange = Number(item.reps_change) || 0
  const weightChangeKg = Number(item.weight_change_kg) || 0
  const scope = item.weight_change_scope || 'unknown'
  const setNumbers = Array.isArray(item.weight_change_set_numbers) ? item.weight_change_set_numbers : []
  const volumePct = Number(item.volume_change_percent) || 0
  const hasTop = typeof item.top_weight_kg === 'number'
  const topChange = Number(item.top_weight_change_kg) || 0

  const weightClauses = []
  // Werte für die Steigerungs-Wertung (Vorzeichen zählt).
  const signals = []

  if (scope === 'mixed') {
    if (hasTop) {
      const key = topChange > 0 ? 'deltaTopUp' : topChange < 0 ? 'deltaTopDown' : 'deltaTopSame'
      weightClauses.push(t(`feedbackHistory.${key}`, { kg: fmt(item.top_weight_kg), change: fmt(topChange) }))
      if (topChange !== 0) signals.push(topChange)
    } else {
      weightClauses.push(t('feedbackHistory.deltaWeightMixed'))
    }
    if (Math.abs(volumePct) >= VOLUME_MENTION_MIN_PERCENT) {
      weightClauses.push(t(volumePct > 0 ? 'feedbackHistory.deltaVolumeUp' : 'feedbackHistory.deltaVolumeDown', { pct: fmt(volumePct) }))
      signals.push(volumePct)
    }
  } else if ((scope === 'increased' || scope === 'decreased') && typeof item.weight_change_min_kg === 'number') {
    weightClauses.push(t(scope === 'increased' ? 'feedbackHistory.deltaWeightUpRange' : 'feedbackHistory.deltaWeightDownRange', {
      min: fmt(item.weight_change_min_kg),
      max: fmt(item.weight_change_max_kg)
    }))
    signals.push(scope === 'increased' ? 1 : -1)
  } else if (weightChangeKg !== 0) {
    if (scope === 'partial' && setNumbers.length > 0) {
      weightClauses.push(t(
        weightChangeKg > 0 ? 'feedbackHistory.deltaWeightMoreInSet' : 'feedbackHistory.deltaWeightLessInSet',
        { kg: fmt(weightChangeKg), sets: formatSetList(setNumbers, t) }
      ))
    } else {
      weightClauses.push(t(
        weightChangeKg > 0 ? 'feedbackHistory.deltaWeightMore' : 'feedbackHistory.deltaWeightLess',
        { kg: fmt(weightChangeKg) }
      ))
    }
    signals.push(weightChangeKg)
  }

  const weightChanged = scope === 'mixed' || weightClauses.length > 0
  const parts = []
  if (weightClauses.length) parts.push(weightClauses.join(', '))
  if (repsChange !== 0) {
    parts.push(t(repsChange > 0 ? 'feedbackHistory.deltaRepsMore' : 'feedbackHistory.deltaRepsLess', { n: fmt(repsChange) }))
    signals.push(repsChange)
  }
  if (setsChange !== 0) {
    parts.push(t(setsChange > 0 ? 'feedbackHistory.deltaSetsMore' : 'feedbackHistory.deltaSetsLess', { n: fmt(setsChange) }))
    signals.push(setsChange)
  }

  if (!parts.length) return t('feedbackHistory.deltaNoChange')

  // Nachsatz: was gleich geblieben ist (nach Kategorien Gewicht / Wdh. / Sätze).
  const changedCount = [weightChanged, repsChange !== 0, setsChange !== 0].filter(Boolean).length
  let suffix = ''
  if (changedCount === 1) {
    if (weightChanged) suffix = t('feedbackHistory.deltaSuffixWeightChanged')
    else if (repsChange !== 0) suffix = t('feedbackHistory.deltaSuffixRepsChanged')
    else suffix = t('feedbackHistory.deltaSuffixSetsChanged')
  } else if (changedCount === 2) {
    if (!weightChanged) suffix = t('feedbackHistory.deltaSuffixOnlyWeightUnchanged')
    else if (repsChange === 0) suffix = t('feedbackHistory.deltaSuffixOnlyRepsUnchanged')
    else suffix = t('feedbackHistory.deltaSuffixOnlySetsUnchanged')
  }

  const isImprovement = signals.length > 0 && signals.every((v) => v > 0)
  let sentence = parts.join(` ${t('feedbackHistory.deltaAnd')} `)
  if (suffix) sentence += `, ${suffix}`
  sentence += isImprovement ? ` – ${t('feedbackHistory.deltaImprovement')}.` : '.'
  return sentence
}

// "3" oder "1, 2 und 3"
function formatSetList(setNumbers, t) {
  const sorted = [...(setNumbers || [])].sort((a, b) => a - b)
  if (sorted.length <= 1) return String(sorted[0] ?? '')
  const last = sorted[sorted.length - 1]
  return `${sorted.slice(0, -1).join(', ')} ${t('feedbackHistory.deltaAnd')} ${last}`
}
