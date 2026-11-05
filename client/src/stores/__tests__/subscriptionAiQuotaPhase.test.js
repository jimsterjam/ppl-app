import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/api/subscription', () => ({
  fetchSubscriptionStatus: vi.fn().mockResolvedValue(null),
  upgradeSubscriptionRequest: vi.fn().mockResolvedValue(null)
}))
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue(null) }))

import { useSubscriptionStore } from '../subscriptionStore.js'

// KI-Kontingent: Willkommenskontingent in den ersten Tagen, danach Monatskontingent (server/utils/aiQuota.js).
beforeEach(() => {
  const data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  })
  setActivePinia(createPinia())
})

describe('KI-Kontingent: Phase und Datum vom Server', () => {
  it('Willkommensphase: Datum und regulärer Monatswert kommen vom Server', () => {
    const store = useSubscriptionStore()
    store.applyAiUsageSnapshot({
      phase: 'welcome', monthlyCount: 4, monthlyLimit: 30, monthlyRemaining: 26,
      resetsAt: '2026-12-05T12:00:00.000Z', regularMonthlyLimit: 10
    })
    expect(store.usage.aiPhase).toBe('welcome')
    expect(store.usage.aiRegularLimit).toBe(10)
    expect(store.quickGeneratorResetDate.toISOString()).toBe('2026-12-05T12:00:00.000Z')
    expect(store.quickGenerationsUsedThisMonth).toBe(4)
  })

  it('Monatsphase: Datum kommt weiter vom Server, unbekannte Phase gilt als monatlich', () => {
    const store = useSubscriptionStore()
    store.applyAiUsageSnapshot({ phase: 'unsinn', monthlyCount: 2, monthlyLimit: 10, resetsAt: '2026-12-01T00:00:00.000Z', regularMonthlyLimit: 10 })
    expect(store.usage.aiPhase).toBe('monthly')
    expect(store.quickGeneratorResetDate.toISOString()).toBe('2026-12-01T00:00:00.000Z')
  })

  it('ohne Serverdatum: Beginn des nächsten Monats wie bisher', () => {
    const store = useSubscriptionStore()
    store.applyAiUsageSnapshot({ monthlyCount: 0, monthlyLimit: 10, monthWindowStart: '2026-11-01T00:00:00.000Z' })
    expect(store.quickGeneratorResetDate.toISOString()).toBe('2026-12-01T00:00:00.000Z')
  })
})
