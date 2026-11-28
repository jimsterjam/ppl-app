// Haltungen der Strichfiguren-Demos (siehe engine.js). Nur für Übungen OHNE Foto/Video im Katalog; Schlüssel ist die Katalog-ID.
// Aufbau einer Demo:
//   id, name_en   Katalogeintrag (Test gleicht beides mit default-exercises.json ab)
//   hot           arbeitende Zone: 'torso' | 'arms' | 'legs'
//   keys          Schlüsselhaltungen, gleichmäßig auf t = 0..1 verteilt (eine = statisch)
//   phases        Ablauf [{ d, from, to, hold? }]; hold = am Endpunkt wird gehalten (Leuchten). Fehlt = statisch.
//   props         { bar: true, box: true } = Hang an der Stange mit Einstiegskiste; sonst Bodenübung (Handgelenk am Boden)
// Winkel: 0 = nach rechts, 90 = nach unten. Neue Demos nur mit Vorschaubild zur Freigabe (Genauigkeit der Haltung).

const PLANK = { torso: -7, head: -12, uarm: 90, farm: 0, thigh: 173, shin: 173, foot: 83 }

const TUCK_START = { torso: -10, head: 5, uarm: 105, farm: 105, thigh: 35, shin: 145, foot: 0 }
const TUCK_HOLD = { torso: 0, head: 14, uarm: 105, farm: 105, thigh: 30, shin: 205, foot: 175 }

const HANG_STAND = { torso: -78, head: -60, uarm: -72, farm: -72, thigh: 90, shin: 90, foot: 0 }
// HANG_STEP so gewählt, dass die Füße beim Absteigen nicht durch die Kistenkante laufen (Test in demos.test.js)
const HANG_STEP = { torso: -85, head: -62, uarm: -76, farm: -76, thigh: 50, shin: 115, foot: 0 }
const HANG = { torso: -90, head: -62, uarm: -90, farm: -90, thigh: 90, shin: 92, foot: 15 }

// --- Weitere Halteübungen (Entwurf, Haltungen mit Vorschaubild zur Freigabe) ---
// Liegestütz-Start für Hollow/Arch: flach auf dem Boden (Anker: Hüfte am Boden)
const LIE_SUPINE = { torso: 0, head: -35, uarm: 0, farm: 0, thigh: 180, shin: 180, foot: -80 }
// foot -169 = 191 Grad, aber auf kurzem Weg vom flachen Start (-80): sonst dreht sich der Fuß beim Übergang einmal um und taucht durch den Boden
const HOLLOW = { torso: -9, head: -4, uarm: -9, farm: -9, thigh: 191, shin: 191, foot: -169 }
const LIE_PRONE = { torso: 0, head: -30, uarm: 0, farm: 0, thigh: 180, shin: 180, foot: 180 }
const ARCH = { torso: -11, head: -48, uarm: -30, farm: -30, thigh: 193, shin: 197, foot: 205 }
// Wall Sit: Anker Zehen am Boden, Wand hinter dem Rücken
const WALL_STAND = { torso: -90, head: -82, uarm: 90, farm: 90, thigh: 59, shin: 59, foot: 0 }
const WALL_SIT = { torso: -90, head: -82, uarm: 64, farm: 70, thigh: 0, shin: 90, foot: 0 }
// Crow Pose: Start = Hocke (wie Tuck Planche), Haltung = Knie auf den Oberarmen
const CROW = { torso: 25, head: 15, uarm: 160, farm: 80, thigh: 45, shin: 192, foot: 190 }
// Barren-Stütz (Anker: Handgelenk an den Holmen, Körper hängt darunter)
const SUPPORT = { torso: -95, head: -88, uarm: 80, farm: 80, thigh: 55, shin: 92, foot: 15 }
// Flexed Arm Hang: Start = Hang, Ende = Kinn über der Stange
const FLEXED = { torso: -90, head: -68, uarm: 112, farm: -112, thigh: 94, shin: 95, foot: 15 }
// Front Lever (Straddle) und Back-Lever-Stufen: Start = Hang an gestreckten Armen
const FL_STRADDLE = { torso: 0, head: -40, uarm: -90, farm: -90, thigh: 180, shin: 180, foot: 180, spread: 12 }
const BL_TUCK = { torso: 0, head: 28, uarm: -106, farm: -106, thigh: 35, shin: 205, foot: 190 }
const BL_ADV_TUCK = { torso: 0, head: 28, uarm: -106, farm: -106, thigh: 90, shin: 180, foot: 180 }
const BL_STRADDLE = { torso: 0, head: 28, uarm: -106, farm: -106, thigh: 180, shin: 180, foot: 180, spread: 12 }

const HOLD_PHASES = [{ d: 1.0, from: 0, to: 0 }, { d: 1.5, from: 0, to: 1 }, { d: 2.8, from: 1, to: 1, hold: true }, { d: 1.3, from: 1, to: 0 }]

export const EXERCISE_DEMOS = Object.freeze([
  { id: '9019', name_en: 'plank', hot: ['torso'], keys: [PLANK] },
  {
    id: '9013', name_en: 'tuck planche', hot: ['arms'], keys: [TUCK_START, TUCK_HOLD],
    phases: [{ d: 1.0, from: 0, to: 0 }, { d: 1.5, from: 0, to: 1 }, { d: 2.8, from: 1, to: 1, hold: true }, { d: 1.3, from: 1, to: 0 }]
  },
  {
    id: '9022', name_en: 'dead hang', hot: ['arms'], keys: [HANG_STAND, HANG_STEP, HANG], props: { bar: true, box: true },
    phases: [{ d: 1.0, from: 0, to: 0 }, { d: 1.8, from: 0, to: 1 }, { d: 2.8, from: 1, to: 1, hold: true }, { d: 1.3, from: 1, to: 0 }]
  },
  { id: '9020', name_en: 'hollow body hold', hot: ['torso'], anchor: 'hip', keys: [LIE_SUPINE, HOLLOW], phases: HOLD_PHASES },
  { id: '9021', name_en: 'arch body hold', hot: ['torso'], anchor: 'hip', keys: [LIE_PRONE, ARCH], phases: HOLD_PHASES },
  { id: '9023', name_en: 'flexed arm hang', hot: ['arms'], keys: [HANG, FLEXED], props: { bar: true }, phases: HOLD_PHASES },
  { id: '9024', name_en: 'wall sit', hot: ['legs'], anchor: 'toe', keys: [WALL_STAND, WALL_SIT], props: { wall: true }, phases: HOLD_PHASES },
  { id: '9025', name_en: 'crow pose', hot: ['arms'], keys: [TUCK_START, CROW], phases: HOLD_PHASES },
  { id: '9026', name_en: 'parallel bar support hold', hot: ['arms'], keys: [SUPPORT], props: { bar: true } },
  { id: '9027', name_en: 'straddle front lever', hot: ['torso'], keys: [HANG, FL_STRADDLE], props: { bar: true }, phases: HOLD_PHASES },
  { id: '9028', name_en: 'tuck back lever', hot: ['torso'], keys: [HANG, BL_TUCK], props: { bar: true }, phases: HOLD_PHASES },
  { id: '9029', name_en: 'advanced tuck back lever', hot: ['torso'], keys: [HANG, BL_ADV_TUCK], props: { bar: true }, phases: HOLD_PHASES },
  { id: '9030', name_en: 'straddle back lever', hot: ['torso'], keys: [HANG, BL_STRADDLE], props: { bar: true }, phases: HOLD_PHASES }
])

const BY_ID = new Map(EXERCISE_DEMOS.map((d) => [d.id, d]))
const BY_NAME = new Map(EXERCISE_DEMOS.map((d) => [d.name_en, d]))
const clean = (value) => String(value || '').trim().toLowerCase()
const stripPrefix = (value) => String(value || '').trim().replace(/^ex_/, '')

/**
 * Demo zu einer Übung (Katalogeintrag oder Übung im Workout) oder null.
 * Die ID ist maßgeblich (id, _id, exerciseId, auch mit Präfix "ex_"): Gibt es eine ID, die nicht zu einer Demo gehört, gibt es keine Demo,
 * auch wenn der Name passt (eigene Übung "Plank" mit eigenem Foto/Video). Nur ohne jede ID entscheidet der englische Name
 * (ältere Workouts nur mit Namen). Eigene Übungen des Nutzers (_isCustom) bekommen nie eine Demo.
 */
export function findExerciseDemo(exercise) {
  if (!exercise || typeof exercise !== 'object' || exercise._isCustom) return null
  const ids = [exercise.id, exercise._id, exercise.exerciseId].map(stripPrefix).filter(Boolean)
  for (const id of ids) {
    const demo = BY_ID.get(id)
    if (demo) return demo
  }
  if (ids.length) return null
  for (const candidate of [exercise.name_en, exercise.displayName, exercise.name]) {
    const demo = BY_NAME.get(clean(candidate))
    if (demo) return demo
  }
  return null
}
