// "Letzten Satz zurücknehmen" in der Pause (Absprache Paul 05.11.): den Satz, zu dem die laufende Pause gehört, wieder
// als offen markieren. Das eigentliche Umschalten (inkl. Beenden der Pause) macht toggleRowDone in WorkoutDetailView.

/**
 * @param {{ exercises: Array, exIndex: number, rowIndex: number, isDone: (row: object) => boolean,
 *   toggle: (row: object, exIndex: number, rowIndex: number) => void, clearRest: () => void }} input
 * @returns {'undone'|'cleared'} undone = Haken entfernt (Pause endet dabei), cleared = Satz nicht (mehr) abgehakt, nur Pause beendet
 */
export function undoRestSet({ exercises, exIndex, rowIndex, isDone, toggle, clearRest }) {
  const row = Array.isArray(exercises) ? exercises[exIndex]?.setDetails?.[rowIndex] : undefined
  if (row && isDone(row)) {
    toggle(row, exIndex, rowIndex)
    return 'undone'
  }
  clearRest()
  return 'cleared'
}
