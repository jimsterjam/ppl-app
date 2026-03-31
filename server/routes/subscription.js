/**
 * 💳 Subscription Routes für Backend API
 * Express.js Route-Handler für Freemium/Premium Model
 * 
 * @description
 * Verwaltet Subscription-Status, Upgrades und Feature-Zugriff
 * 
 * @routes
 * - GET  /api/subscription/status       - Subscription & Usage abrufen
 * - POST /api/subscription/upgrade      - Upgrade zu Pro/Elite
 * - POST /api/ai/workout-suggestion     - AI Coach Empfehlung (Premium)
 * - GET  /api/ai/analyze-progress       - Progress Analyse (Premium)
 * - POST /api/social/share-workout      - Workout teilen (Premium)
 * - GET  /api/social/friends-feed       - Friends Activity Feed
 * 
 * @status 🚧 Mock Implementation - Echte Payment Integration ausstehend
 * @todo Stripe/Paddle Integration für echte Payments
 * @todo MongoDB Models für Subscriptions
 * 
 * @version 1.0.0
 * @since 2025-11-06
 */
import express from 'express'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
import UserProfile from '../models/UserProfile.js'
import Workout from '../models/Workout.js'

const router = express.Router()

const FREE_AI_WEEKLY_LIMIT = 1
const SUBSCRIPTION_FORCE_PLAN = String(process.env.SUBSCRIPTION_FORCE_PLAN || '').trim().toLowerCase()
const SUBSCRIPTION_FORCE_SCOPE = String(process.env.SUBSCRIPTION_FORCE_SCOPE || 'all').trim().toLowerCase()
const SUBSCRIPTION_FORCE_ALLOWLIST = String(process.env.SUBSCRIPTION_FORCE_ALLOWLIST || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function startOfIsoWeek(dateInput) {
  const date = new Date(dateInput)
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - isoDay + 1)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function isPaidPlan(plan = 'free') {
  return plan === 'pro' || plan === 'elite'
}

function resolveEffectivePlan(profilePlan = 'free', userId = '') {
  const normalizedProfilePlan = ['free', 'pro', 'elite'].includes(profilePlan) ? profilePlan : 'free'
  const validForcedPlan = ['free', 'pro', 'elite'].includes(SUBSCRIPTION_FORCE_PLAN) ? SUBSCRIPTION_FORCE_PLAN : ''

  if (IS_PRODUCTION || !validForcedPlan) {
    return { effectivePlan: normalizedProfilePlan, planSource: 'db' }
  }

  if (SUBSCRIPTION_FORCE_SCOPE === 'allowlist') {
    if (!userId || !SUBSCRIPTION_FORCE_ALLOWLIST.includes(userId)) {
      return { effectivePlan: normalizedProfilePlan, planSource: 'db' }
    }
  }

  return { effectivePlan: validForcedPlan, planSource: 'override' }
}

async function getOrCreateUserProfile(uid) {
  if (!uid) return null
  let profile = await UserProfile.findOne({ uid })
  if (profile) return profile
  profile = await UserProfile.create({ uid })
  return profile
}

function getAiWeeklyUsage(profile) {
  const weekWindowStart = startOfIsoWeek(new Date())
  const savedStartRaw = profile?.aiUsage?.weekWindowStart
  const savedStart = savedStartRaw ? startOfIsoWeek(savedStartRaw) : null
  const isCurrentWindow = savedStart && savedStart.getTime() === weekWindowStart.getTime()
  const weeklyCount = isCurrentWindow ? Math.max(0, Number(profile?.aiUsage?.weeklyCount) || 0) : 0
  return {
    weekWindowStart,
    weeklyCount,
    weeklyLimit: isPaidPlan(profile?.subscription?.plan || 'free') ? null : FREE_AI_WEEKLY_LIMIT,
    weeklyRemaining: isPaidPlan(profile?.subscription?.plan || 'free')
      ? null
      : Math.max(0, FREE_AI_WEEKLY_LIMIT - weeklyCount)
  }
}

/**
 * GET /api/subscription/status
 * Liefert aktuellen Subscription-Status und Usage-Daten
 * 
 * @protected Requires Authentication
 * @returns {Object} { subscription, usage }
 */
router.get('/status', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.auth?.userId
    const profile = await getOrCreateUserProfile(userId)
    const persistedPlan = profile?.subscription?.plan || 'free'
    const { effectivePlan, planSource } = resolveEffectivePlan(persistedPlan, userId)
    const paidPlan = isPaidPlan(effectivePlan)
    const aiUsage = getAiWeeklyUsage({
      ...profile?.toObject?.(),
      subscription: {
        ...(profile?.subscription || {}),
        plan: effectivePlan
      }
    })

    const subscription = {
      plan: effectivePlan,
      persistedPlan,
      planSource,
      status: profile?.subscription?.status || 'active',
      billingCycle: profile?.subscription?.billingCycle || null,
      expiresAt: profile?.subscription?.expiresAt || null,
      features: paidPlan
        ? [
            'unlimited_workouts',
            'ai_coach',
            'advanced_stats',
            'workout_sharing',
            'custom_templates'
          ]
        : []
    }
    
    // Usage aus DB berechnen
    const now = new Date()
    const weekStart = startOfIsoWeek(now)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [workoutsThisWeek, workoutsThisMonth, totalWorkouts, lastWorkout] = await Promise.all([
      Workout.countDocuments({ userId, date: { $gte: weekStart } }),
      Workout.countDocuments({ userId, date: { $gte: monthStart } }),
      Workout.countDocuments({ userId }),
      Workout.findOne({ userId }).sort({ date: -1 }).select({ date: 1 }).lean()
    ])

    const usage = {
      workoutsThisWeek,
      workoutsThisMonth,
      totalWorkouts,
      lastWorkoutDate: lastWorkout?.date || null,
      ai: aiUsage,
      analyticsEnabled: paidPlan
    }
    
    res.json({
      subscription,
      usage
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    res.status(500).json({ error: 'Failed to get subscription status' })
  }
})

// Upgrade zu Pro/Elite
router.post('/upgrade', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.auth?.userId
    const { plan, paymentMethod, cycle } = req.body
    
    // Validate plan
    if (!['pro', 'elite'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' })
    }
    
    const billingCycle = cycle === 'yearly' ? 'yearly' : 'monthly'
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + (billingCycle === 'yearly' ? 12 : 1))

    const profile = await getOrCreateUserProfile(userId)
    profile.subscription = {
      plan,
      status: 'active',
      billingCycle,
      expiresAt
    }
    profile.analyticsEnabled = true
    await profile.save()

    const subscription = {
      plan,
      status: 'active',
      billingCycle,
      expiresAt,
      features: plan === 'pro' ? [
        'unlimited_workouts',
        'ai_coach',
        'advanced_stats',
        'workout_sharing',
        'custom_templates'
      ] : [
        'unlimited_workouts',
        'ai_coach', 
        'advanced_stats',
        'workout_sharing',
        'custom_templates',
        'unlimited_friends',
        'personal_coaching',
        'priority_support'
      ]
    }
    
    res.json({
      subscription,
      message: 'Upgrade successful'
    })
  } catch (error) {
    console.error('Upgrade error:', error)
    res.status(500).json({ error: 'Upgrade failed' })
  }
})

// AI Coach Recommendations
router.post('/ai/workout-suggestion', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.auth?.userId
    
    // Check if user has AI Coach feature
    // const hasAI = await checkSubscriptionFeature(userId, 'ai_coach')
    // if (!hasAI) return res.status(403).json({ error: 'AI Coach requires Pro subscription' })
    
    // AI Logic hier - für Demo: einfache Regeln
    const lastWorkouts = [] // aus DB laden
    const suggestion = {
      recommendedType: 'push',
      reason: 'Du hast seit 3 Tagen kein Push-Training gemacht',
      exercises: [
        'Bankdrücken',
        'Schulterdrücken', 
        'Trizeps Seilzug'
      ],
      intensity: 'moderate',
      confidence: 0.85
    }
    
    res.json(suggestion)
  } catch (error) {
    console.error('AI suggestion error:', error)
    res.status(500).json({ error: 'Failed to generate suggestion' })
  }
})

// Progress Analysis
router.get('/ai/analyze-progress', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.auth?.userId
    
    // Analyse der letzten 4 Wochen
    const insights = [
      {
        type: 'improvement',
        message: 'Dein Bankdrücken hat sich um 12% verbessert!',
        priority: 'medium',
        exercises: ['Bankdrücken']
      },
      {
        type: 'plateau',
        message: 'Kniebeugen stagnieren - probiere Variationen',
        priority: 'high',
        exercises: ['Kniebeugen Langhantel'],
        solutions: ['Frontkniebeugen', 'Pause Squats', 'Erhöhe Frequenz']
      }
    ]
    
    const adaptations = [
      {
        exercise: 'Bankdrücken',
        currentWeight: 80,
        recommendedWeight: 82.5,
        type: 'progressive_overload'
      }
    ]
    
    res.json({
      insights,
      adaptations,
      analyzedPeriod: '4 weeks',
      confidence: 0.78
    })
  } catch (error) {
    console.error('Progress analysis error:', error)
    res.status(500).json({ error: 'Analysis failed' })
  }
})

// Social Features: Workout teilen
router.post('/social/share-workout', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.auth?.userId
    const { workoutId, message, visibility } = req.body
    
    // Check sharing feature
    // const canShare = await checkSubscriptionFeature(userId, 'workout_sharing')
    // if (!canShare) return res.status(403).json({ error: 'Sharing requires Pro subscription' })
    
    const sharedWorkout = {
      _id: 'shared_' + Date.now(),
      workoutId,
      userId,
      message,
      visibility,
      likes: 0,
      comments: [],
      sharedAt: new Date().toISOString()
    }
    
    // Save to database...
    
    res.json(sharedWorkout)
  } catch (error) {
    console.error('Share workout error:', error)
    res.status(500).json({ error: 'Sharing failed' })
  }
})

// Friends Feed
router.get('/social/friends-feed', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.auth?.userId
    
    // Mock Feed
    const feed = [
      {
        _id: 'feed1',
        user: { name: 'Max Mustermann', avatar: null },
        workout: { name: 'Push Training', type: 'push' },
        message: 'Neuer PR beim Bankdrücken! 💪',
        likes: 5,
        isLiked: false,
        sharedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ]
    
    res.json(feed)
  } catch (error) {
    console.error('Friends feed error:', error)
    res.status(500).json({ error: 'Failed to load feed' })
  }
})

export default router