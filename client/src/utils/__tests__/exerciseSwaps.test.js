import { describe, it, expect } from 'vitest'
import catalogJson from '@/data/default-exercises.json'
import { CURATED_SWAPS } from '@/data/exerciseSwapList'
import { normalizeDefaultExercises } from '../normalizeDefaultExercises.js'
import { curateDefaultExercises } from '../exerciseCuration.js'
import { getSwapSuggestions, equipmentKind, SWAP_MAX_SUGGESTIONS } from '../exerciseSwaps.js'

// Wie in der App: gebündelter Katalog -> kuratiert -> normalisiert (defaultExercisesLoader.js).
const catalog = normalizeDefaultExercises(curateDefaultExercises(catalogJson, { enableCuration: true, enableExoticFilter: true }))
const names = new Set(catalog.map((entry) => entry.name_en.toLowerCase()))

describe('Austausch-Liste', () => {
  it('33 Grundübungen; alle Namen (Original und Ersatz) gibt es im App-Katalog', () => {
    expect(Object.keys(CURATED_SWAPS)).toHaveLength(33)
    const missing = []
    for (const [original, subs] of Object.entries(CURATED_SWAPS)) {
      for (const name of [original, ...subs]) if (!names.has(name)) missing.push(name)
    }
    expect(missing).toEqual([])
  })

  it('keine Übung schlägt sich selbst oder doppelt vor', () => {
    for (const [original, subs] of Object.entries(CURATED_SWAPS)) {
      expect(subs).not.toContain(original)
      expect(new Set(subs).size).toBe(subs.length)
    }
  })
})

describe('getSwapSuggestions', () => {
  it('Bench Press Barbell: zuerst geführte Maschinen, Langhantel selbst nicht dabei', () => {
    const result = getSwapSuggestions({ exercise: { name: 'bench press barbell' }, catalog })
    expect(result[0].entry.name_en).toBe('lever chest press (weight stack)')
    expect(result.slice(0, 3).every((s) => s.kind === 'machine')).toBe(true)
    expect(result.every((s) => s.curated)).toBe(true)
    expect(result.map((s) => s.entry.name_en)).not.toContain('bench press barbell')
    expect(result.length).toBeLessThanOrEqual(SWAP_MAX_SUGGESTIONS)
  })

  it('Übungen, die schon im Workout sind, werden nicht vorgeschlagen', () => {
    const result = getSwapSuggestions({ exercise: { name: 'bench press barbell' }, catalog, exclude: ['Lever Chest Press (Weight Stack)'] })
    expect(result.map((s) => s.entry.name_en)).not.toContain('lever chest press (weight stack)')
    expect(result[0].entry.name_en).toBe('lever chest press (plate loaded)')
  })

  it('Übung außerhalb der Liste: automatisch, gleicher Zielmuskel, nie „fortgeschritten“, höchstens 6', () => {
    const original = catalog.find((e) => e.name_en.toLowerCase() === 'dumbbell incline fly') || catalog.find((e) => equipmentKind(e) === 'dumbbell' && !CURATED_SWAPS[e.name_en.toLowerCase()])
    const result = getSwapSuggestions({ exercise: { name: original.name_en }, catalog })
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(SWAP_MAX_SUGGESTIONS)
    for (const { entry, curated } of result) {
      expect(curated).toBe(false)
      expect(entry.target).toBe(original.target)
      expect(String(entry.difficulty).toLowerCase()).not.toBe('advanced')
      expect(entry.name_en).not.toBe(original.name_en)
    }
  })

  it('freies Gewicht als Original: automatische Vorschläge beginnen mit geführten Geräten', () => {
    const original = catalog.find((e) => equipmentKind(e) === 'barbell' && !CURATED_SWAPS[e.name_en.toLowerCase()] && e.target === 'quads')
      || catalog.find((e) => equipmentKind(e) === 'dumbbell' && !CURATED_SWAPS[e.name_en.toLowerCase()])
    const result = getSwapSuggestions({ exercise: { name: original.name_en }, catalog })
    const ranks = result.map((s) => ({ machine: 0, cable: 1, smith: 1 }[s.kind] ?? 2))
    expect(ranks[0]).toBeLessThanOrEqual(1)
  })

  it('Übung mit deutschem Namen oder nur mit Katalog-ID wird trotzdem gefunden (ältere Vorlagen-Favoriten)', () => {
    const bench = catalog.find((e) => e.name_en.toLowerCase() === 'bench press barbell')
    const byGerman = getSwapSuggestions({ exercise: { name: bench.name, exerciseId: undefined }, catalog })
    const byId = getSwapSuggestions({ exercise: { name: 'irgendwas', exerciseId: bench._id }, catalog })
    expect(byGerman[0].entry.name_en).toBe('lever chest press (weight stack)')
    expect(byId[0].entry.name_en).toBe('lever chest press (weight stack)')
    expect(byGerman.map((s) => s.entry.name_en)).not.toContain('bench press barbell')
  })

  it('unbekannte Übung: leere Liste', () => {
    expect(getSwapSuggestions({ exercise: { name: 'gibt es nicht' }, catalog })).toEqual([])
  })
})

describe('equipmentKind', () => {
  it('ordnet Geräte zu', () => {
    expect(equipmentKind({ equipment_en: 'leverage machine' })).toBe('machine')
    expect(equipmentKind({ equipment_en: 'sled machine' })).toBe('machine')
    expect(equipmentKind({ equipment_en: 'smith machine' })).toBe('smith')
    expect(equipmentKind({ equipment_en: 'cable' })).toBe('cable')
    expect(equipmentKind({ equipment_en: 'barbell' })).toBe('barbell')
    expect(equipmentKind({ equipment_en: 'ez barbell' })).toBe('barbell')
    expect(equipmentKind({ equipment_en: 'dumbbell' })).toBe('dumbbell')
    expect(equipmentKind({ equipment_en: 'body weight' })).toBe('bodyweight')
    expect(equipmentKind({})).toBe('other')
  })
})
