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
// Wiederholungen (reps_set_changes, siehe resolveRepsSetChanges in trainingAnalysisService.js):
//   je Satz mit Änderung, gleiche Änderung zusammengefasst ("1 Wdh. mehr (Satz 1 und 2), 1 Wdh.
//   weniger (Satz 7)"). Ältere Einträge ohne reps_set_changes zeigen weiter die Gesamt-Differenz.
//   Alle Fakten zu Sätzen kommen aus dieser Berechnung - der KI-Text nennt sie nie (siehe
//   server/utils/feedbackFactGuard.js).
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

  // null = älterer Eintrag ohne Satz-Daten zu den Wiederholungen
  const repsSetChanges = Array.isArray(item.reps_set_changes)
    ? item.reps_set_changes.filter((c) => c && Number(c.change) !== 0 && Number.isFinite(Number(c.change)))
    : null

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

  // Wiederholungen: je Satz (neue Einträge) bzw. Gesamt-Differenz (ältere Einträge, oder wenn nur
  // zusätzliche/fehlende Sätze die Summe verändern - dann gibt es keine vergleichbaren Sätze).
  const repsClauses = []
  let repsChanged = false
  if (repsSetChanges) {
    for (const group of groupRepsChanges(repsSetChanges)) {
      repsClauses.push(t(
        group.change > 0 ? 'feedbackHistory.deltaRepsMoreInSet' : 'feedbackHistory.deltaRepsLessInSet',
        { n: fmt(group.change), sets: formatSetList(group.sets, t) }
      ))
      signals.push(group.change)
    }
    repsChanged = repsClauses.length > 0
  }
  if (!repsChanged && repsChange !== 0 && (!repsSetChanges || setsChange !== 0)) {
    repsClauses.push(t(repsChange > 0 ? 'feedbackHistory.deltaRepsMore' : 'feedbackHistory.deltaRepsLess', { n: fmt(repsChange) }))
    signals.push(repsChange)
    repsChanged = true
  }

  const weightChanged = scope === 'mixed' || weightClauses.length > 0
  const parts = []
  if (weightClauses.length) parts.push(weightClauses.join(', '))
  if (repsClauses.length) parts.push(repsClauses.join(', '))
  if (setsChange !== 0) {
    parts.push(t(setsChange > 0 ? 'feedbackHistory.deltaSetsMore' : 'feedbackHistory.deltaSetsLess', { n: fmt(setsChange) }))
    signals.push(setsChange)
  }

  if (!parts.length) return t('feedbackHistory.deltaNoChange')

  // Nachsatz: was gleich geblieben ist (nach Kategorien Gewicht / Wdh. / Sätze).
  const changedCount = [weightChanged, repsChanged, setsChange !== 0].filter(Boolean).length
  let suffix = ''
  if (changedCount === 1) {
    if (weightChanged) suffix = t('feedbackHistory.deltaSuffixWeightChanged')
    else if (repsChanged) suffix = t('feedbackHistory.deltaSuffixRepsChanged')
    else suffix = t('feedbackHistory.deltaSuffixSetsChanged')
  } else if (changedCount === 2) {
    if (!weightChanged) suffix = t('feedbackHistory.deltaSuffixOnlyWeightUnchanged')
    else if (!repsChanged) suffix = t('feedbackHistory.deltaSuffixOnlyRepsUnchanged')
    else suffix = t('feedbackHistory.deltaSuffixOnlySetsUnchanged')
  }

  const isImprovement = signals.length > 0 && signals.every((v) => v > 0)
  let sentence = parts.join(` ${t('feedbackHistory.deltaAnd')} `)
  if (suffix) sentence += `, ${suffix}`
  sentence += isImprovement ? ` – ${t('feedbackHistory.deltaImprovement')}.` : '.'
  return sentence
}

// Gleiche Änderung zusammenfassen: [{set_number:1,change:1},{set_number:2,change:1},{set_number:7,change:-1}]
// -> [{change:1,sets:[1,2]},{change:-1,sets:[7]}] (Reihenfolge nach erstem Auftreten).
function groupRepsChanges(changes) {
  const groups = []
  for (const c of changes) {
    const change = Number(c.change)
    let group = groups.find((g) => g.change === change)
    if (!group) {
      group = { change, sets: [] }
      groups.push(group)
    }
    group.sets.push(c.set_number)
  }
  return groups
}

// "3" oder "1, 2 und 3"
function formatSetList(setNumbers, t) {
  const sorted = [...(setNumbers || [])].sort((a, b) => a - b)
  if (sorted.length <= 1) return String(sorted[0] ?? '')
  const last = sorted[sorted.length - 1]
  return `${sorted.slice(0, -1).join(', ')} ${t('feedbackHistory.deltaAnd')} ${last}`
}
