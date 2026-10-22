import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createExerciseMatcher, fold, resolveParsedWorkout, stem } from '../matchExercise.js'
import { SYNONYMS } from '../synonyms.js'

const catalog = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../public/data/default-exercises.json'), 'utf8'))
const match = createExerciseMatcher({ catalog })
const names = new Set(catalog.map((e) => e.name_en))

// --- Daten der Tabelle selbst --------------------------------------------------------------------------------------
describe('Synonymtabelle: Pflege', () => {
  it('jedes Ziel und jeder Vorschlag existiert im Katalog (verhindert stilles Verrotten)', () => {
    const missing = []
    for (const concept of SYNONYMS) {
      for (const target of concept.targets) if (!names.has(target.name)) missing.push(`${concept.id}: ${target.name}`)
      for (const name of concept.suggest || []) if (!names.has(name)) missing.push(`${concept.id} (Vorschlag): ${name}`)
    }
    expect(missing).toEqual([])
  })

  it('kein Schreibweisen-Konflikt: derselbe Begriff zeigt nicht auf zwei Konzepte', () => {
    const seen = new Map()
    const conflicts = []
    for (const concept of SYNONYMS) {
      for (const raw of concept.keys) {
        const key = fold(typeof raw === 'string' ? raw : raw.key).split(' ').map(stem).join(' ')
        if (seen.has(key) && seen.get(key) !== concept.id) conflicts.push(`${key}: ${seen.get(key)} / ${concept.id}`)
        seen.set(key, concept.id)
      }
    }
    expect(conflicts).toEqual([])
  })

  it('jede Zeile hat mindestens einen Begriff und entweder Ziele oder Vorschläge', () => {
    for (const concept of SYNONYMS) {
      expect(concept.keys.length, concept.id).toBeGreaterThan(0)
      expect(concept.targets.length + (concept.suggest || []).length, concept.id).toBeGreaterThan(0)
    }
  })
})

// --- Treffer: [Eingabe, erwartete Übung (name_en), Standardwahl angenommen?] --------------------------------------
const MATCHED = [
  // Deutsch, Grundübungen
  ['Bankdrücken', 'bench press barbell', true],
  ['Bankdruecken', 'bench press barbell', true],
  ['Flachbankdrücken', 'bench press barbell', true],
  ['Langhantel Bankdrücken', 'bench press barbell', false],
  ['Kurzhantel Bankdrücken', 'dumbbell bench press', true],
  ['Schrägbankdrücken', 'barbell incline bench press', true],
  ['Schrägbankdrücken Kurzhantel', 'dumbbell incline bench press', false],
  ['Schräg Bankdrücken Kurzhantel', 'dumbbell incline bench press', false],
  ['Kniebeugen', 'barbell high bar squat', true],
  ['Kniebeuge Kurzhantel', 'dumbbell squat', false],
  ['Körpergewicht Kniebeugen', 'bodyweight squat', false],
  ['Frontkniebeugen', 'front squat barbell', false],
  ['Goblet Squat', 'dumbbell goblet squat', false],
  ['Bulgarian Split Squat', 'dumbbell single leg split squat', true],
  ['Kreuzheben', 'barbell deadlift', true],
  ['Rumänisches Kreuzheben', 'barbell romanian deadlift', true],
  ['RDL Kurzhantel', 'dumbbell romanian deadlift', false],
  ['Sumo Kreuzheben', 'barbell sumo deadlift', false],
  ['Schulterdrücken Maschine', 'lever shoulder press', false],
  ['Schulterdrücken Kurzhantel', 'dumbbell seated shoulder press', false],
  ['Overhead Press', 'barbell standing wide military press', false],
  ['Military Press', 'barbell standing wide military press', false],
  ['Kabelrudern', 'cable seated row', true],
  ['Kurzhantelrudern', 'dumbbell one arm bent-over row', false],
  ['Einarmiges Rudern', 'dumbbell one arm bent-over row', false],
  ['Langhantelrudern', 'barbell bent over row', false],
  ['Latzug', 'lat pulldown wide grip', true],
  ['Latzug eng', 'cable lateral pulldown with v-bar', false],
  ['Latzug Untergriff', 'reverse grip machine lat pulldown', false],
  ['Klimmzüge', 'pull-up', false],
  ['Klimmzüge mit Zusatzgewicht', 'weighted pull-up', false],
  ['Klimmzüge assistiert', 'assisted pull-up', false],
  ['Chin Ups', 'chin-up', false],
  ['Dips', 'chest dip', true],
  ['Trizeps Dips', 'triceps dip', false],
  // Arme
  ['Bizepscurls', 'dumbbell biceps curl', true],
  ['Bizeps Curls', 'dumbbell biceps curl', true],
  ['Langhantel Curls', 'barbell curl', false],
  ['SZ Curls', 'ez barbell curl', false],
  ['Kabelcurls', 'cable curl', false],
  ['Hammercurls', 'dumbbell hammer curl', true],
  ['Trizepsdrücken', 'cable pushdown', true],
  ['Trizeps Pushdown', 'cable pushdown', true],
  ['Trizeps Pushdown Seil', 'cable pushdown (with rope attachment)', false],
  ['Skullcrusher', 'barbell lying triceps extension skull crusher', false],
  // Schultern, Brust, Rücken
  ['Seitheben Kurzhantel', 'dumbbell lateral raise', true],
  ['Seitheben sitzend', 'dumbbell seated lateral raise', false],
  ['Seitheben Kabel', 'cable lateral raise', false],
  ['Seitheben Maschine', 'lever lateral raise', false],
  ['Frontheben', 'dumbbell front raise', false],
  ['Butterfly', 'lever seated fly', false],
  ['Fliegende Kurzhantel', 'dumbbell fly', false],
  ['Cable Fly', 'cable standing fly', false],
  ['Brustpresse', 'lever chest press (weight stack)', false],
  ['Reverse Fly', 'reverse fly dumbbell', true],
  ['Schulterzucken', 'barbell shrug', true],
  ['Shrugs Kurzhantel', 'dumbbell shrug', false],
  ['Rückenstrecker', 'hyperextension', false],
  ['Good Mornings', 'barbell good morning', false],
  // Beine
  ['Beinpresse', 'sled 45° leg press', false],
  ['Beinstrecker', 'leg extension', false],
  ['Beinbeuger', 'lever lying leg curl', true],
  ['Beinbeuger liegend', 'lever lying leg curl', false],
  ['Beinbeuger sitzend', 'lever seated leg curl', false],
  ['Wadenheben', 'lever standing calf raise', true],
  ['Wadenheben sitzend', 'lever seated calf raise', false],
  ['Wadenheben Kurzhantel', 'dumbbell standing calf raise', false],
  ['Ausfallschritte', 'dumbbell lunge', true],
  ['Ausfallschritte Langhantel', 'barbell lunge', false],
  ['Walking Lunges', 'walking lunge', false],
  ['Step Ups', 'dumbbell step-up', false],
  ['Hackenschmidt', 'sled hack squat', true],
  // Körpergewicht, Rumpf, Sonstiges
  ['Liegestütze', 'push-up', false],
  ['Liegestütz eng', 'close-grip push-up', false],
  ['Hängendes Beinheben', 'hanging leg raise', false],
  ['Russian Twist', 'russian twist', false],
  ['Bauchroller', 'wheel rollout', false],
  ['Crunches', 'crunch floor', false],
  ['Farmers Walk', 'farmers walk', false],
  ['Kettlebell Swings', 'kettlebell swing', false],
  ['Burpees', 'burpee', false],
  ['Kickbacks', 'cable kickback', false],
  // Englisch
  ['bench press barbell', 'bench press barbell', false],
  ['bench press', 'bench press barbell', true],
  ['Squat', 'barbell high bar squat', true],
  ['Squats', 'barbell high bar squat', true],
  ['Deadlift', 'barbell deadlift', true],
  ['Lat Pulldown', 'lat pulldown wide grip', true],
  ['Pull-ups', 'pull-up', false],
  ['Pullups', 'pull-up', false],
  ['Dumbbell Curl', 'dumbbell biceps curl', false],
  ['Leg Press', 'sled 45° leg press', false],
  ['Leg Extension', 'leg extension', false],
  ['Calf Raises', 'lever standing calf raise', true],
  ['Push-ups', 'push-up', false],
  ['Hip Thrust Alternative', null, null],
  // Alte Namen aus der Bereinigung (aliases im Katalog)
  ['leg curl lying', 'lever lying leg curl', false],
  ['lying leg curl', 'lever lying leg curl', false],
  // Tippfehler (eindeutig)
  ['Kreuzhben', 'barbell deadlift', true],
  ['Kniebeugn', 'barbell high bar squat', true],
  ['Klimzüge', 'pull-up', false]
].filter(([, expected]) => expected)

describe('createExerciseMatcher: sichere Treffer', () => {
  for (const [input, expected, assumed] of MATCHED) {
    it(`"${input}" -> ${expected}${assumed ? ' (Standardwahl angenommen)' : ''}`, () => {
      const r = match(input)
      expect(r.status).toBe('matched')
      expect(r.name_en).toBe(expected)
      expect(r.exercise_id).toBeTruthy()
      expect(r.assumed.includes('variant')).toBe(assumed)
    })
  }
})

// --- Rückfragen --------------------------------------------------------------------------------------------------
describe('createExerciseMatcher: Alternativen zur Standardwahl', () => {
  it('angenommene Variante liefert die übrigen Varianten zum Ändern per Tap', () => {
    const r = match('Bankdrücken')
    expect(r.assumed).toEqual(['variant'])
    expect(r.alternatives.map((a) => a.name_en)).toEqual(['dumbbell bench press', 'barbell incline bench press', 'dumbbell incline bench press'])
  })

  it('sichere Treffer ohne Annahme haben keine Alternativen', () => {
    expect(match('Seitheben Kabel').alternatives).toBeUndefined()
  })
})

describe('createExerciseMatcher: Rückfrage bei echter Mehrdeutigkeit', () => {
  it('"Seitheben": Auswahl nach Gerät (wie im Entwurf)', () => {
    const r = match('Seitheben')
    expect(r.status).toBe('ambiguous')
    expect(r.candidates.map((c) => c.name_en)).toEqual(['dumbbell lateral raise', 'dumbbell seated lateral raise', 'cable lateral raise', 'lever lateral raise'])
  })

  it('"Rudern", "Schulterdrücken", "Fliegende" fragen nach dem Gerät', () => {
    for (const input of ['Rudern', 'Schulterdrücken', 'Fliegende', 'Lateral Raises']) {
      const r = match(input)
      expect(r.status, input).toBe('ambiguous')
      expect(r.candidates.length, input).toBeGreaterThan(1)
      expect(r.candidates.length, input).toBeLessThanOrEqual(4)
    }
  })

  it('mit genanntem Gerät keine Rückfrage mehr', () => {
    expect(match('Rudern Kabel').status).toBe('matched')
    expect(match('Schulterdrücken Kurzhantel').status).toBe('matched')
  })
})

// --- Nicht gefunden / nie raten ----------------------------------------------------------------------------------
describe('createExerciseMatcher: nicht gefunden statt Raten', () => {
  const NOT_FOUND = ['Face Pulls', 'Plank', 'Zauberübung 3000', '???', '', 'asdfghjkl', 'Trizeps Extension']

  for (const input of NOT_FOUND) {
    it(`"${input}" -> not_found, keine stille Zuordnung`, () => {
      const r = match(input)
      expect(r.status).toBe('not_found')
      expect(r.exercise_id ?? null).toBeNull()
    })
  }

  it('Hip Thrust fehlt im Katalog: nur Vorschlag (Glute Bridge), nie automatisch gleichgesetzt', () => {
    const r = match('Hip Thrust')
    expect(r.status).toBe('not_found')
    expect(r.suggestions.map((s) => s.name_en)).toEqual(['barbell glute bridge'])
  })

  it('genanntes Gerät, das es für den Begriff nicht gibt: nicht still ein anderes wählen', () => {
    for (const input of ['Bankdrücken breit', 'Latzug Kurzhantel', 'Kurzhantel Klimmzüge']) {
      const r = match(input)
      expect(r.status, input).toBe('not_found')
      expect(r.suggestions.length, input).toBeGreaterThan(0)
    }
  })

  it('Tippfehler nur bei längeren Begriffen und eindeutig', () => {
    expect(match('Kurz').status).toBe('not_found')
    expect(match('Bank').status).toBe('not_found')
  })
})

// --- Eigene Übungen und Sonderfälle ---------------------------------------------------------------------------------
describe('createExerciseMatcher: eigene Übungen und Reihenfolge', () => {
  const withCustom = createExerciseMatcher({ catalog, customExercises: [{ _id: 'custom-1', name: 'Bankdrücken Spezial' }, { _id: 'custom-2', name: 'Latzug' }] })

  it('eigene Übung mit genau diesem Namen hat Vorrang', () => {
    expect(withCustom('Bankdrücken Spezial')).toMatchObject({ status: 'matched', via: 'custom', exercise_id: 'custom-1' })
    expect(withCustom('latzug')).toMatchObject({ status: 'matched', via: 'custom', exercise_id: 'custom-2' })
  })

  it('ohne eigene Übung bleibt der Katalog zuständig', () => {
    expect(withCustom('Kreuzheben').name_en).toBe('barbell deadlift')
  })

  it('exakter Katalogname hat Vorrang vor der Synonymtabelle', () => {
    const r = match('leg curl lying') // früherer Name aus der Bereinigung (aliases im Katalog)
    expect(r.via).toBe('catalog')
    expect(match('bench press barbell').via).toBe('catalog')
  })

  it('leerer oder fehlender Katalog bricht nicht ab', () => {
    expect(() => createExerciseMatcher({})('Bankdrücken')).not.toThrow()
    expect(createExerciseMatcher({ catalog: [] })('Bankdrücken').status).toBe('not_found')
  })

  it('gleiche Eingabe, gleiches Ergebnis', () => {
    expect(match('Seitheben')).toEqual(match('Seitheben'))
  })
})

// --- Anbindung an das Parser-Ergebnis ---------------------------------------------------------------------------------
describe('resolveParsedWorkout', () => {
  const parsed = {
    split: null,
    days_per_week: null,
    unresolved: [],
    needs_llm: false,
    sessions: [{
      label: 'Push', type: 'push',
      exercises: [
        { raw_text: 'Bankdrücken', exercise_id: null, variant: null, sets: 3, reps: 8, weight_kg: 80, assumed: [] },
        { raw_text: 'Seitheben', exercise_id: null, variant: null, sets: 3, reps: null, weight_kg: null, assumed: ['sets'] },
        { raw_text: 'Face Pulls', exercise_id: null, variant: null, sets: 3, reps: null, weight_kg: null, assumed: ['sets'] }
      ]
    }]
  }

  it('füllt Treffer, markiert Annahmen, sammelt Rückfragen und verändert die Eingabe nicht', () => {
    const copy = JSON.parse(JSON.stringify(parsed))
    const r = resolveParsedWorkout(parsed, match)
    expect(parsed).toEqual(copy)
    const [bench, lateral, face] = r.sessions[0].exercises
    expect(bench).toMatchObject({ exercise_id: expect.any(String), variant: 'barbell,flat', reps: 8, weight_kg: 80 })
    expect(bench.assumed).toEqual(['variant'])
    expect(lateral.exercise_id).toBeNull()
    expect(face.exercise_id).toBeNull()
    expect(r.summary).toEqual({ total: 3, matched: 1, ambiguous: 1, not_found: 1 })
    expect(r.questions.map((q) => [q.raw_text, q.status])).toEqual([['Seitheben', 'ambiguous'], ['Face Pulls', 'not_found']])
    expect(r.questions[0].candidates.length).toBeGreaterThan(1)
  })

  it('leere oder fehlende Sitzungen', () => {
    expect(resolveParsedWorkout({ sessions: [] }, match).summary.total).toBe(0)
    expect(resolveParsedWorkout(null, match).sessions).toEqual([])
  })
})

// --- Trefferquote (Kennzahl für den Erfolg dieses Schritts) ---------------------------------------------------------------
describe('Trefferquote der Formulierungen', () => {
  it('keine einzige Fehlzuordnung in der Testliste, Quote der sicheren Treffer', () => {
    let wrong = 0
    for (const [input, expected] of MATCHED) {
      const r = match(input)
      if (r.status === 'matched' && r.name_en !== expected) wrong += 1
    }
    expect(wrong).toBe(0)
    const matchedShare = MATCHED.filter(([input]) => match(input).status === 'matched').length / MATCHED.length
    expect(matchedShare).toBe(1)
  })
})

// --- Hilfsfunktionen ---------------------------------------------------------------------------------------------
describe('fold / stem', () => {
  it('Umlaute, Groß-/Kleinschreibung und Satzzeichen egal', () => {
    expect(fold('Bankdrücken!')).toBe('bankdrucken')
    expect(fold('BANKDRUECKEN')).toBe('bankdrucken')
    expect(fold('Pull-Ups')).toBe('pull ups')
  })

  it('Mehrzahl und Endungen egal', () => {
    expect(stem('kniebeugen')).toBe(stem('kniebeuge'))
    expect(stem('curls')).toBe(stem('curl'))
    expect(stem('klimmzuge')).toBe(stem('klimmzug'))
  })
})
