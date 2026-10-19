// Aufwärmsätze in der Großansicht (Absprache Paul 19.10.): vor dem ersten Arbeitssatz einer Übung, ohne Timer.
// Gibt den nächsten noch nicht erledigten Aufwärmsatz zurück oder null (kein Aufwärmsatz, schon alle erledigt
// oder in dieser Übung wurde bereits ein Arbeitssatz abgehakt).
// handled: Set mit Schlüsseln "exIndex:rowIndex" (nur im Speicher der Ansicht, nicht im Workout gespeichert).
export function findPendingWarmup({ exercise, exIndex, handled, weightMode = true } = {}) {
  const rows = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  if (!exercise || !weightMode || rows.some((row) => row && !row.isWarmup && row.done === true)) return null
  const warmupIdx = rows.map((row, i) => (row?.isWarmup ? i : -1)).filter((i) => i >= 0)
  const pos = warmupIdx.findIndex((i) => !handled?.has(`${exIndex}:${i}`))
  if (pos < 0) return null
  return { exIndex, rowIndex: warmupIdx[pos], number: pos + 1, total: warmupIdx.length }
}
