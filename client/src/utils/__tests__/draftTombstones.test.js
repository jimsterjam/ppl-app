import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock logger bevor die Datei importiert wird
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

import {
  DRAFT_TOMBSTONE_TTL_MS,
  isDraftLike,
  markDraftsDeleted,
  isDraftDeleted,
  filterOutDeletedDrafts,
  readDraftTombstones,
  writeDraftTombstones
} from '../draftTombstones.js'

// Einfacher localStorage-Mock für jsdom-losen Umgebung
const store = {}
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value) },
  removeItem: (key) => { delete store[key] },
  clear: () => { for (const k of Object.keys(store)) delete store[k] }
}
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  localStorageMock.clear()
})

// ------------------------------------
// isDraftLike
// ------------------------------------
describe('isDraftLike', () => {
  it('erkennt _isDraft-Flag', () => {
    expect(isDraftLike({ _id: 'abc', _isDraft: true })).toBe(true)
  })

  it('erkennt isDraft-Flag', () => {
    expect(isDraftLike({ _id: 'abc', isDraft: true })).toBe(true)
  })

  it('erkennt ID "draft"', () => {
    expect(isDraftLike({ _id: 'draft' })).toBe(true)
  })

  it('erkennt draft-Präfix in ID', () => {
    expect(isDraftLike({ _id: 'draft-12345' })).toBe(true)
  })

  it('gibt false für normales Workout zurück', () => {
    expect(isDraftLike({ _id: 'abc123', completed: true })).toBe(false)
  })

  it('gibt false für undefined zurück', () => {
    expect(isDraftLike(undefined)).toBe(false)
  })
})

// ------------------------------------
// markDraftsDeleted / isDraftDeleted
// ------------------------------------
describe('markDraftsDeleted + isDraftDeleted', () => {
  it('markiert IDs als gelöscht und stellt sie fest', () => {
    markDraftsDeleted(['draft-1', 'draft-2'])
    expect(isDraftDeleted('draft-1')).toBe(true)
    expect(isDraftDeleted('draft-2')).toBe(true)
  })

  it('gibt false zurück für nicht-markierte ID', () => {
    markDraftsDeleted(['draft-1'])
    expect(isDraftDeleted('draft-99')).toBe(false)
  })

  it('gibt false zurück wenn TTL abgelaufen', () => {
    const now = Date.now()
    const expiredTs = now - DRAFT_TOMBSTONE_TTL_MS - 1000
    writeDraftTombstones({ 'draft-old': expiredTs })
    expect(isDraftDeleted('draft-old')).toBe(false)
  })

  it('gibt true zurück innerhalb der TTL-Frist', () => {
    const recentTs = Date.now() - 1000
    writeDraftTombstones({ 'draft-recent': recentTs })
    expect(isDraftDeleted('draft-recent')).toBe(true)
  })

  it('ignoriert leere oder ungültige IDs', () => {
    markDraftsDeleted([null, '', undefined])
    const map = readDraftTombstones()
    expect(Object.keys(map)).toHaveLength(0)
  })

  it('gibt false zurück für null-ID', () => {
    expect(isDraftDeleted(null)).toBe(false)
    expect(isDraftDeleted(undefined)).toBe(false)
  })
})

// ------------------------------------
// filterOutDeletedDrafts
// ------------------------------------
describe('filterOutDeletedDrafts', () => {
  it('entfernt tombstoned Drafts aus der Liste', () => {
    markDraftsDeleted(['draft-1'])
    const list = [
      { _id: 'normal-id', isDraft: false },
      { _id: 'draft-1', _isDraft: true }
    ]
    const result = filterOutDeletedDrafts(list)
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('normal-id')
  })

  it('behält nicht-tombstoned Drafts', () => {
    const list = [{ _id: 'draft-new', _isDraft: true }]
    const result = filterOutDeletedDrafts(list)
    expect(result).toHaveLength(1)
  })

  it('funktioniert mit einem leeren Array', () => {
    expect(filterOutDeletedDrafts([])).toEqual([])
  })

  it('funktioniert mit null/undefined', () => {
    expect(filterOutDeletedDrafts(null)).toEqual([])
  })

  it('behält normale (nicht-draft) Einträge unverändert', () => {
    const list = [{ _id: 'abc', completed: true }]
    markDraftsDeleted(['abc']) // tombstone auf non-draft ID – soll nicht greifen
    const result = filterOutDeletedDrafts(list)
    expect(result).toHaveLength(1) // isDraftLike gibt false zurück => nicht gefiltert
  })
})
