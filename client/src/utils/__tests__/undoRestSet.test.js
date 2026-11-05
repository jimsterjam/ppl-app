import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { undoRestSet, findRowPosition } from '../undoRestSet.js'

const isDone = (row) => row.done === true
const makeWorkout = () => reactive({
  exercises: [
    { name: 'A', setDetails: [{ reps: 5, done: true }, { reps: 5, done: true }, { reps: 5, done: false }] },
    { name: 'B', setDetails: [{ reps: 8, done: false }] }
  ]
})

describe('Satz zur Pause finden (stabil über das Satz-Objekt)', () => {
  it('findet den Satz auch über reaktive Proxys', () => {
    const workout = makeWorkout()
    const rowRef = workout.exercises[0].setDetails[1]
    expect(findRowPosition(workout.exercises, rowRef)).toMatchObject({ exIndex: 0, rowIndex: 1 })
  })

  it('folgt dem Satz, wenn davor ein Satz entfernt oder Übungen verschoben werden', () => {
    const workout = makeWorkout()
    const rowRef = workout.exercises[0].setDetails[1]
    workout.exercises[0].setDetails.splice(0, 1) // Satz davor entfernt
    expect(findRowPosition(workout.exercises, rowRef)).toMatchObject({ exIndex: 0, rowIndex: 0 })
    workout.exercises.reverse() // Übungen vertauscht
    expect(findRowPosition(workout.exercises, rowRef)).toMatchObject({ exIndex: 1, rowIndex: 0 })
  })

  it('Satz entfernt oder anderes Workout geöffnet: nichts gefunden', () => {
    const workout = makeWorkout()
    const rowRef = workout.exercises[0].setDetails[1]
    workout.exercises[0].setDetails.splice(1, 1)
    expect(findRowPosition(workout.exercises, rowRef)).toBeNull()
    const other = makeWorkout() // gleiche Positionen und abgehakt, aber anderes Workout
    expect(findRowPosition(other.exercises, rowRef)).toBeNull()
  })

  it('ohne Referenz oder Übungsliste: nichts gefunden', () => {
    expect(findRowPosition(makeWorkout().exercises, null)).toBeNull()
    expect(findRowPosition(undefined, {})).toBeNull()
  })
})

describe('Letzten Satz zurücknehmen (Pause)', () => {
  it('nimmt genau den Haken des Satzes zurück, der die Pause gestartet hat', () => {
    const workout = makeWorkout()
    const rowRef = workout.exercises[0].setDetails[1]
    workout.exercises[0].setDetails.splice(0, 1) // Position hat sich verschoben
    const toggle = vi.fn((row) => { row.done = !row.done })
    expect(undoRestSet({ exercises: workout.exercises, rowRef, isDone, toggle })).toBe(true)
    expect(toggle).toHaveBeenCalledWith(rowRef, 0, 0)
    expect(rowRef.done).toBe(false)
    expect(workout.exercises[0].setDetails[1].done).toBe(false) // der offene dritte Satz bleibt offen
  })

  it('schaltet nichts um, wenn der Satz nicht (mehr) abgehakt oder nicht auffindbar ist', () => {
    const workout = makeWorkout()
    const toggle = vi.fn()
    expect(undoRestSet({ exercises: workout.exercises, rowRef: workout.exercises[0].setDetails[2], isDone, toggle })).toBe(false)
    expect(undoRestSet({ exercises: workout.exercises, rowRef: { done: true }, isDone, toggle })).toBe(false)
    expect(undoRestSet({ exercises: undefined, rowRef: null, isDone, toggle })).toBe(false)
    expect(toggle).not.toHaveBeenCalled()
  })
})
