import { cacheAssetFromUrl, getCachedAssetUri } from '@/utils/assetCache'
import { logger } from '@/utils/logger'

const CDN_BASE = (import.meta.env.VITE_ASSET_CDN_BASE || '').replace(/\/+$/, '')
const DEFAULT_CONCURRENCY = 2
let downloadConcurrency = DEFAULT_CONCURRENCY
const downloadQueue = []
const inFlight = new Map()
let activeCount = 0

export function setDownloadConcurrency(value) {
  const num = Number(value)
  downloadConcurrency = Number.isFinite(num) && num > 0 ? Math.floor(num) : DEFAULT_CONCURRENCY
}

function enqueueDownload(remoteUrl, cacheKey) {
  if (!remoteUrl || !cacheKey) return Promise.resolve(null)
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey)

  const taskPromise = new Promise((resolve) => {
    downloadQueue.push({ remoteUrl, cacheKey, resolve })
    processQueue()
  })

  inFlight.set(cacheKey, taskPromise)
  return taskPromise
}

function processQueue() {
  if (activeCount >= downloadConcurrency) return
  const next = downloadQueue.shift()
  if (!next) return

  activeCount += 1
  cacheAssetFromUrl(next.remoteUrl, next.cacheKey)
    .then((uri) => {
      next.resolve(uri || null)
    })
    .catch(() => {
      next.resolve(null)
    })
    .finally(() => {
      inFlight.delete(next.cacheKey)
      activeCount -= 1
      processQueue()
    })
}

function resolveId(exercise) {
  const raw = exercise?.mediaId || exercise?.id || exercise?.exerciseId || exercise?._id || null
  if (!raw) return null
  let str = String(raw).trim()
  if (str.startsWith('ex_')) {
    str = str.slice(3)
  }
  return /^\d+$/.test(str) ? str.padStart(4, '0') : str
}

function resolveVersion(exercise) {
  return exercise?.mediaVersion || exercise?.version || 'v1'
}

function deriveLegacyCandidates(exercise, ext = 'mp4') {
  const explicit = String(exercise?.imageUrl || exercise?.mediaUrl || exercise?.thumbnailUrl || '').trim()
  if (!explicit) return []

  const candidates = []
  if (ext === 'mp4' && explicit.toLowerCase().endsWith('.gif')) {
    const idMatch = explicit.match(/\/(\d{1,6})\.gif$/i)
    const id = idMatch?.[1]?.padStart(4, '0')
    const version = resolveVersion(exercise)
    if (id) {
      candidates.push(`/assets-cdn/exercises/mp4/360/${id}.${version}.mp4`)
      candidates.push(`/exercises/mp4/360/${id}.${version}.mp4`)
    }
  }

  return candidates
}

function buildExerciseMediaCandidates(exercise, size = 360, ext = 'mp4') {
  const candidates = []
  const id = resolveId(exercise)
  const version = resolveVersion(exercise)

  if (id) {
    if (ext === 'mp4') {
      candidates.push(`/exercises/mp4/${size}/${id}.${version}.mp4`)
      if (CDN_BASE) {
        candidates.push(`${CDN_BASE}/exercises/mp4/${size}/${id}.${version}.mp4`)
      }
      candidates.push(`/assets-cdn/exercises/mp4/${size}/${id}.${version}.mp4`)
    }
  }

  candidates.push(...deriveLegacyCandidates(exercise, ext))

  const explicit = exercise?.imageUrl || exercise?.mediaUrl || null
  if (explicit && /^https?:\/\//i.test(explicit)) {
    const lower = explicit.toLowerCase()
    if (ext === 'mp4' && lower.endsWith('.mp4')) {
      candidates.push(explicit)
    }
  }

  return [...new Set(candidates.filter(Boolean))]
}

export function getExerciseThumb(exercise) {
  return exercise?.thumbnailStaticUrl || exercise?.thumbnailUrl || exercise?.imageUrl || '/exercises/play.svg'
}

export function buildExerciseMediaUrl(exercise, size = 360, ext = 'mp4') {
  if (!exercise) return null
  const candidates = buildExerciseMediaCandidates(exercise, size, ext)
  if (candidates.length) return candidates[0]

  const explicit = exercise?.imageUrl || exercise?.mediaUrl || null
  if (ext === 'mp4' && typeof explicit === 'string' && explicit.toLowerCase().endsWith('.mp4')) {
    return explicit
  }
  return null
}

export function buildExerciseCacheKey(exercise, size = 360, ext = 'mp4') {
  const id = resolveId(exercise)
  if (!id) return null
  const version = resolveVersion(exercise)
  return `exercises/${size}/${id}.${version}.${ext}`
}

export async function resolveExerciseMedia(exercise, options = {}) {
  const size = options.size || 360
  const fallbackUrl = options.fallbackUrl || getExerciseThumb(exercise)
  const onResolved = typeof options.onResolved === 'function' ? options.onResolved : null

  if (onResolved) onResolved(fallbackUrl)

  const id = resolveId(exercise)
  const remoteMp4 = buildExerciseMediaUrl(exercise, size, 'mp4')
  const cacheMp4 = buildExerciseCacheKey(exercise, size, 'mp4')
  const mp4Candidates = buildExerciseMediaCandidates(exercise, size, 'mp4')

  logger.debug('[assetResolver] resolve media', {
    id,
    size,
    cdnBase: CDN_BASE || null,
    fallbackUrl,
    remoteMp4,
    cacheMp4
  })

  if (mp4Candidates.length === 0) {
    logger.debug('[assetResolver] no remote media, using fallback')
    return fallbackUrl
  }

  if (cacheMp4) {
    const cachedMp4 = await getCachedAssetUri(cacheMp4)
    if (cachedMp4) {
      logger.debug('📦 [assetResolver] cache hit:', cacheMp4)
      if (onResolved) onResolved(cachedMp4)
      return cachedMp4
    }
  }

  const primaryMp4 = remoteMp4 || mp4Candidates[0] || null

  if (primaryMp4 && onResolved) onResolved(primaryMp4)

  if (primaryMp4 && cacheMp4) {
    enqueueDownload(primaryMp4, cacheMp4)
      .then((uri) => {
        if (uri && onResolved) onResolved(uri)
      })
      .catch(() => {})
  }

  return fallbackUrl
}

export async function preloadExerciseMedia(exercises = [], options = {}) {
  const size = options.size || 360
  const limit = Number.isFinite(options.limit) ? options.limit : 12
  const list = Array.isArray(exercises) ? exercises.slice(0, limit) : []

  const tasks = list.map(async (exercise) => {
    const remoteUrl = buildExerciseMediaUrl(exercise, size, 'mp4')
    const cacheKey = buildExerciseCacheKey(exercise, size, 'mp4')
    if (!remoteUrl || !cacheKey) return null

    const cached = await getCachedAssetUri(cacheKey)
    if (cached) return cached

    return enqueueDownload(remoteUrl, cacheKey)
  })

  await Promise.all(tasks)
}
