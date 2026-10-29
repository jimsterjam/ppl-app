import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/api/subscription', () => ({
  fetchSubscriptionStatus: vi.fn().mockResolvedValue(null),
  upgradeSubscriptionRequest: vi.fn().mockResolvedValue(null)
}))
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue(null) }))

import { useSubscriptionStore } from '../subscriptionStore.js'

// Absprache Paul 29.10.: Kostenlos = Tracking ohne Limits. Vorher sperrte der Workout-Builder im Gratis-Tarif das
// vierte Workout einer Woche (und 6 Übungen je Workout waren vorgesehen) - das passt nicht zu Plänen mit 6 Tagen.
beforeEach(() => {
  const data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  })
  setActivePinia(createPinia())
})

describe('Gratis-Tarif: keine Grenzen für Workouts und Übungen', () => {
  it('es gibt keine Workout-/Übungs-Sperre mehr im Store', () => {
    const store = useSubscriptionStore()
    expect(store.canCreateWorkout).toBeUndefined()
    expect(store.canAddExercise).toBeUndefined()
    expect(store.workoutsRemaining).toBeUndefined()
  })

  it('viele Workouts diese Woche ändern am KI-Kontingent nichts', () => {
    const store = useSubscriptionStore()
    store.usage.workoutsThisWeek = 20
    store.usage.aiMonthlyLimit = 30
    store.usage.aiMonthlyCount = 0
    expect(store.canUseQuickGenerator).toBe(true)
  })
})
