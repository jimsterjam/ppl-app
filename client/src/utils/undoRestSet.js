// "Letzten Satz zurücknehmen" in der Pause (Absprache Paul 05.11.): den Satz, zu dem die laufende Pause gehört, wieder
// als offen markieren. Das eigentliche Umschalten (inkl. Beenden der Pause) macht toggleRowDone in WorkoutDetailView.
//
// Der Satz wird über das Satz-OBJEKT gefunden, nicht über Positionen: Positionen (Übung/Satznummer) ändern sich, wenn in
// der Pause ein Satz davor entfernt oder eine Übung verschoben wird, und gelten nicht für ein anderes geöffnetes Workout.
// Wird das Objekt im aktuell geöffneten Workout nicht gefunden, gibt es nichts zurückzunehmen (Link ausgeblendet).
import { toRaw } from 'vue'

/**
 * @param {Array} exercises - Übungen des aktuell geöffneten Workouts
 * @param {object|null} rowRef - Satz-Objekt, das beim Start der Pause abgehakt wurde
 * @returns {{ exIndex: number, rowIndex: number, row: object }|null}
 */
export function findRowPosition(exercises, rowRef) {
  const target = rowRef ? toRaw(rowRef) : null
  if (!target || !Array.isArray(exercises)) return null
  for (let exIndex = 0; exIndex < exercises.length; exIndex += 1) {
    const rows = exercises[exIndex]?.setDetails
    if (!Array.isArray(rows)) continue
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      if (rows[rowIndex] && toRaw(rows[rowIndex]) === target) return { exIndex, rowIndex, row: rows[rowIndex] }
    }
  }
  return null
}

/**
 * @param {{ exercises: Array, rowRef: object|null, isDone: (row: object) => boolean,
 *   toggle: (row: object, exIndex: number, rowIndex: number) => void }} input
 * @returns {boolean} true = Haken entfernt (die Pause endet dabei über toggle), false = nichts zu tun
 */
export function undoRestSet({ exercises, rowRef, isDone, toggle }) {
  const position = findRowPosition(exercises, rowRef)
  if (!position || !isDone(position.row)) return false
  toggle(position.row, position.exIndex, position.rowIndex)
  return true
}
