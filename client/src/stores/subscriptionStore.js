/**
 * 💳 Subscription Store für Freemium/Premium Model
 * 
 * @description
 * Verwaltet Subscription-Status und Feature-Limits:
 * - Free Plan: 3 Workouts/Woche, 6 Übungen/Workout
 * - Pro Plan: Unlimited Workouts, AI Coach, Advanced Stats
 * - Elite Plan: Alles + Personal Coaching, Priority Support
 * 
 * @features
 * - Feature-Gating (hasFeature Checks)
 * - Usage Tracking (Workouts diese Woche/Monat)
 * - Upgrade-Flow mit Demo-Mode Fallback
 * - localStorage Persistence für Offline
 * 
 * @example
 * ```javascript
 * import { useSubscriptionStore } from '@/stores/subscriptionStore'
 * 
 * const subscription = useSubscriptionStore()
 * 
 * // Check if user can create workout
 * if (!subscription.canCreateWorkout) {
 *   // Show upgrade modal
 * }
 * 
 * // Upgrade to Pro
 * await subscription.upgradeSubscription('pro', paymentMethod)
 * ```
 * 
 * @version 1.0.0
 * @since 2025-11-06
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { getAuthToken } from '@/utils/authToken'
import { fetchSubscriptionStatus, upgradeSubscriptionRequest } from '@/api/subscription'
// Avoid calling useClerk/useAuth here: Pinia stores run outside a component setup
// context and calling useClerk() may throw. We will rely on getAuthToken()
// which falls back to window.Clerk or cached tokens.

const TRANSIENT_REQUEST_COOLDOWN_MS = 15000
let subscriptionCheckPromise = null
let subscriptionCooldownUntil = 0

function isTransientRequestError(error) {
  const status = Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0)
  const code = String(error?.code || error?.context?.originalError?.code || '')
  return status === 0 || [502, 503, 504].includes(status) || code === 'ECONNABORTED' || code === 'ERR_NETWORK'
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const DEV_PLAN_KEY = 'bro_split_dev_plan'
  const USAGE_KEY = 'bro_split_usage'
  const subscription = ref({
    plan: 'free',
    status: 'active',
    billingCycle: null,
    expiresAt: null,
    features: []
  })
  
  const usage = ref({
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    totalWorkouts: 0,
    lastWorkoutDate: null,
    aiWeeklyCount: 0,
    aiWeeklyLimit: 1,
    aiWeekWindowStart: null,
    quickGenerationsThisMonth: 0,
    quickGenerationMonth: null
  })
  
  const limits = ref({
    free: {
      maxWorkoutsPerWeek: 3,
      maxExercisesPerWorkout: 6,
      maxQuickGenerationsPerMonth: 3,
      maxFriends: 5,
      hasAICoach: false,
      hasAdvancedStats: false,
      hasWorkoutSharing: false,
      hasCustomTemplates: false
    },
    pro: {
      maxWorkoutsPerWeek: -1, // unlimited
      maxExercisesPerWorkout: -1,
      maxQuickGenerationsPerMonth: -1,
      maxFriends: 50,
      hasAICoach: true,
      hasAdvancedStats: true,
      hasWorkoutSharing: true,
      hasCustomTemplates: true
    },
    elite: {
      maxWorkoutsPerWeek: -1,
      maxExercisesPerWorkout: -1,
      maxQuickGenerationsPerMonth: -1,
      maxFriends: -1, // unlimited
      hasAICoach: true,
      hasAdvancedStats: true,
      hasWorkoutSharing: true,
      hasCustomTemplates: true,
      hasPersonalCoaching: true,
      hasPrioritySupport: true
    }
  })
  
  const devPlanOverride = ref(localStorage.getItem(DEV_PLAN_KEY))

  const getMonthKey = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const persistUsage = () => {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage.value))
    } catch {}
  }

  const ensureQuickGeneratorMonthWindow = () => {
    const monthKey = getMonthKey()
    if (usage.value.quickGenerationMonth !== monthKey) {
      usage.value.quickGenerationMonth = monthKey
      usage.value.quickGenerationsThisMonth = 0
      persistUsage()
    }
  }

  const buildPlanSnapshot = (planType) => {
    const validPlan = ['free', 'pro', 'elite'].includes(planType) ? planType : 'free'
    return {
      plan: validPlan,
      status: 'active',
      billingCycle: validPlan === 'free' ? null : 'monthly',
      expiresAt: validPlan === 'free' ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      features: []
    }
  }

  const applyPlan = (planType, { persist = true, reason = 'manual' } = {}) => {
    const snapshot = buildPlanSnapshot(planType)
    subscription.value = snapshot
    if (persist) {
      localStorage.setItem('bro_split_subscription', JSON.stringify(snapshot))
    }
    logger.debug(`📦 Subscription plan set to ${snapshot.plan} (${reason})`)
    return snapshot
  }

  // Subscription Status checken
  const checkSubscription = async (planOverride = null, options = {}) => {
    const force = options?.force === true

    try {
      const savedUsage = localStorage.getItem(USAGE_KEY)
      if (savedUsage) {
        usage.value = {
          ...usage.value,
          ...JSON.parse(savedUsage)
        }
      }
    } catch {}

    const savedSubscription = localStorage.getItem('bro_split_subscription')
    if (savedSubscription) {
      subscription.value = JSON.parse(savedSubscription)
    } else {
      applyPlan(planOverride || 'free', { persist: true, reason: 'bootstrap' })
    }

    if (subscriptionCheckPromise) {
      return subscriptionCheckPromise
    }

    if (!force && subscriptionCooldownUntil > Date.now()) {
      const effectiveOverride = planOverride || devPlanOverride.value
      if (effectiveOverride && limits.value[effectiveOverride]) {
        applyPlan(effectiveOverride, { persist: false, reason: 'dev-override' })
      }
      ensureQuickGeneratorMonthWindow()
      return subscription.value
    }

    subscriptionCheckPromise = (async () => {
      try {
        const token = await getAuthToken()
        if (token) {
          const remote = await fetchSubscriptionStatus(token)
          const remoteSub = remote?.subscription || null
          const remoteUsage = remote?.usage || null

          if (remoteSub && remoteSub.plan) {
            subscription.value = {
              plan: remoteSub.plan,
              status: remoteSub.status || 'active',
              billingCycle: remoteSub.billingCycle || null,
              expiresAt: remoteSub.expiresAt || null,
              features: Array.isArray(remoteSub.features) ? remoteSub.features : []
            }
            localStorage.setItem('bro_split_subscription', JSON.stringify(subscription.value))
          }

          if (remoteUsage) {
            usage.value = {
              ...usage.value,
              workoutsThisWeek: Number(remoteUsage.workoutsThisWeek) || 0,
              workoutsThisMonth: Number(remoteUsage.workoutsThisMonth) || 0,
              totalWorkouts: Number(remoteUsage.totalWorkouts) || 0,
              lastWorkoutDate: remoteUsage.lastWorkoutDate || null,
              aiWeeklyCount: Number(remoteUsage?.ai?.weeklyCount) || 0,
              aiWeeklyLimit: Number.isFinite(Number(remoteUsage?.ai?.weeklyLimit))
                ? Number(remoteUsage?.ai?.weeklyLimit)
                : -1,
              aiWeekWindowStart: remoteUsage?.ai?.weekWindowStart || null
            }
            persistUsage()
          }
          subscriptionCooldownUntil = 0
        }
      } catch (error) {
        if (isTransientRequestError(error)) {
          subscriptionCooldownUntil = Date.now() + TRANSIENT_REQUEST_COOLDOWN_MS
        }
        logger.warn('⚠️ Subscription status fallback to local cache:', error?.message)
      }

      const effectiveOverride = planOverride || devPlanOverride.value
      if (effectiveOverride && limits.value[effectiveOverride]) {
        applyPlan(effectiveOverride, { persist: false, reason: 'dev-override' })
      }

      ensureQuickGeneratorMonthWindow()
      return subscription.value
    })().finally(() => {
      subscriptionCheckPromise = null
    })

    return subscriptionCheckPromise
  }
  
  // Demo-Reset Funktion für Testing
  const resetToFree = () => {
    applyPlan('free', { persist: true, reason: 'reset' })
    localStorage.removeItem(DEV_PLAN_KEY)
    devPlanOverride.value = null
    logger.debug('🧪 Demo Mode: Reset to free plan')
  }
  
  // Upgrade zu Pro/Elite
  const upgradeSubscription = async (planType, paymentMethod) => {
    const cycle = paymentMethod?.cycle === 'yearly' ? 'yearly' : 'monthly'
    const token = await getAuthToken()

    if (!token) {
      const snapshot = applyPlan(planType, { persist: true, reason: 'upgrade-offline-fallback' })
      return { subscription: snapshot, success: true, demo: true }
    }

    const result = await upgradeSubscriptionRequest(token, { plan: planType, cycle })
    const remoteSub = result?.subscription
    if (remoteSub?.plan) {
      subscription.value = {
        plan: remoteSub.plan,
        status: remoteSub.status || 'active',
        billingCycle: remoteSub.billingCycle || cycle,
        expiresAt: remoteSub.expiresAt || null,
        features: Array.isArray(remoteSub.features) ? remoteSub.features : []
      }
      localStorage.setItem('bro_split_subscription', JSON.stringify(subscription.value))
      return { ...result, success: true }
    }

    const snapshot = applyPlan(planType, { persist: true, reason: 'upgrade-response-fallback' })
    return { subscription: snapshot, success: true, demo: true }
  }

  const setDevPlanOverride = (planType) => {
    if (!planType || !limits.value[planType]) {
      return
    }
    devPlanOverride.value = planType
    localStorage.setItem(DEV_PLAN_KEY, planType)
    applyPlan(planType, { persist: false, reason: 'dev-override' })
  }

  const clearDevPlanOverride = () => {
    devPlanOverride.value = null
    localStorage.removeItem(DEV_PLAN_KEY)
    checkSubscription()
  }
  
  // Usage tracking
  const trackWorkoutCreated = () => {
    usage.value.workoutsThisWeek++
    usage.value.workoutsThisMonth++
    usage.value.totalWorkouts++
    usage.value.lastWorkoutDate = new Date().toISOString()
    persistUsage()
  }

  const trackQuickGeneration = () => {
    ensureQuickGeneratorMonthWindow()
    usage.value.quickGenerationsThisMonth += 1
    usage.value.aiWeeklyCount = (Number(usage.value.aiWeeklyCount) || 0) + 1
    persistUsage()
  }

  const applyAiUsageSnapshot = (ai = null) => {
    if (!ai || typeof ai !== 'object') return
    usage.value = {
      ...usage.value,
      aiWeeklyCount: Number(ai.weeklyCount) || 0,
      aiWeeklyLimit: Number.isFinite(Number(ai.weeklyLimit)) ? Number(ai.weeklyLimit) : -1,
      aiWeekWindowStart: ai.weekWindowStart || usage.value.aiWeekWindowStart
    }
    persistUsage()
  }
  
  // Feature-Checks
  const canCreateWorkout = computed(() => {
    const currentLimits = limits.value[subscription.value.plan]
    if (currentLimits.maxWorkoutsPerWeek === -1) return true
    return usage.value.workoutsThisWeek < currentLimits.maxWorkoutsPerWeek
  })
  
  const canAddExercise = computed(() => (currentExerciseCount) => {
    const currentLimits = limits.value[subscription.value.plan]
    if (currentLimits.maxExercisesPerWorkout === -1) return true
    return currentExerciseCount < currentLimits.maxExercisesPerWorkout
  })
  
  const hasFeature = computed(() => (featureName) => {
    const currentLimits = limits.value[subscription.value.plan]
    return currentLimits[featureName] || false
  })
  
  const isPremium = computed(() => {
    return subscription.value.plan !== 'free'
  })
  
  const isElite = computed(() => {
    return subscription.value.plan === 'elite'
  })
  
  const workoutsRemaining = computed(() => {
    const currentLimits = limits.value[subscription.value.plan]
    if (currentLimits.maxWorkoutsPerWeek === -1) return Infinity
    return Math.max(0, currentLimits.maxWorkoutsPerWeek - usage.value.workoutsThisWeek)
  })

  const canUseQuickGenerator = computed(() => {
    if (subscription.value.plan !== 'free') return true
    const limit = Number(usage.value.aiWeeklyLimit)
    if (!Number.isFinite(limit) || limit < 0) return true
    return (Number(usage.value.aiWeeklyCount) || 0) < limit
  })

  const quickGenerationsRemaining = computed(() => {
    if (subscription.value.plan !== 'free') return Infinity
    const limit = Number(usage.value.aiWeeklyLimit)
    if (!Number.isFinite(limit) || limit < 0) return Infinity
    return Math.max(0, limit - (Number(usage.value.aiWeeklyCount) || 0))
  })

  const quickGeneratorResetDate = computed(() => {
    const startRaw = usage.value.aiWeekWindowStart
    const start = startRaw ? new Date(startRaw) : null
    if (start && !Number.isNaN(start.getTime())) {
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 7)
      return end
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
  })

  const quickGenerationsUsedThisMonth = computed(() => {
    return Number(usage.value.aiWeeklyCount) || 0
  })
  
  const shouldShowUpgrade = computed(() => {
    if (subscription.value.plan !== 'free') return false
    return usage.value.workoutsThisWeek >= limits.value.free.maxWorkoutsPerWeek - 1
  })

  const hasDevOverride = computed(() => !!devPlanOverride.value)
  
  // Pricing
  const pricing = ref({
    pro: {
      monthly: 4.99,
      yearly: 49.99,
      features: [
        'Unlimited Workouts',
        'AI Coach Recommendations',
        'Advanced Stats & Analytics',
        'Workout Sharing',
        'Custom Templates',
        'Up to 50 Friends'
      ]
    },
    elite: {
      monthly: 9.99,
      yearly: 99.99,
      features: [
        'Everything in Pro',
        'Unlimited Friends',
        'Personal Coaching Insights',
        'Priority Support',
        'Early Access to Features',
        'Export Data'
      ]
    }
  })
  
  return {
    // State
    subscription,
    usage,
    limits,
    pricing,
    devPlanOverride,
    
    // Actions
    checkSubscription,
    upgradeSubscription,
    trackWorkoutCreated,
    trackQuickGeneration,
    applyAiUsageSnapshot,
    resetToFree,
    setDevPlanOverride,
    clearDevPlanOverride,
    
    // Computed
    canCreateWorkout,
    canAddExercise,
    hasFeature,
    isPremium,
    isElite,
    workoutsRemaining,
    canUseQuickGenerator,
    quickGenerationsRemaining,
    quickGeneratorResetDate,
    quickGenerationsUsedThisMonth,
    shouldShowUpgrade,
    hasDevOverride
  }
})