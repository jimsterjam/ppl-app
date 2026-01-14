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
// Avoid calling useClerk/useAuth here: Pinia stores run outside a component setup
// context and calling useClerk() may throw. We will rely on getAuthToken()
// which falls back to window.Clerk or cached tokens.

export const useSubscriptionStore = defineStore('subscription', () => {
  const DEV_PLAN_KEY = 'bro_split_dev_plan'
  const subscription = ref({
    plan: 'free',
    status: 'active',
    expiresAt: null,
    features: []
  })
  
  const usage = ref({
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    totalWorkouts: 0,
    lastWorkoutDate: null
  })
  
  const limits = ref({
    free: {
      maxWorkoutsPerWeek: 3,
      maxExercisesPerWorkout: 6,
      maxFriends: 5,
      hasAICoach: false,
      hasAdvancedStats: false,
      hasWorkoutSharing: false,
      hasCustomTemplates: false
    },
    pro: {
      maxWorkoutsPerWeek: -1, // unlimited
      maxExercisesPerWorkout: -1,
      maxFriends: 50,
      hasAICoach: true,
      hasAdvancedStats: true,
      hasWorkoutSharing: true,
      hasCustomTemplates: true
    },
    elite: {
      maxWorkoutsPerWeek: -1,
      maxExercisesPerWorkout: -1,
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

  const buildPlanSnapshot = (planType) => {
    const validPlan = ['free', 'pro', 'elite'].includes(planType) ? planType : 'free'
    return {
      plan: validPlan,
      status: 'active',
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
  const checkSubscription = async (planOverride = null) => {
    const savedSubscription = localStorage.getItem('bro_split_subscription')
    if (savedSubscription) {
      subscription.value = JSON.parse(savedSubscription)
      logger.debug('🧪 Demo Mode: Loaded subscription from localStorage:', subscription.value.plan)
    } else {
      applyPlan(planOverride || 'free', { persist: true, reason: 'bootstrap' })
    }

    const effectiveOverride = planOverride || devPlanOverride.value
    if (effectiveOverride && limits.value[effectiveOverride]) {
      applyPlan(effectiveOverride, { persist: false, reason: 'dev-override' })
    }
  }
  
  // Demo-Reset Funktion für Testing
  const resetToFree = () => {
    applyPlan('free', { persist: true, reason: 'reset' })
    localStorage.removeItem(DEV_PLAN_KEY)
    devPlanOverride.value = null
    logger.debug('🧪 Demo Mode: Reset to free plan')
  }
  
  // Upgrade zu Pro/Elite
  // Offline/Demo: Upgrade nur lokal simulieren
  const upgradeSubscription = async (planType, paymentMethod) => {
    logger.debug('🧪 Demo Mode: Simulating upgrade to', planType)
    const snapshot = applyPlan(planType, { persist: true, reason: 'upgrade' })
    logger.debug('🧪 Demo Mode: Upgrade completed and saved to localStorage')
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
    shouldShowUpgrade,
    hasDevOverride
  }
})