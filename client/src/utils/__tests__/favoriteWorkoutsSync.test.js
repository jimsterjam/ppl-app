/**
 * Tests für den Server-Sync-/Restore-Baustein der Favoriten-Workouts
 * (reconcileFavoritesWithServer + Fire-and-Forget-Sync bei save/update/rename/delete).
 *
 * Hintergrund: Favoriten liefen bisher ausschließlich lokal (localStorage) - bei
 * Geräteverlust, Neuinstallation oder einem UID-Wechsel (z.B. Apple-Sign-In mit anderer
 * Firebase-UID als das ursprüngliche Konto) gingen sie unwiederbringlich verloren.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

const mockFetchRemote = vi.fn()
const mockPushRemote = vi.fn()
const mockDeleteRemote = vi.fn()

vi.mock('@/api/favoriteWorkouts', () => ({
  fetchFavoriteWorkoutsRemote: (...args) => mockFetchRemote(...args),
  pushFavoriteWorkoutRemote: (...args) => mockPushRemote(...args),
  deleteFavoriteWorkoutRemote: (...args) => mockDeleteRemote(...args)
}))

const mockGetIdToken = vi.fn()
vi.mock('../firebaseAuth', () => ({
  useFirebaseAuth: () => ({ getIdToken: (...args) => mockGetIdToken(...args) })
}))

import {
  saveFavoriteWorkout,
  getFavoritesByType,
  reconcileFavoritesWithServer,
  getFavoriteLimitPerType
} from '../workoutFavorites.js'

// ── localStorage Mock ──────────────────────────────────────────────────────
const lsStore = {}
const localStorageMock = {
  getItem: (key) => lsStore[key] ?? null,
  setItem: (key, value) => { lsStore[key] = String(value) },
  removeItem: (key) => { delete lsStore[key] },
  clear: () => { for (const k of Object.keys(lsStore)) delete lsStore[k] }
}
vi.stubGlobal('localStorage', localStorageMock)

const USER_ID = 'apple-uid-123'
const WORKOUT = { name: 'Push Day', type: 'push', exercises: [{ _id: 'ex1', name: 'Bankdrücken', sets: 3, reps: 10, weight: 80 }] }

beforeEach(() => {
  localStorageMock.clear()
  mockFetchRemote.mockReset()
  mockPushRemote.mockReset()
  mockDeleteRemote.mockReset()
  mockGetIdToken.mockReset()
})

describe('reconcileFavoritesWithServer', () => {
  it('ohne userId/token -> tut nichts, ruft Server nicht auf', async () => {
    const result = await reconcileFavoritesWithServer(null, null)
    expect(result).toEqual({ pulled: 0, pushed: 0 })
    expect(mockFetchRemote).not.toHaveBeenCalled()
  })

  it('Server-Favorit, der lokal fehlt, wird ergänzt (Restore-Fall)', async () => {
    mockFetchRemote.mockResolvedValue([
      {
        clientId: 'fav_push_remote_1',
        type: 'push',
        name: 'Vom Server',
        workout: WORKOUT,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ])

    const result = await reconcileFavoritesWithServer(USER_ID, 'fake-token')

    expect(result.pulled).toBe(1)
    const favorites = getFavoritesByType(USER_ID, 'push')
    expect(favorites).toHaveLength(1)
    expect(favorites[0].name).toBe('Vom Server')
    expect(favorites[0].id).toBe('fav_push_remote_1')
  })

  it('lokaler Favorit, den der Server noch nicht kennt, wird nachgeliefert', async () => {
    mockFetchRemote.mockResolvedValue([])
    mockPushRemote.mockResolvedValue({ ok: true })

    const saveResult = saveFavoriteWorkout({ userId: USER_ID, type: 'push', name: 'Nur lokal', workout: WORKOUT })
    expect(saveResult.success).toBe(true)

    const result = await reconcileFavoritesWithServer(USER_ID, 'fake-token')

    expect(result.pushed).toBe(1)
    expect(mockPushRemote).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: saveResult.favorite.id, type: 'push', name: 'Nur lokal' }),
      'fake-token'
    )
  })

  it('Konflikt (gleiche clientId): neuerer Stand gewinnt', async () => {
    const saveResult = saveFavoriteWorkout({ userId: USER_ID, type: 'push', name: 'Alter Name', workout: WORKOUT })
    const clientId = saveResult.favorite.id

    // Server hat eine NEUERE Version desselben Favoriten (z.B. von einem anderen Gerät)
    mockFetchRemote.mockResolvedValue([
      {
        clientId,
        type: 'push',
        name: 'Neuerer Name vom Server',
        workout: WORKOUT,
        createdAt: saveResult.favorite.createdAt,
        updatedAt: new Date(Date.now() + 60_000).toISOString() // 1 Minute in der Zukunft
      }
    ])

    const result = await reconcileFavoritesWithServer(USER_ID, 'fake-token')

    expect(result.pulled).toBe(1)
    const favorites = getFavoritesByType(USER_ID, 'push')
    expect(favorites).toHaveLength(1)
    expect(favorites[0].name).toBe('Neuerer Name vom Server')
    // Da die Server-Version übernommen wurde, ist sie jetzt "bekannt" -> kein Push nötig
    expect(mockPushRemote).not.toHaveBeenCalled()
  })

  it('Konflikt: lokaler Stand ist neuer -> bleibt unverändert, kein Downgrade', async () => {
    const saveResult = saveFavoriteWorkout({ userId: USER_ID, type: 'push', name: 'Aktueller lokaler Name', workout: WORKOUT })
    const clientId = saveResult.favorite.id

    mockFetchRemote.mockResolvedValue([
      {
        clientId,
        type: 'push',
        name: 'Veralteter Server-Name',
        workout: WORKOUT,
        createdAt: saveResult.favorite.createdAt,
        updatedAt: new Date(Date.now() - 60_000).toISOString() // 1 Minute in der Vergangenheit
      }
    ])

    await reconcileFavoritesWithServer(USER_ID, 'fake-token')

    const favorites = getFavoritesByType(USER_ID, 'push')
    expect(favorites[0].name).toBe('Aktueller lokaler Name')
  })

  it('Merge respektiert weiterhin das Pro-Typ-Limit', async () => {
    const limit = getFavoriteLimitPerType()
    // Lokal bereits am Limit
    for (let i = 0; i < limit; i += 1) {
      saveFavoriteWorkout({ userId: USER_ID, type: 'legs', name: `Lokal ${i}`, workout: WORKOUT })
    }

    // Server bringt zusätzlich noch mehr Favoriten desselben Typs mit
    mockFetchRemote.mockResolvedValue([
      {
        clientId: 'fav_legs_extra',
        type: 'legs',
        name: 'Extra vom Server',
        workout: WORKOUT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date(Date.now() + 1000).toISOString()
      }
    ])

    await reconcileFavoritesWithServer(USER_ID, 'fake-token')

    const favorites = getFavoritesByType(USER_ID, 'legs')
    expect(favorites.length).toBeLessThanOrEqual(limit)
  })
})

describe('Fire-and-forget Sync bei saveFavoriteWorkout', () => {
  it('speichert lokal sofort und synchronisiert', async () => {
    mockGetIdToken.mockResolvedValue('fake-token')
    mockPushRemote.mockResolvedValue({ ok: true })

    const result = saveFavoriteWorkout({ userId: USER_ID, type: 'pull', name: 'Pull Favorit', workout: WORKOUT })
    expect(result.success).toBe(true)

    // Lokal ist der Favorit sofort da (synchron)
    expect(getFavoritesByType(USER_ID, 'pull')).toHaveLength(1)

    // Hintergrund-Sync läuft asynchron - kurz warten, bis das Promise-Microtask durchläuft
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockPushRemote).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pull', name: 'Pull Favorit' }),
      'fake-token'
    )
  })

  it('kein Token verfügbar (z.B. offline) -> lokaler Speichervorgang schlägt trotzdem nicht fehl', async () => {
    mockGetIdToken.mockResolvedValue(null)

    const result = saveFavoriteWorkout({ userId: USER_ID, type: 'fullbody', name: 'Offline Favorit', workout: WORKOUT })
    expect(result.success).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockPushRemote).not.toHaveBeenCalled()
  })
})
