// Übersetzt einen Diagnose-Eintrag vom Server (server/utils/stagnationDiagnosis.js) in i18n-Keys
// und Parameter. Ohne Vue-Imports, damit direkt testbar.

export const DIAGNOSIS_CAUSES = Object.freeze(['insufficient_data', 'low_frequency', 'repeating', 'plateau', 'plateau_long'])

function formatKg(value, locale) {
  const loc = String(locale || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

/**
 * @returns {null | { causeKey, nextKey, params, showWeeks }}
 */
export function diagnosisTextKeys(item, locale = 'de') {
  if (!item || !DIAGNOSIS_CAUSES.includes(item.cause)) return null
  const params = {
    weeks: item.weeks,
    sessions: item.sessions,
    sets: item.sets,
    reps: item.reps,
    nextReps: item.nextReps,
    logged: item.logged,
    complete: item.complete,
    weight: formatKg(item.weight, locale),
    nextWeight: formatKg(item.nextWeight, locale),
    deloadWeight: formatKg(item.deloadWeight, locale)
  }
  let nextKey = `coachDiagnosis.next_${item.cause}`
  if (item.cause === 'repeating') {
    nextKey = item.nextReps ? 'coachDiagnosis.next_repeating_reps' : 'coachDiagnosis.next_repeating_weight'
  } else if (item.cause === 'plateau_long') {
    nextKey = item.switchTo === 'strength' ? 'coachDiagnosis.next_plateau_long_strength' : 'coachDiagnosis.next_plateau_long_hypertrophy'
  }
  return {
    causeKey: `coachDiagnosis.cause_${item.cause}`,
    nextKey,
    params,
    showWeeks: item.cause !== 'insufficient_data'
  }
}
