import { describe, it, expect } from 'vitest'
import { parseWorkoutText } from '../parse.js'
import { DEFAULT_SETS, MAX_INPUT_LENGTH } from '../schema.js'

// Kürzel: [Text, erwartete Übungen als [Name, Sätze, Wdh., kg, Sekunden]]. null = nicht angegeben (leer, nichts erfunden).
const first = (text) => parseWorkoutText(text).sessions.flatMap((s) => s.exercises)
const view = (e) => [e.raw_text, e.sets, e.reps, e.weight_kg, e.duration_seconds]

const SINGLE = [
  // Standardmuster Deutsch
  ['Bankdrücken 3x8 80 kg', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 3x8 80', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 3 x 8 mit 80 kg', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 3×8 80kg', ['Bankdrücken', 3, 8, 80, null]],
  ['80 kg Bankdrücken 3x8', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 80kg 3x8', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 82,5 kg 3x8', ['Bankdrücken', 3, 8, 82.5, null]],
  ['Bankdrücken 82.5kg 3x8', ['Bankdrücken', 3, 8, 82.5, null]],
  ['Kniebeugen 5x5 100 kg', ['Kniebeugen', 5, 5, 100, null]],
  ['Kreuzheben 1x5 140', ['Kreuzheben', 1, 5, 140, null]],
  ['Bankdrücken 3 Sätze à 8 mit 80 kg', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 3 Sätze 8 Wiederholungen 80kg', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken 4 Sätze', ['Bankdrücken', 4, null, null, null]],
  ['Bankdrücken 10 Wdh', ['Bankdrücken', DEFAULT_SETS, 10, null, null]],
  ['Bankdrücken mit 80', ['Bankdrücken', DEFAULT_SETS, null, 80, null]],
  ['Bankdrücken @ 80kg', ['Bankdrücken', DEFAULT_SETS, null, 80, null]],
  ['Bankdrücken', ['Bankdrücken', DEFAULT_SETS, null, null, null]],
  ['Klimmzüge 4x max', ['Klimmzüge', 4, null, null, null]],
  ['Klimmzüge 4xmax', ['Klimmzüge', 4, null, null, null]],
  // Englisch
  ['Bench press 3x8 80kg', ['Bench press', 3, 8, 80, null]],
  ['Bench Press 3 sets of 8 at 80 kg', ['Bench Press', 3, 8, 80, null]],
  ['Barbell row 4x10 with 60kg', ['Barbell row', 4, 10, 60, null]],
  ['Pull-ups 3x AMRAP', ['Pull-ups', 3, null, null, null]],
  ['Squat 5x5', ['Squat', 5, 5, null, null]],
  // Zahlwörter
  ['drei mal acht Bankdrücken mit 80 kg', ['Bankdrücken', 3, 8, 80, null]],
  ['Bankdrücken vier Sätze', ['Bankdrücken', 4, null, null, null]],
  ['Bench press three times eight 80kg', ['Bench press', 3, 8, 80, null]],
  // Zeit
  ['Plank 60 Sekunden', ['Plank', DEFAULT_SETS, null, null, 60]],
  ['Plank 3x60s', ['Plank', 3, null, null, 60]],
  ['Plank 2 Minuten', ['Plank', DEFAULT_SETS, null, null, 120]],
  ['Plank 45 sec', ['Plank', DEFAULT_SETS, null, null, 45]]
]

describe('parseWorkoutText: Standardmuster', () => {
  for (const [text, expected] of SINGLE) {
    it(`"${text}"`, () => {
      const exercises = first(text)
      expect(exercises).toHaveLength(1)
      expect(view(exercises[0])).toEqual(expected)
    })
  }
})

describe('parseWorkoutText: Annahmen und Leerstellen (nichts erfinden)', () => {
  it('fehlende Sätze: DEFAULT_SETS und "assumed: sets" - Wdh./Gewicht bleiben leer', () => {
    const [e] = first('Dips')
    expect(e).toMatchObject({ sets: DEFAULT_SETS, reps: null, weight_kg: null, assumed: ['sets'] })
  })

  it('genannte Sätze sind nicht angenommen', () => {
    expect(first('Dips 4x10')[0].assumed).toEqual([])
  })

  it('Bereich 8-10 wird als Bereich gemerkt, nicht als Wert', () => {
    const [e] = first('Bankdrücken 3x8-10 70 kg')
    expect(e).toMatchObject({ sets: 3, reps: null, reps_range: [8, 10], weight_kg: 70 })
  })

  it('exercise_id und variant bleiben null (macht Schritt 2)', () => {
    const [e] = first('Bankdrücken 3x8 80')
    expect(e.exercise_id).toBeNull()
    expect(e.variant).toBeNull()
  })
})

describe('parseWorkoutText: mehrere Übungen, Sitzungen, Split', () => {
  it('Trennung per Komma, "und", Semikolon, Zeilenumbruch, Plus', () => {
    for (const text of [
      'Bankdrücken 3x8 80, Dips 3x10',
      'Bankdrücken 3x8 80 und Dips 3x10',
      'Bankdrücken 3x8 80; Dips 3x10',
      'Bankdrücken 3x8 80\nDips 3x10',
      'Bankdrücken 3x8 80 + Dips 3x10'
    ]) {
      expect(first(text).map((e) => e.raw_text)).toEqual(['Bankdrücken', 'Dips'])
    }
  })

  it('Dezimalkomma wird nicht als Trenner gelesen', () => {
    expect(first('Bankdrücken 3x8 82,5 kg, Dips 3x10').map(view)).toEqual([
      ['Bankdrücken', 3, 8, 82.5, null],
      ['Dips', 3, 10, null, null]
    ])
  })

  it('Sitzungsname mit Doppelpunkt', () => {
    const r = parseWorkoutText('Push: Bankdrücken 3x8 80, Dips 3x10')
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0]).toMatchObject({ label: 'Push', type: 'push' })
    expect(r.sessions[0].exercises).toHaveLength(2)
  })

  it('mehrere Sitzungen', () => {
    const r = parseWorkoutText('Push: Bankdrücken 3x8 80\nPull: Rudern 3x10 60')
    expect(r.sessions.map((s) => [s.label, s.type, s.exercises.length])).toEqual([['Push', 'push', 1], ['Pull', 'pull', 1]])
  })

  it('nur ein Typ ("Push", "Beine", "Ganzkörper")', () => {
    expect(parseWorkoutText('Push').sessions).toEqual([{ label: 'Push', type: 'push', exercises: [] }])
    expect(parseWorkoutText('Beine').sessions[0]).toMatchObject({ label: 'Legs', type: 'legs' })
    expect(parseWorkoutText('Ganzkörper').sessions[0]).toMatchObject({ label: 'Fullbody', type: 'fullbody' })
  })

  it('Upper/Lower und Brust haben (noch) keinen App-Typ: type bleibt null, Name bleibt erhalten', () => {
    expect(parseWorkoutText('Upper').sessions[0]).toMatchObject({ label: 'Upper', type: null })
    expect(parseWorkoutText('Brust').sessions[0]).toMatchObject({ label: 'Brust', type: null })
  })

  it('Split und Tage pro Woche (Beispiel aus der Idee)', () => {
    const r = parseWorkoutText('Push Pull Legs, 5 Tage, Bankdrücken 3x8 mit 80 kg')
    expect(r.split).toBe('ppl')
    expect(r.days_per_week).toBe(5)
    expect(first('Push Pull Legs, 5 Tage, Bankdrücken 3x8 mit 80 kg').map(view)).toEqual([['Bankdrücken', 3, 8, 80, null]])
    expect(r.unresolved).toEqual([])
    expect(parseWorkoutText('PPL 4 Tage die Woche').days_per_week).toBe(4)
    expect(parseWorkoutText('Upper Lower Split').split).toBe('upper_lower')
  })

  it('Füllwörter vorne ("Heute mache ich ...")', () => {
    expect(first('Heute mache ich Bankdrücken 3x8 80').map(view)).toEqual([['Bankdrücken', 3, 8, 80, null]])
    expect(first('Today bench press 3x8 80kg').map(view)).toEqual([['bench press', 3, 8, 80, null]])
  })
})

describe('parseWorkoutText: nicht verstanden -> melden, nicht raten', () => {
  const GAPS = [
    ['', null],
    ['   ', null],
    ['3x8 80', 'no_name'],
    ['80 kg', 'no_name'],
    ['???', 'unparsed']
  ]
  for (const [text, reason] of GAPS) {
    it(`"${text}" -> ${reason ?? 'leer'}`, () => {
      const r = parseWorkoutText(text)
      expect(first(text)).toHaveLength(0)
      if (reason) {
        expect(r.unresolved.map((u) => u.reason)).toContain(reason)
        expect(r.needs_llm).toBe(true)
      } else {
        expect(r.unresolved).toEqual([])
        expect(r.needs_llm).toBe(false)
      }
    })
  }

  it('lbs werden nicht umgerechnet: Gewicht bleibt leer, Grund wird gemeldet', () => {
    const r = parseWorkoutText('Latzug 60 lbs 3x10')
    expect(first('Latzug 60 lbs 3x10').map(view)).toEqual([['Latzug', 3, 10, null, null]])
    expect(r.unresolved.map((u) => u.reason)).toEqual(['unit_unsupported'])
    expect(r.needs_llm).toBe(false)
  })

  it('unsinnige Zahlen werden verworfen, nicht übernommen', () => {
    const [a] = first('Bankdrücken 3x8 5000 kg')
    expect(a.weight_kg).toBeNull()
    const [b] = first('Bankdrücken 99x8 80')
    expect(b.sets).toBe(DEFAULT_SETS)
    expect(parseWorkoutText('Bankdrücken 99x8 80').unresolved.map((u) => u.reason)).toContain('out_of_range')
  })

  it('ein unverständliches Segment stoppt die anderen nicht', () => {
    const r = parseWorkoutText('Bankdrücken 3x8 80, ???, Dips 3x10')
    expect(first('Bankdrücken 3x8 80, ???, Dips 3x10').map((e) => e.raw_text)).toEqual(['Bankdrücken', 'Dips'])
    expect(r.needs_llm).toBe(true)
  })
})

describe('parseWorkoutText: Eingabe-Sicherheit', () => {
  it('Steuerzeichen und <> werden entfernt, nie als HTML weitergereicht', () => {
    const out = JSON.stringify(parseWorkoutText('<script>alert(1)</script> Bankdrücken 3x8 80\u0000'))
    expect(out).not.toMatch(/[<>]/)
    expect(out).not.toContain('\\u0000')
    expect(first('<b>Bankdrücken</b> 3x8 80').map((e) => e.raw_text)).toEqual(['Bankdrücken'])
  })

  it('zu lange Eingabe wird gekürzt und gemeldet', () => {
    const r = parseWorkoutText(`Bankdrücken 3x8 80, ${'Dips 3x10, '.repeat(200)}`)
    expect(r.unresolved.some((u) => u.reason === 'input_truncated')).toBe(true)
    expect(JSON.stringify(r).length).toBeLessThan(MAX_INPUT_LENGTH * 40)
  })

  it('kein String, null, undefined -> leeres Ergebnis ohne Fehler', () => {
    for (const v of [null, undefined, 42, {}, []]) {
      expect(() => parseWorkoutText(v)).not.toThrow()
    }
    expect(parseWorkoutText(null).sessions).toEqual([])
  })

  it('gleiche Eingabe, gleiches Ergebnis', () => {
    const text = 'Push: Bankdrücken 3x8 80, Dips 3x10'
    expect(parseWorkoutText(text)).toEqual(parseWorkoutText(text))
  })
})

describe('parseWorkoutText: Schreibweisen aus der Praxis', () => {
  it('Listenzeichen und Nummern am Zeilenanfang', () => {
    expect(first('- Bankdrücken 3x8 80\n- Dips 3x10').map((e) => e.raw_text)).toEqual(['Bankdrücken', 'Dips'])
    expect(first('1. Bankdrücken 3x8 80\n2) Dips 3x10').map((e) => e.raw_text)).toEqual(['Bankdrücken', 'Dips'])
  })

  it('Gewicht vor Wiederholungen: "80 kg x 8" -> 8 Wdh.', () => {
    expect(view(first('Bankdrücken 80kg x 8')[0])).toEqual(['Bankdrücken', DEFAULT_SETS, 8, 80, null])
  })

  it('uneindeutig ("8 x 80 kg", "3x8x80"): Zahl wird NICHT geraten, Grund wird gemeldet', () => {
    for (const text of ['Bankdrücken 8 x 80kg', 'Bankdrücken 3x8x80']) {
      const r = parseWorkoutText(text)
      expect(r.unresolved.map((u) => u.reason)).toContain('ambiguous_numbers')
      expect(first(text)[0].raw_text).toBe('Bankdrücken')
    }
    expect(view(first('Bankdrücken 3x8x80')[0])).toEqual(['Bankdrücken', 3, 8, null, null])
  })

  it('Zahlen als eigene Segmente gehören zur Übung davor und werden als "merged_numbers" gemeldet', () => {
    const r = parseWorkoutText('Bankdrücken, 3x8, 80kg')
    expect(first('Bankdrücken, 3x8, 80kg').map(view)).toEqual([['Bankdrücken', 3, 8, 80, null]])
    expect(r.unresolved.map((u) => u.reason)).toContain('merged_numbers')
    expect(r.needs_llm).toBe(false)
  })

  it('Pausen-Angaben werden nicht Teil des Namens und gemeldet (kein Ziel der ersten Version)', () => {
    expect(first('Bankdrücken 3x8 80kg 90 Sek Pause').map(view)).toEqual([['Bankdrücken', 3, 8, 80, null]])
    expect(parseWorkoutText('Kniebeugen 5x5 100kg Pausen 3 min').unresolved.map((u) => u.reason)).toEqual(['ignored_rest'])
  })

  it('Wörter wie "mit" bleiben mitten im Namen erhalten, nur am Rand fallen sie weg', () => {
    expect(first('Kabelzug mit Seil 3x12 20kg')[0].raw_text).toBe('Kabelzug mit Seil')
    expect(first('Bankdrücken ca. 3x8 80kg')[0].raw_text).toBe('Bankdrücken')
    expect(first('Dips (Langhantel) 3x8')[0].raw_text).toBe('Dips (Langhantel)')
  })

  it('Zahl im Namen ("21 Curls") wird nicht geraten', () => {
    const r = parseWorkoutText('21 Curls')
    expect(r.sessions).toEqual([])
    expect(r.needs_llm).toBe(true)
  })
})
