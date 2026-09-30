import { describe, it, expect } from 'vitest'
import { exerciseTokenKey, buildCatalogIndex, findCatalogEntry, findCatalogEntryByName } from '../exerciseMatch.js'

const catalog = [
  { id: '0025', _id: 'ex_0025', name: 'Bankdrücken Langhantel', name_en: 'bench press barbell' },
  { id: '0296', _id: 'ex_0296', name: 'Kurzhanteldrücken mit engem Griff', name_en: 'dumbbell close-grip press', aliases: ['dumbbell close grip press'], aliasIds: ['1731'] },
  { id: '0576', _id: 'ex_0576', name: 'Brustpresse am Gerät (Scheiben)', name_en: 'lever chest press (plate loaded)', aliases: ['lever chest press', 'Hebel-Brustpresse'] },
  { id: '0577', _id: 'ex_0577', name: 'Brustpresse am Gerät (Steckgewicht)', name_en: 'lever chest press (weight stack)' },
  { id: '1111', name: 'A', name_en: 'squat front barbell' },
  { id: '2222', name: 'B', name_en: 'front barbell squat' }
]
const index = buildCatalogIndex(catalog)

describe('exerciseMatch', () => {
  it('Wortreihenfolge und Satzzeichen egal', () => {
    expect(exerciseTokenKey('Barbell Bench Press')).toBe(exerciseTokenKey('bench press barbell'))
    expect(findCatalogEntryByName(index, 'Barbell Bench Press')?.id).toBe('0025')
  })

  it('alter Name (alias) findet den umbenannten Eintrag, zusammengeführte ID den bleibenden', () => {
    expect(findCatalogEntryByName(index, 'lever chest press')?.id).toBe('0576')
    expect(findCatalogEntryByName(index, 'Hebel-Brustpresse')?.id).toBe('0576')
    expect(findCatalogEntry(index, { exerciseId: 'ex_1731' })?.id).toBe('0296')
    expect(findCatalogEntry(index, { exerciseId: '1731' })?.id).toBe('0296')
  })

  it('ID vor Name; unbekannte ID fällt auf den Namen zurück', () => {
    expect(findCatalogEntry(index, { exerciseId: 'ex_0577', name: 'bench press barbell' })?.id).toBe('0577')
    expect(findCatalogEntry(index, { exerciseId: '66f0c0ffee', name: 'Barbell Bench Press' })?.id).toBe('0025')
  })

  it('mehrdeutige Wortreihenfolge wird nicht geraten, eigene Übungen bleiben ohne Treffer', () => {
    expect(findCatalogEntryByName(index, 'barbell squat front')).toBeNull()
    expect(findCatalogEntryByName(index, 'Meine Spezialübung')).toBeNull()
  })
})
