import { buildWorkoutNotesSummary } from './workoutNotes'

export function getExercisesMissingNotes(exercises = [], getNote) {
  const missing = []
  ;(Array.isArray(exercises) ? exercises : []).forEach((ex, idx) => {
    const hasLoggedSets = Array.isArray(ex?.setDetails) && ex.setDetails.length > 0
    if (!hasLoggedSets) return
    const note = typeof getNote === 'function' ? getNote(idx) : ''
    if (!String(note || '').trim()) {
      missing.push(ex?.name || `Übung ${idx + 1}`)
    }
  })
  return missing
}

export function resolveFinalDurationMinutes({ workout, sessionStopwatchStore }) {
  const timerElapsedSeconds = Math.max(0, Math.round((Number(sessionStopwatchStore?.elapsedMs) || 0) / 1000))
  const timerDurationMinutes = timerElapsedSeconds > 0 ? Math.max(1, Math.round(timerElapsedSeconds / 60)) : 0
  const existingDuration = Number(workout?.duration) || 0
  return timerDurationMinutes > 0 ? timerDurationMinutes : existingDuration
}

export function normalizeWorkoutForSave({ workout, exerciseNotes, sessionStopwatchStore, userId }) {
  const w = workout || {}
  const exercises = (w.exercises || []).map((ex, idx) => {
    const firstWorkingSet = (ex.setDetails || []).find(s => !s.isWarmup)
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      reps: firstWorkingSet?.reps ?? ex.reps ?? 10,
      weight: firstWorkingSet?.weight ?? ex.weight ?? 0,
      setDetails: ex.setDetails || [],
      note: Array.isArray(exerciseNotes) && typeof exerciseNotes[idx] !== 'undefined'
        ? exerciseNotes[idx]
        : (typeof ex.note === 'string' ? ex.note : '')
    }
  })

  const normalized = {
    name: w.name,
    type: w.type,
    date: w.date,
    userId: userId || undefined,
    duration: resolveFinalDurationMinutes({ workout: w, sessionStopwatchStore }),
    completed: true,
    _isDraft: false,
    isDraft: false,
    exercises
  }

  normalized.notes = buildWorkoutNotesSummary(normalized.exercises)
  return normalized
}
