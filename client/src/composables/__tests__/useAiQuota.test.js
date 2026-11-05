import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'

const state = vi.hoisted(() => ({ store: null }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: { value: 'de' } }) }))
vi.mock('@/stores/subscriptionStore', () => ({ useSubscriptionStore: () => state.store }))

import { useAiQuota } from '../useAiQuota'

function quotaFor(count, isPremium = false, usage = { aiMonthlyLimit: 60 }) {
  state.store = reactive({
    isPremium,
    usage,
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
  it('warnt bei einem Viertel übrig (mindestens 1) und sperrt bei 0', () => {
    expect(quotaFor(45).level.value).toBe('low') // 60er-Kontingent: 15 übrig
    expect(quotaFor(44).level.value).toBe('ok')
    const empty = quotaFor(60)
    expect(empty.remaining.value).toBe(0)
    expect(empty.level.value).toBe('empty')
  })
  it('Monatskontingent 10: knapp ab 3 übrig, nicht schon zu Beginn', () => {
    const limit10 = { aiMonthlyLimit: 10, aiPhase: 'monthly' }
    expect(quotaFor(0, false, limit10).level.value).toBe('ok')
    expect(quotaFor(7, false, limit10).level.value).toBe('low')
    expect(quotaFor(10, false, limit10).level.value).toBe('empty')
  })
  it('Willkommensphase wird erkannt, der reguläre Monatswert steht bereit', () => {
    const welcome = quotaFor(4, false, { aiMonthlyLimit: 30, aiPhase: 'welcome', aiRegularLimit: 10 })
    expect(welcome.isWelcome.value).toBe(true)
    expect(welcome.regularLimit.value).toBe(10)
    expect(welcome.remaining.value).toBe(26)
    const normal = quotaFor(4, false, { aiMonthlyLimit: 10, aiPhase: 'monthly', aiRegularLimit: 10 })
    expect(normal.isWelcome.value).toBe(false)
  })
  it('Pro-Nutzer sehen keine Kontingent-Anzeige', () => {
    expect(quotaFor(10, true).isFree.value).toBe(false)
  })
})
