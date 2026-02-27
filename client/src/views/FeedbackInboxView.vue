<template>
  <div class="feedback-inbox">
    <HeaderBar :title="$t('feedback.title')" />

    <main class="content">
      <section class="glass inbox-card">
        <div class="inbox-header">
          <div>
            <h3 class="inbox-title">{{ $t('feedback.inboxTitle') }}</h3>
            <p class="muted">{{ $t('feedback.inboxHint') }}</p>
          </div>

          <button class="outline" type="button" :disabled="loading" @click="loadThreads(true)">
            {{ loading ? $t('common.loading') : $t('feedback.refresh') }}
          </button>
        </div>

        <div v-if="blockedReason" class="muted">{{ blockedReason }}</div>
        <div v-else-if="loading" class="muted">{{ $t('common.loading') }}</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else-if="!threads.length" class="muted">{{ $t('feedback.empty') }}</div>

        <div v-else class="thread-list">
          <button
            v-for="th in threads"
            :key="th.workoutId"
            class="thread"
            type="button"
            @click="openThread(th)"
          >
            <div class="thread-top">
              <div class="thread-main">
                <div class="thread-title">{{ th.workout?.name || $t('feedback.unknownWorkout') }}</div>
                <div class="thread-sub">
                  {{ (th.workout?.type || '').toUpperCase() }}
                  <span v-if="th.workout?.date"> · {{ formatDate(th.workout.date) }}</span>
                </div>
              </div>

              <div class="thread-time">{{ formatDateTime(th.lastMessage?.createdAt) }}</div>
            </div>

            <div class="thread-preview">
              <span class="preview-sender">
                {{ th.lastMessage?.sender === 'client' ? $t('feedback.you') : $t('feedback.coach') }}:
              </span>
              <span class="preview-text">{{ th.lastMessage?.text }}</span>
            </div>
          </button>
        </div>
      </section>
    </main>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { isOnline } from '@/utils/offlineStorage'
import { listWorkoutChatThreads } from '@/api/account'

const router = useRouter()
const { t: $t, locale } = useI18n()
const { getIdToken } = useFirebaseAuth()

const threads = ref([])
const loading = ref(false)
const error = ref('')

const blockedReason = computed(() => {
  if (!isOnline()) return $t('feedback.offlineHint')
  return ''
})

function formatDate(d) {
  try {
    const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
    return new Date(d).toLocaleDateString(loc)
  } catch {
    return ''
  }
}

function formatDateTime(d) {
  if (!d) return ''
  try {
    const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
    return new Date(d).toLocaleString(loc)
  } catch {
    return ''
  }
}

async function loadThreads(force = false) {
  if (loading.value) return
  error.value = ''
  if (blockedReason.value) return

  loading.value = true
  try {
    const token = await getIdToken().catch(() => null)
    if (!token) return
    const items = await listWorkoutChatThreads(token, 60)
    threads.value = Array.isArray(items) ? items : []
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

function openThread(th) {
  const workoutId = th?.workoutId
  if (!workoutId) return
  router.push({ name: 'workout-detail', params: { id: workoutId }, query: { chat: '1' } })
}

onMounted(() => {
  void loadThreads(false)
})
</script>

<style scoped>
.feedback-inbox {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 70px;
}

.content {
  padding: 24px clamp(16px, 4vw, 48px);
  display: flex;
  justify-content: center;
}

.inbox-card {
  width: 100%;
  max-width: 820px;
  padding: clamp(18px, 3vw, 26px);
}

.inbox-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.inbox-title {
  margin: 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.95rem;
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 6px 0 0;
}

.error {
  color: color-mix(in srgb, var(--danger-color) 70%, var(--fg));
  font-size: 0.9rem;
}

.outline {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line-soft));
  border-radius: 999px;
  padding: 10px 14px;
  min-height: 42px;
  color: var(--fg);
  cursor: pointer;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.78rem;
  white-space: nowrap;
}

.outline:hover {
  filter: brightness(1.04);
}

.outline:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.thread-list {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.thread {
  width: 100%;
  text-align: left;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  cursor: pointer;
}

.thread:hover {
  background: color-mix(in srgb, var(--bg-elevated) 98%, transparent);
}

.thread-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.thread-main {
  min-width: 0;
}

.thread-title {
  font-weight: 800;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-sub {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 4px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.thread-time {
  color: var(--muted);
  font-size: 0.82rem;
  white-space: nowrap;
}

.thread-preview {
  margin-top: 10px;
  color: var(--fg);
  font-size: 0.95rem;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-sender {
  color: color-mix(in srgb, var(--accent) 75%, var(--fg));
  font-weight: 700;
  margin-right: 6px;
}

.preview-text {
  color: color-mix(in srgb, var(--fg) 92%, var(--muted));
}
</style>
