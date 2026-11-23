import { describe, it, expect } from 'vitest'
import catalog from '@/data/default-exercises.json'
import { matchExerciseName } from '@/utils/textWorkout/matchExercise.js'

// Jimmy 23.11.: Übungen aus einem Calisthenics-Workout (Planche, Front Lever, Core). Nur Übungsnamen, ohne Bild/Video (gibt es noch nicht).
const NEW_IDS = ['ex_9012', 'ex_9013', 'ex_9014', 'ex_9015', 'ex_9016', 'ex_9017', 'ex_9018']
const byId = new Map(catalog.map((e) => [e._id, e]))

describe('Katalog: Calisthenics-Übungen (Planche, Front Lever, Core)', () => {
  it.each(NEW_IDS)('%s hat alle Pflichtfelder, Körpergewicht und kein Bild', (id) => {
    const e = byId.get(id)
    expect(e).toBeTruthy()
    expect(e.id).toBe(id.replace('ex_', ''))
    expect(e.name_en).toBe(e.name.toLowerCase())
    expect(['Push', 'Pull', 'Legs', 'Core']).toContain(e.category)
    expect(e.equipment).toBe('Körpergewicht')
    expect(e.equipment_en).toBe('body weight')
    expect(e.imageUrl).toBe('')
    expect(e.thumbnailUrl).toBe('')
    expect(e.description.length).toBeGreaterThan(40)
    expect(e.description_en.length).toBeGreaterThan(40)
    expect(e.instructions.length).toBeGreaterThanOrEqual(3)
    expect(e.instructions_en.length).toBe(e.instructions.length)
    expect(e.aiMetadata.allowedEquipmentModes).toContain('bodyweight_only')
  })

  it('Gegenprobe: keine doppelten IDs und keine doppelten englischen Namen im Katalog', () => {
    const ids = catalog.map((e) => e._id)
    expect(new Set(ids).size).toBe(ids.length)
    const names = catalog.map((e) => e.name_en)
    expect(new Set(names).size).toBe(names.length)
  })

  // Die Schreibweisen aus dem Workout-Text müssen der richtigen Übung zugeordnet werden (neu oder schon vorhanden).
  it.each([
    ['Lean Push-Up Position Hold', 'lean planche'],
    ['Pseudo Planche Push-Ups', 'pseudo planche push-up'],
    ['Tuck Planche Hold', 'tuck planche'],
    ['Tuck Front Lever Hold', 'tuck front lever'],
    ['Tuck-FL-Raises', 'tuck front lever raise'],
    ['Archer Rows', 'archer row'],
    ['Advanced Tuck Front Lever', 'advanced tuck front lever'],
    ['Hollow Body Rocks', 'hollow body rock'],
    ['Hanging Leg Raises', 'hanging leg raise'],
    ['L-Sit', 'l-sit on floor']
  ])('"%s" -> %s', (text, expected) => {
    const result = matchExerciseName(text, { catalog })
    expect(result.status).toBe('matched')
    expect(result.name_en).toBe(expected)
  })

  it('Gegenprobe: ähnlich klingende Übungen bleiben getrennt (Tuck Front Lever ist nicht der volle Front Lever)', () => {
    expect(matchExerciseName('Front Lever', { catalog }).name_en).toBe('front lever')
    expect(matchExerciseName('Tuck Front Lever', { catalog }).name_en).toBe('tuck front lever')
    expect(matchExerciseName('Planche', { catalog }).name_en).not.toBe('tuck planche')
  })
})
