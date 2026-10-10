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

// Ziele (Reihenfolge der Anzeige in den Einstellungen) und Übungsarten, für die der Nutzer die
// Standard-Pause ändern kann. 'core' zählt wie Isolation (siehe restSecondsFor).
export const REST_GOALS = Object.freeze(['strength', 'hypertrophy', 'explosive'])
export const REST_TYPES = Object.freeze(['compound', 'isolation'])

export const REST_MIN_SECONDS = 15
export const REST_MAX_SECONDS = 600
export const REST_STEP_SECONDS = 15

// Letzte Sekunden der Pause: farblich hervorgehoben, und eine minimierte Leiste wechselt
// automatisch wieder auf die große Anzeige.
export const REST_ENDING_MS = 10000

/**
 * Soll die minimierte Pause jetzt wieder groß werden? Nur einmal pro Pause (autoExpanded), damit
 * ein erneutes Verkleinern in den letzten Sekunden respektiert wird.
 */
export function shouldAutoExpandRest({ minimized, fullscreen, running, remainingMs, autoExpanded }) {
  return !!(minimized && fullscreen && running && !autoExpanded && remainingMs <= REST_ENDING_MS)
}

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

/** Eingebaute Standard-Pause (ohne Einstellung des Nutzers). */
export function defaultRestSeconds(goal, exerciseType) {
  const table = REST_DEFAULT_SECONDS[goal] || REST_DEFAULT_SECONDS.hypertrophy
  return exerciseType === 'compound' ? table.compound : table.isolation
}

/**
 * Eigene Standard-Pausen des Nutzers (localStorage) prüfen: nur bekannte Ziele/Übungsarten und
 * gültige Sekunden bleiben übrig. Ergebnis: { strength?: { compound?: 200 }, ... }
 */
export function sanitizeRestOverrides(raw) {
  const result = {}
  if (!raw || typeof raw !== 'object') return result
  for (const goal of REST_GOALS) {
    const entry = raw[goal]
    if (!entry || typeof entry !== 'object') continue
    for (const type of REST_TYPES) {
      const value = sanitizeCustomRest(entry[type])
      if (value) result[goal] = { ...result[goal], [type]: value }
    }
  }
  return result
}

/**
 * Reihenfolge: gemerkte Pause der Übung > eigener Standard des Nutzers > eingebauter Standard.
 * @param {'strength'|'hypertrophy'|'explosive'} goal - wirksame Trainingsart der Übung
 * @param {'compound'|'isolation'|'core'} exerciseType - siehe classifyExercise (weightSuggestion.js)
 * @param {number|null} customSeconds - vom Nutzer gemerkte Dauer (hat Vorrang)
 * @param {object|null} overrides - eigene Standard-Pausen (sanitizeRestOverrides)
 */
export function restSecondsFor(goal, exerciseType, customSeconds = null, overrides = null) {
  const custom = sanitizeCustomRest(customSeconds)
  if (custom) return custom
  const type = exerciseType === 'compound' ? 'compound' : 'isolation'
  const own = sanitizeCustomRest(overrides?.[goal]?.[type])
  if (own) return own
  return defaultRestSeconds(goal, exerciseType)
}

/** "2:05" */
export function formatRest(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
