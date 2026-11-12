// Plan-Überschreibung im Client (nur für die Entwicklung): VITE_FORCE_PLAN erzwingt einen Plan, VITE_ENABLE_DEV_PLAN_OVERRIDE
// erlaubt die Entwickler-Überschreibung. Beides wird beim BAUEN in die App eingebrannt. Ein vergessener Eintrag in der lokalen
// .env ließ jeden Build die App als "Pro" zeigen, egal was der Server meldet (Karte "KI-Kontingent" fehlte, Monatsberichte luden
// endlos; Absprache Jimmy 05.11.). In Produktions-Builds (import.meta.env.PROD) werden beide deshalb IGNORIERT.

const PLANS = ['free', 'pro', 'elite']

/**
 * @param {Record<string, any>} env - import.meta.env
 * @returns {{ forcedPlan: string|null, devOverrideEnabled: boolean, ignoredInProduction: boolean }}
 */
export function readPlanOverrideConfig(env = {}) {
  const production = env.PROD === true
  const forced = String(env.VITE_FORCE_PLAN || '').trim().toLowerCase()
  const forcedValid = PLANS.includes(forced)
  const devEnabled = String(env.VITE_ENABLE_DEV_PLAN_OVERRIDE || '0').trim() === '1'
  return {
    forcedPlan: !production && forcedValid ? forced : null,
    devOverrideEnabled: !production && devEnabled,
    ignoredInProduction: production && (forcedValid || devEnabled)
  }
}
