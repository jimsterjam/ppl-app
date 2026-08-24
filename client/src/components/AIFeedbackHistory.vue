<template>
  <div class="ai-feedback-history glass">
    <div class="header">
      <h3>{{ t('feedbackHistory.title') || 'KI-Feedback Verlauf' }}</h3>
    </div>

    <div v-if="loading && items.length === 0" class="state-message">
      <div class="spinner"></div>
    </div>

    <div v-else-if="error" class="state-message error">
      <p>{{ error }}</p>
      <button class="retry-btn" type="button" @click="load(1)">
        {{ t('common.retry') || 'Erneut versuchen' }}
      </button>
    </div>

    <div v-else-if="items.length === 0" class="empty-state">
      <div class="empty-icon">🤖</div>
      <p>{{ t('feedbackHistory.empty') || 'Noch kein KI-Feedback vorhanden. Schließe ein Workout ab, um dein erstes Feedback zu erhalten.' }}</p>
    </div>

    <div v-else class="feedback-list">
      <div
        v-for="item in items"
        :key="item.workoutId"
        class="feedback-item"
        :class="{ expanded: expandedId === item.workoutId }"
        @click="toggle(item.workoutId)"
      >
        <div class="feedback-summary">
          <div class="feedback-info">
            <span class="feedback-name">{{ item.name || 'Workout' }}</span>
            <span class="feedback-date">{{ formatDate(item.ai_generated_at || item.date) }}</span>
          </div>
          <span class="chevron" :class="{ open: expandedId === item.workoutId }">›</span>
        </div>

        <div v-if="expandedId === item.workoutId" class="feedback-text">
          {{ item.ai_feedback }}
        </div>
      </div>

      <button
        v-if="hasMore"
        class="load-more-btn"
        type="button"
        :disabled="loading"
        @click.stop="loadMore"
      >
        {{ loading ? (t('common.loading') || 'Lädt…') : (t('feedbackHistory.loadMore') || 'Mehr laden') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { fetchWorkoutFeedbacks } from '@/api/workouts'
import { logger } from '@/utils/logger'

const { t, locale } = useI18n()
const { getIdToken } = useFirebaseAuth()

const items = ref([])
const loading = ref(false)
const error = ref(null)
const page = ref(1)
const hasMore = ref(false)
const expandedId = ref(null)

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''
  const loc = String(locale.value).startsWith('de') ? 'de-DE' : 'en-US'
  return date.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function load(targetPage = 1) {
  loading.value = true
  error.value = null
  try {
    const token = await getIdToken().catch(() => null)
    const res = await fetchWorkoutFeedbacks(token, { page: targetPage, limit: 20 })
    const newItems = Array.isArray(res?.items) ? res.items : []
    items.value = targetPage === 1 ? newItems : [...items.value, ...newItems]
    hasMore.value = Boolean(res?.hasMore)
    page.value = targetPage
  } catch (err) {
    logger.error('[AIFeedbackHistory] load failed', err?.message)
    error.value = t('feedbackHistory.error') || 'Feedback-Verlauf konnte nicht geladen werden'
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (loading.value || !hasMore.value) return
  load(page.value + 1)
}

onMounted(() => load(1))
</script>

<style scoped>
.ai-feedback-history {
  padding: 1.25rem;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  text-align: center;
}

.state-message.error p {
  color: var(--error, #FF3B30);
  margin: 0;
}

.retry-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border, #ddd);
  background: var(--secondary-bg, #f5f5f5);
  cursor: pointer;
}

.spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--border, #ddd);
  border-top-color: var(--primary, #007AFF);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 1.5rem 0.5rem;
  color: var(--muted);
}

.empty-icon {
  font-size: 2rem;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feedback-item {
  border-radius: 0.75rem;
  background: var(--surface);
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.feedback-item:active {
  background: var(--surface-strong);
}

.feedback-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.feedback-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.feedback-name {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feedback-date {
  font-size: 0.8rem;
  color: var(--muted);
}

.chevron {
  font-size: 1.4rem;
  color: var(--muted);
  transform: rotate(90deg);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(-90deg);
}

.feedback-text {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line-soft);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.6;
  /* War fest auf var(--text-primary, #000) - diese Variable existiert im Design-System
     nicht (style.css definiert --fg/--muted), fiel also immer auf schwarz zurück. Auf dem
     im Dark Mode dunklen .glass-Panel-Hintergrund war der aufgeklappte Feedback-Text dadurch
     schwarz auf dunkel - nicht lesbar. */
  color: var(--fg);
}

.load-more-btn {
  margin-top: 0.25rem;
  padding: 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border, #ddd);
  background: transparent;
  color: var(--primary, #007AFF);
  font-weight: 500;
  cursor: pointer;
}

.load-more-btn:disabled {
  opacity: 0.6;
}

/* Der vorherige @media (prefers-color-scheme: dark)-Block wurde entfernt: er reagierte auf
   die OS-Einstellung statt auf das im Theme-Store gewählte App-Theme ([data-theme] am Root)
   und deckte ohnehin nicht die eigentliche Ursache ab (siehe .feedback-text oben). Hintergründe
   kommen jetzt direkt über var(--surface)/var(--surface-strong) theme-aware. */
</style>
