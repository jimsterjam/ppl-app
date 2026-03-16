const CATEGORY_VALUES = new Set(['Push', 'Pull', 'Legs', 'Core', 'Cardio', 'Full Body'])
const MUSCLE_GROUP_VALUES = new Set([
  'Brust', 'Schultern', 'Trizeps',
  'Rücken', 'Bizeps', 'Trapez',
  'Quadrizeps', 'Hamstrings', 'Gesäß', 'Glutes', 'Waden',
  'Bauch', 'Core',
  'Cardio'
])
const EQUIPMENT_VALUES = new Set([
  'Hanteln', 'Langhantel', 'Kurzhanteln',
  'Kabelzug', 'Körpergewicht',
  'Kettlebell', 'Resistance Band', 'Cardio-Gerät',
  'Medizinball', 'Sandbag', 'Band',
  'machine'
])

const normalizeStr = (value) => String(value || '').trim().toLowerCase()

function mapCategory(rawCategory, bodyPart, target) {
  if (CATEGORY_VALUES.has(rawCategory)) return rawCategory
  const bp = normalizeStr(bodyPart)
  const tg = normalizeStr(target)
  const rc = normalizeStr(rawCategory)

  if (rc.includes('cardio') || bp.includes('cardio') || tg.includes('cardio') || tg.includes('cardiovascular')) return 'Cardio'
  if (bp.includes('waist') || tg.includes('abs') || tg.includes('obliques') || tg.includes('core')) return 'Core'
  if (bp.includes('upper legs') || bp.includes('lower legs') || bp.includes('legs') || tg.includes('quads') || tg.includes('quadriceps') || tg.includes('hamstrings') || tg.includes('glutes') || tg.includes('calves')) return 'Legs'
  if (bp.includes('back') || tg.includes('lats') || tg.includes('upper back') || tg.includes('lower back') || tg.includes('rhomboids') || tg.includes('traps')) return 'Pull'
  if (bp.includes('upper arms')) {
    if (tg.includes('triceps')) return 'Push'
    return 'Pull'
  }
  if (bp.includes('chest') || bp.includes('shoulders') || tg.includes('pectorals') || tg.includes('delts') || tg.includes('triceps')) return 'Push'
  if (bp.includes('full body') || rc.includes('full body')) return 'Full Body'
  return 'Push'
}

function mapMuscleGroup(existing, target, bodyPart) {
  if (MUSCLE_GROUP_VALUES.has(existing)) return existing
  const tg = normalizeStr(target)
  const bp = normalizeStr(bodyPart)

  if (tg.includes('pectorals') || tg.includes('chest') || bp.includes('chest')) return 'Brust'
  if (tg.includes('biceps')) return 'Bizeps'
  if (tg.includes('triceps')) return 'Trizeps'
  if (tg.includes('delts') || tg.includes('shoulders') || bp.includes('shoulders')) return 'Schultern'
  if (tg.includes('lats') || tg.includes('upper back') || tg.includes('lower back') || tg.includes('rhomboids') || tg.includes('back') || bp.includes('back')) return 'Rücken'
  if (tg.includes('traps') || tg.includes('trapezius')) return 'Trapez'
  if (tg.includes('quads') || tg.includes('quadriceps') || bp.includes('upper legs')) return 'Quadrizeps'
  if (tg.includes('hamstrings')) return 'Hamstrings'
  if (tg.includes('glutes') || tg.includes('gluteus')) return 'Gesäß'
  if (tg.includes('calves') || bp.includes('lower legs')) return 'Waden'
  if (tg.includes('abs') || bp.includes('waist')) return 'Bauch'
  if (tg.includes('obliques') || tg.includes('core')) return 'Core'
  if (tg.includes('cardio') || tg.includes('cardiovascular') || bp.includes('cardio')) return 'Cardio'
  if (tg.includes('forearms')) return 'Bizeps'
  if (tg.includes('hip flexors')) return 'Core'
  if (bp.includes('upper arms')) return 'Bizeps'
  return 'Core'
}

function mapEquipment(existing, equipmentEn) {
  if (EQUIPMENT_VALUES.has(existing)) return existing
  const eq = normalizeStr(equipmentEn || existing)
  if (!eq) return ''
  if (eq.includes('barbell') || eq.includes('ez bar') || eq.includes('trap bar')) return 'Langhantel'
  if (eq.includes('dumbbell')) return 'Kurzhanteln'
  if (eq.includes('cable')) return 'Kabelzug'
  if (eq.includes('machine') || eq.includes('smith') || eq.includes('maschine')) return 'machine'
  if (eq.includes('body weight') || eq.includes('bodyweight')) return 'Körpergewicht'
  if (eq.includes('kettlebell')) return 'Kettlebell'
  if (eq.includes('resistance band') || eq === 'band') return 'Resistance Band'
  if (eq.includes('medicine ball')) return 'Medizinball'
  if (eq.includes('sandbag')) return 'Sandbag'
  if (eq.includes('cardio')) return 'Cardio-Gerät'
  return existing || equipmentEn
}

export function normalizeDefaultExercise(exercise = {}) {
  const cdnBase = (import.meta.env.VITE_ASSET_CDN_BASE || '').replace(/\/+$/, '')
  const rawId = exercise.id ? String(exercise.id).trim() : ''
  const derivedId = exercise._id || (rawId ? `ex_${rawId}` : undefined)
  const name = exercise.name || exercise.name_en || ''
  const name_en = exercise.name_en || name
  const target = exercise.target || exercise.muscleGroup_en || exercise.muscleGroup || ''
  const originalCategory = exercise.category || ''
  const category = mapCategory(originalCategory, exercise.bodyPart, target)
  const muscleGroup = mapMuscleGroup(exercise.muscleGroup, target, exercise.bodyPart)
  const equipment_en = exercise.equipment_en || exercise.equipment || ''
  const equipment = mapEquipment(exercise.equipment, equipment_en)
  const description = exercise.description || exercise.description_en || ''
  const description_en = exercise.description_en || exercise.description || ''
  const numericId = rawId && /^\d+$/.test(rawId) ? rawId.padStart(4, '0') : rawId
  const mediaId = exercise.mediaId || numericId || derivedId
  const mediaVersion = exercise.mediaVersion || exercise.version || 'v1'
  let imageUrl = exercise.imageUrl || undefined
  let thumbnailUrl = exercise.thumbnailUrl || undefined
  const thumbnailStaticUrl = exercise.thumbnailStaticUrl || (numericId ? `/exercises/static/180/${numericId}.jpg` : undefined)

  if (imageUrl && thumbnailUrl && imageUrl.includes('/180/') && thumbnailUrl.includes('/360/')) {
    const tmp = imageUrl
    imageUrl = thumbnailUrl
    thumbnailUrl = tmp
  }

  const normalized = {
    ...exercise,
    _id: derivedId,
    mediaId,
    mediaVersion,
    name,
    name_en,
    category,
    muscleGroup,
    muscleGroup_en: exercise.muscleGroup_en || target || muscleGroup,
    equipment,
    equipment_en,
    description,
    description_en,
    imageUrl,
    thumbnailUrl,
    thumbnailStaticUrl
  }

  if (originalCategory && originalCategory !== category) {
    normalized.category_raw = originalCategory
  }

  return normalized
}

export function normalizeDefaultExercises(raw) {
  const list = Array.isArray(raw) ? raw : (raw?.default || [])
  return list.map(normalizeDefaultExercise)
}
