// Pausendauer zwischen Sätzen (Pausentimer, startet beim Abhaken eines Arbeitssatzes).
// Ohne Imports, damit direkt testbar.
//
// Die Pause startet durch ein Ereignis (Satz abgehakt), nicht nach einer festen Arbeitsphase -
// wie lange ein Satz dauert, weiß die App nicht (Absprache Paul). Standarddauer je
// Trainingsart und Übungsart; eine vom Nutzer gemerkte Dauer (exercise.restSeconds) hat Vorrang.

export const REST_DEFAULT_SECONDS = Object.freeze({
  strength: Object.freeze({ compound: 180, isolation: 120 }),
  hypertrophy: Object.freeze({ compound: 120, isolation: 90 }),
  explosive: Object.freeze({ compound: 120, isolation: 120 })
})

export const REST_MIN_SECONDS = 15
export const REST_MAX_SECONDS = 600
export const REST_STEP_SECONDS = 15

export function clampRestSeconds(value) {
  const n = Math.round(Number(value) || 0)
  return Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, n))
}

/** Gemerkte Dauer der Übung, falls gültig - sonst null. */
export function sanitizeCustomRest(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < REST_MIN_SECONDS || n > REST_MAX_SECONDS) return null
  return Math.round(n)
}

/**
 * @param {'strength'|'hypertrophy'|'explosive'} goal - wirksame Trainingsart der Übung
 * @param {'compound'|'isolation'|'core'} exerciseType - siehe classifyExercise (weightSuggestion.js)
 * @param {number|null} customSeconds - vom Nutzer gemerkte Dauer (hat Vorrang)
 */
export function restSecondsFor(goal, exerciseType, customSeconds = null) {
  const custom = sanitizeCustomRest(customSeconds)
  if (custom) return custom
  const table = REST_DEFAULT_SECONDS[goal] || REST_DEFAULT_SECONDS.hypertrophy
  return exerciseType === 'compound' ? table.compound : table.isolation
}

/** "2:05" */
export function formatRest(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
