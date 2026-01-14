/**
 * AI Coach Store für intelligente Workout-Empfehlungen
 */
// Prompt-Template für den Workout-Generator (Push–Pull–Beine)
export const workoutPromptTemplate = `
Du bist ein KI-gestützter Fitness-Coach. Generiere einen vollständigen, effektiven 3-Tage-Trainingsplan nach dem Push–Pull–Beine-Prinzip für eine Woche. Gib für jeden Tag die Übungen, Sätze, Wiederholungen und eine kurze Begründung an. Berücksichtige Trainingsstand, Ziel (Muskelaufbau), verfügbare Ausrüstung und individuelle Wünsche, falls angegeben.

Format:
Tag: [Push/Pull/Beine]
Übungen:
- Übung 1: [Name], [Sätze] Sätze x [Wdh.], [kurze Begründung]
- ...
Hinweise: [kurze, motivierende Tipps]
`
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAuthToken } from '@/utils/authToken'
import { logger } from '@/utils/logger'
import { http } from '@/api/http'
import { useSubscriptionStore } from '@/stores/subscriptionStore'

const LAST_RECOMMENDATION_KEY = 'ai_coach_last_recommendation'
const USAGE_STATS_KEY = 'ai_coach_usage_stats'
const CONSENT_STORAGE_KEY = 'ai_coach_consent'
const MODE_OVERRIDE_KEY = 'ai_coach_mode_override'

const featureFlags = {
  remoteEnabled: import.meta.env.VITE_AI_REMOTE_ENABLED === 'true',
  demoFallbackEnabled: import.meta.env.VITE_AI_DEMO_FALLBACK !== 'false'
}

const defaultUsageStats = () => ({
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  lastMode: null,
  lastRequestAt: null,
  remoteSuccess: 0,
  demoSuccess: 0
})

const localWorkoutPool = {
  push: [
    {
      workoutName: 'Power Push Session',
      exercises: [
        { name: 'Schrägbankdrücken', sets: 4, reps: 8, rest: 120 },
        { name: 'Liegestütze', sets: 3, reps: 10, rest: 90 },
        { name: 'Dips', sets: 3, reps: 8, rest: 90 },
        { name: 'Schulterdrücken', sets: 4, reps: 10, rest: 120 },
        { name: 'Trizeps-Kickbacks', sets: 3, reps: 12, rest: 60 }
      ]
    },
    {
      workoutName: 'Push Volume Builder',
      exercises: [
        { name: 'Kurzhantel Bankdrücken', sets: 3, reps: 12, rest: 90 },
        { name: 'Seitheben', sets: 4, reps: 15, rest: 60 },
        { name: 'Liegestütze', sets: 3, reps: 15, rest: 60 },
        { name: 'Frontheben', sets: 3, reps: 12, rest: 60 },
        { name: 'Overhead Trizepsdrücken', sets: 4, reps: 12, rest: 90 }
      ]
    },
    {
      workoutName: 'Push Strength Circuit',
      exercises: [
        { name: 'Bankdrücken', sets: 4, reps: 6, rest: 150 },
        { name: 'Military Press', sets: 3, reps: 5, rest: 120 },
        { name: 'Dips', sets: 4, reps: 6, rest: 150 },
        { name: 'Trizeps Bankdrücken', sets: 3, reps: 8, rest: 90 },
        { name: 'Arnold Press', sets: 3, reps: 15, rest: 60 }
      ]
    }
  ],
  pull: [
    {
      workoutName: 'Pull Power Session',
      exercises: [
        { name: 'Klimmzüge', sets: 4, reps: 6, rest: 120 },
        { name: 'Rudern Langhantel', sets: 4, reps: 8, rest: 120 },
        { name: 'Kurzhantelrudern', sets: 3, reps: 10, rest: 90 },
        { name: 'Bizeps Curls Langhantel', sets: 3, reps: 8, rest: 90 },
        { name: 'Face Pulls', sets: 3, reps: 12, rest: 60 }
      ]
    },
    {
      workoutName: 'Pull Volume Builder',
      exercises: [
        { name: 'Latzug zur Brust', sets: 3, reps: 12, rest: 90 },
        { name: 'Rudern Kabelzug', sets: 4, reps: 12, rest: 90 },
        { name: 'Kurzhantel Bizeps Curls', sets: 3, reps: 15, rest: 60 },
        { name: 'Hammer Curls', sets: 3, reps: 12, rest: 60 },
        { name: 'Umgekehrtes Flys', sets: 4, reps: 15, rest: 60 }
      ]
    },
    {
      workoutName: 'Pull Strength Circuit',
      exercises: [
        { name: 'Klimmzüge', sets: 4, reps: 5, rest: 150 },
        { name: 'Rudern Langhantel', sets: 4, reps: 6, rest: 150 },
        { name: 'Pullovers Langhantel', sets: 3, reps: 8, rest: 120 },
        { name: 'Bizeps Curls Langhantel', sets: 3, reps: 6, rest: 90 },
        { name: 'Shrugs Langhantel', sets: 3, reps: 12, rest: 90 }
      ]
    }
  ],
  legs: [
    {
      workoutName: 'Leg Power Session',
      exercises: [
        { name: 'Kniebeugen Langhantel', sets: 4, reps: 6, rest: 180 },
        { name: 'Rumänisches Kreuzheben', sets: 4, reps: 8, rest: 150 },
        { name: 'Bulgarian Split Squats', sets: 3, reps: 10, rest: 120 },
        { name: 'Ausfallschritte Kurzhantel', sets: 3, reps: 8, rest: 90 },
        { name: 'Wadenheben stehend', sets: 4, reps: 15, rest: 60 }
      ]
    },
    {
      workoutName: 'Leg Volume Builder',
      exercises: [
        { name: 'Frontkniebeugen', sets: 3, reps: 12, rest: 120 },
        { name: 'Beinpresse', sets: 4, reps: 15, rest: 90 },
        { name: 'Beincurls liegend', sets: 3, reps: 12, rest: 90 },
        { name: 'Beinstrecker', sets: 3, reps: 15, rest: 60 },
        { name: 'Glute Bridge', sets: 4, reps: 20, rest: 60 }
      ]
    },
    {
      workoutName: 'Leg Strength Circuit',
      exercises: [
        { name: 'Kreuzheben konventionell', sets: 4, reps: 5, rest: 180 },
        { name: 'Kniebeugen Langhantel', sets: 4, reps: 6, rest: 180 },
        { name: 'Hip Thrust Langhantel', sets: 3, reps: 8, rest: 120 },
        { name: 'Good Mornings', sets: 3, reps: 10, rest: 90 },
        { name: 'Wadenheben sitzend', sets: 4, reps: 12, rest: 60 }
      ]
    }
  ],
  fullbody: [
    {
      workoutName: 'Full Body Flow',
      exercises: [
        { name: 'Kettlebell Swings', sets: 4, reps: 12, rest: 90 },
        { name: 'Klimmzüge', sets: 3, reps: 8, rest: 90 },
        { name: 'Kniebeugen Langhantel', sets: 3, reps: 10, rest: 120 },
        { name: 'Kurzhantel Bankdrücken', sets: 3, reps: 12, rest: 90 },
        { name: 'Plank', sets: 3, reps: 45, rest: 60 }
      ]
    }
  ]
}

const safeLoadJSON = (key, fallback = null) => {
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (err) {
    logger.debug('⚠️ AI Coach: Konnte JSON nicht laden', key, err?.message)
    return fallback
  }
}

const safeSaveJSON = (key, value) => {
  try {
    if (typeof localStorage === 'undefined') return
    if (value === null || value === undefined) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (err) {
    logger.debug('⚠️ AI Coach: Konnte JSON nicht speichern', key, err?.message)
  }
}

const pickWorkoutTemplate = (focus) => {
  const normalized = (focus || 'push').toLowerCase()
  if (normalized.includes('pull')) return randomEntry(localWorkoutPool.pull)
  if (normalized.includes('leg')) return randomEntry(localWorkoutPool.legs)
  if (normalized.includes('full')) return randomEntry(localWorkoutPool.fullbody)
  return randomEntry(localWorkoutPool.push)
}

const randomEntry = (list) => list[Math.floor(Math.random() * list.length)]

const mapTemplateToWorkout = (template, context) => {
  const workout = {
    type: context.focus || 'push',
    focus: context.focus || 'push',
    workoutName: template.workoutName,
    exercises: template.exercises.map((exercise, idx) => ({
      ...exercise,
      _id: `demo_${exercise.name.replace(/\s+/g, '_').toLowerCase()}_${idx}`,
      exerciseId: null,
      muscleGroup: context.focus || 'Push',
      category: context.focus || 'push'
    })),
    estimatedDuration: context.timeAvailable || 45,
    difficulty: context.experienceLevel || 'intermediate',
    metadata: {
      source: 'demo_local',
      isDemoData: true,
      variation: template.workoutName,
      recommendationId: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }
  return workout
}

const normalizeRecommendation = (payload, mode = 'remote') => {
  if (!payload) return null
  const baseExercises = Array.isArray(payload.exercises) ? payload.exercises : []
  return {
    workoutName: payload.workoutName || payload.metadata?.workoutName || 'AI Workout',
    exercises: baseExercises.map((exercise, idx) => ({
      name: exercise.name,
      sets: exercise.sets ?? 3,
      reps: exercise.reps ?? 12,
      rest: exercise.rest ?? 90,
      _id: exercise._id || `tmp_${idx}`,
      exerciseId: exercise.exerciseId,
      muscleGroup: exercise.muscleGroup || payload.focus || 'Push',
      category: exercise.category || payload.focus || 'push'
    })),
    estimatedDuration: payload.estimatedDuration || 45,
    difficulty: payload.difficulty || 'intermediate',
    metadata: {
      ...payload.metadata,
      mode,
      source: payload.metadata?.source || mode,
      recommendationId: payload.metadata?.recommendationId || `ai_${Date.now()}`
    }
  }
}

export const useAICoachStore = defineStore('aiCoach', () => {
  const subscriptionStore = useSubscriptionStore()

  const recommendations = ref([])
  const insights = ref([])
  const adaptations = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const userConsent = ref(safeLoadJSON(CONSENT_STORAGE_KEY, null))
  const lastRecommendation = ref(safeLoadJSON(LAST_RECOMMENDATION_KEY, null))
  const usageStats = ref(safeLoadJSON(USAGE_STATS_KEY, defaultUsageStats()) || defaultUsageStats())
  const modeOverride = ref(typeof localStorage !== 'undefined' ? localStorage.getItem(MODE_OVERRIDE_KEY) : null)
  const aiStatus = ref({
    available: true,
    confidence: 0,
    lastUsed: null,
    totalRecommendations: 0,
    averageRating: 0,
    mode: 'demo'
  })

  const hasConsent = computed(() => Boolean(userConsent.value?.accepted))

  const hasPlanAccess = computed(() => {
    const checker = subscriptionStore?.hasFeature
    if (typeof checker === 'function') {
      try {
        return checker('hasAICoach')
      } catch {
        return false
      }
    }
    return false
  })

  const canUseAI = computed(() => hasConsent.value && hasPlanAccess.value)

  const aiMode = computed(() => {
    if (!canUseAI.value) return 'locked'
    if (modeOverride.value === 'demo' || !featureFlags.remoteEnabled) return 'demo'
    if (modeOverride.value === 'remote') return 'remote'
    return 'remote'
  })

  const recordUsage = (mode, success) => {
    usageStats.value.totalRequests += 1
    usageStats.value.lastMode = mode
    usageStats.value.lastRequestAt = new Date().toISOString()
    if (success) {
      usageStats.value.successCount += 1
      if (mode === 'remote') usageStats.value.remoteSuccess += 1
      if (mode === 'demo') usageStats.value.demoSuccess += 1
    } else {
      usageStats.value.failureCount += 1
    }
    safeSaveJSON(USAGE_STATS_KEY, usageStats.value)
  }

  const persistRecommendation = (recommendation) => {
    lastRecommendation.value = recommendation
    safeSaveJSON(LAST_RECOMMENDATION_KEY, recommendation)
  }

  const clearLastRecommendation = () => {
    lastRecommendation.value = null
    safeSaveJSON(LAST_RECOMMENDATION_KEY, null)
  }

  const generateWorkoutSuggestion = async (context = {}) => {
    isLoading.value = true
    error.value = null
    try {
      const template = pickWorkoutTemplate(context.focus)
      const workout = mapTemplateToWorkout(template, context)
      recommendations.value.unshift({ ...workout, timestamp: new Date().toISOString() })
      persistRecommendation(workout)
      recordUsage('demo', true)
      aiStatus.value = {
        ...aiStatus.value,
        lastUsed: new Date().toISOString(),
        totalRecommendations: aiStatus.value.totalRecommendations + 1,
        mode: 'demo'
      }
      return workout
    } catch (err) {
      error.value = err
      recordUsage('demo', false)
      logger.error('❌ Demo AI Coach Fehler:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const requestRecommendation = async (context = {}, options = {}) => {
    if (!hasConsent.value) {
      const err = new Error('AI Nutzung erfordert Consent')
      err.code = 'consent-missing'
      throw err
    }
    if (!hasPlanAccess.value) {
      const err = new Error('AI Coach nur für Pro/Elite verfügbar')
      err.code = 'plan-missing'
      throw err
    }

    const targetMode = options.forceDemo ? 'demo' : aiMode.value
    if (targetMode === 'demo' || targetMode === 'locked') {
      return generateWorkoutSuggestion(context)
    }

    isLoading.value = true
    error.value = null

    try {
      const token = await getAuthToken().catch(() => null)
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`

      const { data } = await http.post('/workouts/ai-suggestion', { ...context, mode: 'auto' }, { headers })
      const normalized = normalizeRecommendation(data, 'remote')
      persistRecommendation(normalized)
      recommendations.value.unshift({ ...normalized, timestamp: new Date().toISOString() })
      recordUsage('remote', true)
      aiStatus.value = {
        ...aiStatus.value,
        lastUsed: new Date().toISOString(),
        totalRecommendations: aiStatus.value.totalRecommendations + 1,
        mode: 'remote',
        confidence: normalized.metadata?.confidence || aiStatus.value.confidence
      }
      return normalized
    } catch (remoteError) {
      logger.error('❌ Remote AI Fehler, falle auf Demo zurück:', remoteError)
      recordUsage('remote', false)
      error.value = remoteError
      if (featureFlags.demoFallbackEnabled) {
        try {
          const fallback = await generateWorkoutSuggestion(context)
          fallback.metadata = { ...fallback.metadata, fallbackReason: remoteError.message }
          return fallback
        } catch (fallbackError) {
          throw fallbackError
        }
      }
      throw remoteError
    } finally {
      isLoading.value = false
    }
  }

  const analyzeProgress = async () => {
    logger.debug('🧠 Demo AI Coach: Analysiere Fortschritt lokal...')
    const demoInsights = [
      {
        type: 'strength',
        priority: 'high',
        message: 'Your bench press has increased by 12.5% over the last 4 weeks. Excellent progressive overload!',
        confidence: 0.94
      },
      {
        type: 'volume',
        priority: 'medium', 
        message: 'Weekly training volume is optimal at 16 sets per muscle group. Consider adding 2-3 sets for arms.',
        confidence: 0.87
      },
      {
        type: 'recovery',
        priority: 'low',
        message: 'Rest periods between sessions are adequate. Recovery metrics show good adaptation.',
        confidence: 0.81
      }
    ]
    const demoAdaptations = [
      {
        exercise: 'Bench Press',
        currentWeight: '80kg',
        suggestedWeight: '82.5kg',
        reason: 'Ready for progressive overload based on recent performance'
      },
      {
        exercise: 'Squats',
        currentReps: '8-10',
        suggestedReps: '6-8',
        reason: 'Focus on strength gains by reducing reps and increasing weight'
      }
    ]
    const analysis = {
      insights: demoInsights,
      adaptations: demoAdaptations,
      timestamp: new Date().toISOString(),
      demo: true
    }
    insights.value = analysis.insights
    adaptations.value = analysis.adaptations
    logger.debug('🧠 Demo AI Coach: Analyse abgeschlossen')
    return analysis
  }

  const detectPlateau = async () => {
    logger.debug('🧠 Demo AI Coach: Simuliere Plateau Detection...')
    const demoPlateauData = {
      hasPlateaus: Math.random() > 0.5,
      affectedExercises: ['Bench Press', 'Overhead Press'],
      message: 'Plateau detected in pressing movements. No improvement in the last 3 weeks.',
      solutions: [
        'Deload Week (50-60% of 1RM)',
        'Change Rep Range (3-5 reps instead of 8-10)',
        'Add Pause Reps',
        'Increase Training Frequency',
        'Try Different Grip Width'
      ],
      confidence: 0.78,
      weeksStagnant: 3,
      demo: true,
      recommendations: [
        {
          exercise: 'Bench Press',
          solution: 'Deload to 70kg for one week, then return with new technique focus',
          priority: 'high'
        }
      ]
    }
    if (demoPlateauData.hasPlateaus) {
      insights.value.push({
        type: 'plateau',
        priority: 'high',
        message: demoPlateauData.message,
        solutions: demoPlateauData.solutions,
        exercises: demoPlateauData.affectedExercises
      })
    }
    logger.debug('🧠 Demo AI Coach: Plateau Detection abgeschlossen, hasPlateaus:', demoPlateauData.hasPlateaus)
    return demoPlateauData
  }

  const getPersonalizedAdaptations = computed(() => {
    return adaptations.value.filter(adaptation => adaptation.confidence > 0.7)
  })

  const prioritizedInsights = computed(() => {
    return insights.value.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  })

  const clearRecommendations = () => {
    recommendations.value = []
  }

  const clearInsights = () => {
    insights.value = []
  }

  const setConsent = (consent) => {
    userConsent.value = consent
    safeSaveJSON(CONSENT_STORAGE_KEY, consent)
  }

  const revokeConsent = () => {
    userConsent.value = null
    safeSaveJSON(CONSENT_STORAGE_KEY, null)
    clearLastRecommendation()
  }

  const resetAIStatus = () => {
    aiStatus.value = {
      available: true,
      confidence: 0,
      lastUsed: null,
      totalRecommendations: 0,
      averageRating: 0,
      mode: 'demo'
    }
  }

  const submitFeedback = async (recommendationId, feedback) => {
    logger.debug('📝 Feedback submitted:', { recommendationId, feedback })
    return true
  }

  const initializeAI = () => {
    if (!userConsent.value) {
      const stored = safeLoadJSON(CONSENT_STORAGE_KEY, null)
      if (stored) userConsent.value = stored
    }
    const storedRecommendation = safeLoadJSON(LAST_RECOMMENDATION_KEY, null)
    if (storedRecommendation) lastRecommendation.value = storedRecommendation
    const storedStats = safeLoadJSON(USAGE_STATS_KEY, null)
    if (storedStats) usageStats.value = storedStats
    resetAIStatus()
  }

  const grantConsent = (consent = { accepted: true }) => {
    setConsent({ ...consent, accepted: true, timestamp: Date.now() })
  }

  const setModeOverride = (mode) => {
    modeOverride.value = mode
    if (typeof localStorage !== 'undefined') {
      if (mode) localStorage.setItem(MODE_OVERRIDE_KEY, mode)
      else localStorage.removeItem(MODE_OVERRIDE_KEY)
    }
  }

  return {
    recommendations,
    insights,
    adaptations,
    isLoading,
    error,
    userConsent,
    lastRecommendation,
    aiStatus,
    usageStats,
    aiMode,

    workoutPromptTemplate,

    hasConsent,
    canUseAI,
    getPersonalizedAdaptations,
    prioritizedInsights,

    generateWorkoutSuggestion,
    requestRecommendation,
    analyzeProgress,
    detectPlateau,
    clearRecommendations,
    clearInsights,
    setConsent,
    revokeConsent,
    resetAIStatus,
    submitFeedback,
    initializeAI,
    grantConsent,
    clearLastRecommendation,
    setModeOverride
  }
})