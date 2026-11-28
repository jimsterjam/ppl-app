import { describe, it, expect } from 'vitest'
import { joints, mixPose, poseAt, timelineAt, layout, buildFrame, frameBounds, LIMB, POSE_KEYS, DEMO_WIDTH } from '../engine'
import { EXERCISE_DEMOS } from '../demos'

const POSE = { torso: 0, head: 0, uarm: 90, farm: 0, thigh: 90, shin: 90, foot: 0 }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('engine: Gelenke', () => {
  it('Hüfte im Ursprung, Winkel 0 = rechts, 90 = unten, Segmentlängen bleiben erhalten', () => {
    const j = joints(POSE)
    expect(j.hip).toEqual([0, 0])
    expect(j.shoulder[0]).toBeCloseTo(LIMB.torso)
    expect(j.shoulder[1]).toBeCloseTo(0)
    expect(j.knee[1]).toBeCloseTo(LIMB.thigh) // 90 = nach unten
    expect(dist(j.hip, j.shoulder)).toBeCloseTo(LIMB.torso)
    expect(dist(j.shoulder, j.elbow)).toBeCloseTo(LIMB.uarm)
    expect(dist(j.elbow, j.wrist)).toBeCloseTo(LIMB.farm)
    expect(dist(j.knee, j.ankle)).toBeCloseTo(LIMB.shin)
    expect(dist(j.ankle, j.toe)).toBeCloseTo(LIMB.foot)
  })

  it('mixPose: Ränder und Mitte', () => {
    const a = { ...POSE, torso: 0 }, b = { ...POSE, torso: 40 }
    expect(mixPose(a, b, 0).torso).toBe(0)
    expect(mixPose(a, b, 1).torso).toBe(40)
    expect(mixPose(a, b, 0.5).torso).toBe(20)
  })

  it('poseAt: Schlüsselhaltungen gleichmäßig verteilt, außerhalb 0..1 begrenzt, eine Haltung = statisch', () => {
    const k = [0, 30, 90].map((torso) => ({ ...POSE, torso }))
    expect(poseAt(k, 0).torso).toBe(0)
    expect(poseAt(k, 0.5).torso).toBe(30)
    expect(poseAt(k, 1).torso).toBe(90)
    expect(poseAt(k, 0.75).torso).toBe(60)
    expect(poseAt(k, -3).torso).toBe(0)
    expect(poseAt(k, 9).torso).toBe(90)
    expect(poseAt([k[1]], 0.3)).toBe(k[1])
    expect(poseAt([], 0)).toBeNull()
  })
})

describe('engine: Ablauf', () => {
  const phases = [{ d: 1, from: 0, to: 0 }, { d: 2, from: 0, to: 1 }, { d: 3, from: 1, to: 1, hold: true }, { d: 1, from: 1, to: 0 }]

  it('halten nur in der Haltephase, t läuft von 0 nach 1 und zurück', () => {
    expect(timelineAt(phases, 0.5)).toEqual({ t: 0, holding: false })
    const mid = timelineAt(phases, 2) // Mitte der Bewegung
    expect(mid.t).toBeCloseTo(0.5)
    expect(mid.holding).toBe(false)
    expect(timelineAt(phases, 4)).toEqual({ t: 1, holding: true })
    expect(timelineAt(phases, 5.9).holding).toBe(true)
    // Rückweg (6..7 s): nicht mehr halten, t liegt zwischen den Enden
    const back = timelineAt(phases, 6.5)
    expect(back.holding).toBe(false)
    expect(back.t).toBeGreaterThan(0)
    expect(back.t).toBeLessThan(1)
  })

  it('der Ablauf wiederholt sich (auch bei großen oder negativen Zeiten)', () => {
    expect(timelineAt(phases, 7 + 4)).toEqual(timelineAt(phases, 4))
    expect(timelineAt(phases, -3)).toEqual(timelineAt(phases, 4))
  })

  it('ohne Phasen (statisch): Endhaltung, immer "halten"', () => {
    expect(timelineAt(undefined, 5)).toEqual({ t: 1, holding: true })
    expect(timelineAt([], 5)).toEqual({ t: 1, holding: true })
  })
})

describe.each(EXERCISE_DEMOS.map((d) => [d.name_en, d]))('engine: Demo "%s"', (_name, demo) => {
  const lay = layout(demo)

  it('Layout hat endliche Werte', () => {
    for (const v of [lay.scale, lay.origin[0], lay.origin[1], lay.floorY, lay.width, lay.height]) expect(Number.isFinite(v)).toBe(true)
    expect(lay.width).toBe(DEMO_WIDTH)
    expect(lay.scale).toBeGreaterThan(5)
  })

  it('die Figur bleibt in jedem Bild vollständig im Zeichenbereich', () => {
    for (let i = 0; i <= 40; i++) {
      const f = buildFrame(demo, lay, i / 40, false)
      const xs = [], ys = []
      for (const s of [...f.near, ...f.far]) { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2) }
      xs.push(f.head.cx - f.head.r, f.head.cx + f.head.r); ys.push(f.head.cy - f.head.r, f.head.cy + f.head.r)
      expect(Math.min(...xs), `x min @${i}`).toBeGreaterThanOrEqual(0)
      expect(Math.max(...xs), `x max @${i}`).toBeLessThanOrEqual(lay.width)
      expect(Math.min(...ys), `y min @${i}`).toBeGreaterThanOrEqual(0)
      expect(Math.max(...ys), `y max @${i}`).toBeLessThanOrEqual(lay.height)
    }
  })

  it('Zeichendaten enthalten keine NaN/Infinity', () => {
    const f = buildFrame(demo, lay, 0.37, true)
    const nums = [...f.near, ...f.far].flatMap((s) => [s.x1, s.y1, s.x2, s.y2])
    nums.push(f.head.cx, f.head.cy, f.head.r, ...f.joints.flatMap((j) => [j.cx, j.cy, j.r]))
    for (const n of nums) expect(Number.isFinite(n)).toBe(true)
  })

  it('nur die arbeitende Zone ist hervorgehoben (Gegenprobe: nicht alles)', () => {
    const f = buildFrame(demo, lay, 1, true)
    const hot = f.near.filter((s) => s.hot)
    expect(hot.length).toBeGreaterThan(0)
    expect(hot.length).toBeLessThan(f.near.length)
    if (demo.hot.includes('torso')) expect(hot.every((s) => s.kind === 'torso')).toBe(true)
    if (demo.hot.includes('arms')) expect(hot).toHaveLength(2)
  })

  it('"holding" wird an das Bild weitergegeben', () => {
    expect(buildFrame(demo, lay, 1, true).holding).toBe(true)
    expect(buildFrame(demo, lay, 1, false).holding).toBe(false)
  })
})

describe.each(EXERCISE_DEMOS.map((d) => [d.name_en, d]))('engine: Standbild-Ausschnitt "%s"', (_name, demo) => {
  it('quadratisch und die ganze Figur liegt darin', () => {
    const frame = buildFrame(demo, layout(demo), 1, false)
    const b = frameBounds(frame)
    expect(b.size).toBeGreaterThan(20)
    const pts = [...frame.near, ...frame.far].flatMap((s) => [[s.x1, s.y1], [s.x2, s.y2]])
    pts.push([frame.head.cx - frame.head.r, frame.head.cy], [frame.head.cx + frame.head.r, frame.head.cy], [frame.head.cx, frame.head.cy - frame.head.r], [frame.head.cx, frame.head.cy + frame.head.r])
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(b.x)
      expect(x).toBeLessThanOrEqual(b.x + b.size)
      expect(y).toBeGreaterThanOrEqual(b.y)
      expect(y).toBeLessThanOrEqual(b.y + b.size)
    }
  })
})

it('Pflichtfelder jeder Haltung sind Zahlen', () => {
  for (const demo of EXERCISE_DEMOS) for (const key of demo.keys) for (const k of POSE_KEYS) expect(typeof key[k], `${demo.id}.${k}`).toBe('number')
})
