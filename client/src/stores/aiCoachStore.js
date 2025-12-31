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

export const useAICoachStore = defineStore('aiCoach', () => {
  const recommendations = ref([])
  const insights = ref([])
  const adaptations = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const userConsent = ref(null)
  const lastRecommendation = ref(null)
  
  // Computed properties for compatibility
  const hasConsent = computed(() => {
    if (!userConsent.value) {
      const stored = localStorage.getItem('ai_coach_consent')
      if (stored) {
        userConsent.value = JSON.parse(stored)
      }
    }
    return userConsent.value?.accepted || false
  })
  
  const canUseAI = computed(() => hasConsent.value)
  
  const aiStatus = ref({
    available: true,
    confidence: 0,
    lastUsed: null,
    totalRecommendations: 0,
    averageRating: 0
  })
  
  // Intelligente Workout-Vorschläge basierend auf Historie
  // Offline/Demo: Workout-Vorschlag lokal simulieren
  const generateWorkoutSuggestion = async (context = {}) => {
    isLoading.value = true
    error.value = null
    logger.debug('🧠 Demo AI Coach: Generiere lokalen Vorschlag...')
    // Demo-Workouts
    const demoSuggestions = [
      {
        recommendedType: 'Push',
        reason: 'Demo: Zeit für Push-Übungen!',
        exercises: ['Push-ups', 'Dips', 'Shoulder Press', 'Tricep Extensions'],
        confidence: 0.75
      },
      {
        recommendedType: 'Pull',
        reason: 'Demo: Fokus auf Rücken und Bizeps!',
        exercises: ['Pull-ups', 'Barbell Row', 'Face Pulls', 'Biceps Curls'],
        confidence: 0.72
      },
      {
        recommendedType: 'Legs',
        reason: 'Demo: Zeit für Beine!',
        exercises: ['Squats', 'Lunges', 'Leg Press', 'Calf Raises'],
        confidence: 0.78
      },
      {
        recommendedType: 'Full Body',
        reason: 'Demo: Ganzkörper-Workout für Abwechslung!',
        exercises: ['Push-ups', 'Pull-ups', 'Squats', 'Plank'],
        confidence: 0.7
      }
    ]
    // Zufällige Auswahl
    const demoSuggestion = demoSuggestions[Math.floor(Math.random() * demoSuggestions.length)]
    demoSuggestion.timestamp = new Date().toISOString()
    demoSuggestion.demo = true
    recommendations.value.unshift(demoSuggestion)
    lastRecommendation.value = {
      workoutName: demoSuggestion.recommendedType,
      exercises: demoSuggestion.exercises.map(name => ({ name, sets: 3, reps: 12 })),
      metadata: { source: 'demo', isDemoData: true }
    }
    isLoading.value = false
    return demoSuggestion
  }
  
  // Offline/Demo: Analyse lokal simulieren
  const analyzeProgress = async () => {
    logger.debug('🧠 Demo AI Coach: Analysiere Fortschritt lokal...')
    // Demo-Daten für Progress Analysis
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
  
  // Offline/Demo: Plateau Detection lokal simulieren
  const detectPlateau = async () => {
    logger.debug('🧠 Demo AI Coach: Simuliere Plateau Detection...')
    // Demo-Daten für Plateau Detection
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
  
  // Personalisierte Anpassungen für Workouts
  const getPersonalizedAdaptations = computed(() => {
    return adaptations.value.filter(adaptation => 
      adaptation.confidence > 0.7 // Nur hochvertrauende Vorschläge
    )
  })
  
  // Alle Insights mit Priorität
  const prioritizedInsights = computed(() => {
    return insights.value.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  })
  
  // Clear functions für Testing
  const clearRecommendations = () => {
    recommendations.value = []
  }
  
  const clearInsights = () => {
    insights.value = []
  }
  
  // Consent methods for compatibility
  const setConsent = (consent) => {
    userConsent.value = consent
    localStorage.setItem('ai_coach_consent', JSON.stringify(consent))
  }
  
  const revokeConsent = () => {
    userConsent.value = null
    localStorage.removeItem('ai_coach_consent')
  }
  
  const resetAIStatus = () => {
    aiStatus.value = {
      available: true,
      confidence: 0,
      lastUsed: null,
      totalRecommendations: 0,
      averageRating: 0
    }
  }
  
  const submitFeedback = async (recommendationId, feedback) => {
    logger.debug('📝 Feedback submitted:', { recommendationId, feedback })
    return true
  }

  const initializeAI = () => {
    // Consent aus localStorage laden
    if (!userConsent.value) {
      const stored = localStorage.getItem('ai_coach_consent')
      if (stored) {
        userConsent.value = JSON.parse(stored)
      }
    }
    resetAIStatus()
  }
  
  const grantConsent = () => {
    userConsent.value = { accepted: true }
    localStorage.setItem('ai_coach_consent', JSON.stringify({ accepted: true }))
  }

  return {
    // State
    recommendations,
    insights,
    adaptations,
    isLoading,
    error,
    userConsent,
    lastRecommendation,
    aiStatus,

    // Prompt-Template
    workoutPromptTemplate,

    // Computed
    hasConsent,
    canUseAI,
    getPersonalizedAdaptations,
    prioritizedInsights,

    // Actions
    generateWorkoutSuggestion,
    analyzeProgress,
    detectPlateau,
    clearRecommendations,
    clearInsights,
    setConsent,
    revokeConsent,
    resetAIStatus,
    submitFeedback,
    initializeAI,
    grantConsent
  }
})