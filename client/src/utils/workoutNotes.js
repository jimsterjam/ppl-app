 /**
 * Hilfsfunktionen für Workout-Notizen
 */

const DEFAULT_MAX_ITEMS = 10
const DEFAULT_MAX_LENGTH = 800

function normalizeOptions(options = {}) {
  const maxItems = Number.isFinite(options.maxItems) && options.maxItems > 0
    ? Math.floor(options.maxItems)
    : DEFAULT_MAX_ITEMS
  const maxLength = Number.isFinite(options.maxLength) && options.maxLength > 0
    ? Math.floor(options.maxLength)
    : DEFAULT_MAX_LENGTH
  return { maxItems, maxLength }
}

export function buildWorkoutNotesSummary(exercises, options = {}) {
  if (!Array.isArray(exercises) || exercises.length === 0) return ''
  const { maxItems, maxLength } = normalizeOptions(options)
  const parts = []
  for (const exercise of exercises) {
    if (!exercise) continue
    const note = typeof exercise.note === 'string' ? exercise.note.trim() : ''
    if (!note) continue
    const name = typeof exercise.name === 'string' ? exercise.name.trim() : ''
    const label = name ? `${name}: ` : ''
    parts.push(`${label}${note}`)
    if (parts.length >= maxItems) break
  }
  if (!parts.length) return ''
  const summary = parts.join(' • ')
  if (summary.length <= maxLength) return summary
  return `${summary.slice(0, maxLength).trim()}...`
}

export function ensureWorkoutNotes(workout, options = {}) {
  if (!workout || typeof workout !== 'object') return workout
  const existing = typeof workout.notes === 'string' ? workout.notes.trim() : ''
  const summary = buildWorkoutNotesSummary(workout.exercises, options) || ''
  const replaceExisting = options.replaceExisting === true
  if (replaceExisting) {
    workout.notes = summary
    return workout
  }
  workout.notes = existing || summary
  return workout
}

export function resolveWorkoutNotes(workout, options = {}) {
  if (!workout || typeof workout !== 'object') return ''
  const existing = typeof workout.notes === 'string' ? workout.notes.trim() : ''
  if (existing) return existing
  return buildWorkoutNotesSummary(workout.exercises, options) || ''
}
