// Halteübungen im Katalog tragen die Messart "Zeit" (Absprache Jimmy 24.11.): sie werden in Sekunden erfasst,
// nicht als Wdh. × kg. Gegenprobe: bewegte Varianten und Übungen mit Zusatzgewicht bleiben bei Wdh. + kg.
import { describe, it, expect } from 'vitest'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { buildAddedExercise } from '@/utils/measureMode'
import { buildSwappedExercise } from '@/utils/exerciseSwapApply'
import { addExercisesTo, emptyDraft } from '@/utils/planBuilder'

const TIMED = [
  'lean planche', 'tuck planche', 'frog planche', 'straddle planche', 'full planche',
  'tuck front lever', 'advanced tuck front lever', 'front lever', 'back lever', 'handstand',
  'l-sit on floor', 'pull-up l-sit', 'v-sit on floor',
  'bodyweight incline side plank', 'side bridge v. 2', 'power point plank'
]
const MOVING = [
  'hollow body rock', 'tuck front lever raise', 'front lever reps', 'pseudo planche push-up', 'full planche push-up',
  'archer row', 'handstand push-up', 'weighted front plank', 'push-up', 'bench press barbell'
]

describe('Katalog: Messart "Zeit" für Halteübungen', () => {
  it('alle 16 Halteübungen haben measureMode "time" (nach Katalog-Normalisierung)', async () => {
    const byName = new Map((await loadDefaultExercises()).map((e) => [e.name_en, e]))
    for (const name of TIMED) {
      expect(byName.get(name), name).toBeTruthy()
      expect(byName.get(name).measureMode, name).toBe('time')
    }
  })

  it('Gegenprobe: bewegte Varianten und Zusatzgewicht bleiben bei Wdh. + kg', async () => {
    const byName = new Map((await loadDefaultExercises()).map((e) => [e.name_en, e]))
    for (const name of MOVING) {
      const entry = byName.get(name)
      if (!entry) continue
      expect(entry.measureMode, name).toBeUndefined()
    }
    expect(byName.get('hollow body rock')).toBeTruthy()
    expect(byName.get('weighted front plank')).toBeTruthy()
  })

  it('im Workout hinzugefügt: Sekunden statt Wdh. + kg', async () => {
    const entry = (await loadDefaultExercises()).find((e) => e.name_en === 'tuck planche')
    const added = buildAddedExercise(entry, { exerciseId: entry._id, name: 'Tuck Planche' })
    expect(added.measureMode).toBe('time')
    expect(added.setDetails).toEqual([{ reps: null, weight: null, durationSeconds: null }])
  })

  it('Gegenprobe: normale Übung wird weiter mit Wdh. + kg angelegt', async () => {
    const entry = (await loadDefaultExercises()).find((e) => e.name_en === 'hollow body rock')
    const added = buildAddedExercise(entry, { exerciseId: entry._id, name: 'Hollow Body Rock' })
    expect(added.measureMode).toBeUndefined()
    expect(added.setDetails).toEqual([{ reps: 10, weight: 0 }])
  })

  it('Tausch auf eine Halteübung übernimmt die Messart, Tausch zurück entfernt sie', async () => {
    const catalog = await loadDefaultExercises()
    const hold = catalog.find((e) => e.name_en === 'l-sit on floor')
    const normal = catalog.find((e) => e.name_en === 'hollow body rock')
    const old = { name: 'Plank', setDetails: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }] }
    const toHold = buildSwappedExercise(old, hold)
    expect(toHold.measureMode).toBe('time')
    expect(toHold.setDetails).toHaveLength(2)
    expect(toHold.setDetails[0]).toEqual({ reps: null, weight: null, durationSeconds: null })
    const back = buildSwappedExercise({ ...toHold, measureMode: 'time' }, normal)
    expect(back.measureMode).toBeUndefined()
    expect(back.setDetails[0]).toEqual({ reps: 10, weight: 0 })
  })

  it('im Trainingsplan behält die Halteübung ihre Messart', async () => {
    const catalog = await loadDefaultExercises()
    const hold = catalog.find((e) => e.name_en === 'front lever')
    const normal = catalog.find((e) => e.name_en === 'archer row')
    const draft = addExercisesTo({ ...emptyDraft(), days: [{ exercises: [] }] }, 0, [
      { exerciseId: hold._id, name: 'Front Lever', measureMode: hold.measureMode },
      { exerciseId: normal._id, name: 'Archer Row', measureMode: normal.measureMode }
    ])
    expect(draft.days[0].exercises[0].measureMode).toBe('time')
    expect(draft.days[0].exercises[1].measureMode).toBeUndefined()
  })
})
