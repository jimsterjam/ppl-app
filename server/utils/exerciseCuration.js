const HARD_REMOVE_CATEGORY = new Set(['stretching', 'mobility', 'warmup', 'warm-up'])
const HARD_REMOVE_PHASE = new Set(['warmup', 'warm-up'])
const HARD_REMOVE_TYPE = new Set(['mobility', 'stretching', 'warmup', 'warm-up'])

const EXOTIC_KEYWORDS = [
  'assisted',
  'alternating',
  'alternate',
  'bosu',
  'swiss ball',
  'stability ball',
  'landmine',
  'banded',
  'kneeling',
  'contralateral',
  'single-arm cable',
  'single arm cable',
  'single-leg balance',
  'single leg balance',
  'floss',
  'corrective',
  'prehab',
  'rehab'
]

const CORE_WHITELIST_PATTERNS = [
  /\bsquat\b/i,
  /\bdeadlift\b/i,
  /\bbench\b/i,
  /\brow\b/i,
  /\bpull[ -]?up\b/i,
  /\blat[ -]?pull\b/i,
  /\boverhead\b/i,
  /\bshoulder press\b/i,
  /\bchest press\b/i,
  /\blunge\b/i,
  /\bhip thrust\b/i,
  /\bleg press\b/i,
  /\bcurl\b/i,
  /\bextension\b/i,
  /\bcalf raise\b/i,
  /\bplank\b/i,
  /\bcrunch\b/i
]

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function isCoreWhitelist(name = '') {
  return CORE_WHITELIST_PATTERNS.some((pattern) => pattern.test(name))
}

function hasExoticKeyword(name = '') {
  const normalized = normalizeText(name)
  return EXOTIC_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function shouldHardRemove(exercise) {
  const categoryRaw = normalizeText(exercise?.category_raw)
  if (HARD_REMOVE_CATEGORY.has(categoryRaw)) return true

  const phase = normalizeText(exercise?.aiMetadata?.primaryPhase)
  if (HARD_REMOVE_PHASE.has(phase)) return true

  const exerciseType = normalizeText(exercise?.aiMetadata?.exerciseType)
  if (HARD_REMOVE_TYPE.has(exerciseType)) return true

  return false
}

function shouldRemoveExotic(exercise) {
  const name = `${exercise?.name || ''} ${exercise?.name_en || ''}`.trim()
  if (!name) return false
  if (!hasExoticKeyword(name)) return false
  if (isCoreWhitelist(name)) return false
  return true
}

export function curateDefaultExercises(exercises = [], options = {}) {
  const enableCuration = options?.enableCuration !== false
  const enableExoticFilter = options?.enableExoticFilter !== false

  if (!enableCuration) return Array.isArray(exercises) ? exercises : []

  const list = Array.isArray(exercises) ? exercises : []
  const curated = []

  for (const exercise of list) {
    if (!exercise || typeof exercise !== 'object') continue
    if (shouldHardRemove(exercise)) continue
    if (enableExoticFilter && shouldRemoveExotic(exercise)) continue
    curated.push(exercise)
  }

  return curated
}
