// Welcher Plan gilt für einen Nutzer? Gleiche Regeln wie getEntitlements in routes/workouts.js und
// resolveEffectivePlan in routes/subscription.js: in Produktion immer der gespeicherte Plan, außerhalb
// von Produktion optional per SUBSCRIPTION_FORCE_PLAN überschrieben (alle oder Allowlist).

const PLANS = ['free', 'pro', 'elite'];

export function isPaidPlan(plan = 'free') {
  return plan === 'pro' || plan === 'elite';
}

function readEnv(env) {
  return {
    forcePlan: String(env.SUBSCRIPTION_FORCE_PLAN || '').trim().toLowerCase(),
    forceScope: String(env.SUBSCRIPTION_FORCE_SCOPE || 'all').trim().toLowerCase(),
    allowlist: String(env.SUBSCRIPTION_FORCE_ALLOWLIST || '').split(',').map((e) => e.trim()).filter(Boolean),
    isProduction: env.NODE_ENV === 'production'
  };
}

/**
 * @returns {{ plan: 'free'|'pro'|'elite', paid: boolean, planSource: 'db'|'override' }}
 */
export function resolvePlan(profilePlan = 'free', userId = '', env = process.env) {
  const stored = PLANS.includes(profilePlan) ? profilePlan : 'free';
  const { forcePlan, forceScope, allowlist, isProduction } = readEnv(env);
  const forced = PLANS.includes(forcePlan) ? forcePlan : '';
  const overrideApplies = !isProduction && forced &&
    (forceScope !== 'allowlist' || (userId && allowlist.includes(userId)));
  const plan = overrideApplies ? forced : stored;
  return { plan, paid: isPaidPlan(plan), planSource: overrideApplies ? 'override' : 'db' };
}
