<template>
  <div class="features-test-page">
    <HeaderBar title="🧪 AI Workout Coach" />
    
    <!-- AI Disclaimer Modal -->
    <AIDisclaimerModal 
      :show="showAIDisclaimer"
      @accept="onAIConsentAccept"
      @decline="onAIConsentDecline"
    />
    
    <div class="test-content">
      <!-- AI Coach Section -->
      <section class="test-section">
        <h3>🤖 AI Workout Coach</h3>
        
        <!-- AI Consent Status -->
        <div class="test-card ai-consent-card">
          <h4>AI Status</h4>
          <div class="consent-status">
            <div class="status-item">
              <label>AI Consent:</label>
              <span :class="aiStore.hasConsent ? 'success' : 'warning'">
                {{ aiStore.hasConsent ? '✅ Erteilt' : '⚠️ Nicht erteilt' }}
              </span>
            </div>
            <div class="status-item">
              <label>AI Verfügbar:</label>
              <span :class="aiStore.canUseAI ? 'success' : 'error'">
                {{ aiStore.canUseAI ? '✅ Ja' : '❌ Nein' }}
              </span>
            </div>
          </div>
          
          <div class="test-actions">
            <button @click="showAIDisclaimer = true" v-if="!aiStore.hasConsent">
              🤖 AI Coach aktivieren
            </button>
            <button @click="revokeAIConsent" v-if="aiStore.hasConsent" class="warning">
              Consent widerrufen
            </button>
          </div>
        </div>
        
        <!-- AI Workout Configuration -->
        <div class="test-card" v-if="aiStore.canUseAI">
          <h4>🎯 Workout Konfiguration</h4>
          
          <div class="config-form">
            <!-- Workout-Dauer -->
            <div class="config-item">
              <label for="duration-slider">
                <span class="config-label">⏱️ Workout-Dauer</span>
                <span class="config-value">{{ workoutConfig.timeAvailable }} Minuten</span>
              </label>
              <input 
                id="duration-slider"
                type="range" 
                min="15" 
                max="90" 
                step="15" 
                v-model="workoutConfig.timeAvailable"
                class="config-slider"
              />
              <div class="slider-labels">
                <span>15min</span>
                <span>30min</span>
                <span>45min</span>
                <span>60min</span>
                <span>90min</span>
              </div>
            </div>
            
            <!-- Experience Level -->
            <div class="config-item">
              <label for="level-select">
                <span class="config-label">📈 Erfahrungslevel</span>
              </label>
              <select 
                id="level-select"
                v-model="workoutConfig.experienceLevel" 
                class="config-select"
              >
                <option value="beginner">🟢 Anfänger</option>
                <option value="intermediate">🟡 Fortgeschritten</option>
                <option value="advanced">🔴 Experte</option>
              </select>
            </div>
            
            <!-- Intensität -->
            <div class="config-item">
              <label for="intensity-slider">
                <span class="config-label">🔥 Intensität</span>
                <span class="config-value">{{ getIntensityLabel(workoutConfig.intensity) }}</span>
              </label>
              <input 
                id="intensity-slider"
                type="range" 
                min="1" 
                max="5" 
                step="1" 
                v-model="workoutConfig.intensity"
                class="config-slider intensity-slider"
              />
              <div class="slider-labels">
                <span>😌 Leicht</span>
                <span>🔥 Intensiv</span>
              </div>
            </div>
            
            <!-- Workout-Fokus -->
            <div class="config-item">
              <label for="focus-select">
                <span class="config-label">🎯 Fokus</span>
              </label>
              <select 
                id="focus-select"
                v-model="workoutConfig.focus" 
                class="config-select"
              >
                <option value="push">💪 Push (Brust, Schultern, Trizeps)</option>
                <option value="pull">🤲 Pull (Rücken, Bizeps)</option>
                <option value="legs">🦵 Beine</option>
                <option value="fullbody">🏃 Ganzkörper</option>
              </select>
            </div>
            
              <!-- Equipment -->
            <div class="config-item">
              <label class="config-label">🏋️ Verfügbare Ausrüstung</label>
              <div class="equipment-grid">
                <label v-for="(equipment, idx) in availableEquipment" :key="`eq-${idx}`" class="equipment-checkbox">
                  <input 
                    type="checkbox" 
                    :value="equipment.id" 
                    v-model="workoutConfig.equipment"
                  />
                  <span class="equipment-label">{{ equipment.icon }} {{ equipment.name }}</span>
                </label>
              </div>
            </div>            <!-- AI Request Button -->
            <div class="config-actions">
              <button 
                @click="requestAIWorkout" 
                :disabled="aiProcessing"
                class="ai-request-btn"
              >
                <span v-if="aiProcessing">🤖 Generiere Workout...</span>
                <span v-else>🚀 Workout generieren</span>
              </button>
              <button @click="resetConfig" :disabled="aiProcessing" class="ai-request-btn secondary">🔄 Reset</button>
            </div>
          </div>
        </div>

        <!-- AI Recommendation Result -->
        <div class="test-card" v-if="aiRecommendation">
          <h4>🤖 AI Empfehlung</h4>
          
          <div class="ai-result">
            <div class="recommendation">
              <div class="rec-header">
                <strong>{{ aiRecommendation.workoutName || 'AI Workout' }}</strong>
                <div class="source-indicator" :class="getSourceClass(aiRecommendation.metadata?.source)">
                  {{ getSourceLabel(aiRecommendation.metadata?.source) }}
                </div>
              </div>
              
              <div class="rec-details">
                <div class="detail-item">
                  <span class="detail-label">Dauer:</span>
                  <span>{{ aiRecommendation.estimatedDuration || 'N/A' }} Min</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Übungen:</span>
                  <span>{{ aiRecommendation.exercises?.length || 0 }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Confidence:</span>
                  <span class="confidence-badge" :class="getConfidenceClass(aiRecommendation.metadata?.confidence)">
                    {{ aiRecommendation.metadata?.confidence || 0 }}%
                  </span>
                </div>
              </div>
              
              <!-- Exercises -->
              <div class="exercises-preview">
                <h5>💪 Übungen</h5>
                <div class="exercise-list">
                  <div v-for="(exercise, idx) in aiRecommendation.exercises" :key="`ex-${idx}-${exercise._id || exercise.name}`" class="exercise-item">
                    <span class="exercise-name">{{ exercise.name }}</span>
                    <span class="exercise-details">{{ exercise.sets }}x{{ exercise.reps }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <div class="workout-actions">
                <button @click="startWorkoutNow" class="action-btn primary">
                  ▶️ Jetzt starten
                </button>
                <button @click="saveToBuilder" class="action-btn secondary">
                  ✏️ Im Builder bearbeiten
                </button>
                <button @click="saveForLater" class="action-btn secondary">
                  💾 Für später speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAICoachStore } from '@/stores/aiCoachStore'
import { useToastStore } from '@/stores/toastStore'
import HeaderBar from '@/components/HeaderBar.vue'
import AIDisclaimerModal from '@/components/AIDisclaimerModal.vue'
import { http } from '@/api/http'
import { logger } from '@/utils/logger'

// Composables
const { t } = useI18n()
const router = useRouter()
const aiStore = useAICoachStore()
const toast = useToastStore()

// Reactive state
const showAIDisclaimer = ref(false)
const aiProcessing = ref(false)
const aiRecommendation = ref(null)

const workoutConfig = ref({
  timeAvailable: 45,
  experienceLevel: 'intermediate',
  intensity: 3,
  focus: 'push',
  equipment: ['bodyweight']
})

const availableEquipment = ref([
  { id: 'dumbbells', name: 'Kurzhanteln', icon: '🏋️' },
  { id: 'barbell', name: 'Langhantel', icon: '🥇' },
  { id: 'pull_up_bar', name: 'Klimmzugstange', icon: '🤸' },
  { id: 'bench', name: 'Bank', icon: '🪑' },
  { id: 'cable_machine', name: 'Kabelzug', icon: '🔗' },
  { id: 'machine', name: 'Maschinen', icon: '⚙️' },
  { id: 'bodyweight', name: 'Körpergewicht', icon: '🧘' }
])

// Methods
const onAIConsentAccept = () => {
  logger.debug('Consent akzeptiert!')
  aiStore.grantConsent()
  showAIDisclaimer.value = false
  toast.show('AI Coach aktiviert! 🤖', 'success')
  setTimeout(() => {
    logger.debug('hasConsent:', aiStore.hasConsent)
  }, 500)
}

const onAIConsentDecline = () => {
  logger.debug('Consent abgelehnt!')
  showAIDisclaimer.value = false
  toast.show('AI Coach wurde nicht aktiviert', 'info')
}

const revokeAIConsent = () => {
  aiStore.revokeConsent()
  aiRecommendation.value = null
  workoutConfig.value = {
    timeAvailable: 45,
    experienceLevel: 'intermediate',
    intensity: 3,
    focus: 'push',
    equipment: ['bodyweight']
  }
  toast.show('AI Consent widerrufen', 'warning')
}

const getIntensityLabel = (intensity) => {
  const labels = {
    1: '😌 Sehr leicht',
    2: '🙂 Leicht', 
    3: '😊 Moderat',
    4: '😅 Intensiv',
    5: '🔥 Sehr intensiv'
  }
  return labels[intensity] || 'Moderat'
}

const requestAIWorkout = async () => {
  if (!aiStore.canUseAI) {
    toast.show('AI Coach nicht verfügbar', 'error')
    return
  }
  aiProcessing.value = true
  aiRecommendation.value = null
  try {
    const response = await http.post('/workouts/ai-suggestion', workoutConfig.value)
    aiRecommendation.value = response.data
    toast.show('AI Workout generiert! 🤖', 'success')
  } catch (error) {
    logger.error('AI Workout Request failed:', error)
    toast.show('Fehler beim Generieren des Workouts', 'error')
    aiRecommendation.value = null
  } finally {
    aiProcessing.value = false
  }
}

const startWorkoutNow = () => {
  if (!aiRecommendation.value) return
  
  const workout = {
    name: aiRecommendation.value.workoutName,
    exercises: aiRecommendation.value.exercises,
    estimatedDuration: aiRecommendation.value.estimatedDuration,
    type: workoutConfig.value.focus,
    metadata: {
      source: 'ai_generated',
      generatedAt: new Date().toISOString()
    }
  }
  
  router.push({
    path: '/workout-detail',
    query: { 
      template: 'ai',
      type: workoutConfig.value.focus
    },
    state: { workout }
  })
}

const saveToBuilder = () => {
  logger.debug('🚀 FeaturesTestView - saveToBuilder CALLED')
  
  if (!aiRecommendation.value) {
    logger.error('❌ saveToBuilder - aiRecommendation ist leer!')
    alert('Fehler: Kein AI-Workout vorhanden!')
    return
  }
  
  const workout = {
    name: aiRecommendation.value.workoutName,
    exercises: aiRecommendation.value.exercises,
    type: workoutConfig.value.focus,
    metadata: {
      source: 'ai_generated',
      generatedAt: new Date().toISOString()
    }
  }
  
  logger.debug('� saveToBuilder - Workout:', workout)
  logger.debug('📦 saveToBuilder - Exercises Count:', workout.exercises?.length)
  
  // Nutze localStorage für robuste Datenübertragung
  try {
    const workoutStr = JSON.stringify(workout)
    localStorage.setItem('ai_workout_to_builder', workoutStr)
    logger.debug('💾 saveToBuilder - In localStorage gespeichert')
  } catch (e) {
    logger.error('❌ saveToBuilder - localStorage Error:', e)
    alert('Fehler beim Speichern: ' + e.message)
    return
  }
  
  logger.debug('🔀 saveToBuilder - Navigiere zu /workout-builder...')
  
  router.push({
    path: '/workout-builder',
    query: { 
      template: 'ai',
      type: workoutConfig.value.focus,
      edit: 'true'
    }
  })
}

const saveForLater = async () => {
  if (!aiRecommendation.value) return
  
  try {
    const workout = {
      name: aiRecommendation.value.workoutName,
      exercises: aiRecommendation.value.exercises,
      estimatedDuration: aiRecommendation.value.estimatedDuration,
      type: workoutConfig.value.focus,
      metadata: {
        source: 'ai_generated',
        generatedAt: new Date().toISOString(),
        savedForLater: true
      }
    }
    
    await http.post('/workouts', workout)
    toast.show('Workout gespeichert! 💾', 'success')
  } catch (error) {
    logger.error('Failed to save workout:', error)
    toast.show('Fehler beim Speichern', 'error')
  }
}

const getSourceClass = (source) => {
  if (source?.includes('openai') || source?.includes('gpt')) return 'ai-source'
  if (source?.includes('demo') || source?.includes('fallback')) return 'demo-source'
  return 'unknown-source'
}

const getSourceLabel = (source) => {
  if (source?.includes('openai') || source?.includes('gpt')) return '🤖 OpenAI'
  if (source === 'demo_no_api_key') return '🧪 Demo (Kein API Key)'
  if (source === 'fallback_after_ai_error') return '🧪 Demo (Quota exceeded)'
  if (source?.includes('demo')) return '🧪 Demo'
  if (source?.includes('fallback')) return '🧪 Fallback'
  return `❓ ${source || 'Unbekannt'}`
}

const getConfidenceClass = (confidence) => {
  if (confidence >= 80) return 'high'
  if (confidence >= 60) return 'medium'
  return 'low'
}

// Reset-Konfiguration
const resetConfig = () => {
  workoutConfig.value = {
    timeAvailable: 45,
    experienceLevel: 'intermediate',
    intensity: 3,
    focus: 'push',
    equipment: ['bodyweight']
  }
  aiRecommendation.value = null
}

// Lifecycle
onMounted(() => {
  aiStore.initializeAI()
})
</script>

<style scoped>
.features-test-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding-bottom: 80px;
}

.test-content {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin-bottom: 30px;
}

.test-section h3 {
  color: var(--text-primary);
  margin-bottom: 20px;
  font-size: 1.4rem;
}

.test-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.test-card h4 {
  color: var(--text-primary);
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.consent-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-item label {
  font-weight: 500;
  color: var(--text-secondary);
}

.success {
  color: var(--success-color);
  background: #eafbe7;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 6px;
}
.warning {
  color: var(--warning-color);
  background: #fff3e0;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 6px;
}
.error {
  color: var(--error-color);
  background: #fdecea;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 6px;
}

.ai-consent-card {
  border: 2px solid var(--primary-color);
  background: var(--bg-secondary);
}

.test-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 15px;
}

.test-actions button,
.config-actions button {
  background: var(--primary-color);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.test-actions button:hover,
.config-actions button:hover {
  background: var(--primary-hover, #0057a8);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.test-actions button.warning {
  background: var(--warning-color);
}

.test-actions button.warning:hover {
  background: #e88a00;
}

.config-actions button.secondary {
  background: #999;
}

.config-actions button.secondary:hover {
  background: #777;
}

.config-actions button:disabled {
  background: #ccc;
  color: #888;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.config-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.config-value {
  font-weight: 700;
  color: var(--primary-color);
  font-size: 1.1rem;
}

.config-select {
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
}

.config-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(0,116,217,0.1);
}

.config-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--border-color);
  outline: none;
  cursor: pointer;
  appearance: none;
}

.config-slider::-webkit-slider-thumb {
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  border: 2px solid white;
}

.config-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.equipment-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.equipment-checkbox:hover {
  border-color: var(--primary-color);
  background: var(--bg-secondary);
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.equipment-checkbox input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color);
}

.equipment-label {
  cursor: pointer;
  flex: 1;
}

.equipment-checkbox input[type="checkbox"] {
  margin: 0;
}

.equipment-label {
  font-size: 14px;
  color: var(--text-primary);
}

.config-actions {
  margin-top: 20px;
}

.ai-request-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.ai-request-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.ai-request-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-result {
  border-radius: 10px;
  border: 2px solid var(--primary-color);
  padding: 20px;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.rec-header strong {
  color: var(--text-primary);
  font-size: 1.1rem;
}

.source-indicator {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.ai-source { background: var(--primary-color); color: white; }
.demo-source { background: var(--warning-color); color: white; }
.unknown-source { background: var(--text-secondary); color: white; }

.rec-details {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.confidence-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: bold;
}

.confidence-badge.high { background: var(--success-color); color: white; }
.confidence-badge.medium { background: var(--warning-color); color: white; }
.confidence-badge.low { background: var(--error-color); color: white; }

.exercises-preview h5 {
  color: var(--text-primary);
  margin-bottom: 10px;
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.exercise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.exercise-name {
  font-weight: 500;
  color: var(--text-primary);
}

.exercise-details {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: bold;
}

.workout-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 120px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn.primary {
  background: var(--primary-color);
  color: var(--text-primary);
}

.action-btn.secondary {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .test-content {
    padding: 15px;
  }
  
  .rec-details {
    gap: 15px;
  }
  
  .workout-actions {
    flex-direction: column;
  }
  
  .action-btn {
    min-width: 100%;
  }
}
</style>