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
      <section class="hero">
        <div>
          <h2 class="hero-title">Bereit für dein Training?</h2>
          <p class="hero-sub">{{ weeklyProgressLabel }}</p>
        </div>
      </section>

      <section class="quick-start">
        <div class="quick-grid">
          <WorkoutCard
            label="Push"
            :active="lastWorkoutType === 'push'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="startQuick('push')"
            @info="openWorkoutInfo('push')"
          />
          <WorkoutCard
            label="Pull"
            :active="lastWorkoutType === 'pull'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="startQuick('pull')"
            @info="openWorkoutInfo('pull')"
          />
          <WorkoutCard
            label="Legs"
            :active="lastWorkoutType === 'legs'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="startQuick('legs')"
            @info="openWorkoutInfo('legs')"
          />
          <WorkoutCard
            :label="$t('dashboard.fullBodyLabel')"
            :active="lastWorkoutType === 'fullbody'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="startQuick('fullbody')"
            @info="openWorkoutInfo('fullbody')"
          />
        </div>

        <div v-if="hasDraft" class="draft-note">
          <span>{{ $t('dashboard.draftAvailable') }}</span>
          <div class="draft-actions">
            <button class="cta-inline" type="button" @click="startWorkout(draftId)">Fortsetzen</button>
            <button class="cta-inline danger" type="button" @click="discardDraft">{{ $t('dashboard.deleteDraft') }}</button>
          </div>
        </div>
      </section>

      <div v-if="workoutCreated" class="success-message">
        <div class="success-content">
          <h3>{{ $t('dashboard.successCreated') }}</h3>
          <p>{{ capitalize(selectedWorkoutType) }} Day {{ $t('dashboard.successCreated') }}</p>
        </div>
      </div>

    </main>

    <AppModal
      v-model="showInfoModal"
      :title="$t('dashboard.workoutTypeInfoTitle')"
      :message="infoMessage"
      :show-cancel="false"
      :confirm-text="$t('common.confirm')"
      type="info"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from "../stores/userStore";
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { isOnline, deleteWorkoutOffline, getWorkoutOffline } from '@/utils/offlineStorage'

import HeaderBar from "../components/HeaderBar.vue";
import WorkoutCard from "../components/WorkoutCard.vue";
import AppModal from "../components/AppModal.vue";
import { logger } from '@/utils/logger'

const store = useUserStore()
const settings = useSettingsStore()
const { t: $t } = useI18n()
const router = useRouter()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const authStore = useAuthStore()

const user = ref(null)
const isSignedIn = ref(false)
const selectedWorkoutType = ref('push')
const isOffline = ref(!isOnline())
const workoutCreated = ref(false)
const detailDraft = ref(null)
const showInfoModal = ref(false)
const infoMessage = ref('')
const draftSourceLogged = ref(false)


const hasDraft = computed(() => {
  const storeHasDraft = (store.workouts || []).some(w => (w?._isDraft === true || w?.isDraft === true) && w?.completed !== true)
  return storeHasDraft || Boolean(detailDraft.value)
})
const draftId = computed(() => {
  return store.workouts.find(w => (w?._isDraft === true || w?.isDraft === true) && w?.completed !== true)?._id || detailDraft.value?._id
})

function logDraftSourceOnce() {
  if (draftSourceLogged.value) return
  const storeDrafts = (store.workouts || []).filter(w => w?._isDraft === true || w?.isDraft === true)
  const hasStoreDraft = storeDrafts.length > 0
  const hasSessionDraft = Boolean(detailDraft.value)
  let source = 'none'
  if (hasStoreDraft && hasSessionDraft) source = 'both'
  else if (hasStoreDraft) source = 'store'
  else if (hasSessionDraft) source = 'sessionStorage'

  logger.debug('🧪 [Dashboard] Draft source diagnostic', {
    source,
    hasStoreDraft,
    hasSessionDraft,
    storeDraftIds: storeDrafts.map(d => d?._id),
    sessionDraftId: detailDraft.value?._id || null,
    hasDraftComputed: hasDraft.value,
    draftIdComputed: draftId.value || null
  })

  draftSourceLogged.value = true
}

const weeklyGoal = computed(() => Number(settings.weeklyGoal) || 4)
const weeklyCount = computed(() => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  return (store.workouts || []).filter(w => !(w?.isDraft || w?._isDraft) && new Date(w.date || w.updatedAt || 0).getTime() >= cutoff).length
})
const weeklyProgressLabel = computed(() => `Wochenfortschritt: ${weeklyCount.value}/${weeklyGoal.value} Trainings`)

const lastWorkoutType = computed(() => {
  const last = store.lastSavedWorkout
  const type = last?.type?.toString().trim().toLowerCase()
  if (type === 'leg') return 'legs'
  if (type === 'freestyle') return 'fullbody'
  return type || null
})

const nextType = computed(() => store.nextWorkoutType || 'push')

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
  if (!name) return 'U'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  const a = parts[0].slice(0, 1)
  const b = parts[parts.length - 1].slice(0, 1)
  return (a + b).toUpperCase()
})

function getDetailDraftKey() {
  const userId = store?.user?.id || store?.user?._id || authStore?.user?.id || authStore?.user?._id || 'guest'
  return `workout_detail_draft_${userId}`
}

async function readDetailDraft() {
  try {
    const raw = sessionStorage.getItem(getDetailDraftKey())
    if (!raw) {
      detailDraft.value = null
      logDraftSourceOnce()
      return
    }
    const parsed = JSON.parse(raw)
    const data = parsed?.workout || parsed
    if (!data || !data._id || data.completed) {
      detailDraft.value = null
      try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
      logDraftSourceOnce()
      return
    }
    const draftId = String(data._id)
    const isDraftLike = data?._isDraft === true || data?.isDraft === true || draftId === 'draft' || draftId.startsWith('draft-')
    if (!isDraftLike) {
      detailDraft.value = null
      try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
      logDraftSourceOnce()
      return
    }
    const mappedRealId = draftId.startsWith('draft-')
      ? String(sessionStorage.getItem(`workout_map_${draftId}`) || '')
      : ''
    if (mappedRealId) {
      const mappedFromStore = (store.workouts || []).find(w => String(w?._id || '') === mappedRealId) || null
      const mappedFromOffline = mappedFromStore ? null : (await getWorkoutOffline(mappedRealId).catch(() => null))
      const mapped = mappedFromStore || mappedFromOffline
      if (mapped?.completed === true) {
        detailDraft.value = null
        try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
        logDraftSourceOnce()
        return
      }
      if (mapped && mapped.completed !== true) {
        detailDraft.value = {
          ...mapped,
          _id: mappedRealId,
          _isDraft: true,
          isDraft: true,
          completed: false
        }
        logDraftSourceOnce()
        return
      }

      detailDraft.value = {
        ...data,
        _isDraft: true,
        isDraft: true,
        completed: false
      }
      logDraftSourceOnce()
      return
    }
    const offlineDraft = await getWorkoutOffline(draftId)
    if (!offlineDraft) {
      detailDraft.value = null
      try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
      logDraftSourceOnce()
      return
    }
    detailDraft.value = data
    logDraftSourceOnce()
  } catch {
    detailDraft.value = null
    logDraftSourceOnce()
  }
}

function onAvatarImgError() {
  avatarLoadError.value = true
}

const onOnlineStatus = () => { isOffline.value = false }
const onOfflineStatus = () => { isOffline.value = true }

// Helper
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Load workouts
async function loadWorkoutsData(force = false) {
  try {
    const hasAuth = authStore.isAuthenticated || Boolean(getCurrentUser && getCurrentUser())
    if (!isOnline()) {
      if (!hasAuth || !authStore.isOfflineSessionValid) return
      await Promise.all([
        store.loadWorkouts(null, { force })
      ])
      return
    }
    const token = await getIdToken();
    const currentUser = getCurrentUser ? getCurrentUser() : null;
    logger.debug('🔑 [Dashboard] Token vorhanden:', !!token, 'User:', !!currentUser)
    if (token && currentUser) {
      logger.debug('📥 DashboardView - Lade Workouts', force ? '(forced)' : '(cached allowed)')
      await Promise.all([
        store.loadWorkouts(token, { force }),
        settings.loadProfile(token).catch(() => null)
      ])
      logger.debug('✅ [Dashboard] Workouts geladen')
    } else {
      logger.warn('⚠️ Workouts werden nicht geladen, da kein Token/User vorhanden ist.');
      await Promise.all([
        store.loadWorkouts(null, { force })
      ])
    }
  } catch (error) {
    logger.warn('⚠️ Fehler beim Laden der Workouts mit Token:', error)
    await Promise.all([
      store.loadWorkouts(null, { force })
    ])
  } finally {
    logDraftSourceOnce()
  }
}


function retryLoadWorkouts() {
  loadWorkoutsData(true);
}

// Start Workout
function startWorkout(typeOrId) {
  if (hasDraft.value && draftId.value) {
    logger.debug('🏁 [Dashboard] Navigating to workout-detail:', draftId.value)
    router.push({ name: 'workout-detail', params: { id: draftId.value } });
  } else {
    const safeType = typeof typeOrId === 'string' && typeOrId.length > 0 ? typeOrId : 'push';
    logger.debug('🏁 [Dashboard] Navigating to workout-builder with type:', safeType)
    router.push({ name: 'workout-builder', query: { type: safeType } });
  }
}

function startQuick(type) {
  const safeType = typeof type === 'string' && type.length > 0 ? type : 'push'
  router.push({ name: 'workout-builder', query: { type: safeType } })
}

function openWorkoutInfo(type) {
  if (type === 'push') infoMessage.value = $t('dashboard.pushInfo')
  else if (type === 'pull') infoMessage.value = $t('dashboard.pullInfo')
  else if (type === 'legs') infoMessage.value = $t('dashboard.legsInfo')
  else if (type === 'freestyle' || type === 'fullbody') infoMessage.value = $t('dashboard.freestyleInfo')
  else infoMessage.value = ''
  showInfoModal.value = true
}

async function discardDraft() {
  try {
    await store.clearDraft()
    // Draft aus Pinia-Store entfernen
    store.workouts = store.workouts.filter(w => !(w?._isDraft === true || w?.isDraft === true))
    store.hasDraft = false
  } catch {}
  detailDraft.value = null
  try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
  // Workouts neu laden, damit UI sofort aktualisiert
  await loadWorkoutsData(true)
}


// keep a single afterEach registration to avoid duplicates
let afterEachRegistered = false
let removeAfterEachHook = null
const onWindowFocus = () => { if (isSignedIn.value) loadWorkoutsData(true) }

// Mounted: Auth & Refresh
onMounted(() => {
  draftSourceLogged.value = false
  window.addEventListener('online', onOnlineStatus)
  window.addEventListener('offline', onOfflineStatus)
  readDetailDraft()

  if (!isOnline() && authStore.isOfflineSessionValid) {
    user.value = authStore.user
    isSignedIn.value = true
    loadWorkoutsData(false)
  }

  onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser
    isSignedIn.value = !!firebaseUser
    readDetailDraft()
    if (isSignedIn.value && firebaseUser) {
      const token = await firebaseUser.getIdToken()
      logger.debug('📥 DashboardView - Lade Workouts (authState)', 'Token:', token)
      await Promise.all([
        store.loadWorkouts(token, { force: false }),
        settings.loadProfile(token).catch(() => null)
      ])
    } else if (!isOnline() && authStore.isOfflineSessionValid) {
      await loadWorkoutsData(false)
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
  window.removeEventListener('online', onOnlineStatus)
  window.removeEventListener('offline', onOfflineStatus)
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
  draftSourceLogged.value = false
  if (isSignedIn.value || (!isOnline() && authStore.isOfflineSessionValid)) {
    logger.debug('📥 DashboardView - Route aktiviert, lade Workouts neu')
    await loadWorkoutsData(true)
    await readDetailDraft()
  } else {
    logger.debug('🚫 [Dashboard] onActivated: Nicht eingeloggt')
    await readDetailDraft()
  }
})
</script>

<style scoped>
.dashboard {
  min-height: 100dvh;
  background: var(--bg-inner);
  color: var(--fg);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px clamp(12px, 3vw, 32px);
  padding-bottom: 0;
  min-height: calc(100dvh - var(--header-height) - var(--safe-top) - 64px - var(--safe-bottom, 0px));
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
}

.dashboard-avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  background: var(--card-bg);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.dashboard-avatar:hover {
  transform: translateY(-1px);
  border-color: var(--line-strong);
  background: var(--bg-panel);
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
  background: var(--card-bg);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-radius: calc(var(--panel-radius) - 12px);
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
}

.hero-title {
  margin: 6px 0 0;
  font-size: clamp(1.9rem, 3.6vw, 2.5rem);
  font-weight: 900;
  color: var(--fg-strong);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 40%, transparent);
}

.hero-sub {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}

.quick-start {
  display: flex;
  flex-direction: column;
  gap: 10px;
}


.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.draft-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-strong);
  background: var(--card-soft);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.draft-actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.cta-inline {
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--fg-strong);
  padding: 5px 10px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}

.cta-inline.danger {
  border-color: var(--danger);
  color: var(--danger-text);
}

@media (max-width: 520px) {
  .draft-note {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .draft-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}

:deep(.empty-state .icon) {
  display: none;
}
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
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
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


@keyframes fadeSlide {
  0% { opacity: 0; transform: translateY(-12px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
