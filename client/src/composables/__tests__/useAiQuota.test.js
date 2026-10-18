import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'

const state = vi.hoisted(() => ({ store: null }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: { value: 'de' } }) }))
vi.mock('@/stores/subscriptionStore', () => ({ useSubscriptionStore: () => state.store }))

import { useAiQuota } from '../useAiQuota'

function quotaFor(count, isPremium = false) {
  state.store = reactive({
    isPremium,
    usage: { aiMonthlyLimit: 60 },
    quickGenerationsUsedThisMonth: count,
    quickGeneratorResetDate: new Date(Date.UTC(2026, 10, 1)),
    checkSubscription: vi.fn().mockResolvedValue(null)
  })
  return useAiQuota({ refresh: false })
}

describe('useAiQuota', () => {
  it('zeigt verbleibende Anfragen und Stufe ok', () => {
    const q = quotaFor(23)
    expect(q.isFree.value).toBe(true)
    expect(q.remaining.value).toBe(37)
    expect(q.level.value).toBe('ok')
    expect(q.resetDateLabel.value).toBe('1. November')
  })
  it('warnt ab 10 übrig und sperrt bei 0', () => {
    expect(quotaFor(50).level.value).toBe('low')
    expect(quotaFor(49).level.value).toBe('ok')
    const empty = quotaFor(75)
    expect(empty.remaining.value).toBe(0)
    expect(empty.level.value).toBe('empty')
  })
  it('Pro-Nutzer sehen keine Kontingent-Anzeige', () => {
    expect(quotaFor(10, true).isFree.value).toBe(false)
  })
})
