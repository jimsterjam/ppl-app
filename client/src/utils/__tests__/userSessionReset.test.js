import { describe, it, expect, vi } from 'vitest'
import { resetUserBoundStores } from '../userSessionReset.js'

describe('Kontowechsel: konto-gebundene Speicher leeren', () => {
  it('leert Monatsberichte und Plan/Nutzung', () => {
    const monthlyReports = { reset: vi.fn() }
    const subscription = { resetForUserChange: vi.fn() }
    resetUserBoundStores({ subscription, monthlyReports })
    expect(monthlyReports.reset).toHaveBeenCalledTimes(1)
    expect(subscription.resetForUserChange).toHaveBeenCalledTimes(1)
  })

  it('fehlende Speicher führen nicht zu Fehlern', () => {
    expect(() => resetUserBoundStores()).not.toThrow()
    expect(() => resetUserBoundStores({ subscription: {} })).not.toThrow()
  })
})
