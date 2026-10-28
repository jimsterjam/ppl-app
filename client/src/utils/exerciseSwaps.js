import { CURATED_SWAPS } from '@/data/exerciseSwapList'

// Ersatz-Vorschläge für „Übung wechseln“ (Absprache Paul 28.10.): zuerst die handgepflegte Liste für die Grundübungen,
// sonst/zusätzlich automatisch nach Zielmuskel, Gerät und Schwierigkeit. Bei freien Gewichten kommen geführte Maschinen
// zuerst - wer die Übung noch nicht sicher beherrscht, muss dort nichts ausbalancieren.

export const SWAP_MAX_SUGGESTIONS = 6

/** Geräteart einer Übung (Katalogfeld `equipment_en`) als Schlüssel für Anzeige und Rangfolge. */
export function equipmentKind(entry) {
  const eq = String(entry?.equipment_en || entry?.equipment || '').toLowerCase()
  if (eq.includes('smith')) return 'smith'
  if (eq.includes('machine') || eq.includes('sled') || eq.includes('maschine')) return 'machine'
  if (eq.includes('cable') || eq.includes('kabel')) return 'cable'
  if (eq.includes('barbell') || eq.includes('langhantel') || eq.includes('trap bar')) return 'barbell'
  if (eq.includes('dumbbell') || eq.includes('kurzhantel')) return 'dumbbell'
  if (eq.includes('body weight') || eq.includes('bodyweight') || eq.includes('körpergewicht')) return 'bodyweight'
  return 'other'
}

const FREE_WEIGHT_KINDS = new Set(['barbell', 'dumbbell'])
// Rang je Geräteart, wenn das Original ein freies Gewicht ist: geführt vor frei.
const GUIDED_FIRST_RANK = { machine: 0, cable: 1, smith: 1, bodyweight: 2, dumbbell: 2, other: 2, barbell: 3 }
const DIFFICULTY_RANK = { beginner: 0, intermediate: 1 }

const nameKey = (value) => String(value || '').trim().toLowerCase()

function entryKey(entry) {
  return nameKey(entry?.name_en || entry?.name)
}

function findByName(catalog, name) {
  const key = nameKey(name)
  return (catalog || []).find((entry) => entryKey(entry) === key) || null
}

/**
 * @param {object} options
 * @param {{ name?: string, exerciseId?: string }} options.exercise - die zu ersetzende Übung (englischer Name wie im Workout)
 * @param {Array} options.catalog - normalisierter Übungskatalog (loadDefaultExercises)
 * @param {string[]} [options.exclude] - Namen, die nicht vorgeschlagen werden (z. B. schon im Workout)
 * @param {number} [options.limit]
 * @returns {Array<{ entry: object, kind: string, curated: boolean }>}
 */
export function getSwapSuggestions({ exercise, catalog, exclude = [], limit = SWAP_MAX_SUGGESTIONS } = {}) {
  const original = findByName(catalog, exercise?.name)
  const skip = new Set([nameKey(exercise?.name), ...exclude.map(nameKey)])
  const picked = []
  const add = (entry, curated) => {
    const key = entryKey(entry)
    if (!entry || skip.has(key) || picked.length >= limit) return
    skip.add(key)
    picked.push({ entry, kind: equipmentKind(entry), curated })
  }

  for (const name of CURATED_SWAPS[nameKey(exercise?.name)] || []) add(findByName(catalog, name), true)
  if (picked.length >= limit || !original?.target) return picked

  const originalKind = equipmentKind(original)
  const rank = (entry) => {
    const kind = equipmentKind(entry)
    const gear = FREE_WEIGHT_KINDS.has(originalKind) ? GUIDED_FIRST_RANK[kind] : (kind === originalKind ? 1 : 0)
    return gear + (DIFFICULTY_RANK[String(entry.difficulty || '').toLowerCase()] ?? 1)
  }
  ;(catalog || [])
    .filter((entry) => entry.target === original.target && String(entry.difficulty || '').toLowerCase() !== 'advanced')
    .map((entry, index) => ({ entry, index, score: rank(entry) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .forEach(({ entry }) => add(entry, false))
  return picked
}
