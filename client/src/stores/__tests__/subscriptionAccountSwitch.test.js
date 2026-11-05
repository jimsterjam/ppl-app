import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const fetchStatus = vi.hoisted(() => vi.fn())
vi.mock('@/api/subscription', () => ({ fetchSubscriptionStatus: fetchStatus, upgradeSubscriptionRequest: vi.fn() }))
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue('token') }))

import { useSubscriptionStore } from '../subscriptionStore.js'
import { useMonthlyReportStore } from '../monthlyReportStore.js'
import { resetUserBoundStores } from '../../utils/userSessionReset.js'

let data
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  })
  setActivePinia(createPinia())
  fetchStatus.mockReset()
})

describe('Kontowechsel in derselben Sitzung', () => {
  it('ein Pro-Konto vererbt Plan, Nutzung und Zwischenspeicher nicht an das nächste Konto', async () => {
    const store = useSubscriptionStore()
    store.subscription.plan = 'pro'
    store.usage.aiMonthlyCount = 7
    data.set('bro_split_subscription', JSON.stringify({ plan: 'pro' }))
    data.set('bro_split_usage', JSON.stringify({ aiMonthlyCount: 7 }))

    store.resetForUserChange()

    expect(store.subscription.plan).toBe('free')
    expect(store.isPremium).toBe(false)
    expect(store.usage.aiMonthlyCount).toBe(0)
    expect(data.has('bro_split_subscription')).toBe(false)
    expect(data.has('bro_split_usage')).toBe(false)
  })

  it('die Antwort einer noch laufenden Abfrage des alten Kontos wird verworfen', async () => {
    const store = useSubscriptionStore()
    let release
    fetchStatus.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const pending = store.checkSubscription(null, { force: true })
    await Promise.resolve()
    await Promise.resolve()
    store.resetForUserChange() // Kontowechsel, während die Abfrage des alten Kontos läuft
    release({ subscription: { plan: 'pro', status: 'active', planSource: 'db' }, usage: { ai: { monthlyCount: 9, monthlyLimit: null } } })
    await pending
    expect(store.subscription.plan).toBe('free')
    expect(store.usage.aiMonthlyCount).toBe(0)
  })

  it('reset über resetUserBoundStores leert auch die Monatsberichte', () => {
    const subscription = useSubscriptionStore()
    const monthlyReports = useMonthlyReportStore()
    monthlyReports.reports = [{ id: 'a1', periodStart: '2026-10-01', periodEnd: '2026-10-31' }]
    monthlyReports.details = { a1: { totals: {} } }
    monthlyReports.loaded = true
    resetUserBoundStores({ subscription, monthlyReports })
    expect(monthlyReports.reports).toEqual([])
    expect(monthlyReports.details).toEqual({})
    expect(monthlyReports.loaded).toBe(false)
    expect(monthlyReports.hasRealReport).toBe(false)
  })
})
