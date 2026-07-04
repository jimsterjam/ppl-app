/**
 * Drei-Signal-Workout-Vergleich: Staerke, Umfang, Konsistenz.
 * Immer positiv geframt - keine negativen Ausgaben.
 *
 * @module workoutComparison
 */

function getWorkingSets(exercise) {
  if (Array.isArray(exercise.setDetails) && exercise.setDetails.length) {
    return exercise.setDetails
      .filter(s => !s.isWarmup)
      .map(s => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
  }
  const sets = Number(exercise.sets) || 1
  const reps = Number(exercise.reps) || 0
  const weight = Number(exercise.weight) || 0
  return Array.from({ length: sets }, () => ({ reps, weight }))
}

function getBestSetScore(exercise) {
  return getWorkingSets(exercise).reduce(
    (best, s) => {
      const score = s.reps * s.weight
      return score > best.score ? { score, weight: s.weight, reps: s.reps } : best
    },
    { score: 0, weight: 0, reps: 0 }
  )
}

// Signal 1: Staerke

function berechneStaerke(curr, prev) {
  const currExs = curr.exercises || []
  const prevExs = prev.exercises || []
  let bestImprovementEx = null
  let bestImprovementDelta = 0
  let matchedCount = 0
  let heldCount = 0

  for (const ex of currExs) {
    const prevEx = prevExs.find(p =>
      String(p.name || '').trim().toLowerCase() === String(ex.name || '').trim().toLowerCase()
    )
    if (!prevEx) continue
    matchedCount++
    const currBest = getBestSetScore(ex)
    const prevBest = getBestSetScore(prevEx)
    if (currBest.score > prevBest.score) {
      const delta = currBest.score - prevBest.score
      if (delta > bestImprovementDelta) {
        bestImprovementDelta = delta
        bestImprovementEx = {
          name: ex.name,
          currWeight: currBest.weight,
          prevWeight: prevBest.weight,
          currReps: currBest.reps
        }
      }
    }
    if (prevBest.score === 0 || currBest.score >= prevBest.score * 0.9) heldCount++
  }

  if (bestImprovementEx) {
    const wert = (bestImprovementEx.currWeight - bestImprovementEx.prevWeight) > 0
      ? `${bestImprovementEx.currWeight} kg`
      : `${bestImprovementEx.currReps} Wdh`
    return { wert, text: `Neues Bestgewicht bei ${bestImprovementEx.name}`, emoji: '💪' }
  }
  if (matchedCount > 0 && heldCount >= matchedCount * 0.8) {
    return { wert: 'gehalten', text: 'Stärke erfolgreich bestätigt', emoji: '✅' }
  }
  return { wert: 'fokussiert', text: 'Konservativ und sauber gearbeitet', emoji: '🎯' }
}

// Signal 2: Umfang

function countWorkingSets(workout) {
  return (workout.exercises || []).reduce((total, ex) => {
    if (Array.isArray(ex.setDetails) && ex.setDetails.length)
      return total + ex.setDetails.filter(s => !s.isWarmup).length
    return total + (Number(ex.sets) || 1)
  }, 0)
}

function berechneUmfang(curr, prev) {
  const currSets = countWorkingSets(curr)
  const prevSets = countWorkingSets(prev)
  const exDiff = (curr.exercises || []).length - (prev.exercises || []).length
  const setsDiff = currSets - prevSets

  if (setsDiff > 0 || exDiff > 0) {
    const wert = setsDiff > 0 ? `+${setsDiff} Sätze` : `+${exDiff} Übungen`
    return { wert, text: 'Mehr Volumen aufgebaut', emoji: '📈' }
  }
  if (Math.abs(setsDiff) <= 1 && exDiff === 0)
    return { wert: `${currSets} Sätze`, text: 'Volumen konstant gehalten', emoji: '🔄' }
  if (setsDiff <= -3)
    return { wert: `${currSets} Sätze`, text: 'Kompakt und effizient', emoji: '⚡' }
  return { wert: `${currSets} Sätze`, text: 'Qualität über Quantität', emoji: '🎯' }
}

// Signal 3: Konsistenz

function berechneKonsistenz(curr) {
  const ratios = []
  for (const ex of (curr.exercises || [])) {
    const sets = getWorkingSets(ex).filter(s => s.weight > 0)
    if (sets.length < 2) continue
    const first = sets[0].weight
    if (first > 0) ratios.push(sets[sets.length - 1].weight / first)
  }
  if (ratios.length === 0) return { wert: null, text: 'Starke Konstanz über alle Sätze', emoji: '💯' }
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
  if (avg > 1.05) return { wert: 'gesteigert', text: 'Gewicht innerhalb der Session gesteigert', emoji: '🚀' }
  if (avg >= 0.9)  return { wert: 'konstant',   text: 'Starke Konstanz über alle Sätze',          emoji: '💯' }
  return { wert: 'intensiv', text: 'Alles aus dem Tank geholt', emoji: '🔥' }
}

/**
 * Vergleicht zwei Workouts anhand von drei positiv geframedten Signalen.
 *
 * Randfaelle:
 * - workoutB === null  Erstes Workout dieser Art, kein Vergleich moeglich
 * - Keine setDetails   Fallback auf exercise.sets / reps / weight
 * - Unterschiedliche Uebungen: nur namensgleiche fliessen in Staerke ein
 * - Leere exercises:   Positiver Fallback-Text
 *
 * @param {Object}      workoutA  Aktuelles (neueres) Workout
 * @param {Object|null} workoutB  Vorheriges (aelteres) Workout
 * @returns {{
 *   staerke:    { wert: string|null, text: string, emoji: string },
 *   umfang:     { wert: string|null, text: string, emoji: string },
 *   konsistenz: { wert: string|null, text: string, emoji: string }
 * }}
 */
export function compareWorkouts(workoutA, workoutB) {
  if (!workoutB) {
    return {
      staerke:    { wert: null, text: 'Erster Eintrag dieser Art – der nächste Vergleich startet hier.', emoji: '🏁' },
      umfang:     { wert: null, text: 'Basis gesetzt – ab jetzt wird verglichen.', emoji: '📋' },
      konsistenz: { wert: null, text: 'Wird beim nächsten Workout ausgewertet.', emoji: '🎯' }
    }
  }
  return {
    staerke:    berechneStaerke(workoutA, workoutB),
    umfang:     berechneUmfang(workoutA, workoutB),
    konsistenz: berechneKonsistenz(workoutA)
  }
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeWorkoutTypeKey(value) {
  const source = String(value || '').trim().toLowerCase()
  if (!source) return ''
  if (source === 'push' || source.includes('push')) return 'push'
  if (source === 'pull' || source.includes('pull')) return 'pull'
  if (source === 'legs' || source === 'leg' || source.includes('leg') || source.includes('bein')) return 'legs'
  if (source === 'fullbody' || source === 'full body' || source === 'freestyle' || source.includes('full')) return 'fullbody'
  return source
}

function getWorkoutTimestamp(workout) {
  const candidates = [workout?.date, workout?.updatedAt, workout?.createdAt]
  for (const candidate of candidates) {
    const ts = new Date(candidate || 0).getTime()
    if (Number.isFinite(ts) && ts > 0) return ts
  }
  return NaN
}

/**
 * Epley 1RM-Schaetzung.
 * Wird zentral exportiert, damit alle Vergleiche dieselbe Formel verwenden.
 */
export function estimateOneRepMaxEpley(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  return w * (1 + r / 30)
}

function getExerciseSetDetails(exercise) {
  if (Array.isArray(exercise?.setDetails) && exercise.setDetails.length) {
    return exercise.setDetails
      .filter((set) => !set?.isWarmup)
      .map((set) => ({
        reps: Number(set?.reps) || 0,
        weight: Number(set?.weight) || 0
      }))
  }

  const sets = Math.max(1, Number(exercise?.sets) || 1)
  const reps = Number(exercise?.reps) || 0
  const weight = Number(exercise?.weight) || 0
  return Array.from({ length: sets }, () => ({ reps, weight }))
}

function aggregateExerciseMetrics(exercise) {
  const sets = getExerciseSetDetails(exercise)
  let bestWeight = 0
  let totalReps = 0
  let bestEstimated1RM = 0

  sets.forEach((set) => {
    const reps = Number(set?.reps) || 0
    const weight = Number(set?.weight) || 0
    if (weight > bestWeight) bestWeight = weight
    totalReps += reps
    const est = estimateOneRepMaxEpley(weight, reps)
    if (est > bestEstimated1RM) bestEstimated1RM = est
  })

  return {
    bestWeight,
    totalReps,
    estimated1RM: bestEstimated1RM
  }
}

function classifyDirectionByOneRepMax(currentEstimated1RM, previousEstimated1RM) {
  const current = Number(currentEstimated1RM) || 0
  const previous = Number(previousEstimated1RM) || 0

  if (current === 0 && previous === 0) return 'same'
  if (previous === 0) return current > 0 ? 'up' : 'same'

  const deltaRatio = (current - previous) / Math.abs(previous)
  if (Math.abs(deltaRatio) <= 0.01) return 'same'
  return deltaRatio > 0 ? 'up' : 'down'
}

/**
 * Vergleicht die letzten zwei abgeschlossenen Workouts eines Typs.
 *
 * @param {string} type - Zieltyp (push|pull|legs|fullbody)
 * @param {Array<object>} workouts - Workout-Liste
 * @returns {{currentDate:string, previousDate:string, exercises:Array<{name:string, current:{bestWeight:number, totalReps:number, estimated1RM:number}, previous:{bestWeight:number, totalReps:number, estimated1RM:number}, direction:'up'|'down'|'same'}>}|null}
 */
export function getTypeComparison(type, workouts = []) {
  const wantedType = normalizeWorkoutTypeKey(type)
  if (!wantedType) return null

  const completedOfType = (Array.isArray(workouts) ? workouts : [])
    .filter((workout) => workout && workout.completed === true)
    .filter((workout) => normalizeWorkoutTypeKey(workout?.type) === wantedType)
    .map((workout) => ({ workout, ts: getWorkoutTimestamp(workout) }))
    .filter((entry) => Number.isFinite(entry.ts))
    .sort((a, b) => b.ts - a.ts)

  if (completedOfType.length < 2) return null

  const currentWorkout = completedOfType[0].workout
  const previousWorkout = completedOfType[1].workout
  const currentExercises = Array.isArray(currentWorkout?.exercises) ? currentWorkout.exercises : []
  const previousExercises = Array.isArray(previousWorkout?.exercises) ? previousWorkout.exercises : []

  const previousByName = new Map()
  previousExercises.forEach((exercise) => {
    const key = normalizeName(exercise?.name)
    if (!key || previousByName.has(key)) return
    previousByName.set(key, exercise)
  })

  const sharedExercises = currentExercises
    .map((exercise) => {
      const key = normalizeName(exercise?.name)
      if (!key) return null
      const previousExercise = previousByName.get(key)
      if (!previousExercise) return null

      const currentMetrics = aggregateExerciseMetrics(exercise)
      const previousMetrics = aggregateExerciseMetrics(previousExercise)

      return {
        name: String(exercise?.name || '').trim() || 'Übung',
        current: currentMetrics,
        previous: previousMetrics,
        direction: classifyDirectionByOneRepMax(
          currentMetrics.estimated1RM,
          previousMetrics.estimated1RM
        )
      }
    })
    .filter(Boolean)

  if (!sharedExercises.length) return null

  return {
    currentDate: currentWorkout?.date || currentWorkout?.updatedAt || currentWorkout?.createdAt || null,
    previousDate: previousWorkout?.date || previousWorkout?.updatedAt || previousWorkout?.createdAt || null,
    exercises: sharedExercises
  }
}
