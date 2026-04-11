/**
 * Draft-Tombstone-Verwaltung für Offline-Drafts.
 * Verhindert, dass gelöschte Drafts aus dem Cache wieder auftauchen.
 */

import { logger } from './logger'

export const DRAFT_TOMBSTONES_KEY = 'deleted_draft_ids_v1'
export const DRAFT_TOMBSTONE_TTL_MS = 6 * 60 * 60 * 1000

export function isDraftLike(workout) {
  const id = String(workout?._id || '')
  return workout?._isDraft === true || workout?.isDraft === true || id === 'draft' || id.startsWith('draft-')
}

export function readDraftTombstones() {
  try {
    const raw = localStorage.getItem(DRAFT_TOMBSTONES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeDraftTombstones(map) {
  try {
    localStorage.setItem(DRAFT_TOMBSTONES_KEY, JSON.stringify(map || {}))
  } catch {}
}

export function markDraftsDeleted(ids = []) {
  const valid = [...new Set((ids || []).map(v => String(v || '').trim()).filter(Boolean))]
  if (!valid.length) return
  const next = readDraftTombstones()
  const now = Date.now()
  valid.forEach((id) => {
    next[id] = now
  })
  writeDraftTombstones(next)
}

export function isDraftDeleted(id) {
  if (!id) return false
  const map = readDraftTombstones()
  const entry = map[String(id)]
  if (!entry) return false
  const timestamp = Number(typeof entry === 'object' ? (entry?.timestamp || entry?.deletedAt || 0) : entry)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return (Date.now() - timestamp) <= DRAFT_TOMBSTONE_TTL_MS
  }
  return Boolean(entry)
}

export function filterOutDeletedDrafts(list = [], source = 'unknown') {
  const items = Array.isArray(list) ? list : []
  const removed = items.filter(w => isDraftLike(w) && isDraftDeleted(w?._id))
  if (removed.length) {
    logger.debug('🛡️ [DraftIntegrity] Blocked tombstoned drafts from source:', source, removed.map(w => String(w?._id || '')))
  }
  return items.filter(w => !(isDraftLike(w) && isDraftDeleted(w?._id)))
}
