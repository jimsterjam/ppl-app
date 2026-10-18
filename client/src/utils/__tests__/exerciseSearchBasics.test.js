import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchAndRankExercises } from '../exerciseSearch.js'

// Absprache Paul 15.10.: Die Suche zeigt zuerst die Basisübung, danach die Varianten - geprüft gegen den echten Katalog.
const catalog = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/data/default-exercises.json'), 'utf8'))
const items = catalog.map((e) => ({ name: e.name_en || e.name, de: e.name, equipment: e.equipment_en }))
const search = (q, list = items) => searchAndRankExercises(list, q, { getPrimaryText: (i) => i.name, getSecondaryTexts: (i) => [i.de] }).map((i) => i.name)

describe('Suche: Basisübungen zuerst', () => {
  it('squat: Full Squat, High Bar Squat, Bodyweight Squat, Goblet Squat vor allen Varianten', () => {
    expect(search('squat').slice(0, 4)).toEqual(['full squat', 'barbell high bar squat', 'bodyweight squat', 'dumbbell goblet squat'])
    expect(search('squats').slice(0, 2)).toEqual(['full squat', 'barbell high bar squat'])
    expect(search('kniebeuge')[0]).toBe('full squat')
  })

  it('Körpergewicht-Filter + squat: Bodyweight Squat steht ganz vorn', () => {
    const bodyweight = items.filter((i) => i.equipment === 'body weight')
    expect(search('squat', bodyweight)[0]).toBe('bodyweight squat')
  })

  it('push up / push-up / pushups: der einfache Push-up zuerst (Bindestrich wie Leerzeichen)', () => {
    for (const q of ['push up', 'push-up', 'pushup', 'liegestütz']) {
      expect(search(q)[0]).toBe('push-up')
    }
  })

  it('bench press, pull up, deadlift, lunge, curl, row: Basis vorn', () => {
    expect(search('bench press').slice(0, 2)).toEqual(['bench press barbell', 'dumbbell bench press'])
    expect(search('pull up').slice(0, 2)).toEqual(['pull-up', 'chin-up'])
    expect(search('deadlift')[0]).toBe('barbell deadlift')
    expect(search('lunge').slice(0, 3)).toEqual(['walking lunge', 'dumbbell lunge', 'barbell lunge'])
    expect(search('curl').slice(0, 2)).toEqual(['barbell curl', 'dumbbell biceps curl'])
    expect(search('row')[0]).toBe('barbell bent over row')
  })

  it('genauere Suche bleibt genau: "goblet squat" findet zuerst die Goblet Squats, "arrow" keine Rudern-Basis', () => {
    expect(search('goblet squat').slice(0, 2)).toEqual(['dumbbell goblet squat', 'kettlebell goblet squat'])
    expect(search('arrow')[0]).not.toBe('barbell bent over row')
  })

  it('der alte Name der Körpergewicht-Kniebeuge bleibt über den Alias auffindbar', () => {
    const entry = catalog.find((e) => e._id === 'ex_3533')
    expect(entry.name_en).toBe('bodyweight squat')
    expect(entry.aliases).toContain('quads (bodyweight squat)')
  })
})

describe('Suche: Wortreihenfolge egal', () => {
  it('"leg curl lying" liefert dasselbe wie "lying leg curl"', () => {
    const a = search('lying leg curl').slice(0, 5)
    expect(search('leg curl lying').slice(0, 5)).toEqual(a)
    expect(a).toContain('lever lying leg curl')
  })
})
