import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  post: vi.fn(), get: vi.fn(), online: vi.fn(),
  local: [], saved: [], deleted: [], cached: []
}))
vi.mock('../http', () => ({ createResourceApi: () => ({ post: mocks.post, get: mocks.get, put: vi.fn(), delete: vi.fn() }) }))
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } }))
vi.mock('@/utils/offlineStorage', () => ({
  isOnline: mocks.online,
  getAllCustomExercisesOffline: async () => mocks.local,
  saveCustomExerciseOffline: async (ex) => { mocks.saved.push(ex) },
  deleteCustomExerciseOffline: async (id) => { mocks.deleted.push(id) },
  cacheCustomExercises: async (list) => { mocks.cached.push(...list) },
  generateCustomExerciseId: () => 'custom_x'
}))

import { syncCustomExercisesWithServer } from '../customExercises.js'

// Fund Paul 11.10.: Eigene Übungen waren nach einer Neuinstallation weg - die Server-Liste wurde nie geladen.
describe('Eigene Übungen: Abgleich mit dem Server', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((v) => { if (typeof v?.mockReset === 'function') v.mockReset() })
    mocks.local.length = 0; mocks.saved.length = 0; mocks.deleted.length = 0; mocks.cached.length = 0
    mocks.online.mockReturnValue(true)
  })

  it('Neuinstallation: lädt die Server-Übungen und speichert sie lokal', async () => {
    mocks.get.mockResolvedValue({ data: [{ _id: 'a1', userId: 'u1', name: 'Zottman Curl' }, { _id: 'a2', userId: 'u1', name: 'Reverse Fly' }] })
    const result = await syncCustomExercisesWithServer('tok', 'u1')
    expect(result).toEqual({ uploaded: 0, downloaded: 2 })
    expect(mocks.cached.map((e) => e.name)).toEqual(['Zottman Curl', 'Reverse Fly'])
    expect(mocks.get.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  it('liefert nur offline angelegte Übungen (custom_-ID) nach und ersetzt sie durch die Server-Version', async () => {
    mocks.local.push({ _id: 'custom_1', userId: 'u1', name: 'Mein Curl', muscleGroup: 'biceps' }, { _id: 'a1', userId: 'u1', name: 'Schon synchron' })
    mocks.post.mockResolvedValue({ data: { _id: 'srv1', userId: 'u1', name: 'Mein Curl' } })
    mocks.get.mockResolvedValue({ data: [] })
    const result = await syncCustomExercisesWithServer('tok', 'u1')
    expect(result.uploaded).toBe(1)
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post.mock.calls[0][1].name).toBe('Mein Curl')
    expect(mocks.saved[0]._id).toBe('srv1')
    expect(mocks.deleted).toEqual(['custom_1'])
  })

  it('Fehler beim Nachliefern behält die lokale Übung und stoppt den Abgleich nicht', async () => {
    mocks.local.push({ _id: 'custom_1', userId: 'u1', name: 'Mein Curl' })
    mocks.post.mockRejectedValue(new Error('offline'))
    mocks.get.mockResolvedValue({ data: [{ _id: 'a1', userId: 'u1', name: 'X' }] })
    const result = await syncCustomExercisesWithServer('tok', 'u1')
    expect(result).toEqual({ uploaded: 0, downloaded: 1 })
    expect(mocks.deleted).toEqual([])
  })

  it('ohne Token, ohne Nutzer oder offline: tut nichts', async () => {
    expect(await syncCustomExercisesWithServer(null, 'u1')).toEqual({ uploaded: 0, downloaded: 0 })
    expect(await syncCustomExercisesWithServer('tok', '')).toEqual({ uploaded: 0, downloaded: 0 })
    mocks.online.mockReturnValue(false)
    expect(await syncCustomExercisesWithServer('tok', 'u1')).toEqual({ uploaded: 0, downloaded: 0 })
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
