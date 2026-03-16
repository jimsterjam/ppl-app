import { getAllExercisesOffline } from '@/utils/offlineStorage'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { fetchExercises } from '@/api/exercises'

// Merge offline exercises with JSON defaults, dedupe by name+equipment, optional equipment filter,
// and sort alphabetically by first three letters, then full name
export async function getMergedSortedExercises({ category = '', equipment = '', locale = '', includeRemote = true } = {}) {
  // Build quick lookup by both DE and EN names from defaults
  const normalize = (s) => (s || '').trim().toLowerCase()
  const isGermanLocale = String(locale || '').toLowerCase().startsWith('de')
  let defaults = []
  try {
    defaults = await loadDefaultExercises()
  } catch (err) {
    console.warn('[ExerciseList] loadDefaultExercises failed:', err?.message || err)
  }
  if (!Array.isArray(defaults)) defaults = []
  console.debug('[ExerciseList] defaults loaded:', defaults.length, '| category:', category || '(all)')
  const nameIndex = new Map()
  for (const d of defaults) {
    const de = normalize(d.name)
    const en = normalize(d.name_en)
    if (de) nameIndex.set(de, d)
    if (en) nameIndex.set(en, d)
  }

  const pickDisplayName = (exercise = {}) => {
    const rawName = exercise?.name || ''
    const d = nameIndex.get(normalize(rawName)) || nameIndex.get(normalize(exercise?.name_en))
    if (isGermanLocale) {
      return d?.name || exercise?.names?.de || exercise?.name_de || rawName || exercise?.name_en || ''
    }
    return d?.name_en || d?.name || exercise?.name_en || rawName || ''
  }
  const canonNameKey = (rawName) => {
    const d = nameIndex.get(normalize(rawName))
    // Use EN as canonical when available, else DE
    return normalize(d?.name_en || d?.name || rawName)
  }
  const canonEquipKey = (rawEquip, rawName) => {
    const d = nameIndex.get(normalize(rawName))
    // Prefer default english equipment as canonical key when mapping exists
    return normalize(d?.equipment_en || rawEquip || 'bodyweight')
  }

  let list = []
  try {
    // Add JSON defaults FIRST (preferred for canonicalization)
    const filteredDefaults = category ? defaults.filter(ex => (ex.category || '') === category) : defaults
    const mappedDefaults = filteredDefaults.map(ex => ({
      ...ex,
      displayName: pickDisplayName(ex),
      __canonKey: `${canonNameKey(ex.name)}__${canonEquipKey(ex.equipment, ex.name)}`,
      _id: ex._id || `json_${normalize(ex.name)}_${normalize(ex.equipment || 'bodyweight')}`
    }))
    list = mappedDefaults
  } catch {
    list = []
  }
  if (includeRemote) {
    try {
      const remote = await fetchExercises({ category, equipment })
      const mappedRemote = (Array.isArray(remote) ? remote : []).map(ex => ({
        ...ex,
        displayName: pickDisplayName(ex),
        __canonKey: `${canonNameKey(ex.name)}__${canonEquipKey(ex.equipment, ex.name)}`
      }))
      list = [...list, ...mappedRemote]
    } catch {}
  }
  try {
    // Append offline stored exercises with optional category filter
    const offline = await getAllExercisesOffline({ category })
    const mappedOffline = (Array.isArray(offline) ? offline : []).map(ex => ({
      ...ex,
      displayName: pickDisplayName(ex),
      __canonKey: `${canonNameKey(ex.name)}__${canonEquipKey(ex.equipment, ex.name)}`
    }))
    list = [...list, ...mappedOffline]
  } catch {}

  // Equipment filter if provided (match raw equipment string, case-insensitive)
  if (equipment) {
    const eq = equipment.toLowerCase()
    list = list.filter(ex => (ex.equipment || '').toLowerCase() === eq)
  }

  // Deduplicate by canonical name + canonical equipment (keep first: defaults preferred)
  const seen = new Set()
  const unique = []
  for (const ex of list) {
    const key = isGermanLocale
      ? normalize(ex.displayName || ex.name || ex.name_en)
      : (ex.__canonKey || `${normalize(ex.name)}__${normalize(ex.equipment || 'bodyweight')}`)
    if (!seen.has(key)) { seen.add(key); unique.push(ex) }
  }

  // Sort by displayName (locale-aware), then by raw name as tiebreaker
  const sorted = unique.slice().sort((a, b) => {
    const an = normalize(a.displayName || a.name)
    const bn = normalize(b.displayName || b.name)
    const pref = an.slice(0,3).localeCompare(bn.slice(0,3))
    if (pref !== 0) return pref
    return an.localeCompare(bn)
  })

  console.debug('[ExerciseList] final sorted result:', sorted.length, '| unique:', unique.length)
  return sorted
}
