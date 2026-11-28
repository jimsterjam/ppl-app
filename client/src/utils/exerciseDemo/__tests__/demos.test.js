import { describe, it, expect } from 'vitest'
import catalog from '@/data/default-exercises.json'
import { EXERCISE_DEMOS, findExerciseDemo } from '../demos'
import { jointUnits, layout, BOX_HEIGHT, BOX_HALF_WIDTH } from '../engine'

const byId = new Map(catalog.map((e) => [e.id, e]))
const demo = (id) => EXERCISE_DEMOS.find((d) => d.id === id)

describe('Demos: Abgleich mit dem Katalog', () => {
  it.each(EXERCISE_DEMOS.map((d) => [d.name_en, d]))('"%s" gibt es im Katalog, ohne Foto/Video und als Zeit-Übung', (_n, d) => {
    const entry = byId.get(d.id)
    expect(entry, d.id).toBeTruthy()
    expect(entry.name_en).toBe(d.name_en)
    // Demos nur dort, wo es kein echtes Foto/Video gibt
    expect(entry.imageUrl).toBe('')
    expect(entry.thumbnailUrl).toBe('')
    expect(entry.measureMode).toBe('time')
  })

  it('jede Demo-ID und jeder Name kommt nur einmal vor', () => {
    expect(new Set(EXERCISE_DEMOS.map((d) => d.id)).size).toBe(EXERCISE_DEMOS.length)
    expect(new Set(EXERCISE_DEMOS.map((d) => d.name_en)).size).toBe(EXERCISE_DEMOS.length)
  })

  it('Ablauf: genau eine Haltephase, Werte 0..1, Anfang und Ende passen zusammen', () => {
    for (const d of EXERCISE_DEMOS.filter((x) => x.phases)) {
      expect(d.phases.filter((p) => p.hold)).toHaveLength(1)
      for (const p of d.phases) { expect(p.from).toBeGreaterThanOrEqual(0); expect(p.to).toBeLessThanOrEqual(1); expect(p.d).toBeGreaterThan(0) }
      expect(d.phases[0].from).toBe(0)
      expect(d.phases.at(-1).to).toBe(d.phases[0].from) // Schleife schließt sich
      const hold = d.phases.find((p) => p.hold)
      expect(hold.from).toBe(1); expect(hold.to).toBe(1)
    }
  })
})

describe('Demos: Körperkontakt (Haltung stimmt rechnerisch)', () => {
  it('Plank: Zehen, Ellbogen und Handgelenk liegen auf einer Höhe (am Boden)', () => {
    const d = demo('9019')
    const ys = ['toe', 'elbow', 'wrist'].map((n) => jointUnits(d, 1, n)[1])
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.02)
    // Gegenprobe: Hüfte/Knie schweben über dem Boden
    expect(jointUnits(d, 1, 'hip')[1]).toBeLessThan(ys[0] - 0.3)
  })

  it('Tuck Planche: am Start Füße und Hände am Boden, in der Haltung Füße oben', () => {
    const d = demo('9013')
    const start = ['toe', 'wrist'].map((n) => jointUnits(d, 0, n)[1])
    expect(Math.abs(start[0] - start[1])).toBeLessThan(0.02)
    const wristY = jointUnits(d, 1, 'wrist')[1]
    for (const n of ['toe', 'ankle', 'knee', 'hip']) expect(jointUnits(d, 1, n)[1], n).toBeLessThan(wristY - 0.5)
    // Arme in der Haltung gestreckt (Schulter, Ellbogen, Handgelenk auf einer Linie)
    const [s, e, w] = ['shoulder', 'elbow', 'wrist'].map((n) => jointUnits(d, 1, n))
    const cross = (e[0] - s[0]) * (w[1] - s[1]) - (e[1] - s[1]) * (w[0] - s[0])
    expect(Math.abs(cross)).toBeLessThan(0.01)
  })

  it('Dead Hang: Start auf der Kiste, danach neben der Kiste in der Luft (nie durch die Kiste)', () => {
    const d = demo('9022')
    const lay = layout(d)
    const box = lay.boxRect
    expect(box.h).toBe(BOX_HEIGHT)
    expect(box.w).toBeCloseTo(2 * BOX_HALF_WIDTH)
    const top = box.y, right = box.x + box.w
    // Start: Zehen auf der Kiste
    const t0 = jointUnits(d, 0, 'toe')
    expect(Math.abs(t0[1] - top)).toBeLessThan(0.02)
    expect(t0[0]).toBeGreaterThan(box.x)
    expect(t0[0]).toBeLessThan(right)
    // Ende: frei hängend, Füße hinter der Kistenkante und über dem Boden
    for (const n of ['ankle', 'toe']) expect(jointUnits(d, 1, n)[0], n).toBeGreaterThan(right)
    expect(jointUnits(d, 1, 'toe')[1]).toBeLessThan(lay.floorUnits - 0.1)
    // Hände bleiben an der Stange (Handgelenk = Ankerpunkt) und die Arme sind im Hang gestreckt
    expect(jointUnits(d, 1, 'wrist')).toEqual([0, 0])
    expect(jointUnits(d, 1, 'shoulder')[0]).toBeCloseTo(0, 1)
    // auf dem Weg: Zehen und Knöchel bleiben über der Kistenoberkante, solange sie noch über der Kiste sind.
    // Toleranz 0,02 Einheiten (unter 1 px): kleiner als die Strichdicke, nicht sichtbar.
    for (let i = 0; i <= 100; i++) {
      for (const name of ['toe', 'ankle']) {
        const p = jointUnits(d, i / 100, name)
        if (p[0] > box.x && p[0] < right) expect(p[1], `${name} t=${i / 100}`).toBeLessThanOrEqual(top + 0.02)
      }
    }
  })
})

const J = (id, t, name) => jointUnits(demo(id), t, name)
const FLOOR_DEMOS = EXERCISE_DEMOS.filter((d) => !d.props?.bar)
const BAR_DEMOS = EXERCISE_DEMOS.filter((d) => d.props?.bar)

describe('Demos: allgemeine Regeln für alle Haltungen', () => {
  it.each(FLOOR_DEMOS.map((d) => [d.name_en, d]))('Bodenübung "%s": in keinem Bild geht ein Gelenk durch den Boden', (_n, d) => {
    for (let i = 0; i <= 100; i++) {
      for (const name of ['hip', 'shoulder', 'elbow', 'wrist', 'knee', 'ankle', 'toe']) {
        expect(jointUnits(d, i / 100, name)[1], `${name} t=${i / 100}`).toBeLessThanOrEqual(0.03)
      }
    }
  })

  it.each(BAR_DEMOS.map((d) => [d.name_en, d]))('Hang "%s": Hände bleiben an der Stange, Füße in jedem Bild über dem Boden', (_n, d) => {
    const lay = layout(d)
    for (let i = 0; i <= 100; i++) {
      expect(jointUnits(d, i / 100, 'wrist')).toEqual([0, 0])
      for (const name of ['toe', 'ankle', 'knee', 'hip']) expect(jointUnits(d, i / 100, name)[1], `${name} t=${i / 100}`).toBeLessThan(lay.floorUnits - 0.05)
    }
    expect(lay.floorY).toBeLessThanOrEqual(lay.height)
  })
})

describe('Demos: Haltungen der weiteren Halteübungen', () => {
  it('Hollow Body Hold: Start flach am Boden, Halten mit abgehobenen Schultern und Beinen, Hüfte bleibt am Boden', () => {
    expect(J('9020', 0, 'shoulder')[1]).toBeCloseTo(0, 1)
    expect(J('9020', 0, 'ankle')[1]).toBeCloseTo(0, 1)
    expect(J('9020', 1, 'hip')).toEqual([0, 0])
    expect(J('9020', 1, 'shoulder')[1]).toBeLessThan(-0.15)
    expect(J('9020', 1, 'ankle')[1]).toBeLessThan(-0.25)
    // Arme in Verlängerung des Körpers über dem Kopf (rechts vom Kopf)
    expect(J('9020', 1, 'wrist')[0]).toBeGreaterThan(J('9020', 1, 'shoulder')[0])
  })

  it('Arch Body Hold: Start flach, Halten mit angehobener Brust, Armen und Beinen; höherer Arm- und Kopfwinkel als beim Hollow Hold', () => {
    expect(J('9021', 0, 'ankle')[1]).toBeCloseTo(0, 1)
    expect(J('9021', 1, 'shoulder')[1]).toBeLessThan(-0.15)
    expect(J('9021', 1, 'ankle')[1]).toBeLessThan(-0.15)
    expect(J('9021', 1, 'wrist')[1]).toBeLessThan(J('9020', 1, 'wrist')[1]) // Arme höher gehoben
    expect(J('9021', 1, 'head')[1]).toBeLessThan(J('9020', 1, 'head')[1])
  })

  it('Wall Sit: Füße am Boden, Hüfte bleibt an der Wand, am Ende Oberschenkel waagerecht und Unterschenkel senkrecht', () => {
    const d = demo('9024')
    expect(layout(d).wallX).not.toBeNull()
    const x0 = J('9024', 0, 'hip')[0]
    for (let i = 0; i <= 100; i++) expect(Math.abs(J('9024', i / 100, 'hip')[0] - x0), `t=${i / 100}`).toBeLessThan(0.2)
    expect(Math.abs(J('9024', 1, 'knee')[1] - J('9024', 1, 'hip')[1])).toBeLessThan(0.05)
    expect(Math.abs(J('9024', 1, 'ankle')[0] - J('9024', 1, 'knee')[0])).toBeLessThan(0.05)
    expect(J('9024', 1, 'hip')[1]).toBeLessThan(J('9024', 0, 'hip')[1] + 0.8) // Hüfte ist abgesunken
    expect(J('9024', 0, 'hip')[1]).toBeLessThan(J('9024', 1, 'hip')[1]) // Start: Hüfte höher (kleineres y)
  })

  it('Crow Pose: Start Hände und Füße am Boden, Haltung Füße oben, Knie auf den Oberarmen, Arme gebeugt', () => {
    const d = demo('9025')
    expect(Math.abs(J('9025', 0, 'toe')[1])).toBeLessThan(0.05)
    for (const n of ['toe', 'ankle']) expect(J('9025', 1, n)[1], n).toBeLessThan(-0.6)
    // Knie nahe am Oberarm (Strecke Ellbogen-Schulter)
    const [e, s, k] = [J('9025', 1, 'elbow'), J('9025', 1, 'shoulder'), J('9025', 1, 'knee')]
    const dx = s[0] - e[0], dy = s[1] - e[1]
    const u = Math.max(0, Math.min(1, ((k[0] - e[0]) * dx + (k[1] - e[1]) * dy) / (dx * dx + dy * dy)))
    expect(Math.hypot(k[0] - (e[0] + u * dx), k[1] - (e[1] + u * dy))).toBeLessThan(0.45)
    // Ellbogen gebeugt: Schulter-Handgelenk kürzer als beide Armsegmente zusammen
    const w = J('9025', 1, 'wrist')
    expect(Math.hypot(w[0] - s[0], w[1] - s[1])).toBeLessThan(1.35)
    expect(d.keys).toHaveLength(2)
  })

  it('Barren-Stütz: Arme gestreckt neben dem Körper, Beine hängen frei', () => {
    const [s, e, w] = ['shoulder', 'elbow', 'wrist'].map((n) => J('9026', 1, n))
    expect(Math.abs((e[0] - s[0]) * (w[1] - s[1]) - (e[1] - s[1]) * (w[0] - s[0]))).toBeLessThan(0.01) // gestreckt
    expect(s[1]).toBeLessThan(0) // Schultern über den Händen
    expect(J('9026', 1, 'hip')[1]).toBeGreaterThan(s[1])
    // Arm und Rumpf liegen nicht aufeinander (sonst unleserlich)
    expect(Math.abs(w[0] - J('9026', 1, 'hip')[0])).toBeGreaterThan(0.12)
  })

  it('Flexed Arm Hang: Start gestreckter Hang, Ende Kinn über der Stange mit gebeugten Armen', () => {
    expect(J('9023', 0, 'shoulder')[1]).toBeGreaterThan(1.3)
    // Kopfmitte plus Radius (Kinn) liegt über der Stange (y < 0)
    expect(J('9023', 1, 'head')[1] + 0.25).toBeLessThan(0)
    expect(J('9023', 1, 'shoulder')[1]).toBeLessThan(0.6)
    const s = J('9023', 1, 'shoulder'), w = J('9023', 1, 'wrist')
    expect(Math.hypot(w[0] - s[0], w[1] - s[1])).toBeLessThan(1.1) // Arme stark gebeugt
  })

  it('Straddle Front Lever: Körper waagerecht auf Schulterhöhe, Arme senkrecht gestreckt, Beine gestreckt und gespreizt', () => {
    expect(Math.abs(J('9027', 1, 'hip')[1] - J('9027', 1, 'shoulder')[1])).toBeLessThan(0.02)
    expect(Math.abs(J('9027', 1, 'shoulder')[0])).toBeLessThan(0.02)
    expect(Math.abs(J('9027', 1, 'ankle')[1] - J('9027', 1, 'hip')[1])).toBeLessThan(0.02)
    expect(demo('9027').keys.at(-1).spread).toBeGreaterThan(0)
    expect(J('9027', 1, 'head')[1]).toBeLessThan(J('9027', 1, 'shoulder')[1]) // Gesicht nach oben
  })

  it('Back-Lever-Stufen: Körper waagerecht; Tuck angezogen, Advanced Tuck Oberschenkel senkrecht, Straddle gestreckt (Beinlänge nimmt zu)', () => {
    const reach = (id) => Math.abs(J(id, 1, 'ankle')[0] - J(id, 1, 'hip')[0])
    for (const id of ['9028', '9029', '9030']) {
      expect(Math.abs(J(id, 1, 'hip')[1] - J(id, 1, 'shoulder')[1]), id).toBeLessThan(0.02)
      expect(J(id, 1, 'head')[1], id).toBeGreaterThan(J(id, 1, 'shoulder')[1]) // Gesicht nach unten
    }
    expect(reach('9028')).toBeLessThan(reach('9029'))
    expect(reach('9029')).toBeLessThan(reach('9030'))
    expect(Math.abs(J('9029', 1, 'knee')[0] - J('9029', 1, 'hip')[0])).toBeLessThan(0.05) // Oberschenkel senkrecht
    expect(demo('9030').keys.at(-1).spread).toBeGreaterThan(0)
  })
})

describe('findExerciseDemo', () => {
  it('findet über ID (auch mit ex_ und exerciseId) und über den englischen Namen', () => {
    expect(findExerciseDemo({ id: '9019' })?.name_en).toBe('plank')
    expect(findExerciseDemo({ _id: 'ex_9013' })?.name_en).toBe('tuck planche')
    expect(findExerciseDemo({ exerciseId: 'ex_9022' })?.name_en).toBe('dead hang')
    expect(findExerciseDemo({ name: 'Plank' })?.name_en).toBe('plank')
    expect(findExerciseDemo({ name: 'x', name_en: 'Dead Hang' })?.name_en).toBe('dead hang')
    expect(findExerciseDemo({ displayName: ' tuck planche ' })?.name_en).toBe('tuck planche')
  })

  it('Gegenprobe: ähnlich benannte oder unbekannte Übungen und eigene Übungen bekommen keine Demo', () => {
    expect(findExerciseDemo(null)).toBeNull()
    expect(findExerciseDemo(undefined)).toBeNull()
    expect(findExerciseDemo('plank')).toBeNull()
    expect(findExerciseDemo({})).toBeNull()
    expect(findExerciseDemo({ name: 'Weighted Front Plank' })).toBeNull()
    expect(findExerciseDemo({ name: 'Plank with twist' })).toBeNull()
    expect(findExerciseDemo({ id: '0025' })).toBeNull()
    expect(findExerciseDemo({ name: 'Plank', _isCustom: true })).toBeNull()
    expect(findExerciseDemo({ id: '9019', _isCustom: true })).toBeNull()
  })

  it('Review 28.11.: die ID ist maßgeblich - eigene Übung mit gleichem Namen und eigener ID bekommt keine Demo', () => {
    // Übung im Workout (nicht als _isCustom markiert), eigene ID, Name wie im Katalog
    expect(findExerciseDemo({ exerciseId: 'custom_abc123', name: 'Plank', name_en: 'plank' })).toBeNull()
    expect(findExerciseDemo({ exerciseId: '65f1c2a9e4b0a1d2c3e4f5a6', name: 'Dead Hang' })).toBeNull()
    // Katalog-ID ohne Demo, aber Name einer Demo-Übung: ebenfalls keine Demo
    expect(findExerciseDemo({ id: '0025', name: 'Plank', name_en: 'plank' })).toBeNull()
    expect(findExerciseDemo({ _id: 'ex_0025', exerciseId: 'ex_0025', name_en: 'tuck planche' })).toBeNull()
  })

  it('Review 28.11.: ohne jede ID entscheidet der Name (ältere Workouts), mit Demo-ID gewinnt die ID', () => {
    expect(findExerciseDemo({ name: 'Plank' })?.id).toBe('9019')
    expect(findExerciseDemo({ exerciseId: 'ex_9013', name: 'Etwas anderes' })?.id).toBe('9013')
    expect(findExerciseDemo({ exerciseId: 'custom_x', _id: 'ex_9022' })?.id).toBe('9022')
  })

  it('keine Übung mit echtem Foto/Video bekommt eine Demo (ID- oder Namenstreffer nur bei den Demo-Übungen selbst)', () => {
    const demoIds = new Set(EXERCISE_DEMOS.map((d) => d.id))
    for (const e of catalog) {
      const found = findExerciseDemo(e)
      if (found) expect(demoIds.has(e.id) && e.imageUrl === '', `${e.id} ${e.name_en}`).toBe(true)
    }
  })
})
