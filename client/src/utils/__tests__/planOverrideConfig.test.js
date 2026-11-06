import { describe, it, expect } from 'vitest'
import { readPlanOverrideConfig } from '../planOverrideConfig.js'

describe('Plan-Überschreibung im Client: nur in Entwicklungs-Builds', () => {
  it('Entwicklung: VITE_FORCE_PLAN und Entwickler-Überschreibung wirken', () => {
    expect(readPlanOverrideConfig({ PROD: false, VITE_FORCE_PLAN: 'Pro', VITE_ENABLE_DEV_PLAN_OVERRIDE: '1' }))
      .toEqual({ forcedPlan: 'pro', devOverrideEnabled: true, ignoredInProduction: false })
  })

  it('Produktions-Build: beides wird ignoriert und gemeldet', () => {
    expect(readPlanOverrideConfig({ PROD: true, VITE_FORCE_PLAN: 'pro', VITE_ENABLE_DEV_PLAN_OVERRIDE: '1' }))
      .toEqual({ forcedPlan: null, devOverrideEnabled: false, ignoredInProduction: true })
    expect(readPlanOverrideConfig({ PROD: true, VITE_FORCE_PLAN: 'elite' }).forcedPlan).toBeNull()
  })

  it('nichts gesetzt oder ungültig: kein erzwungener Plan, keine Meldung', () => {
    for (const env of [{}, { PROD: true }, { PROD: false, VITE_FORCE_PLAN: '' }, { PROD: false, VITE_FORCE_PLAN: 'gold' }, { PROD: true, VITE_FORCE_PLAN: 'gold' }]) {
      const config = readPlanOverrideConfig(env)
      expect(config.forcedPlan).toBeNull()
      expect(config.ignoredInProduction).toBe(false)
    }
    expect(readPlanOverrideConfig({ PROD: false, VITE_ENABLE_DEV_PLAN_OVERRIDE: '0' }).devOverrideEnabled).toBe(false)
  })
})
