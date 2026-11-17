// Messart einer Übung (Absprache Jimmy 15.10.):
//   'weight'   - Wiederholungen + kg (Standard, wie bisher)
//   'time'     - Zeit halten (z. B. Plank): Ergebnis ist die Zeit in Sekunden
//   'repsTime' - Wiederholungen in einer festen Zeit: die Zeit ist der Rahmen, das Ergebnis sind die Wiederholungen
// Die Zeit steht je Satz in `setDetails[].durationSeconds`; die Messart an der Übung (`measureMode`, nur wenn nicht
// 'weight'). Spiegelbild: Server models/Workout.js, services/trainingAnalysisService.js.

export const MEASURE_MODES = Object.freeze(['weight', 'time', 'repsTime'])
export const DURATION_MAX_SECONDS = 3600
export const DURATION_STEP_SECONDS = 5

export function sanitizeMeasureMode(value) {
  return value === 'time' || value === 'repsTime' ? value : 'weight'
}

export const showsReps = (mode) => sanitizeMeasureMode(mode) !== 'time'
export const showsWeight = (mode) => sanitizeMeasureMode(mode) === 'weight'
export const showsTime = (mode) => sanitizeMeasureMode(mode) !== 'weight'

/** Kurzform für das Feld: 90 -> "1:30", 45 -> "45 s" wäre mehrdeutig, daher immer m:ss ab 60 s, sonst "45". */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return String(total)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Messart nur speichern, wenn sie von 'weight' abweicht (Altdaten bleiben unverändert). */
export function measureModeField(value) {
  const mode = sanitizeMeasureMode(value)
  return mode === 'weight' ? {} : { measureMode: mode }
}

/**
 * Erster Satz einer neu hinzugefügten Übung. Zeit-Übungen starten ohne Gewicht und ohne erfundene Wiederholungen
 * (leer statt 10 / 0 kg), die Zeit wird in der Satzzeile eingetragen.
 */
export function blankSetForMode(value) {
  return sanitizeMeasureMode(value) === 'weight'
    ? { reps: 10, weight: 0 }
    : { reps: null, weight: null, durationSeconds: null }
}

/** Neue Übung für „Übung hinzufügen“ im laufenden Workout; `selected` ist der gewählte Listeneintrag. */
export function buildAddedExercise(selected, { exerciseId, name }) {
  const entry = selected && typeof selected === 'object' ? selected : {}
  return {
    exerciseId,
    name,
    muscleGroup: entry.muscleGroup,
    imageUrl: entry.imageUrl || '',
    thumbnailUrl: entry.thumbnailUrl || '',
    thumbnailStaticUrl: entry.thumbnailStaticUrl || '',
    // Messart der Übung (z. B. eigene Übung mit "Zeit"): sonst zeigt das Workout Wiederholungen + Gewicht.
    ...measureModeField(entry.measureMode),
    setDetails: [blankSetForMode(entry.measureMode)],
    note: ''
  }
}
