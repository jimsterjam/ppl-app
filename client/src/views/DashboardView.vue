<template>
  <div class="dashboard">
    <!-- Header -->
    <HeaderBar :title="greeting || $t('dashboard.title')">
      <template #actions>
        <button 
          class="refresh-btn" 
          :disabled="store.isWorkoutsLoading"
          :title="$t('dashboard.refreshTitle')"
          @click="refreshData"
        >
          <span :class="{ 'spinning': store.isWorkoutsLoading }">🔄</span>
        </button>
      </template>
    </HeaderBar>

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

      <!-- Quick Overview -->
      <QuickOverview :workouts="store.workouts" />

      <!-- Today's Workout -->
      <section class="today">
        <div class="next-card glass">
          <div class="next-header">
            <h3>{{ $t('dashboard.nextWorkout') }}</h3>
            <span v-if="lastLabel" class="muted">{{ $t('dashboard.last') }}: {{ lastLabel }}</span>
          </div>
          <p class="next-title">{{ nextLabel }}</p>

          <!-- Draft Notice -->
          <div v-if="hasDraft" class="draft-notice">
            <span class="draft-icon">📝</span>
            <span>{{ $t('dashboard.draftAvailable') }}</span>
            <div v-if="draftTimestamp" class="draft-timestamp">
              {{ $t('dashboard.lastSaved') }}: {{ draftTimestamp.toLocaleString() }}
            </div>
          </div>

          <!-- Main Button -->
          <button 
            :disabled="workoutCreated" 
            @click="startWorkout(hasDraft ? draftType : nextType)"
            :class="{ 'draft-button': hasDraft }"
          >
            {{ startButtonText }}
          </button>

          <!-- Secondary Button (Draft) -->
          <button 
            v-if="hasDraft && !workoutCreated"
            @click="startNewWorkout"
            class="secondary-btn"
          >
            {{ $t('dashboard.startNew') }}
          </button>
        </div>
      </section>

      <!-- Recent Workouts -->
      <RecentWorkouts :workouts="store.workouts" />

      <!-- Stats Widget -->
      <StatsWidget v-if="!store.isWorkoutsLoading" :workouts="store.workouts" />
      <div v-else class="stats-skeleton">
        <div class="sk-card" />
        <div class="sk-card" />
        <div class="sk-card" />
      </div>
    </template>

    <!-- Bottom Navigation -->
    <BottomNav />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from "../stores/userStore";
import { useToastStore } from "../stores/toastStore";

import HeaderBar from "../components/HeaderBar.vue";
import BottomNav from "../components/BottomNav.vue";
import EmptyState from "../components/EmptyState.vue";
import QuickOverview from "../components/QuickOverview.vue";
import RecentWorkouts from "../components/RecentWorkouts.vue";
import StatsWidget from "../components/StatsWidget.vue";
import { logger } from '@/utils/logger'

const store = useUserStore()
const toast = useToastStore()
const { t: $t } = useI18n()
const router = useRouter()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()

const user = ref(null)
const isSignedIn = ref(false)
const selectedWorkoutType = ref('push')
const workoutCreated = ref(false)

const nextLabel = computed(() => store.nextWorkoutLabel)
const lastLabel = computed(() => store.lastWorkoutLabel)
const hasDraft = computed(() => store.hasDraft)
const draftType = computed(() => store.draftType)
const draftTimestamp = computed(() => store.draftTimestamp)

const startButtonText = computed(() => hasDraft.value ? $t('dashboard.resumeDraft') : $t('dashboard.startNext'))

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
    console.log('DEBUG: getIdToken() result:', token, 'currentUser:', currentUser);
    if (token && currentUser) {
      logger.debug('📥 DashboardView - Lade Workouts', force ? '(forced)' : '(cached allowed)', 'Token:', token)
      await store.loadWorkouts(token, { force })
    } else {
      logger.warn('⚠️ Workouts werden nicht geladen, da kein Token/User vorhanden ist.');
    }
  } catch (error) {
    logger.warn('⚠️ Fehler beim Laden der Workouts mit Token:', error)
    await store.loadWorkouts(null, { force })
  }
}

function retryLoadWorkouts() {
  loadWorkoutsData(true);
}

// Refresh Data
async function refreshData() {
  logger.debug('🔄 Manueller Daten-Refresh...')
  await loadWorkoutsData(true)
  toast.show($t('common.updated'), { type: 'success', duration: 1500 })
}

// Start Workout
function startWorkout(type) {
  const safeType = typeof type === 'string' && type.length > 0 ? type : 'push';
  router.push({ name: 'workout-builder', query: { type: safeType } });
}
function startNewWorkout() {
  router.push({ name: 'workout-builder' });
}

// Mounted: Auth & Refresh
onMounted(() => {
  onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser
    isSignedIn.value = !!firebaseUser
    if (isSignedIn.value && firebaseUser) {
      const token = await firebaseUser.getIdToken()
      logger.debug('📥 DashboardView - Lade Workouts (authState)', 'Token:', token)
      await store.loadWorkouts(token, { force: false })
    }
  })

  router.afterEach((to, from) => {
    if (to.path === '/' && from.path !== '/') loadWorkoutsData(true)
  })

  window.addEventListener('focus', () => { if (isSignedIn.value) loadWorkoutsData(true) })
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

.secondary-btn {
  width: 100%;
  padding: 10px 20px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg);
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.secondary-btn:hover {
  background: color-mix(in srgb, var(--fg) 5%, transparent);
  border-color: color-mix(in srgb, var(--fg) 30%, transparent);
  transform: translateY(-1px);
}

.secondary-btn:active { transform: translateY(0); }

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
   Stats Skeleton
======================= */
.stats-skeleton {
  margin: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sk-card {
  height: 80px;
  background: var(--surface);
  border-radius: 12px;
  animation: pulse 1.5s ease-in-out infinite;
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
