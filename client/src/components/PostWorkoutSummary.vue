<template>
  <div v-if="showSummary" class="post-workout-summary glass">
    <div class="summary-header">
      <h2>{{ t('postWorkout.title') || 'Workout abgeschlossen!' }}</h2>
      <button class="close-btn" type="button" @click="dismissSummary" aria-label="Schließen">×</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="summary-content loading">
      <div class="spinner"></div>
      <p>{{ t('postWorkout.analyzing') || 'Analysiere deinen Trainingsfortschritt...' }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="summary-content error">
      <p class="error-message">{{ error }}</p>
      <button class="secondary" type="button" @click="dismissSummary">{{ t('common.close') || 'Schließen' }}</button>
    </div>

    <!-- Success State -->
    <div v-else-if="feedback" class="summary-content success">
      <div class="feedback-section">
        <h3>{{ t('postWorkout.feedback') || 'Dein Feedback' }}</h3>
        <div class="feedback-text">{{ feedback }}</div>
      </div>

      <div class="summary-actions">
        <button class="primary" type="button" @click="dismissSummary">
          {{ t('postWorkout.gotIt') || 'Verstanden' }}
        </button>
        <button class="secondary" type="button" @click="goToAnalytics">
          {{ t('postWorkout.seeDetails') || 'Details anschauen' }}
        </button>
      </div>
    </div>

    <!-- Fallback: No Feedback (AI unavailable but workout saved) -->
    <div v-else class="summary-content fallback">
      <p>{{ t('postWorkout.saved') || 'Dein Workout wurde gespeichert!' }}</p>
      <button class="primary" type="button" @click="dismissSummary">
        {{ t('common.continue') || 'Weiter' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'
import axios from 'axios'

const props = defineProps({
  workoutId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const router = useRouter()
const { getIdToken } = useFirebaseAuth()

const showSummary = ref(true)
const loading = ref(true)
const feedback = ref(null)
const error = ref(null)

/**
 * Lade AI-Feedback nach Workout-Speicherung
 */
async function loadAIFeedback() {
  if (!props.workoutId) {
    logger.warn('[PostWorkoutSummary] No workoutId provided')
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null
    feedback.value = null

    const token = await getIdToken().catch(() => null)

    // Rufe AI-Analysis Endpunkt auf
    const response = await axios.post(
      `/api/workouts/${props.workoutId}/ai-analysis`,
      {},
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 60000 // AI braucht Zeit
      }
    )

    if (response.data?.ai_feedback) {
      feedback.value = response.data.ai_feedback
      logger.debug('[PostWorkoutSummary] Feedback loaded', {
        workoutId: props.workoutId,
        provider: response.data.ai_metadata?.provider
      })
    } else {
      // Kein Feedback, aber kein Error
      logger.debug('[PostWorkoutSummary] No feedback in response', { response: response.data })
    }

  } catch (err) {
    logger.error('[PostWorkoutSummary] Error loading feedback', {
      workoutId: props.workoutId,
      error: err.message
    })

    // Nicht tödlich - Workout wurde trotzdem gespeichert
    error.value = err.response?.data?.message ||
                  err.message ||
                  t('postWorkout.error') ||
                  'Feedback konnte nicht geladen werden'
  } finally {
    loading.value = false
  }
}

function dismissSummary() {
  showSummary.value = false
  emit('close')
}

function goToAnalytics() {
  dismissSummary()
  // Scroll zu Workout-Details oder Analytics
  router.push({
    name: 'stats',
    query: { highlightWorkoutId: props.workoutId }
  })
}

onMounted(() => {
  loadAIFeedback()
})
</script>

<style scoped>
.post-workout-summary {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 80vh;
  padding: 2rem 1.5rem 1.5rem;
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: var(--text-secondary, #666);
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}

.close-btn:active {
  background-color: rgba(0, 0, 0, 0.05);
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-height: 50vh;
  overflow-y: auto;
}

.summary-content.loading {
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border, #ddd);
  border-top-color: var(--primary, #007AFF);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-content.loading p {
  color: var(--text-secondary, #666);
  margin: 0;
  text-align: center;
}

.summary-content.error {
  background-color: rgba(255, 59, 48, 0.05);
  padding: 1rem;
  border-radius: 0.5rem;
}

.error-message {
  color: var(--error, #FF3B30);
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
}

.feedback-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feedback-section h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.feedback-text {
  color: var(--text-primary, #000);
  line-height: 1.6;
  font-size: 0.95rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.summary-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.primary, .secondary {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary {
  background-color: var(--primary, #007AFF);
  color: white;
}

.primary:active {
  opacity: 0.8;
}

.secondary {
  background-color: var(--secondary-bg, #f5f5f5);
  color: var(--primary, #007AFF);
  border: 1px solid var(--border, #ddd);
}

.secondary:active {
  background-color: var(--border, #ddd);
}

.summary-content.fallback {
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.summary-content.fallback p {
  margin: 0 0 1rem 0;
  color: var(--text-secondary, #666);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .post-workout-summary {
    background: rgba(20, 20, 20, 0.95);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .summary-content.error {
    background-color: rgba(255, 59, 48, 0.1);
  }

  .secondary {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .secondary:active {
    background-color: rgba(255, 255, 255, 0.2);
  }
}

@media (max-height: 600px) {
  .post-workout-summary {
    max-height: 100vh;
    padding: 1.5rem 1rem 1rem;
  }

  .summary-content {
    max-height: 30vh;
  }
}
</style>
