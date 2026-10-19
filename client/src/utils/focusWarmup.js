// Aufwärmsätze in der Großansicht (Absprache Paul 19.10.): vor dem ersten Arbeitssatz einer Übung, ohne Timer.
// Gibt den nächsten noch nicht erledigten Aufwärmsatz zurück oder null (kein Aufwärmsatz, schon alle erledigt
// oder in dieser Übung wurde bereits ein Arbeitssatz abgehakt).
// Erledigt/übersprungen steht als `warmupHandled` am Satz im Entwurf (übersteht App-Neustart) und wird beim
// finalen Speichern entfernt (stripDraftFlags in workoutDetailSaveFlow.js).
export function findPendingWarmup({ exercise, exIndex, weightMode = true } = {}) {
  const rows = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  if (!exercise || !weightMode || rows.some((row) => row && !row.isWarmup && row.done === true)) return null
  const warmupIdx = rows.map((row, i) => (row?.isWarmup ? i : -1)).filter((i) => i >= 0)
  const pos = warmupIdx.findIndex((i) => rows[i].warmupHandled !== true)
  if (pos < 0) return null
  return { exIndex, rowIndex: warmupIdx[pos], number: pos + 1, total: warmupIdx.length }
}
