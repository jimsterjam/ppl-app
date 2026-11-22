// Antworten nach dem Training lokal am Workout vermerken (F16, Etappe 5b). Gleiche Form wie auf dem Server gespeichert
// (server/utils/athleteAnswers.js): feste Werte, höchstens zwei Einträge, je Übung ein Thema; der Übungsname kommt vom Workout.
// Der Server bleibt die Quelle der Wahrheit: beim nächsten Laden der Workout-Liste ersetzt seine Fassung diese.

const MAX_ANSWERS = 2

/**
 * @param {{exercises?: Array}|null} workout lokales Workout
 * @param {Array<{topic:string, exerciseIndex:number, answer:string, reason?:string, variant?:string}>} answers Antworten aus den Fragen
 * @returns {Array<{topic, exercise, exerciseIndex, answer, reason, variant}>}
 */
export function buildLocalAthleteAnswers(workout, answers) {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : []
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(answers) ? answers : []) {
    const index = raw?.exerciseIndex
    const name = typeof exercises[index]?.name === 'string' ? exercises[index].name.trim() : ''
    if (!Number.isInteger(index) || !name || seen.has(index)) continue
    if (typeof raw.topic !== 'string' || typeof raw.answer !== 'string') continue
    seen.add(index)
    out.push({
      topic: raw.topic,
      exercise: name.slice(0, 120),
      exerciseIndex: index,
      answer: raw.answer,
      reason: typeof raw.reason === 'string' ? raw.reason : null,
      variant: typeof raw.variant === 'string' ? raw.variant : null
    })
    if (out.length >= MAX_ANSWERS) break
  }
  return out
}
