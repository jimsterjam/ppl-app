// "Kurz prüfen" vor dem finalen Speichern eines Workouts (WorkoutDetailView.vue).
//
// Sammelt Hinweise, ob etwas vergessen wurde oder unlogisch aussieht. Blockiert nie - der Nutzer
// kann immer trotzdem speichern. Reine Logik ohne Vue, damit jede Regel direkt testbar ist.
//
// Zwei Gruppen:
//   forgotten - wahrscheinlich vergessen: nicht abgehakte Sätze, Übung ohne gemachte Sätze
//   check     - bitte prüfen: auffälliges Gewicht, 0 kg, auffällige Wiederholungen, Feedback fehlt

// Grenzen für "Gewicht auffällig" im Vergleich zum schwersten Arbeitssatz der letzten Session.
export const WEIGHT_JUMP_UP = 1.25 // mehr als +25 %
export const WEIGHT_DROP_DOWN = 0.5 // weniger als die Hälfte

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Anzeige-Nummer eines Satzes wie in der Tabelle: Aufwärmsätze "W1", Arbeitssätze "1", "2", ... */
export function setLabelFor(setDetails = [], index) {
  let warmup = 0
  let working = 0
  for (let i = 0; i <= index; i++) {
    if (setDetails[i]?.isWarmup) warmup++
    else working++
  }
  return setDetails[index]?.isWarmup ? `W${warmup}` : `${working}`
}

function lastMaxWorkingWeight(lastSessionExercise) {
  const sets = Array.isArray(lastSessionExercise?.setDetails) ? lastSessionExercise.setDetails : []
  const weights = sets
    .filter((set) => set && !set.isWarmup && set.done !== false && num(set.reps) > 0)
    .map((set) => num(set.weight))
  return weights.length ? Math.max(...weights) : 0
}

/**
 * @param {object} params
 * @param {Array} params.exercises - workout.exercises (mit setDetails)
 * @param {boolean} params.trackingActive - laufendes Workout (Abhaken aktiv)
 * @param {(index:number)=>string} [params.getNote] - Feedback-Text der Übung
 * @param {Array} [params.lastSessions] - pro Übung dieselbe Übung aus der letzten Session oder null
 * @param {Array} [params.repTargets] - pro Übung Wiederholungsziel ({ target }) oder null
 * @param {Array<boolean>} [params.noLoad] - pro Übung: Körpergewicht/ohne Zusatzlast
 * @returns {{ forgotten: Array, check: Array, hasOpenSets: boolean, isEmpty: boolean }}
 *   Einträge: { kind, exIndex, name, ...params } - Texte baut die View (i18n).
 */
export function buildSaveReview({
  exercises = [],
  trackingActive = false,
  getNote = null,
  lastSessions = [],
  repTargets = [],
  noLoad = []
} = {}) {
  const forgotten = []
  const check = []
  // Aufwärmsätze werden nicht abgehakt und gelten immer als gemacht.
  const isDone = (set) => !trackingActive || set?.isWarmup === true || set?.done === true

  ;(Array.isArray(exercises) ? exercises : []).forEach((ex, exIndex) => {
    const name = ex?.name || ''
    const sets = Array.isArray(ex?.setDetails) ? ex.setDetails : []
    const doneSets = sets.filter(isDone)

    // --- wahrscheinlich vergessen ---
    if (!sets.length) {
      forgotten.push({ kind: 'noSets', exIndex, name })
    } else if (trackingActive) {
      const open = sets.map((set, i) => (isDone(set) ? null : setLabelFor(sets, i))).filter(Boolean)
      if (open.length) forgotten.push({ kind: 'openSets', exIndex, name, sets: open.join(', '), count: open.length })
    }

    // --- bitte prüfen (nur gemachte Arbeitssätze) ---
    const lastMax = noLoad[exIndex] ? 0 : lastMaxWorkingWeight(lastSessions[exIndex])
    const target = num(repTargets[exIndex]?.target)
    sets.forEach((set, i) => {
      if (!set || set.isWarmup || !isDone(set)) return
      const label = setLabelFor(sets, i)
      const weight = num(set.weight)
      const reps = num(set.reps)

      if (lastMax > 0 && weight === 0) {
        check.push({ kind: 'zeroWeight', exIndex, name, set: label })
      } else if (lastMax > 0 && (weight > lastMax * WEIGHT_JUMP_UP || weight < lastMax * WEIGHT_DROP_DOWN)) {
        check.push({ kind: 'weightOutlier', exIndex, name, set: label, weight, lastWeight: lastMax })
      }

      if (reps === 0) {
        check.push({ kind: 'zeroReps', exIndex, name, set: label })
      } else if (target > 0 && reps > target * 2) {
        check.push({ kind: 'repsOutlier', exIndex, name, set: label, reps, target })
      }
    })

    // Feedback fehlt - nur bei Übungen mit gemachten Sätzen (wie bisher getExercisesMissingNotes).
    if (doneSets.length && typeof getNote === 'function' && !String(getNote(exIndex) || '').trim()) {
      check.push({ kind: 'missingFeedback', exIndex, name })
    }
  })

  const hasOpenSets = forgotten.some((item) => item.kind === 'openSets')
  return { forgotten, check, hasOpenSets, isEmpty: !forgotten.length && !check.length }
}

/** Entfernt alle nicht abgehakten Arbeitssätze (Aufwärmsätze und Übungen bleiben erhalten). */
export function removeOpenSets(exercises = []) {
  return (Array.isArray(exercises) ? exercises : []).map((ex) => ({
    ...ex,
    setDetails: (Array.isArray(ex?.setDetails) ? ex.setDetails : []).filter((set) => set?.isWarmup === true || set?.done === true)
  }))
}

/** Markiert alle Arbeitssätze als gemacht (Aufwärmsätze bleiben ohne Haken). */
export function markAllSetsDone(exercises = []) {
  return (Array.isArray(exercises) ? exercises : []).map((ex) => ({
    ...ex,
    setDetails: (Array.isArray(ex?.setDetails) ? ex.setDetails : []).map((set) => (set?.isWarmup ? set : { ...set, done: true }))
  }))
}
