<template>
  <div class="dashboard">
    <!-- Header -->
    <HeaderBar :title="greeting || $t('dashboard.title')" />

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

        <!-- Recent Workouts -->
        <div class="recent-section">
          <RecentWorkouts :workouts="recentWorkoutsPreview" />
        </div>
    </template>

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

import HeaderBar from "../components/HeaderBar.vue";
import BottomNav from "../components/BottomNav.vue";
import EmptyState from "../components/EmptyState.vue";
import RecentWorkouts from "../components/RecentWorkouts.vue";
import { logger } from '@/utils/logger'

const store = useUserStore()
const { t: $t } = useI18n()
const router = useRouter()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const PROGRESS_RANGE_DAYS = 120

const user = ref(null)
const isSignedIn = ref(false)
const selectedWorkoutType = ref('push')
const workoutCreated = ref(false)

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

// Greeting Computed
const greeting = computed(() => {
  const hour = new Date().getHours()
  const name = user.value?.firstName || ''
  let greet = hour < 11 ? $t('dashboard.greetingMorning') : hour < 18 ? $t('dashboard.greetingDay') : $t('dashboard.greetingEvening')
  return name ? `${greet}, ${name}` : greet
})

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
        store.loadStats(token, { rangeDays: PROGRESS_RANGE_DAYS })
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
        store.loadStats(token, { rangeDays: PROGRESS_RANGE_DAYS })
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
/* =======================
   Buttons
======================= */
.today button {
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.today button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px color-mix(in oklab, var(--accent-color) 60%, transparent);
}

.today button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px color-mix(in oklab, var(--accent-color) 30%, transparent);
}

.today button:disabled {
  background: color-mix(in oklab, var(--success-color) 80%, white);
  color: #fff;
  cursor: not-allowed;
  transform: none;
}

.today button:disabled:hover { transform: none; }

.draft-button {
  background: yellow;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-color) 30%, transparent) !important;
}


/* =======================
   Today Section
======================= */
.today {
  padding: 0 24px 24px;
  max-width: 600px;
  margin: 0 auto;
}

.next-card { 
  background: transparent; 
  border: 1px solid transparent; 
  border-radius: 12px; 
  padding: 16px; 
  margin: 16px 0; 
}

.next-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 8px; 
}

.next-title { 
  font-size: 1.15rem; 
  font-weight: 600; 
  margin: 6px 0 0; 
}

.action-lead {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 8px 0 0;
}

/* Draft Hinweis */
.draft-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-color) 25%, transparent);
  border-radius: 8px;
  margin: 12px 0;
  font-size: 0.85rem;
  color: var(--accent-color);
  font-weight: 500;
}

.draft-icon { font-size: 1.1rem; }
.draft-timestamp {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 4px;
}

/* =======================
   Loading Section
======================= */
.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.loading-section .spinner { width: 40px; height: 40px; }
.loading-section p { color: var(--muted); font-size: 1rem; }

/* =======================
   Success Message
======================= */
.success-message {
  background: color-mix(in oklab, var(--success-color) 20%, transparent);
  border: 1px solid color-mix(in oklab, var(--success-color) 50%, transparent);
  margin: 1rem 0;
  border-radius: 12px;
  padding: 1rem;
  animation: slideInFromTop 0.5s ease-out;
}

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
}

.success-icon { font-size: 2rem; margin-bottom: 0.5rem; }

.success-message h3 { 
  color: var(--fg); 
  margin: 0; 
  font-size: 1.2rem; 
  font-weight: 600; 
}

.success-message p { color: var(--muted); margin: 0; font-size: 0.9rem; }

/* =======================
   Action Hub
======================= */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.primary-action {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: none;
  background: var(--accent-color);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.primary-action.ghost {
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--card-border) 80%, transparent);
  color: var(--fg);
}

.primary-action.ghost:hover {
  background: color-mix(in srgb, var(--fg) 4%, transparent);
}


.recent-section {
  padding-bottom: calc(140px + var(--safe-bottom, 0px));
}

/* =======================
   Misc
======================= */
.muted { color: var(--muted); font-size: 0.85rem; }

/* =======================
   Media Queries
======================= */
@media (min-width: 768px) {
  .today button {
    width: auto;
    min-width: 200px;
    padding: 18px 32px;
  }
}

@media (min-width: 1024px) {
  .dashboard { max-width: 1200px; margin: 0 auto; }
  .today { padding: 0 32px 32px; }
}

/* =======================
   Animations
======================= */
@keyframes slideInFromTop {
  0% { opacity: 0; transform: translateY(-20px); }
  100% { opacity: 1; transform: translateY(0); }
}

</style>
