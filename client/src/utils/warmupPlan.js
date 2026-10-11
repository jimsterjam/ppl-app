// Warm-up-Karte oben im Workout (Absprache Paul 11.10.): drei Schritte zum Abhaken.
//   1. Cardio (5 Min., Timer)   2. Gelenke aufwärmen (2 Min., Timer)   3. eine einfache Körpergewichts-Übung
// zur ersten Hauptübung (einmal, kein Timer). Danach folgen wie bisher die Aufwärmsätze der Übungen
// (isWarmup-Sätze), die dieses Feature nicht ändert.
// Gespeichert wird je Workout nur `warmup: { cardio, joints, specific }` (Booleans) - null = Workout von
// vor dieser Funktion. Spiegelbild: server/utils/workoutWarmup.js. Ohne Vue-Imports, direkt testbar.

export const WARMUP_STEPS = Object.freeze(['cardio', 'joints', 'specific'])
export const WARMUP_CARDIO_SECONDS = 5 * 60
export const WARMUP_JOINTS_SECONDS = 2 * 60
// Schritte mit Timer
export const WARMUP_TIMER_SECONDS = Object.freeze({ cardio: WARMUP_CARDIO_SECONDS, joints: WARMUP_JOINTS_SECONDS })

/** Neues Warm-up: Karte wurde gezeigt, noch nichts abgehakt. */
export function emptyWarmup() {
  return { cardio: false, joints: false, specific: false }
}

/** Gültiges Warm-up-Objekt oder null. Nur echte Booleans zählen als abgehakt. */
export function sanitizeWarmup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = {}
  for (const step of WARMUP_STEPS) result[step] = value[step] === true
  return result
}

export function isWarmupComplete(warmup) {
  const w = sanitizeWarmup(warmup)
  return !!w && WARMUP_STEPS.every((step) => w[step])
}

/** Erster noch nicht abgehakter Schritt (null = alles abgehakt). */
export function currentWarmupStep(warmup) {
  const w = sanitizeWarmup(warmup) || emptyWarmup()
  return WARMUP_STEPS.find((step) => !w[step]) || null
}

/** Nächster offener Schritt nach `step` (null = keiner mehr). */
export function nextWarmupStep(warmup, step) {
  const w = sanitizeWarmup(warmup) || emptyWarmup()
  const after = WARMUP_STEPS.slice(WARMUP_STEPS.indexOf(step) + 1)
  return after.find((s) => !w[s]) || null
}

const JOINT_TYPES = ['push', 'pull', 'legs', 'fullbody']
/** Trainingstyp für den Gelenk-Hinweis; Unbekanntes wie Full Body. */
export function jointsTypeFor(type) {
  const t = String(type || '').toLowerCase()
  return JOINT_TYPES.includes(t) ? t : 'fullbody'
}

// Einfache Körpergewichts-Übungen aus dem Katalog (alle mit Video, Anfänger, ohne Gerät):
//   0659 push-up (wall)                 drücken (Brust, Schulter, Trizeps)
//   0688 scapular pull-up               ziehen (Rücken)
//   3533 quads (bodyweight squat)       Kniebeuge (Beine)
//   3013 low glute bridge on floor      Hüfte (Gesäß, Beinbeuger, Kreuzheben-Muster)
// Welche passt, entscheidet der Zielmuskel (`target`) der ersten Übung im Katalog, bei Kreuzheben-Mustern
// der Name. Keine passende (z. B. Bizeps-Curl, Core): null -> Text "leichter Aufwärmsatz".
export const WARMUP_EXERCISES = Object.freeze({
  push: Object.freeze({ catalogId: 'ex_0659', name: 'push-up (wall)' }),
  pull: Object.freeze({ catalogId: 'ex_0688', name: 'scapular pull-up' }),
  squat: Object.freeze({ catalogId: 'ex_3533', name: 'quads (bodyweight squat)' }),
  hinge: Object.freeze({ catalogId: 'ex_3013', name: 'low glute bridge on floor' })
})

const PUSH_TARGETS = new Set(['pectorals', 'delts', 'triceps', 'serratus anterior'])
const PULL_TARGETS = new Set(['lats', 'upper back', 'traps', 'biceps', 'levator scapulae'])
const SQUAT_TARGETS = new Set(['quads', 'calves'])
const HINGE_TARGETS = new Set(['glutes', 'hamstrings', 'adductors', 'abductors', 'spine'])
const HINGE_NAME = /(deadlift|kreuzheben|good morning|hip thrust|hüftheben|bridge|romanian)/i

/**
 * Schlüssel der passenden Warm-up-Übung (push | pull | squat | hinge) oder null.
 * @param {{ name?: string, name_en?: string, target?: string }} exercise - erste Hauptübung (Katalogdaten bevorzugt)
 */
export function warmupExerciseKey(exercise = {}) {
  const names = `${exercise.name_en || ''} ${exercise.name || ''}`
  if (HINGE_NAME.test(names)) return 'hinge'
  const target = String(exercise.target || '').trim().toLowerCase()
  if (PUSH_TARGETS.has(target)) return 'push'
  if (PULL_TARGETS.has(target)) return 'pull'
  if (SQUAT_TARGETS.has(target)) return 'squat'
  if (HINGE_TARGETS.has(target)) return 'hinge'
  return null
}

export function pickWarmupExercise(exercise = {}) {
  const key = warmupExerciseKey(exercise)
  return key ? { key, ...WARMUP_EXERCISES[key] } : null
}
