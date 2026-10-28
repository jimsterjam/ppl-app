import { describe, it, expect, beforeEach, vi } from 'vitest'

const api = vi.hoisted(() => ({
  fetchTrainingPlansRemote: vi.fn(),
  pushTrainingPlanRemote: vi.fn(),
  deleteTrainingPlanRemote: vi.fn()
}))
vi.mock('@/api/trainingPlans', () => api)
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => 'token' }) }))

import {
  activateTrainingPlan,
  createTrainingPlan,
  deleteTrainingPlan,
  getActiveTrainingPlan,
  getTrainingPlans,
  reconcileTrainingPlansWithServer,
  updateTrainingPlan
} from '../trainingPlanStorage.js'
import { completeDay, getActiveDay } from '../trainingPlan.js'

const days = (n = 3) => Array.from({ length: n }, (_, i) => ({ favoriteId: `fav_${i}`, label: `Tag ${i + 1}` }))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('trainingPlanStorage', () => {
  beforeEach(() => {
    const data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k)
    })
    Object.values(api).forEach((fn) => fn.mockReset())
    api.fetchTrainingPlansRemote.mockResolvedValue([])
    api.pushTrainingPlanRemote.mockResolvedValue({})
    api.deleteTrainingPlanRemote.mockResolvedValue(true)
  })

  it('der erste Plan wird automatisch aktiv und zum Server gespiegelt', async () => {
    const result = createTrainingPlan({ userId: 'u1', name: 'PPL 3x', days: days() })
    expect(result.ok).toBe(true)
    expect(result.plan.active).toBe(true)
    expect(getActiveTrainingPlan('u1').name).toBe('PPL 3x')
    await flush()
    expect(api.pushTrainingPlanRemote).toHaveBeenCalledTimes(1)
    expect(api.pushTrainingPlanRemote.mock.calls[0][0].name).toBe('PPL 3x')
  })

  it('bis zu 3 Pläne; der vierte wird abgelehnt; ungültige Pläne ebenfalls', () => {
    for (let i = 0; i < 3; i += 1) expect(createTrainingPlan({ userId: 'u1', name: `P${i}`, days: days() }).ok).toBe(true)
    expect(createTrainingPlan({ userId: 'u1', name: 'P4', days: days() })).toEqual({ ok: false, error: 'limit' })
    expect(createTrainingPlan({ userId: 'u2', name: '', days: days() })).toEqual({ ok: false, error: 'invalid' })
    expect(getTrainingPlans('u1')).toHaveLength(3)
  })

  it('Pläne gehören zum Nutzer: ein anderes Konto sieht sie nicht', () => {
    createTrainingPlan({ userId: 'u1', name: 'Meiner', days: days() })
    expect(getTrainingPlans('u2')).toEqual([])
    expect(getActiveTrainingPlan('u2')).toBeNull()
  })

  it('neuer Plan mit makeActive löst den bisherigen als aktiven ab; genau einer ist aktiv', () => {
    createTrainingPlan({ userId: 'u1', name: 'A', days: days() })
    createTrainingPlan({ userId: 'u1', name: 'B', days: days(), makeActive: true })
    const plans = getTrainingPlans('u1')
    expect(plans.filter((p) => p.active).map((p) => p.name)).toEqual(['B'])
  })

  it('updateTrainingPlan: Rotation nach dem Training wird gespeichert; null im Updater löscht den Plan', async () => {
    const { plan } = createTrainingPlan({ userId: 'u1', name: 'PPL', days: days() })
    const result = updateTrainingPlan({ userId: 'u1', planId: plan.id, updater: (p) => completeDay(p, getActiveDay(p).id) })
    expect(result.ok).toBe(true)
    expect(getActiveTrainingPlan('u1').activeDayIndex).toBe(1)
    await flush()
    expect(api.pushTrainingPlanRemote).toHaveBeenCalledTimes(2)
    const removed = updateTrainingPlan({ userId: 'u1', planId: plan.id, updater: () => null })
    expect(removed.ok).toBe(true)
    expect(getTrainingPlans('u1')).toEqual([])
    expect(updateTrainingPlan({ userId: 'u1', planId: 'x', updater: (p) => p })).toEqual({ ok: false, error: 'notFound' })
  })

  it('Plan löschen: Server wird informiert; war er aktiv, wird ein anderer aktiv', async () => {
    const a = createTrainingPlan({ userId: 'u1', name: 'A', days: days() }).plan
    createTrainingPlan({ userId: 'u1', name: 'B', days: days() })
    expect(deleteTrainingPlan({ userId: 'u1', planId: a.id }).ok).toBe(true)
    await flush()
    expect(api.deleteTrainingPlanRemote).toHaveBeenCalledWith(a.id, 'token')
    expect(getActiveTrainingPlan('u1').name).toBe('B')
    expect(deleteTrainingPlan({ userId: 'u1', planId: 'x' })).toEqual({ ok: false, error: 'notFound' })
  })

  it('activateTrainingPlan wechselt den aktiven Plan', () => {
    createTrainingPlan({ userId: 'u1', name: 'A', days: days() })
    const b = createTrainingPlan({ userId: 'u1', name: 'B', days: days() }).plan
    expect(activateTrainingPlan({ userId: 'u1', planId: b.id }).plan.name).toBe('B')
    expect(getActiveTrainingPlan('u1').name).toBe('B')
    expect(activateTrainingPlan({ userId: 'u1', planId: 'x' })).toEqual({ ok: false, error: 'notFound' })
  })

  it('kaputte Speicherdaten führen nie zu einem Fehler', () => {
    localStorage.setItem('fbe_training_plans_v1', '{kaputt')
    expect(getTrainingPlans('u1')).toEqual([])
    localStorage.setItem('fbe_training_plans_v1', JSON.stringify({ u1: [null, { name: 'ohne Tage' }, 'x'] }))
    expect(getTrainingPlans('u1')).toEqual([])
  })

  it('reconcile: Server-Pläne werden lokal ergänzt (Restore), fehlende Pläne zum Server nachgeliefert', async () => {
    const local = createTrainingPlan({ userId: 'u1', name: 'Lokal', days: days() }).plan
    await flush()
    api.pushTrainingPlanRemote.mockClear()
    api.fetchTrainingPlansRemote.mockResolvedValue([{
      clientId: 'plan_server', name: 'Vom Server', days: [{ id: 'd1', favoriteId: 'fav_x', label: 'A' }],
      activeDayIndex: 0, active: false, updatedAt: '2020-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z'
    }])
    const result = await reconcileTrainingPlansWithServer('u1', 'token')
    const names = getTrainingPlans('u1').map((p) => p.name).sort()
    expect(names).toEqual(['Lokal', 'Vom Server'])
    expect(result.pulled).toBeGreaterThanOrEqual(1)
    // der lokale Plan kannte der Server noch nicht -> wurde nachgeliefert
    expect(api.pushTrainingPlanRemote.mock.calls.map((c) => c[0].id)).toContain(local.id)
  })

  it('reconcile ohne Anmeldung tut nichts', async () => {
    expect(await reconcileTrainingPlansWithServer('', 'token')).toEqual({ pulled: 0, pushed: 0 })
    expect(await reconcileTrainingPlansWithServer('u1', '')).toEqual({ pulled: 0, pushed: 0 })
    expect(api.fetchTrainingPlansRemote).not.toHaveBeenCalled()
  })
})
