<template>
  <div class="dashboard">
    <!-- Header -->
    <HeaderBar
      :title="userSubtitle || $t('dashboard.title')"
      :show-user-name="false"
    >
      <template #leading>
        <button
          class="dashboard-avatar"
          type="button"
          :aria-label="$t('settings.title')"
          @click="router.push({ name: 'settings' })"
        >
          <img
            v-if="avatarSrc && !avatarLoadError"
            class="dashboard-avatar__img"
            :src="avatarSrc"
            alt=""
            @error="onAvatarImgError"
          />
          <span v-else class="dashboard-avatar__fallback">{{ avatarInitials }}</span>
        </button>
      </template>
    </HeaderBar>

    <main class="dashboard-content">

      <!-- Loading State -->
      <div v-if="store.isWorkoutsLoading" class="loading-section">
        <div class="spinner"></div>
        <p>{{ $t('dashboard.loading') }}</p>
      </div>

      <!-- Error State -->
      <EmptyState 
        v-else-if="store.hasError"
        icon="⚠️"
        :title="$t('dashboard.connectionErrorTitle')"
        :message="store.error"
        :action-text="$t('dashboard.retry')"
        @action="retryLoadWorkouts"
      />

      <!-- No Workouts -->
      <EmptyState 
        v-else-if="store.workouts.length === 0"
        icon="💪"
        :title="$t('dashboard.noWorkoutsTitle')"
        :message="$t('dashboard.noWorkoutsMsg')"
        :action-text="$t('dashboard.startFirst')"
        @action="() => startWorkout(nextType)"
      />

      <!-- Normal State -->
      <template v-else>
        <!-- Success Message -->
        <div v-if="workoutCreated" class="success-message">
          <div class="success-content">
            <span class="success-icon">✅</span>
            <h3>{{ $t('dashboard.successCreated') }}</h3>
            <p>{{ capitalize(selectedWorkoutType) }} Day {{ $t('dashboard.successCreated') }}</p>
          </div>
        </div>

        <!-- Action Hub -->
          <section class="today">
            <div class="next-card glass">
              <div class="next-header">
                <div>
                  <h3>{{ $t('dashboard.nextWorkout') }}</h3>
                  <span v-if="lastLabel" class="muted">{{ $t('dashboard.last') }}: {{ lastLabel }}</span>
                </div>
              </div>
              <p class="next-title">{{ nextLabel }}</p>
              <p class="action-lead">{{ actionLead }}</p>

              <!-- Draft Notice -->
              <div v-if="hasDraft" class="draft-notice">
                <span class="draft-icon">📝</span>
                <span>{{ $t('dashboard.draftAvailable') }}</span>
                <div v-if="draftTimestamp" class="draft-timestamp">
                  {{ $t('dashboard.lastSaved') }}: {{ draftTimestamp.toLocaleString() }}
                </div>
              </div>

              <div class="action-buttons">
                <button 
                  v-if="hasDraft"
                  class="primary-action"
                  :disabled="workoutCreated"
                  @click="startWorkout(draftId)"
                >
                  📝 {{ resumeLabel }}
                </button>
                <button 
                  class="primary-action"
                  :class="{ ghost: hasDraft }"
                  :disabled="workoutCreated"
                  @click="hasDraft ? startNewWorkout() : startWorkout(nextType)"
                >
                  {{ primaryActionLabel }}
                </button>
              </div>
            </div>
          </section>

          <!-- Feedback Inbox Preview (skalierbar, aber dezent) -->
          <section v-if="feedbackThreads.length" class="feedback-section">
            <div class="feedback-card glass">
              <div class="feedback-header">
                <div>
                  <h3 class="feedback-title">{{ $t('feedback.title') }}</h3>
                  <p class="muted" style="margin-top:6px">{{ $t('feedback.inboxHint') }}</p>
                </div>
                <button class="feedback-btn" type="button" :disabled="feedbackLoading" @click="openFeedbackInbox">
                  {{ feedbackLoading ? $t('common.loading') : $t('feedback.inboxTitle') }}
                </button>
              </div>

              <div class="feedback-preview" v-if="feedbackThreads[0]">
                <div class="preview-top">
                  <div class="preview-workout">
                    <strong>{{ feedbackThreads[0].workout?.name || $t('feedback.unknownWorkout') }}</strong>
                    <span class="preview-meta">
                      {{ (feedbackThreads[0].workout?.type || '').toUpperCase() }}
                    </span>
                  </div>
                  <span class="preview-time">{{ formatPreviewTime(feedbackThreads[0].lastMessage?.createdAt) }}</span>
                </div>
                <div class="preview-text">
                  <span class="preview-sender">
                    {{ feedbackThreads[0].lastMessage?.sender === 'client' ? $t('feedback.you') : $t('feedback.coach') }}:
                  </span>
                  {{ feedbackThreads[0].lastMessage?.text }}
                </div>
              </div>
            </div>
          </section>

          <!-- Recent Workouts -->
          <div class="recent-section">
            <RecentWorkouts :workouts="recentWorkoutsPreview" />
          </div>
      </template>

    </main>

    <!-- Bottom Navigation -->
    <BottomNav />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from "../stores/userStore";
import { useSettingsStore } from '@/stores/settingsStore'
import { listWorkoutChatThreads } from '@/api/account'
import { isOnline } from '@/utils/offlineStorage'

import HeaderBar from "../components/HeaderBar.vue";
import BottomNav from "../components/BottomNav.vue";
import EmptyState from "../components/EmptyState.vue";
import RecentWorkouts from "../components/RecentWorkouts.vue";
import { logger } from '@/utils/logger'

const store = useUserStore()
const settings = useSettingsStore()
const { t: $t } = useI18n()
const router = useRouter()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const PROGRESS_RANGE_DAYS = 120

const user = ref(null)
const isSignedIn = ref(false)
const selectedWorkoutType = ref('push')
const workoutCreated = ref(false)

// Feedback inbox preview state
const feedbackThreads = ref([])
const feedbackLoading = ref(false)
let feedbackLoadedAt = 0

const nextLabel = computed(() => store.nextWorkoutLabel)
const lastLabel = computed(() => store.lastWorkoutLabel)
const hasDraft = computed(() => {
  const hd = store.hasDraft
  return hd
})
const draftType = computed(() => store.draftType)
const draftTimestamp = computed(() => store.draftTimestamp)
const draftId = computed(() => store.workouts.find(w => w.isDraft)?._id)

const resumeLabel = computed(() => $t('dashboard.resumeDraft'))

const primaryActionLabel = computed(() => hasDraft.value ? $t('dashboard.startNew') : $t('dashboard.startNext'))

const actionLead = computed(() => hasDraft.value
  ? 'Du hast noch ein gespeichertes Workout. Entscheide, ob du es fortsetzt oder frisch beginnst.'
  : 'Wähle dein nächstes Workout und leg direkt los.')

const nextType = computed(() => store.nextWorkoutType || 'push')

const recentWorkoutsPreview = computed(() => (store.workouts || []).slice(0, 3))

const userSubtitle = computed(() => {
  const preferred = (settings.username || '').trim()
  if (preferred) return preferred
  const displayName = (user.value?.displayName || user.value?.firstName || '').trim()
  return displayName || ''
})

const avatarLoadError = ref(false)
const avatarSrc = computed(() => String(settings.avatarUrl || '').trim())

const avatarInitials = computed(() => {
  const name = String(userSubtitle.value || '').trim()
  if (!name) return '👤'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  const a = parts[0].slice(0, 1)
  const b = parts[parts.length - 1].slice(0, 1)
  return (a + b).toUpperCase()
})

function onAvatarImgError() {
  avatarLoadError.value = true
}

// Helper
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Load workouts
async function loadWorkoutsData(force = false) {
  try {
    const token = await getIdToken();
    const currentUser = getCurrentUser ? getCurrentUser() : null;
    logger.debug('🔑 [Dashboard] Token vorhanden:', !!token, 'User:', !!currentUser)
    if (token && currentUser) {
      logger.debug('📥 DashboardView - Lade Workouts', force ? '(forced)' : '(cached allowed)')
      await Promise.all([
        store.loadWorkouts(token, { force }),
        store.loadStats(token, { rangeDays: PROGRESS_RANGE_DAYS }),
        settings.loadProfile(token).catch(() => null),
        loadFeedbackThreads({ token, force })
      ])
      logger.debug('✅ [Dashboard] Workouts geladen')
    } else {
      logger.warn('⚠️ Workouts werden nicht geladen, da kein Token/User vorhanden ist.');
      await Promise.all([
        store.loadWorkouts(null, { force }),
        store.loadStats(null, { rangeDays: PROGRESS_RANGE_DAYS })
      ])
    }
  } catch (error) {
    logger.warn('⚠️ Fehler beim Laden der Workouts mit Token:', error)
    await Promise.all([
      store.loadWorkouts(null, { force }),
      store.loadStats(null, { rangeDays: PROGRESS_RANGE_DAYS })
    ])
  }
}

function openFeedbackInbox() {
  router.push({ name: 'feedback' })
}

function formatPreviewTime(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString()
  } catch {
    return ''
  }
}

async function loadFeedbackThreads({ token = null, force = false } = {}) {
  if (feedbackLoading.value) return
  if (!isOnline()) return

  const now = Date.now()
  if (!force && feedbackLoadedAt && (now - feedbackLoadedAt) < 60_000) return

  feedbackLoading.value = true
  try {
    const authToken = token || (await getIdToken().catch(() => null))
    if (!authToken) return
    const items = await listWorkoutChatThreads(authToken, 5)
    feedbackThreads.value = Array.isArray(items) ? items : []
    feedbackLoadedAt = Date.now()
  } catch {
    // silent; dashboard should stay clean
  } finally {
    feedbackLoading.value = false
  }
}

function retryLoadWorkouts() {
  loadWorkoutsData(true);
}

// Start Workout
function startWorkout(typeOrId) {
  if (hasDraft.value) {
    logger.debug('🏁 [Dashboard] Navigating to workout-detail:', draftId.value)
    router.push({ name: 'workout-detail', params: { id: draftId.value } });
  } else {
    const safeType = typeof typeOrId === 'string' && typeOrId.length > 0 ? typeOrId : 'push';
    logger.debug('🏁 [Dashboard] Navigating to workout-builder with type:', safeType)
    router.push({ name: 'workout-builder', query: { type: safeType } });
  }
}
async function startNewWorkout() {
  await store.clearDraft()
  router.push({ name: 'workout-builder' })
}

// keep a single afterEach registration to avoid duplicates
let afterEachRegistered = false
let removeAfterEachHook = null
const onWindowFocus = () => { if (isSignedIn.value) loadWorkoutsData(true) }

// Mounted: Auth & Refresh
onMounted(() => {
  onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser
    isSignedIn.value = !!firebaseUser
    if (isSignedIn.value && firebaseUser) {
      const token = await firebaseUser.getIdToken()
      logger.debug('📥 DashboardView - Lade Workouts (authState)', 'Token:', token)
      await Promise.all([
        store.loadWorkouts(token, { force: false }),
        store.loadStats(token, { rangeDays: PROGRESS_RANGE_DAYS }),
        settings.loadProfile(token).catch(() => null),
        loadFeedbackThreads({ token, force: true })
      ])
    }
  })

  if (!afterEachRegistered) {
    const unregister = router.afterEach((to, from) => {
      logger.debug('🧭 [Dashboard] router.afterEach:', to.path, from.path)
      if (to.name === 'dashboard' && from.name !== 'dashboard') {
        logger.debug('🔄 [Dashboard] Navigiert zu Dashboard, lade Workouts neu')
        loadWorkoutsData(true);
      }
    })
    afterEachRegistered = true
    if (typeof unregister === 'function') {
      removeAfterEachHook = unregister
    }
  }

  window.addEventListener('focus', onWindowFocus)
})

onUnmounted(() => {
  // remove window listener
  window.removeEventListener('focus', onWindowFocus)
  // if router provides an unregister fn, call it and allow re-registration later
  if (typeof removeAfterEachHook === 'function') {
    try { removeAfterEachHook() } catch {}
    removeAfterEachHook = null
    afterEachRegistered = false
  }
})

onActivated(async () => {
  if (isSignedIn.value) {
    logger.debug('📥 DashboardView - Route aktiviert, lade Workouts neu')
    await loadWorkoutsData(true)
  } else {
    logger.debug('🚫 [Dashboard] onActivated: Nicht eingeloggt')
  }
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 70px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 24px clamp(16px, 4vw, 48px);
}

.dashboard-avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--card-border) 35%, transparent);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 8px 18px color-mix(in srgb, black 10%, transparent);
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.dashboard-avatar:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--card-border) 55%, transparent);
  background: color-mix(in srgb, var(--surface) 65%, transparent);
}

.dashboard-avatar:active {
  transform: translateY(0);
}

.dashboard-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dashboard-avatar__fallback {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--fg);
  background: radial-gradient(circle at 30% 30%, rgba(215, 255, 31, 0.32), rgba(255, 255, 255, 0.06) 60%);
}

.today {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.next-card {
  position: relative;
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-soft);
  /* background: linear-gradient(145deg, rgba(11, 12, 15, 0.92), rgba(24, 26, 33, 0.85)); */
  box-shadow: var(--shadow-hard);
  padding: clamp(22px, 4vw, 36px);
  overflow: hidden;
}

.next-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 80% 0%, rgba(215, 255, 31, 0.22), transparent 55%);
  opacity: 0.9;
  pointer-events: none;
}

.next-card::after {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: calc(var(--panel-radius) - 18px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: none;
}

.next-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  z-index: 1;
}

.next-title {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 600;
  color: var(--fg-strong);
  margin-top: 6px;
}

.muted {
  color: var(--muted);
  font-size: 0.85rem;
}

.action-lead {
  position: relative;
  z-index: 1;
  color: var(--muted);
  font-size: 1rem;
  margin-top: 12px;
  max-width: 420px;
  line-height: 1.6;
}

.draft-notice {
  position: relative;
  z-index: 1;
  margin-top: 18px;
  border-radius: 20px;
  border: 1px solid rgba(215, 255, 31, 0.45);
  background: rgba(215, 255, 31, 0.08);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--accent);
  font-weight: 600;
}

.draft-icon { font-size: 1.2rem; }
.draft-timestamp { font-size: 0.78rem; color: var(--muted); }

.loading-section,
.success-message {
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  padding: 2.25rem 1.5rem;
  text-align: center;
}

.loading-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.loading-section p { color: var(--muted); }

.success-message {
  animation: fadeSlide 0.5s ease;
  background: rgba(121, 255, 180, 0.16);
  border-color: rgba(121, 255, 180, 0.35);
}

.success-content {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: center;
}

.success-icon { font-size: 2rem; }

.success-message h3 {
  font-size: 1.2rem;
  color: var(--fg-strong);
}

.success-message p { color: var(--muted); }

.action-buttons {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.primary-action {
  width: 100%;
  padding: 18px;
  border-radius: 18px;
  border: none;
  font-size: 0.95rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  background: linear-gradient(120deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast);
  box-shadow: 0 18px 40px rgba(215, 255, 31, 0.35);
}

.primary-action.ghost {
  background: transparent;
  border: 1px solid var(--line-soft);
  color: var(--fg);
  box-shadow: none;
}

.primary-action.ghost:hover {
  background: rgba(255, 255, 255, 0.04);
}

.recent-section {
  padding-bottom: calc(140px + var(--safe-bottom));
}

.feedback-section {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.feedback-card {
  border-radius: var(--panel-radius);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line-soft));
  padding: clamp(18px, 3vw, 24px);
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.feedback-title {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.feedback-btn {
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
}

.feedback-btn:hover {
  filter: brightness(1.04);
}

.feedback-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.feedback-preview {
  margin-top: 14px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.preview-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.preview-workout {
  min-width: 0;
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.preview-workout strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-meta {
  color: var(--muted);
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.preview-time {
  color: var(--muted);
  font-size: 0.82rem;
  white-space: nowrap;
}

.preview-text {
  margin-top: 10px;
  color: color-mix(in srgb, var(--fg) 92%, var(--muted));
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

@media (min-width: 768px) {
  .action-buttons {
    flex-direction: row;
  }

  .primary-action {
    flex: 1;
  }
}

@keyframes fadeSlide {
  0% { opacity: 0; transform: translateY(-12px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
