import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'

const CACHE_ROOT = 'exercise-media-v2'
const CACHE_INDEX_KEY = 'exercise_media_cache_index_v2'
const DEFAULT_MAX_BYTES = 300 * 1024 * 1024
const DEFAULT_MAX_ITEMS = 1000

let cacheLimits = {
  maxBytes: DEFAULT_MAX_BYTES,
  maxItems: DEFAULT_MAX_ITEMS
}

export function setCacheLimits(limits = {}) {
  cacheLimits = {
    maxBytes: Number(limits.maxBytes) || DEFAULT_MAX_BYTES,
    maxItems: Number(limits.maxItems) || DEFAULT_MAX_ITEMS
  }
}

function toCachePath(key) {
  if (!key) return null
  const trimmed = String(key).replace(/^\/+/, '')
  return `${CACHE_ROOT}/${trimmed}`
}

function toPlayableUri(uri) {
  if (!uri) return null
  const value = String(uri)
  if (value.startsWith('file://') || value.startsWith('content://')) {
    try {
      return Capacitor.convertFileSrc(value)
    } catch {
      return value
    }
  }
  return value
}

function readIndex() {
  try {
    const raw = localStorage.getItem(CACHE_INDEX_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeIndex(index) {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index))
  } catch {}
}

function updateIndexEntry(cacheKey, sizeBytes, lastAccessed) {
  if (!cacheKey) return
  const index = readIndex()
  index[cacheKey] = {
    size: Number(sizeBytes) || 0,
    lastAccessed: Number(lastAccessed) || Date.now()
  }
  writeIndex(index)
}

async function deleteCachedFile(cacheKey) {
  const path = toCachePath(cacheKey)
  if (!path) return
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Cache })
  } catch {}
}

async function enforceCacheLimits() {
  const index = readIndex()
  const entries = Object.entries(index).map(([key, meta]) => ({
    key,
    size: Number(meta?.size) || 0,
    lastAccessed: Number(meta?.lastAccessed) || 0
  }))

  if (!entries.length) return

  let totalBytes = entries.reduce((sum, item) => sum + item.size, 0)
  const overBytes = totalBytes > cacheLimits.maxBytes
  const overItems = entries.length > cacheLimits.maxItems
  if (!overBytes && !overItems) return

  entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

  let removed = 0
  let idx = 0
  while ((totalBytes > cacheLimits.maxBytes || entries.length - idx > cacheLimits.maxItems) && idx < entries.length) {
    const entry = entries[idx]
    await deleteCachedFile(entry.key)
    totalBytes -= entry.size
    delete index[entry.key]
    removed += 1
    idx += 1
  }

  writeIndex(index)
  logger.debug('📦 [assetCache] cleanup removed:', removed, 'remaining:', entries.length - removed)
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function getCachedAssetUri(cacheKey) {
  const path = toCachePath(cacheKey)
  if (!path) return null
  const index = readIndex()
  if (!index[cacheKey]) return null
  try {
    const uri = await Filesystem.getUri({ path, directory: Directory.Cache })
    const knownSize = Number(index?.[cacheKey]?.size) || 0
    updateIndexEntry(cacheKey, knownSize, Date.now())
    return toPlayableUri(uri?.uri || null)
  } catch {
    // Stale index entry: file no longer exists in cache.
    if (index[cacheKey]) {
      delete index[cacheKey]
      writeIndex(index)
    }
    return null
  }
}

export async function cacheAssetFromUrl(url, cacheKey) {
  const path = toCachePath(cacheKey)
  if (!url || !path) return null

  const response = await fetch(url)
  if (!response.ok) return null

  const blob = await response.blob()
  const base64 = await blobToBase64(blob)
  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true
  })

  updateIndexEntry(cacheKey, blob?.size || 0, Date.now())
  await enforceCacheLimits()

  const uri = await Filesystem.getUri({ path, directory: Directory.Cache })
  logger.debug('📦 [assetCache] cached:', cacheKey, 'size:', blob?.size || 0)
  return toPlayableUri(uri?.uri || null)
}
