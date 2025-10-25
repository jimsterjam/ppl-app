<template>
  <div class="dashboard">
    <HeaderBar :title="greeting" />

    <!-- Clerk Loading State -->
    <div v-if="!isClerkReady" class="loading-section">
      <div class="spinner"></div>
      <p>Initialisiere Dashboard...</p>
    </div>

    <!-- App Loading State -->
    <div v-else-if="store.isWorkoutsLoading" class="loading-section">
      <div class="spinner"></div>
      <p>Lade deine Workouts...</p>
    </div>

    <!-- Error State -->
    <EmptyState 
      v-else-if="store.hasError"
      icon="⚠️"
      title="Verbindungsfehler"
      :message="store.error"
      action-text="Erneut versuchen"
      @action="retryLoadWorkouts"
    />

    <!-- Empty State -->
    <EmptyState 
      v-else-if="store.workouts.length === 0"
      icon="💪"
      title="Noch keine Workouts"
      message="Starte dein erstes Training und verfolge deinen Fortschritt!"
      action-text="Erstes Workout starten"
      @action="() => startWorkout(nextType)"
    />

    <!-- Normal State -->
    <template v-else>
      <!-- Success Message -->
      <div v-if="workoutCreated" class="success-message">
        <div class="success-content">
          <span class="success-icon">✅</span>
          <h3>Workout erstellt!</h3>
          <p>{{ selectedWorkoutType.charAt(0).toUpperCase() + selectedWorkoutType.slice(1) }} Day Workout wurde erfolgreich erstellt.</p>
        </div>
      </div>

      <section class="today">
        <div class="next-card">
          <div class="next-header">
            <h3>Nächstes Workout</h3>
            <span class="muted" v-if="lastLabel">Zuletzt: {{ lastLabel }}</span>
          </div>
          <p class="next-title">{{ nextLabel }}</p>
          <button @click="startWorkout(nextType)" :disabled="workoutCreated">
            {{ workoutCreated ? 'Workout erstellt!' : `Starten (${nextLabel})` }}
          </button>
        </div>
      </section>

      <StatsWidget v-if="!store.isWorkoutsLoading" :workouts="store.workouts" />
      <div v-if="store.isWorkoutsLoading" class="stats-skeleton">
        <div class="sk-card" />
        <div class="sk-card" />
        <div class="sk-card" />
      </div>
    </template>

    <BottomNav />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUser, useAuth, useClerk } from '@clerk/vue'
import { useUserStore } from "../stores/userStore";
import WorkoutCard from "../components/WorkoutCard.vue";
import StatsWidget from "../components/StatsWidget.vue";
import HeaderBar from "../components/HeaderBar.vue";
import BottomNav from "../components/BottomNav.vue";
import EmptyState from "../components/EmptyState.vue";

const store = useUserStore();
const router = useRouter();
const clerk = useClerk();
const auth = useAuth();
const { user, isSignedIn } = useUser();
const selectedWorkoutType = ref('push')
const isClerkReady = ref(false)
const workoutCreated = ref(false) // Für visuelles Feedback

// Warte auf Clerk Initialisierung
onMounted(async () => {
  console.log('🔧 DashboardView - onMounted, warte auf Clerk...');

  await nextTick();

  const markReadyAndLoad = async () => {
    if (isClerkReady.value) return; // mehrfach Aufruf vermeiden
    isClerkReady.value = true;
    console.log('✅ DashboardView - Clerk ready, isSignedIn:', isSignedIn.value);

    if (!isSignedIn.value) return; // AuthLayout übernimmt Redirect

    console.log('🔄 DashboardView - Angemeldet, lade Daten (Cache erlaubt)...');
    try {
      const token = await getAuthToken();
      console.log('📥 DashboardView - Lade Workouts mit Token (cached allowed):', !!token);
      await store.loadWorkouts(token, { force: false });
    } catch (error) {
      console.warn('⚠️ DashboardView - Fehler beim Laden der Workouts mit Token, versuche ohne:', error);
      await store.loadWorkouts(null, { force: false });
    }
  };

  // Clerk-Loaded: sofort wenn bereits geladen, sonst auf Event warten
  if (window?.Clerk?.loaded) {
    await markReadyAndLoad();
  } else {
    const handler = async () => {
      window.removeEventListener('clerk:loaded', handler);
      await markReadyAndLoad();
    };
    window.addEventListener('clerk:loaded', handler);
    // Fallback: nach 2s trotzdem versuchen, um Hänger zu vermeiden
    setTimeout(() => {
      if (!isClerkReady.value) handler();
    }, 2000);
  }
});

// Überwache Auth-Änderungen nur nach Clerk-Initialisierung
// Auth-Redirect wird zentral im AuthLayout gehandhabt

// Laden der Store-Daten und Standard-Übungen wird jetzt in onMounted gemacht

function typeLabel(type) {
  switch ((type || '').toLowerCase()) {
    case 'push': return 'Push Day'
    case 'pull': return 'Pull Day'
    case 'legs': return 'Leg Day'
    default: return type || 'Workout'
  }
}

// Bestimme das letzte sinnvolle Workout (bevorzugt abgeschlossen/mit Sätzen)
const lastCompleted = computed(() => {
  const list = (store.workouts || []).filter(w => !w.isDraft).filter(w => {
    if (w.completed) return true
    const hasSets = (w?.exercises || []).some(ex => (ex?.setDetails?.length ?? ex?.sets ?? 0) > 0)
    return hasSets
  })
  if (list.length === 0) return null
  return [...list].sort((a,b) => new Date(b.updatedAt || b.date || 0) - new Date(a.updatedAt || a.date || 0))[0]
})

const lastAny = computed(() => store.lastSavedWorkout)

const lastRef = computed(() => lastCompleted.value || lastAny.value)

const nextType = computed(() => {
  const map = { push: 'pull', pull: 'legs', legs: 'push' }
  const lt = (lastRef.value?.type || '').toLowerCase()
  return map[lt] || 'push'
})

const lastLabel = computed(() => {
  if (!lastRef.value) return ''
  const name = lastRef.value.name || typeLabel(lastRef.value.type)
  return name
})

const nextLabel = computed(() => typeLabel(nextType.value))

const greeting = computed(() => {
  if (!isClerkReady.value) return 'Initialisiere...'
  if (store.isWorkoutsLoading) return 'Lade Dashboard...'
  if (store.hasError) return 'Dashboard'
  if (store.workouts.length === 0) return 'Willkommen!'
  return `Nächstes: ${nextLabel.value}`
})

async function startWorkout(type) {
  console.log('🚀 DashboardView - Navigiere zum Workout Builder...')
  
  // Navigiere zum WorkoutBuilder, damit der User selbst entscheiden kann
  const query = type ? { type } : {}
  await router.push({ path: '/workout-builder', query });
}

async function retryLoadWorkouts() {
  try {
    const token = await getAuthToken();
    console.log('🔄 DashboardView - Retry loading workouts with token:', !!token);
    store.loadWorkouts(token, { force: true });
  } catch (error) {
    console.warn('⚠️ DashboardView - Fehler beim Retry:', error);
    store.loadWorkouts(null, { force: true }); // Fallback ohne Token
  }
}

// Robuster Token-Helper analog zum WorkoutBuilder
async function getAuthToken(options = {}) {
  const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE
  const opts = template ? { ...options, template } : options
  try {
    const t = await clerk?.session?.getToken?.(opts)
    if (t) return t
  } catch {}
  try {
    const t = await window?.Clerk?.session?.getToken?.(opts)
    if (t) return t
  } catch {}
  try {
    const maybe = auth?.getToken
    if (typeof maybe === 'function') {
      const t = await maybe(opts)
      if (t) return t
    }
  } catch {}
  return null
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 80px; /* Platz für BottomNav */
  overflow-x: hidden;
}

.today {
  padding: 16px;
}

.today button { background: var(--accent); color: var(--accent-contrast); border: none; padding: 16px 24px; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; width: 100%; min-height: 50px; box-shadow: 0 4px 12px color-mix(in oklab, var(--accent-color) 40%, transparent); transition: all 0.2s ease; -webkit-tap-highlight-color: transparent; }
.today button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px color-mix(in oklab, var(--accent-color) 60%, transparent); }

.today button:active { transform: translateY(0); box-shadow: 0 2px 8px color-mix(in oklab, var(--accent-color) 30%, transparent); }

/* Tablet Styles */
@media (min-width: 768px) {
  .today {
    padding: 24px;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .today button {
    width: auto;
    min-width: 200px;
    padding: 18px 32px;
  }
}

/* Desktop Styles */
@media (min-width: 1024px) {
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .today {
    padding: 32px;
  }
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.spinner { width: 40px; height: 40px; border: 3px solid color-mix(in oklab, var(--accent-color) 30%, transparent); border-top: 3px solid var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; }

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-section p {
  color: var(--muted);
  font-size: 1rem;
}

.no-workout-today { background: var(--surface); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; text-align: center; }

.no-workout-today h3 { color: var(--fg); margin-bottom: 0.5rem; font-size: 1.1rem; }

.no-workout-today p { color: var(--muted); margin: 0; }

.success-message { background: color-mix(in oklab, var(--success-color) 20%, transparent); border: 1px solid color-mix(in oklab, var(--success-color) 50%, transparent); margin: 1rem; border-radius: 12px; padding: 1rem; animation: slideInFromTop 0.5s ease-out; }

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
}

.success-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.success-message h3 { color: var(--fg); margin: 0; font-size: 1.2rem; font-weight: 600; }

.success-message p { color: var(--muted); margin: 0; font-size: 0.9rem; }

@keyframes slideInFromTop {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.today button:disabled { background: color-mix(in oklab, var(--success-color) 80%, white); color: #fff; cursor: not-allowed; transform: none; }
.today button:disabled:hover { transform: none; }

.next-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; }
.next-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.next-title { font-size: 1.15rem; font-weight: 600; margin: 6px 0 0; }
.muted { color: var(--muted); font-size: 0.85rem; }
</style>
.hero-content { animation: fadeIn .25s ease-out; }
.hero-skeleton { padding: 4px 0 8px; }
.sk-title { height: 28px; width: 60%; background: var(--surface); border-radius: 6px; margin-bottom: 10px; }
.sk-sub { height: 16px; width: 70%; background: var(--surface); border-radius: 6px; margin-bottom: 14px; }
.sk-btn { height: 44px; width: 220px; background: var(--surface); border-radius: 10px; }
