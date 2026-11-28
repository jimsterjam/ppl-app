import { describe, it, expect } from 'vitest'
import catalog from '@/data/default-exercises.json'
import { matchExerciseName } from '@/utils/textWorkout/matchExercise.js'

// Calisthenics-Paket, Schritt 2a (Absprache Jimmy 28.11.): Halteübungen 1-12, ohne Bild/Video, Messart Zeit.
const IDS = Array.from({ length: 12 }, (_, i) => `ex_${9019 + i}`)
const byId = new Map(catalog.map((e) => [e._id, e]))
const norm = (s) => String(s || '').trim().toLowerCase()

describe('Katalog: Calisthenics-Halteübungen (9019-9030)', () => {
  it.each(IDS)('%s hat alle Pflichtfelder, Körpergewicht, Messart Zeit und kein Bild', (id) => {
    const e = byId.get(id)
    expect(e).toBeTruthy()
    expect(e.id).toBe(id.replace('ex_', ''))
    expect(e.name_en).toBe(e.name.toLowerCase())
    expect(['Push', 'Pull', 'Legs', 'Core']).toContain(e.category)
    expect(e.equipment).toBe('Körpergewicht')
    expect(e.equipment_en).toBe('body weight')
    expect(e.measureMode).toBe('time')
    expect(e.imageUrl).toBe('')
    expect(e.thumbnailUrl).toBe('')
    expect(e.description.length).toBeGreaterThan(40)
    expect(e.description_en.length).toBeGreaterThan(40)
    expect(e.instructions.length).toBeGreaterThanOrEqual(3)
    expect(e.instructions_en.length).toBe(e.instructions.length)
    expect(e.aiMetadata.allowedEquipmentModes).toContain('bodyweight_only')
  })

  it('Gegenprobe: keine doppelten IDs, englischen Namen oder Aliase im ganzen Katalog', () => {
    const ids = catalog.map((e) => e._id)
    expect(new Set(ids).size).toBe(ids.length)
    const names = catalog.map((e) => norm(e.name_en))
    expect(new Set(names).size).toBe(names.length)
    // ein Alias darf nie so heißen wie eine andere Übung oder ein Alias einer anderen Übung
    const owner = new Map(catalog.map((e) => [norm(e.name_en), e._id]))
    for (const e of catalog) {
      for (const a of e.aliases || []) {
        const key = norm(a)
        if (owner.has(key)) expect(owner.get(key), `${a} (${e._id})`).toBe(e._id)
        else owner.set(key, e._id)
      }
    }
  })

  it('Zeit-Übungen sind Haltepositionen, bewegte Verwandte bleiben bei Wdh.', () => {
    for (const name of ['hollow body rock', 'tuck front lever raise', 'archer row', 'hanging leg raise']) {
      expect(catalog.find((e) => e.name_en === name).measureMode, name).toBeUndefined()
    }
  })

  it.each([
    ['Plank', 'plank'],
    ['Forearm Plank', 'plank'],
    ['Hollow Body Hold', 'hollow body hold'],
    ['Superman Hold', 'arch body hold'],
    ['Dead Hang', 'dead hang'],
    ['Flexed Arm Hang', 'flexed arm hang'],
    ['Wall Sit', 'wall sit'],
    ['Crow Pose', 'crow pose'],
    ['Parallel Bar Support Hold', 'parallel bar support hold'],
    ['Straddle Front Lever', 'straddle front lever'],
    ['Tuck Back Lever', 'tuck back lever'],
    ['Advanced Tuck Back Lever', 'advanced tuck back lever'],
    ['Straddle Back Lever', 'straddle back lever']
  ])('Workout-Text "%s" -> %s', (text, expected) => {
    const result = matchExerciseName(text, { catalog })
    expect(result.status).toBe('matched')
    expect(result.name_en).toBe(expected)
  })

  it('Gegenprobe: bestehende, ähnlich benannte Übungen werden nicht verschluckt', () => {
    expect(matchExerciseName('Hollow Body Rocks', { catalog }).name_en).toBe('hollow body rock')
    expect(matchExerciseName('Weighted Front Plank', { catalog }).name_en).toBe('weighted front plank')
    expect(matchExerciseName('Front Lever', { catalog }).name_en).toBe('front lever')
    expect(matchExerciseName('Back Lever', { catalog }).name_en).toBe('back lever')
    expect(matchExerciseName('Tuck Front Lever', { catalog }).name_en).toBe('tuck front lever')
    expect(matchExerciseName('Advanced Tuck Front Lever', { catalog }).name_en).toBe('advanced tuck front lever')
  })
})
