// Strichfiguren-Demo für Übungen ohne Video (Absprache Jimmy 28.11.): eine Figur in der Seitenansicht (Blick nach rechts),
// gezeichnet aus Gelenkwinkeln. Dieses Modul rechnet nur (keine Vue-Abhängigkeit); die Anzeige macht ExerciseDemo.vue.
// Winkel in Grad: 0 = nach rechts, 90 = nach unten (Bildschirmkoordinaten).

/** Segmentlängen in frei gewählten Einheiten (Körperproportionen). */
export const LIMB = Object.freeze({ torso: 1.25, head: 0.42, headRadius: 0.25, uarm: 0.75, farm: 0.7, thigh: 1.05, shin: 1.0, foot: 0.35 })

export const POSE_KEYS = Object.freeze(['torso', 'head', 'uarm', 'farm', 'thigh', 'shin', 'foot'])
export const DEMO_WIDTH = 320
export const FLOOR_HEIGHT = 150
export const BAR_HEIGHT = 200

const rad = (deg) => (deg * Math.PI) / 180
const step = (p, len, deg) => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))]
const ease = (x) => x * x * (3 - 2 * x)

/** Gelenkpositionen einer Haltung (Hüfte im Ursprung). */
export function joints(pose) {
  const hip = [0, 0]
  const shoulder = step(hip, LIMB.torso, pose.torso)
  const head = step(shoulder, LIMB.head, pose.head)
  const elbow = step(shoulder, LIMB.uarm, pose.uarm)
  const wrist = step(elbow, LIMB.farm, pose.farm)
  const knee = step(hip, LIMB.thigh, pose.thigh)
  const ankle = step(knee, LIMB.shin, pose.shin)
  const toe = step(ankle, LIMB.foot, pose.foot)
  return { hip, shoulder, head, elbow, wrist, knee, ankle, toe }
}

/** Zwei Haltungen mischen (Winkel linear), t = 0..1. */
export function mixPose(a, b, t) {
  const out = {}
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t
  // Optional: Spreizwinkel des hinteren Beins (Seitenansicht zeigt gespreizte Beine nur angedeutet, z. B. Straddle)
  const sa = a.spread || 0
  const sb = b.spread || 0
  if (sa || sb) out.spread = sa + (sb - sa) * t
  return out
}

/** Haltung zum Zeitpunkt t (0..1) über mehrere gleichmäßig verteilte Schlüsselhaltungen. */
export function poseAt(keys, t) {
  if (!Array.isArray(keys) || keys.length === 0) return null
  if (keys.length === 1) return keys[0]
  const x = Math.min(1, Math.max(0, t)) * (keys.length - 1)
  const i = Math.min(keys.length - 2, Math.floor(x))
  return mixPose(keys[i], keys[i + 1], x - i)
}

export function cycleDuration(phases) {
  return (phases || []).reduce((sum, p) => sum + p.d, 0)
}

/**
 * Ablauf: Phasen mit Dauer d (Sekunden), von/bis (t) und hold = am Endpunkt wird gehalten.
 * Ohne Phasen (statische Übung) ist immer die letzte Haltung zu sehen und "holding" wahr.
 */
export function timelineAt(phases, seconds) {
  const total = cycleDuration(phases)
  if (!total) return { t: 1, holding: true }
  let x = ((Number(seconds) || 0) % total + total) % total
  for (const p of phases) {
    if (x < p.d) return { t: p.from + (p.to - p.from) * ease(x / p.d), holding: !!p.hold }
    x -= p.d
  }
  return { t: phases[0].from, holding: false }
}

const anchorOf = (demo) => demo.anchor || 'wrist'

/** Hilfsfunktion: alle Gelenke so verschieben, dass der Ankerpunkt (Einheiten) an (0,0) liegt. */
function relativeToAnchor(pose, anchor) {
  const j = joints(pose)
  const a = j[anchor]
  const out = {}
  for (const [k, p] of Object.entries(j)) out[k] = [p[0] - a[0], p[1] - a[1]]
  return out
}

/** Höhe der Kiste (Einheiten) bei Hang-Übungen mit Einstiegskiste. */
export const BOX_HEIGHT = 0.5
export const BOX_HALF_WIDTH = 0.55

/**
 * Maßstab und Lage der Szene. Bodenübungen: Ankerpunkt (Handgelenk) liegt auf dem Boden.
 * Hang-Übungen: Ankerpunkt (Handgelenk) liegt an der Stange oben; der Boden liegt unter der Kiste.
 */
export function layout(demo) {
  const anchor = anchorOf(demo)
  const bar = !!demo.props?.bar
  const wall = !!demo.props?.wall
  const keys = demo.keys
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  let wallUnits = null
  const samples = keys.length === 1 ? [0] : Array.from({ length: 21 }, (_, i) => i / 20)
  for (const t of samples) {
    const j = relativeToAnchor(poseAt(keys, t), anchor)
    for (const p of Object.values(j)) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
    }
    // Wand: hinter dem Rücken (kleinster x-Wert von Hüfte und Schulter) in allen Bildern
    wallUnits = Math.min(wallUnits ?? Infinity, j.hip[0], j.shoulder[0])
  }
  let floorUnits = 0
  let boxRect = null
  if (bar) {
    if (demo.props.box) {
      const start = relativeToAnchor(keys[0], anchor)
      const top = start.toe[1]
      floorUnits = top + BOX_HEIGHT
      boxRect = { x: start.ankle[0] - BOX_HALF_WIDTH, y: top, w: 2 * BOX_HALF_WIDTH, h: BOX_HEIGHT }
      minX = Math.min(minX, boxRect.x)
      maxX += 1.4 // Platz für die Wandhalterung rechts
    } else {
      floorUnits = maxY + 0.45 // Boden unter den Füßen
      maxX += 1.4
    }
    maxY = Math.max(maxY, floorUnits)
  }
  if (wall) {
    wallUnits -= 0.12
    minX = Math.min(minX, wallUnits - 0.15)
  }
  minX -= 0.3; maxX += 0.3; minY -= 0.3
  const width = DEMO_WIDTH
  const height = bar ? BAR_HEIGHT : FLOOR_HEIGHT
  const bw = maxX - minX
  const bh = maxY - minY
  const topPad = bar ? 10 : 0
  const availH = bar ? height - 8 - topPad : height - 14 - 14
  const scale = Math.min((width - 56) / bw, availH / (bar ? bh : bh + 0.1))
  // Stange: Handgelenk liegt an der Stange; die Figur wird senkrecht so verschoben, dass sie in den Zeichenbereich passt
  const originY = bar ? topPad + -minY * scale : height - 14 - 0.02 * scale
  const origin = [width / 2 - ((minX + maxX) / 2) * scale, originY]
  const floorY = bar ? originY + floorUnits * scale : height - 14
  return { width, height, scale, origin, floorY, bar, boxRect, floorUnits, wallX: wall ? origin[0] + wallUnits * scale : null }
}

const toPx = (p, lay) => [lay.origin[0] + p[0] * lay.scale, lay.origin[1] + p[1] * lay.scale]

/** Ein Bild der Animation als reine Zeichendaten (Linien, Kopf, Gelenke, Szenenteile). */
export function buildFrame(demo, lay, t, holding = false) {
  const anchor = anchorOf(demo)
  const pose = poseAt(demo.keys, t)
  const rel = relativeToAnchor(pose, anchor)
  const P = Object.fromEntries(Object.entries(rel).map(([k, p]) => [k, toPx(p, lay)]))
  const hot = new Set(demo.hot || [])
  const farDx = 0.14 * lay.scale
  const seg = (a, b, kind, hotPart) => ({ x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], kind, hot: hotPart })
  const arms = hot.has('arms'), legs = hot.has('legs'), torso = hot.has('torso')
  const near = [
    seg('hip', 'shoulder', 'torso', torso),
    seg('hip', 'knee', 'limb', legs), seg('knee', 'ankle', 'limb', legs), seg('ankle', 'toe', 'limb', false),
    seg('shoulder', 'elbow', 'limb', arms), seg('elbow', 'wrist', 'limb', arms)
  ]
  const farLine = (a, b, src) => ({ x1: src[a][0] + farDx, y1: src[a][1], x2: src[b][0] + farDx, y2: src[b][1], kind: 'far', hot: false })
  const far = [['shoulder', 'elbow'], ['elbow', 'wrist']].map(([a, b]) => farLine(a, b, P))
  // hinteres Bein: bei Spreizwinkel (spread) leicht abweichend, sonst deckungsgleich
  let legSrc = P
  if (pose.spread) {
    const spreadJoints = joints({ ...pose, thigh: pose.thigh + pose.spread, shin: pose.shin + pose.spread, foot: pose.foot + pose.spread })
    const base = joints(pose)[anchor]
    legSrc = Object.fromEntries(Object.entries(spreadJoints).map(([k, p]) => [k, toPx([p[0] - base[0], p[1] - base[1]], lay)]))
  }
  far.push(...[['hip', 'knee'], ['knee', 'ankle'], ['ankle', 'toe']].map(([a, b]) => farLine(a, b, legSrc)))
  const scene = { lines: [], rects: [], circles: [] }
  if (lay.bar) {
    const wx = lay.origin[0]
    scene.lines.push({ cls: 'floor', x1: 20, y1: lay.floorY, x2: lay.width - 20, y2: lay.floorY })
    scene.lines.push({ cls: 'wall', x1: wx + 52, y1: 6, x2: wx + 52, y2: lay.floorY })
    scene.lines.push({ cls: 'bar', x1: wx, y1: lay.origin[1], x2: wx + 52, y2: lay.origin[1] })
    scene.circles.push({ cls: 'bar-end', cx: wx, cy: lay.origin[1], r: 5 })
    if (lay.boxRect) {
      const r = lay.boxRect
      scene.rects.push({ cls: 'box', x: lay.origin[0] + r.x * lay.scale, y: lay.origin[1] + r.y * lay.scale, w: r.w * lay.scale, h: r.h * lay.scale })
    }
  } else {
    scene.lines.push({ cls: 'floor', x1: 20, y1: lay.floorY + 4, x2: lay.width - 20, y2: lay.floorY + 4 })
    if (lay.wallX != null) scene.lines.push({ cls: 'wall', x1: lay.wallX, y1: 6, x2: lay.wallX, y2: lay.floorY + 4 })
  }
  return {
    far, near,
    head: { cx: P.head[0], cy: P.head[1], r: LIMB.headRadius * lay.scale },
    joints: ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'].map((k) => ({ cx: P[k][0], cy: P[k][1], r: 0.06 * lay.scale })),
    scene, holding: !!holding, t
  }
}

/** Lage eines Gelenks relativ zum Ankerpunkt in Einheiten (für Tests: Bodenkontakt, Kistenabstand). */
export function jointUnits(demo, t, name) {
  return relativeToAnchor(poseAt(demo.keys, t), anchorOf(demo))[name]
}

/**
 * Quadratischer Ausschnitt (viewBox) um die Figur für das kleine Standbild: nur Figur und Kopf, nicht die ganze Szene.
 * margin: Rand in Zeicheneinheiten.
 */
export function frameBounds(frame, margin = 12) {
  const xs = []
  const ys = []
  for (const s of [...frame.near, ...frame.far]) { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2) }
  xs.push(frame.head.cx - frame.head.r, frame.head.cx + frame.head.r)
  ys.push(frame.head.cy - frame.head.r, frame.head.cy + frame.head.r)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const size = Math.max(maxX - minX, maxY - minY) + 2 * margin
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  return { x: cx - size / 2, y: cy - size / 2, size }
}
