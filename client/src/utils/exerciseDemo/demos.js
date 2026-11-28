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

export const EXERCISE_DEMOS = Object.freeze([
  { id: '9019', name_en: 'plank', hot: ['torso'], keys: [PLANK] },
  {
    id: '9013', name_en: 'tuck planche', hot: ['arms'], keys: [TUCK_START, TUCK_HOLD],
    phases: [{ d: 1.0, from: 0, to: 0 }, { d: 1.5, from: 0, to: 1 }, { d: 2.8, from: 1, to: 1, hold: true }, { d: 1.3, from: 1, to: 0 }]
  },
  {
    id: '9022', name_en: 'dead hang', hot: ['arms'], keys: [HANG_STAND, HANG_STEP, HANG], props: { bar: true, box: true },
    phases: [{ d: 1.0, from: 0, to: 0 }, { d: 1.8, from: 0, to: 1 }, { d: 2.8, from: 1, to: 1, hold: true }, { d: 1.3, from: 1, to: 0 }]
  }
])

const BY_ID = new Map(EXERCISE_DEMOS.map((d) => [d.id, d]))
const BY_NAME = new Map(EXERCISE_DEMOS.map((d) => [d.name_en, d]))
const clean = (value) => String(value || '').trim().toLowerCase()
const stripPrefix = (value) => String(value || '').trim().replace(/^ex_/, '')

/**
 * Demo zu einer Übung (Katalogeintrag oder Übung im Workout) oder null.
 * Erst über die ID (id, _id, exerciseId, auch mit Präfix "ex_"), dann über den englischen Namen.
 * Eigene Übungen des Nutzers bekommen nie eine Demo (gleicher Name heißt nicht gleiche Übung).
 */
export function findExerciseDemo(exercise) {
  if (!exercise || typeof exercise !== 'object' || exercise._isCustom) return null
  for (const candidate of [exercise.id, exercise._id, exercise.exerciseId]) {
    const demo = BY_ID.get(stripPrefix(candidate))
    if (demo) return demo
  }
  for (const candidate of [exercise.name_en, exercise.displayName, exercise.name]) {
    const demo = BY_NAME.get(clean(candidate))
    if (demo) return demo
  }
  return null
}
