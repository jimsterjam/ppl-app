import { getAllExercisesOffline, getAllCustomExercisesOffline } from '@/utils/offlineStorage'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { fetchExercises } from '@/api/exercises'

// Merge offline exercises with JSON defaults, dedupe by name+equipment, optional equipment filter,
// and sort alphabetically by first three letters, then full name.
// userId: falls gesetzt, werden zusätzlich die eigenen (nur für diesen User sichtbaren) Übungen eingemischt.
export async function getMergedSortedExercises({ category = '', equipment = '', locale = '', includeRemote = true, userId = '' } = {}) {
  console.log('[DEBUG-CUSTOM] getMergedSortedExercises aufgerufen mit userId:', userId || 'LEER')
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

  // Eigene Übungen des Users anhängen (nur für ihn sichtbar, nicht mit Defaults/Remote gemerged,
  // da sie bewusst keine kanonische Übersetzung haben — displayName = eingegebener Name).
  if (userId) {
    try {
      const custom = await getAllCustomExercisesOffline({ userId })
      console.log('[DEBUG-CUSTOM] userId:', userId, '| gefundene eigene Übungen:', custom.length, '|', custom.map(c => c.name))
      const mappedCustom = (Array.isArray(custom) ? custom : []).map(ex => ({
        ...ex,
        displayName: ex.name || '',
        _isCustom: true,
        // Eigene Übungen sollen nicht mit Default-Übungen dedupliziert werden,
        // auch wenn der Name zufällig übereinstimmt — der User hat sie bewusst
        // separat angelegt (z.B. weil die Standard-Variante nicht passte).
        __canonKey: `custom__${normalize(ex._id)}`
      }))
      list = [...list, ...mappedCustom]
    } catch (err) {
      console.warn('[DEBUG-CUSTOM] getAllCustomExercisesOffline failed:', err?.message || err)
    }
  }

  // Equipment filter if provided (match raw equipment string, case-insensitive)
  // Eigene Übungen sind vom Equipment-Filter ausgenommen, da sie oft kein
  // Equipment-Feld gepflegt haben und sonst fälschlich rausgefiltert würden.
  if (equipment) {
    const eq = equipment.toLowerCase()
    list = list.filter(ex => ex._isCustom || (ex.equipment || '').toLowerCase() === eq)
  }

  // Deduplicate by canonical name + canonical equipment (keep first: defaults preferred)
  const seen = new Set()
  const unique = []
  for (const ex of list) {
    const key = ex._isCustom
      ? ex.__canonKey
      : (isGermanLocale
          ? normalize(ex.displayName || ex.name || ex.name_en)
          : (ex.__canonKey || `${normalize(ex.name)}__${normalize(ex.equipment || 'bodyweight')}`))
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

  console.debug('[ExerciseList] final sorted result:', sorted.length, '| unique:', unique.length, '| custom:', sorted.filter(e => e._isCustom).length)
  return sorted
}