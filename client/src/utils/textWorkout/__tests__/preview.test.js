import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createExerciseMatcher } from '../matchExercise.js'
import { answerItem, buildTextWorkoutModel, canStart, describeValues, pendingQuestion, setGoal } from '../preview.js'

const catalog = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../public/data/default-exercises.json'), 'utf8'))
const match = createExerciseMatcher({ catalog })
const build = (text, goal = 'strength') => buildTextWorkoutModel(text, { match, goal })

describe('buildTextWorkoutModel', () => {
  it('Beispiel aus dem Entwurf: sicher erkannt, nichts offen, Start möglich', () => {
    const m = build('Bankdrücken 3x8 80 kg, Latzug, Dips')
    expect(m.state).toBe('ready')
    expect(m.items.map((i) => [i.nameEn, i.status])).toEqual([
      ['bench press barbell', 'matched'],
      ['lat pulldown wide grip', 'matched'],
      ['chest dip', 'matched']
    ])
    expect(pendingQuestion(m)).toBeNull()
    expect(canStart(m)).toBe(true)
  })

  it('genannte Werte sind "given", fehlende leer/angenommen - nichts erfunden', () => {
    const [bench, lat, dips] = build('Bankdrücken 3x8 80 kg, Latzug, Dips 4x10').items
    expect(describeValues(bench)).toEqual([
      { field: 'sets', value: 3, given: true },
      { field: 'reps', value: 8, given: true },
      { field: 'weight', value: 80, given: true }
    ])
    expect(describeValues(lat)).toEqual([
      { field: 'sets', value: 3, given: false },
      { field: 'reps', value: null, given: false },
      { field: 'weight', value: null, given: false }
    ])
    expect(describeValues(dips)[0]).toEqual({ field: 'sets', value: 4, given: true })
  })

  it('Zeitübung und Wiederholungsbereich', () => {
    const [plank] = build('Farmers Walk 3x60s').items
    expect(describeValues(plank)).toEqual([{ field: 'sets', value: 3, given: true }, { field: 'duration', value: 60, given: true }])
    const [bench] = build('Bankdrücken 3x8-10 70 kg').items
    expect(describeValues(bench)[1]).toEqual({ field: 'repsRange', value: [8, 10], given: true })
  })

  it('angenommene Variante ist markiert und hat Alternativen zum Antippen', () => {
    const [bench] = build('Bankdrücken').items
    expect(bench.assumedVariant).toBe(true)
    expect(bench.alternatives.map((a) => a.name_en)).toContain('dumbbell bench press')
    expect(build('Bankdrücken Kurzhantel Schräg').items[0].assumedVariant).toBe(false)
  })

  it('formatName wird für die Anzeige verwendet', () => {
    const m = buildTextWorkoutModel('Latzug', { match, goal: 'strength', formatName: (n) => n.toUpperCase() })
    expect(m.items[0].display).toBe('LAT PULLDOWN WIDE GRIP')
  })

  it('leere oder unverständliche Eingabe: state "empty", Hinweise statt Absturz', () => {
    expect(build('').state).toBe('empty')
    const m = build('???')
    expect(m.state).toBe('empty')
    expect(m.notUnderstood).toEqual(['???'])
    expect(canStart(m)).toBe(false)
  })

  it('Hinweise aus dem Parser (Pause, lbs, unklare Zahlen, Plan, mehrere Einheiten)', () => {
    const codes = (text) => build(text).hints.map((h) => h.code)
    expect(codes('Bankdrücken 3x8 80kg 90 Sek Pause')).toContain('ignored_rest')
    expect(codes('Latzug 60 lbs 3x10')).toContain('unit_unsupported')
    expect(codes('Bankdrücken 8 x 80kg')).toContain('ambiguous_numbers')
    expect(codes('PPL 5 Tage, Bankdrücken 3x8')).toContain('plan')
    const multi = build('Push: Bankdrücken 3x8\nPull: Rudern Kabel 3x10')
    expect(multi.hints.find((h) => h.code === 'extra_sessions')).toEqual({ code: 'extra_sessions', text: 'Push' })
    expect(multi.items.map((i) => i.nameEn)).toEqual(['bench press barbell'])
    expect(multi.type).toBe('push')
    expect(build('Bankdrücken 3x8').typeAssumed).toBe(true)
  })
})

describe('Rückfragen', () => {
  it('Seitheben: Rückfrage mit Auswahl, erst nach der Antwort ist Start möglich', () => {
    let m = build('Bankdrücken 3x8 80, Seitheben')
    expect(pendingQuestion(m)).toEqual({ kind: 'variant', key: 'ex-1' })
    expect(canStart(m)).toBe(false)
    const choice = m.items[1].candidates.find((c) => c.name_en === 'cable lateral raise')
    m = answerItem(m, 'ex-1', choice)
    expect(m.items[1]).toMatchObject({ status: 'matched', nameEn: 'cable lateral raise', answered: true, assumedVariant: false })
    expect(pendingQuestion(m)).toBeNull()
    expect(canStart(m)).toBe(true)
  })

  it('nicht gefunden: Vorschlag wählen oder weglassen, nie still neu anlegen', () => {
    let m = build('Bankdrücken 3x8 80, Face Pulls')
    expect(pendingQuestion(m)).toEqual({ kind: 'not_found', key: 'ex-1' })
    m = answerItem(m, 'ex-1', 'skip')
    expect(m.items[1].status).toBe('skipped')
    expect(pendingQuestion(m)).toBeNull()
    expect(canStart(m)).toBe(true)
  })

  it('"Weglassen" bei der einzigen Übung: kein Start (nichts übrig)', () => {
    const m = answerItem(build('Face Pulls'), 'ex-0', 'skip')
    expect(canStart(m)).toBe(false)
  })

  it('Variante angenommen -> per Tap eine Alternative wählen', () => {
    let m = build('Bankdrücken')
    const alt = m.items[0].alternatives.find((a) => a.name_en === 'dumbbell bench press')
    m = answerItem(m, 'ex-0', alt)
    expect(m.items[0]).toMatchObject({ nameEn: 'dumbbell bench press', assumedVariant: false })
  })

  it('ohne Ziel wird zuerst das Ziel gefragt (nur beim allerersten Mal), danach nie wieder', () => {
    let m = build('Bankdrücken 3x8', null)
    expect(pendingQuestion(m)).toEqual({ kind: 'goal' })
    expect(canStart(m)).toBe(false)
    m = setGoal(m, 'hypertrophy')
    expect(pendingQuestion(m)).toBeNull()
    expect(canStart(m)).toBe(true)
  })

  it('Antworten verändern das alte Modell nicht', () => {
    const m = build('Seitheben')
    const copy = JSON.parse(JSON.stringify(m))
    answerItem(m, 'ex-0', 'skip')
    expect(m).toEqual(copy)
  })

  it('ungültige Auswahl ändert nichts', () => {
    const m = build('Seitheben')
    expect(answerItem(m, 'ex-0', {}).items[0].status).toBe('ambiguous')
    expect(answerItem(m, 'ex-99', 'skip')).toEqual(m)
  })
})
