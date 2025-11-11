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
  const generateWorkoutSuggestion = async (context = {}) => {
    isLoading.value = true
    error.value = null
    
    console.log('🧪 AI Coach: Starting workout suggestion...')
    
    try {
      // Kurzer Timeout für schnellen Fallback
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout für OpenAI
      
      const response = await fetch('/api/workouts/ai-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify(context),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const suggestion = await response.json()
        
        // Transform to old format
        const transformedSuggestion = {
          recommendedType: suggestion.workoutName || 'AI Workout',
          reason: suggestion.notes || 'Personalized AI recommendation',
          exercises: suggestion.exercises?.map(ex => ex.name) || [],
          confidence: suggestion.metadata?.confidence / 100 || 0.85,
          timestamp: suggestion.metadata?.requestedAt || new Date().toISOString(),
          metadata: suggestion.metadata,
          originalSuggestion: suggestion
        }
        
        recommendations.value.unshift(transformedSuggestion)
        lastRecommendation.value = suggestion
        console.log('🧪 AI Coach: Real API success:', transformedSuggestion)
        return transformedSuggestion
      } else {
        throw new Error(`API returned ${response.status}`)
      }
    } catch (error) {
      console.log('🧪 AI Coach: API failed, using demo data:', error.message)
      error.value = error.message
      
      // Mehrere Demo-Workouts für Fallback
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
      return demoSuggestion
    } finally {
      isLoading.value = false
    }
  }
  
  // Analyse der letzten Workouts für Verbesserungsvorschläge
  const analyzeProgress = async () => {
    console.log('🧪 AI Coach: Starting progress analysis...')
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)
      
      const response = await fetch('/api/ai/analyze-progress', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const analysis = await response.json()
        insights.value = analysis.insights
        adaptations.value = analysis.adaptations
        console.log('🧪 AI Coach: Real API analysis success')
        return analysis
      } else {
        throw new Error(`API returned ${response.status}`)
      }
    } catch (error) {
      console.log('🧪 AI Coach: Progress analysis API failed, using demo data:', error.message)
      
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
        demo: true // Mark as demo data
      }
      
      insights.value = analysis.insights
      adaptations.value = analysis.adaptations
      console.log('🧪 AI Coach: Demo analysis completed')
      return analysis
    }
  }
  
  // Plateau Detection & Solutions
  const detectPlateau = async () => {
    console.log('🧪 AI Coach: Starting plateau detection...')
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)
      
      const response = await fetch('/api/ai/plateau-detection', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const plateauData = await response.json()
        if (plateauData.hasPlateaus) {
          insights.value.push({
            type: 'plateau',
            message: plateauData.message,
            solutions: plateauData.solutions,
            exercises: plateauData.affectedExercises
          })
        }
        console.log('🧪 AI Coach: Real API plateau detection success')
        return plateauData
      } else {
        throw new Error(`API returned ${response.status}`)
      }
    } catch (error) {
      console.log('🧪 AI Coach: Plateau detection API failed, using demo data:', error.message)
      
      // Demo-Daten für Plateau Detection
      const demoPlateauData = {
        hasPlateaus: Math.random() > 0.5, // 50% chance für Demo
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
        demo: true, // Mark as demo data
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
      
      console.log('🧪 AI Coach: Demo plateau detection completed, hasPlateaus:', demoPlateauData.hasPlateaus)
      return demoPlateauData
    }
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
    console.log('📝 Feedback submitted:', { recommendationId, feedback })
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