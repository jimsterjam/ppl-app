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

    <main class="dashboard-content" :class="{ 'has-draft': hasDraft }">
      <section class="hero">
        <div>
          <h2 class="hero-title">Bereit für dein Training?</h2>
          <p class="hero-sub">{{ weeklyProgressLabel }}</p>
        </div>
      </section>

      <section class="quick-start">
        <div v-if="!showStartOptions" class="quick-grid">
          <WorkoutCard
            label="Push"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('push')"
            @info="openWorkoutInfo('push')"
          />
          <WorkoutCard
            label="Pull"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('pull')"
            @info="openWorkoutInfo('pull')"
          />
          <WorkoutCard
            label="Legs"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('legs')"
            @info="openWorkoutInfo('legs')"
          />
          <WorkoutCard
            :label="$t('dashboard.fullBodyLabel')"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('fullbody')"
            @info="openWorkoutInfo('fullbody')"
          />
          <button class="quick-fav-shortcut" type="button" @click="openAllFavorites">
            ★ {{ $t('dashboard.allFavorites') }}
          </button>
          <button class="quick-timer-btn" type="button" @click="showTimerConfig = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 13"/><path d="M9 2h6M12 2v3"/></svg>
            Timer
          </button>
          <WorkoutTimerConfig v-if="showTimerConfig" @close="showTimerConfig = false" />
        </div>

        <div v-else-if="showAllFavoritesPanel" class="quick-mode-panel">
          <div class="quick-mode-head">
            <strong>★ {{ $t('dashboard.allFavorites') }}</strong>
            <button class="cta-inline" type="button" @click="closeAllFavoritesPanel">{{ $t('common.back') }}</button>
          </div>
          <p v-if="favoriteInfoText" class="quick-mode-info">{{ favoriteInfoText }}</p>
          <div class="favorite-list">
            <div v-if="!allFavoriteWorkouts.length" class="favorite-empty">
              {{ $t('dashboard.allFavoritesEmpty') }}
            </div>
            <div v-for="favorite in allFavoriteWorkouts" :key="favorite.id" class="favorite-item">
              <div class="favorite-top">
                <div class="favorite-name">
                  {{ favorite.name }}
                  <span class="fav-type-badge">{{ favorite.type }}</span>
                </div>
                <div class="favorite-date">{{ formatFavoriteDate(favorite.updatedAt || favorite.createdAt) }}</div>
              </div>
              <div v-if="renamingFavoriteId === favorite.id" class="favorite-rename-row">
                <input
                  v-model="favoriteRenameInput"
                  class="favorite-rename-input"
                  type="text"
                  maxlength="40"
                  :placeholder="$t('dashboard.favoriteNamePlaceholder')"
                />
                <button class="cta-inline" type="button" @click="confirmRenameFavorite(favorite)">{{ $t('common.save') }}</button>
                <button class="cta-inline" type="button" @click="cancelRenameFavorite">{{ $t('common.cancel') }}</button>
              </div>
              <div v-else class="favorite-actions">
                <button class="cta-inline" type="button" @click="startFavoriteWorkout(favorite)">{{ $t('dashboard.favoriteStart') }}</button>
                <button class="cta-inline" type="button" @click="adjustFavoriteWorkout(favorite)">{{ $t('dashboard.favoriteAdjust') }}</button>
                <button class="cta-inline" type="button" @click="beginRenameFavorite(favorite)">{{ $t('dashboard.favoriteRename') }}</button>
                <button class="cta-inline danger" type="button" @click="askRemoveFavorite(favorite)">{{ $t('dashboard.favoriteDelete') }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="quick-mode-panel">
          <div class="quick-mode-head">
            <strong>{{ $t('dashboard.startModeTypeTitle', { type: pendingWorkoutTypeLabel }) }}</strong>
            <button class="cta-inline" type="button" @click="closeStartModePanel">{{ $t('common.back') }}</button>
          </div>

          <template v-if="!showFavoritesSelection">
            <button class="quick-mode-btn" type="button" @click="onManualSelected">
              {{ $t('dashboard.startModeManual') }}
            </button>
            <button class="quick-mode-btn" type="button" @click="openFavoritesForType">
              {{ $t('dashboard.startModeFavorites') }}
            </button>
          </template>

          <p v-if="favoriteInfoText" class="quick-mode-info">{{ favoriteInfoText }}</p>

          <div v-if="showFavoritesSelection" class="favorite-list">
            <div class="favorite-list-head">
              <button class="cta-inline" type="button" @click="closeFavoritesSelection">{{ $t('common.back') }}</button>
            </div>
            <p class="quick-mode-info">{{ $t('dashboard.favoritesHint') }}</p>

            <div v-if="!favoriteWorkouts.length" class="favorite-empty">
              {{ $t('dashboard.favoritesEmpty') }}
            </div>

            <div v-for="favorite in favoriteWorkouts" :key="favorite.id" class="favorite-item">
              <div class="favorite-top">
                <div class="favorite-name">{{ favorite.name }}</div>
                <div class="favorite-date">{{ formatFavoriteDate(favorite.updatedAt || favorite.createdAt) }}</div>
              </div>

              <div v-if="renamingFavoriteId === favorite.id" class="favorite-rename-row">
                <input
                  v-model="favoriteRenameInput"
                  class="favorite-rename-input"
                  type="text"
                  maxlength="40"
                  :placeholder="$t('dashboard.favoriteNamePlaceholder')"
                />
                <button class="cta-inline" type="button" @click="confirmRenameFavorite(favorite)">{{ $t('common.save') }}</button>
                <button class="cta-inline" type="button" @click="cancelRenameFavorite">{{ $t('common.cancel') }}</button>
              </div>

              <div v-else class="favorite-actions">
                <button class="cta-inline" type="button" @click="startFavoriteWorkout(favorite)">{{ $t('dashboard.favoriteStart') }}</button>
                <button class="cta-inline" type="button" @click="adjustFavoriteWorkout(favorite)">{{ $t('dashboard.favoriteAdjust') }}</button>
                <button class="cta-inline" type="button" @click="beginRenameFavorite(favorite)">{{ $t('dashboard.favoriteRename') }}</button>
                <button class="cta-inline danger" type="button" @click="askRemoveFavorite(favorite)">{{ $t('dashboard.favoriteDelete') }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasDraft" class="draft-note">
          <span>{{ $t('dashboard.draftAvailable') }}</span>
          <div class="draft-actions">
            <button class="cta-inline" type="button" @click="startWorkout(draftId)">Fortsetzen</button>
            <button class="cta-inline danger" type="button" @click="showDiscardDraftConfirm = true">{{ $t('dashboard.deleteDraft') }}</button>
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

    <AppModal
      v-model="showFavoriteDeleteConfirm"
      :title="$t('dashboard.favoriteDeleteConfirmTitle')"
      :message="$t('dashboard.favoriteDeleteConfirmMsg')"
      :confirm-text="$t('dashboard.favoriteDelete')"
      :cancel-text="$t('common.cancel')"
      type="warning"
      @confirm="confirmRemoveFavorite"
    />

    <AppModal
      v-model="showDiscardDraftConfirm"
      :title="$t('dashboard.discardDraftConfirmTitle')"
      :message="$t('dashboard.discardDraftConfirmMsg')"
      :confirm-text="$t('dashboard.deleteDraft')"
      :cancel-text="$t('common.cancel')"
      type="warning"
      @confirm="discardDraft"
    />

    <!-- Quick Generator entfernt (AI-Feature, für spätere Reaktivierung erhalten) -->

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from "../stores/userStore";
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { isOnline, deleteWorkoutOffline, getWorkoutOffline, saveWorkoutOffline } from '@/utils/offlineStorage'
import { isDraftDeleted } from '@/utils/draftTombstones'
import { deleteWorkout } from '@/api/workouts'
import { http } from '@/api/http'
import { loadDefaultExercises, getCachedDefaultExercises } from '@/utils/defaultExercisesLoader'
import { buildWorkoutBuilderRoute, normalizeBuilderWorkoutType, QUICK_PREFILL_KEY, DETAIL_DRAFT_KEY, saveWorkoutBuilderPrefill } from '@/utils/workoutBuilderFlow'
import {
  getFavoritesByType,
  renameFavoriteWorkout,
  deleteFavoriteWorkout,
  getFavoriteLimitPerType,
  getFavoriteNameValidationError,
  normalizeWorkoutType
} from '@/utils/workoutFavorites'

import HeaderBar from "../components/HeaderBar.vue";
import WorkoutCard from "../components/WorkoutCard.vue";
import AppModal from "../components/AppModal.vue";
import WorkoutTimerConfig from '@/components/timer/WorkoutTimerConfig.vue'
import { logger } from '@/utils/logger'

const store = useUserStore()
const settings = useSettingsStore()
const { t: $t, locale } = useI18n()
const router = useRouter()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const authStore = useAuthStore()

const user = ref(null)
const isSignedIn = ref(false)
const selectedWorkoutType = ref('push')
const isOffline = ref(!isOnline())
const workoutCreated = ref(false)
const showFavoriteDeleteConfirm = ref(false)
const pendingFavoriteToDelete = ref(null)
const showDiscardDraftConfirm = ref(false)
const showTimerConfig = ref(false)
const detailDraft = ref(null)
const showInfoModal = ref(false)
const infoMessage = ref('')
const draftSourceLogged = ref(false)
const pendingWorkoutType = ref('push')
const startFlowStep = ref('idle')
const favoriteWorkouts = ref([])
const allFavoriteWorkouts = ref([])
const favoriteInfoText = ref('')
const renamingFavoriteId = ref(null)
const favoriteRenameInput = ref('')


function resolveDetailDraftTargetId() {
  const currentDraftId = String(detailDraft.value?._id || '')
  if (!currentDraftId) return ''
  if (!currentDraftId.startsWith('draft-')) return currentDraftId
  try {
    const mappedId = String(sessionStorage.getItem(`workout_map_${currentDraftId}`) || '').trim()
    if (mappedId && !isDraftDeleted(mappedId)) return mappedId
  } catch {}
  return currentDraftId
}

function isOpenDraftWorkout(workout) {
  return (workout?._isDraft === true || workout?.isDraft === true)
    && workout?.completed !== true
    && workout?._adjustDraft !== true
}

const hasDraft = computed(() => {
  const storeHasDraft = (store.workouts || []).some(isOpenDraftWorkout)
  return storeHasDraft || Boolean(resolveDetailDraftTargetId())
})
const draftId = computed(() => {
  const storeDraft = store.workouts.find(isOpenDraftWorkout)?._id
  return storeDraft || resolveDetailDraftTargetId()
})
const showStartOptions = computed(() => startFlowStep.value !== 'idle')
const showFavoritesSelection = computed(() => startFlowStep.value === 'favorites')
const showAllFavoritesPanel = computed(() => startFlowStep.value === 'all-favorites')
const pendingWorkoutTypeLabel = computed(() => {
  const type = normalizeBuilderWorkoutType(pendingWorkoutType.value)
  if (type === 'fullbody') return $t('dashboard.fullBodyLabel')
  return type.charAt(0).toUpperCase() + type.slice(1)
})

function getCurrentFavoritesUserId() {
  return String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || 'guest')
}

function loadFavoriteWorkoutsForCurrentType() {
  const userId = getCurrentFavoritesUserId()
  const type = normalizeWorkoutType(pendingWorkoutType.value)
  favoriteWorkouts.value = getFavoritesByType(userId, type)
}

function loadAllFavoriteWorkouts() {
  const userId = getCurrentFavoritesUserId()
  const types = ['push', 'pull', 'legs', 'fullbody']
  const all = types.flatMap(type => getFavoritesByType(userId, type))
  all.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  allFavoriteWorkouts.value = all
}

function formatFavoriteDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(String(locale.value || '').startsWith('en') ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

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
  return DETAIL_DRAFT_KEY
}

function buildFavoriteDetailDraft(favorite) {
  const fav = favorite?.workout || {}
  const type = normalizeBuilderWorkoutType(favorite?.type || pendingWorkoutType.value)
  const draftId = `draft-favorite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const userId = String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || 'guest')
  const exercises = (Array.isArray(fav.exercises) ? fav.exercises : []).map((exercise = {}) => {
    const setDetails = Array.isArray(exercise?.setDetails) && exercise.setDetails.length > 0
      ? exercise.setDetails.map((set) => ({ reps: Number(set?.reps) || 0, weight: Number(set?.weight) || 0, ...(set?.isWarmup ? { isWarmup: true } : {}) }))
      : []
    return {
      ...exercise,
      exerciseId: exercise?.exerciseId || exercise?._id || null,
      setDetails,
      reps: Number(setDetails[0]?.reps) || 0,
      weight: Number(setDetails[0]?.weight) || 0
    }
  })

  return {
    _id: draftId,
    userId,
    name: String(favorite?.name || fav.workoutName || 'Favorite Workout'),
    type,
    date: new Date().toISOString(),
    completed: false,
    _isDraft: true,
    isDraft: true,
    _adjustDraft: true,
    notes: typeof fav.notes === 'string' ? fav.notes : '',
    exercises
  }
}

function getLegacyDetailDraftKeys() {
  try {
    return Object.keys(sessionStorage).filter((key) => key.startsWith('workout_detail_draft_'))
  } catch {
    return []
  }
}

function readDetailDraftRaw() {
  try {
    const direct = sessionStorage.getItem(getDetailDraftKey())
    if (direct) return direct
    const legacyKeys = getLegacyDetailDraftKeys()
    if (!legacyKeys.length) return null
    const latestKey = legacyKeys.sort((a, b) => {
      const ta = Number((sessionStorage.getItem(a) && JSON.parse(sessionStorage.getItem(a))?.timestamp) || 0)
      const tb = Number((sessionStorage.getItem(b) && JSON.parse(sessionStorage.getItem(b))?.timestamp) || 0)
      return tb - ta
    })[0]
    return latestKey ? sessionStorage.getItem(latestKey) : null
  } catch {
    return null
  }
}

async function readDetailDraft() {
  try {
    const raw = readDetailDraftRaw()
    if (!raw) {
      detailDraft.value = null
      logDraftSourceOnce()
      return
    }
    const parsed = JSON.parse(raw)
    // Favorit-Anpassen-Drafts nicht als "in Bearbeitung" im Dashboard anzeigen
    if (parsed?._adjustDraft) {
      detailDraft.value = null
      logDraftSourceOnce()
      return
    }
    const data = parsed?.workout || parsed
    if (!data || !data._id || data.completed) {
      detailDraft.value = null
      try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
      logDraftSourceOnce()
      return
    }
    const draftId = String(data._id)
    if (isDraftDeleted(draftId)) {
      logger.debug('🛡️ [DraftIntegrity] Ignoring tombstoned session draft:', draftId)
      detailDraft.value = null
      try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
      try {
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith('workout_detail_draft_'))
          .forEach((key) => sessionStorage.removeItem(key))
      } catch {}
      logDraftSourceOnce()
      return
    }
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
    if (mappedRealId && isDraftDeleted(mappedRealId)) {
      detailDraft.value = null
      try { sessionStorage.removeItem(getDetailDraftKey()) } catch {}
      logDraftSourceOnce()
      return
    }
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
      detailDraft.value = {
        ...data,
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
    const safeType = normalizeBuilderWorkoutType(typeOrId);
    logger.debug('🏁 [Dashboard] Navigating to workout-builder with type:', safeType)
    router.push(buildWorkoutBuilderRoute(safeType));
  }
}

function startQuick(type) {
  router.push(buildWorkoutBuilderRoute(normalizeBuilderWorkoutType(type)))
}

function openStartMode(type) {
  pendingWorkoutType.value = normalizeBuilderWorkoutType(type)
  startFlowStep.value = 'mode'
  favoriteInfoText.value = ''
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
}

function closeStartModePanel() {
  startFlowStep.value = 'idle'
  favoriteInfoText.value = ''
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
}

function onManualSelected() {
  closeStartModePanel()
  startQuick(pendingWorkoutType.value)
}

function openFavoritesForType() {
  startFlowStep.value = 'favorites'
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
  loadFavoriteWorkoutsForCurrentType()
  const max = getFavoriteLimitPerType()
  favoriteInfoText.value = $t('dashboard.favoritesLimitHint', { count: max })
}

function closeFavoritesSelection() {
  startFlowStep.value = 'mode'
  favoriteInfoText.value = ''
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
}

function openAllFavorites() {
  startFlowStep.value = 'all-favorites'
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
  favoriteInfoText.value = ''
  loadAllFavoriteWorkouts()
}

function closeAllFavoritesPanel() {
  startFlowStep.value = 'idle'
  favoriteInfoText.value = ''
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
}

function openFavoriteInBuilder(favorite, { autoStart = false } = {}) {
  const fav = favorite?.workout || {}
  const type = normalizeBuilderWorkoutType(favorite?.type || pendingWorkoutType.value)
  const exercises = Array.isArray(fav.exercises) ? fav.exercises : []
  const prefill = {
    workoutName: favorite?.name || fav.workoutName || 'Favorite Workout',
    type,
    notes: typeof fav.notes === 'string' ? fav.notes : '',
    exercises,
    favoriteSource: true,
    favoriteId: favorite?.id || null,
    favoriteName: favorite?.name || fav.workoutName || '',
    favoriteType: type
  }
  saveWorkoutBuilderPrefill(prefill)
  closeStartModePanel()
  router.push(buildWorkoutBuilderRoute(type, { quick: true, favoriteStart: autoStart, favoriteAdjust: !autoStart }))
}

async function openFavoriteAdjustInDetail(favorite) {
  const draft = buildFavoriteDetailDraft(favorite)
  await saveWorkoutOffline(draft)
  try {
    sessionStorage.setItem(getDetailDraftKey(), JSON.stringify({ timestamp: Date.now(), workout: draft, _adjustDraft: true }))
  } catch {}

  const type = normalizeBuilderWorkoutType(favorite?.type || pendingWorkoutType.value)
  const query = {
    favoriteSource: '1',
    favoriteAdjust: '1',
    favoriteType: String(type),
    favoriteUserId: getCurrentFavoritesUserId()
  }
  if (favorite?.id) query.favoriteId = String(favorite.id)
  if (favorite?.name) query.favoriteName = String(favorite.name)

  closeStartModePanel()
  await router.push({
    name: 'workout-detail',
    params: { id: draft._id },
    query
  })
}

function startFavoriteWorkout(favorite) {
  try {
    openFavoriteInBuilder(favorite, { autoStart: true })
  } catch {
    favoriteInfoText.value = $t('dashboard.favoriteStartFailed')
  }
}

async function adjustFavoriteWorkout(favorite) {
  try {
    await openFavoriteAdjustInDetail(favorite)
  } catch {
    favoriteInfoText.value = $t('dashboard.favoriteAdjustFailed')
  }
}

function beginRenameFavorite(favorite) {
  renamingFavoriteId.value = favorite?.id || null
  favoriteRenameInput.value = String(favorite?.name || '')
}

function cancelRenameFavorite() {
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
}

function confirmRenameFavorite(favorite) {
  const validationError = getFavoriteNameValidationError(favoriteRenameInput.value)
  if (validationError) {
    favoriteInfoText.value = validationError
    return
  }
  const result = renameFavoriteWorkout({
    userId: getCurrentFavoritesUserId(),
    type: normalizeWorkoutType(favorite?.type || pendingWorkoutType.value),
    id: favorite?.id,
    name: favoriteRenameInput.value
  })
  if (!result.success) {
    favoriteInfoText.value = result.message || $t('dashboard.favoriteRenameFailed')
    return
  }
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
  favoriteInfoText.value = ''
  if (startFlowStep.value === 'all-favorites') loadAllFavoriteWorkouts()
  else loadFavoriteWorkoutsForCurrentType()
}

function askRemoveFavorite(favorite) {
  pendingFavoriteToDelete.value = favorite
  showFavoriteDeleteConfirm.value = true
}

function confirmRemoveFavorite() {
  removeFavorite(pendingFavoriteToDelete.value)
  pendingFavoriteToDelete.value = null
}

function removeFavorite(favorite) {
  const result = deleteFavoriteWorkout({
    userId: getCurrentFavoritesUserId(),
    type: normalizeWorkoutType(favorite?.type || pendingWorkoutType.value),
    id: favorite?.id
  })
  if (!result.success) {
    favoriteInfoText.value = result.message || $t('dashboard.favoriteDeleteFailed')
    return
  }
  favoriteInfoText.value = ''
  if (startFlowStep.value === 'all-favorites') loadAllFavoriteWorkouts()
  else loadFavoriteWorkoutsForCurrentType()
}

// Quick Generator entfernt (AI-Feature, für spätere Reaktivierung erhalten)

function openWorkoutInfo(type) {
  if (type === 'push') infoMessage.value = $t('dashboard.pushInfo')
  else if (type === 'pull') infoMessage.value = $t('dashboard.pullInfo')
  else if (type === 'legs') infoMessage.value = $t('dashboard.legsInfo')
  else if (type === 'freestyle' || type === 'fullbody') infoMessage.value = $t('dashboard.freestyleInfo')
  else infoMessage.value = ''
  showInfoModal.value = true
}

async function discardDraft() {
  // Sammle alle IDs die mit dem aktuellen Draft zusammenhängen können:
  // 1. workout_map_{tempId} → realId (Server-Workout, vom WorkoutBuilder erzeugt)
  // 2. detailDraft._id wenn echte ObjectId (nach router.replace)
  // 3. draftId aus Store (kann direkt realId sein wenn Draft als solche markiert)
  // Alle IDs werden BEDINGUNGSLOS gesammelt – wenn der Delete-Button sichtbar ist,
  // kann kein completed Workout betroffen sein.
  const serverDraftIds = new Set()
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('workout_map_'))
      .forEach(k => {
        const realId = String(sessionStorage.getItem(k) || '').trim()
        if (realId && /^[a-f\d]{24}$/i.test(realId)) serverDraftIds.add(realId)
      })
    // detailDraft selbst kann bereits eine echte MongoDB-ID sein (nach router.replace)
    const draftObjId = String(detailDraft.value?._id || '').trim()
    if (draftObjId && /^[a-f\d]{24}$/i.test(draftObjId)) serverDraftIds.add(draftObjId)
    // Alle Draft-Workouts im Store mit echter ObjectId ebenfalls erfassen
    ;(store.workouts || [])
      .filter(w => (w?._isDraft === true || w?.isDraft === true) && w?.completed !== true)
      .forEach(w => {
        const id = String(w?._id || '').trim()
        if (id && /^[a-f\d]{24}$/i.test(id)) serverDraftIds.add(id)
      })
  } catch {}

  try {
    await store.clearDraft()
    // Draft aus Pinia-Store entfernen
    store.workouts = store.workouts.filter(w => !(w?._isDraft === true || w?.isDraft === true))
  } catch {}

  // Server-seitige Draft-Workouts löschen (von WorkoutBuilder erstellt, bevor User abbricht)
  if (serverDraftIds.size) {
    try {
      const token = await getIdToken().catch(() => null)
      if (token) {
        await Promise.all([...serverDraftIds].map(id => deleteWorkout(id, token).catch(() => null)))
        // Auch aus dem Store entfernen (falls noch nicht durch clearDraft geschehen)
        store.workouts = store.workouts.filter(w => !serverDraftIds.has(String(w?._id || '')))
      }
    } catch {}
  }

  detailDraft.value = null
  try {
    sessionStorage.removeItem(getDetailDraftKey())
    // workout_map_* Keys auch bereinigen
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('workout_map_'))
      .forEach(k => { try { sessionStorage.removeItem(k) } catch {} })
  } catch {}
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
  await readDetailDraft()
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
  padding-bottom: calc(110px + env(safe-area-inset-bottom, 0px));
  min-height: calc(100dvh - var(--header-height) - var(--safe-top) - 64px - var(--safe-bottom, 0px));
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
}

.dashboard-content.has-draft {
  gap: 8px;
  padding-top: 10px;
  padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px));
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

.dashboard-content.has-draft .hero {
  gap: 6px;
  padding: 8px 10px;
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

.quick-grid :deep(.workout-card) {
  aspect-ratio: 1.15 / 1;
}

.dashboard-content.has-draft .quick-grid :deep(.workout-card) {
  aspect-ratio: 1.28 / 1;
}

.quick-fav-shortcut {
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line-strong));
  border-radius: calc(var(--panel-radius) - 16px);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-panel));
  color: var(--fg-strong);
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
  padding: 20px 14px;
  cursor: pointer;
  text-align: center;
  transition: background 120ms ease, border-color 120ms ease;
}

.quick-fav-shortcut:hover {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-panel));
  border-color: var(--accent);
}

.quick-fav-shortcut:active {
  opacity: 0.8;
}

.quick-timer-btn {
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line-strong));
  border-radius: calc(var(--panel-radius) - 16px);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-panel));
  color: var(--fg-strong);
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
  padding: 20px 14px;
  cursor: pointer;
  text-align: center;
  transition: background 120ms ease, border-color 120ms ease;
}

.quick-timer-btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-panel));
  border-color: var(--accent);
}

.quick-timer-btn:active {
  opacity: 0.8;
}

.quick-mode-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
}

.quick-mode-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--fg-strong);
}

.quick-mode-btn {
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: var(--panel-radius);
  background: var(--card-bg);
  color: var(--fg-strong);
  font-weight: 800;
  padding: 24px 14px;
  min-height: 72px;
  text-align: left;
  cursor: pointer;
}

.dashboard-content.has-draft .quick-mode-btn {
  padding: 14px 12px;
  min-height: 56px;
}

.quick-mode-btn:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--card-bg));
}

.quick-mode-info {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.favorite-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100dvh - var(--header-height, 64px) - 220px - env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
}

.favorite-list-head {
  display: flex;
  justify-content: flex-start;
}

.favorite-empty {
  border: 1px dashed var(--line-soft);
  border-radius: var(--panel-radius);
  padding: 10px;
  color: var(--muted);
  font-size: 0.85rem;
}

.favorite-item {
  border: 1px solid var(--line-soft);
  border-radius: var(--panel-radius);
  background: var(--card-soft);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.favorite-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.favorite-name {
  color: var(--fg-strong);
  font-weight: 800;
}

.favorite-date {
  color: var(--muted);
  font-size: 0.75rem;
}

.fav-type-badge {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line-strong));
  color: color-mix(in srgb, var(--accent) 75%, var(--fg));
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  vertical-align: middle;
  margin-left: 4px;
}

.favorite-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.favorite-rename-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.favorite-rename-input {
  flex: 1 1 180px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--bg-panel);
  color: var(--fg);
  padding: 8px 10px;
  font-size: 0.9rem;
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
  margin-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
}

.dashboard-content.has-draft .draft-note {
  position: sticky;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  z-index: 20;
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

.quick-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.quick-form-section {
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  padding: 10px;
  background: color-mix(in srgb, var(--bg-panel) 94%, transparent);
}

.quick-form-section h4 {
  margin: 0 0 10px;
  font-size: 0.9rem;
  color: var(--fg-strong);
}

.quick-form-subgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quick-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--fg-strong);
  font-size: 0.85rem;
}

.quick-form-field--full {
  grid-column: 1 / -1;
}

.quick-form-field label {
  color: var(--fg-strong);
  font-weight: 600;
}

.quick-form-field select,
.quick-form-field input {
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--bg-panel);
  color: var(--fg);
  padding: 8px 10px;
  font-size: 0.9rem;
}

.quick-form-inline-note {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.quick-form-advanced-toggle {
  margin-top: 10px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--fg-strong);
  border-radius: 10px;
  padding: 8px 10px;
  font-weight: 700;
  cursor: pointer;
}

.quick-form-advanced-grid {
  margin-top: 10px;
}

.quick-form-field select:focus,
.quick-form-field input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 0;
  border-color: var(--accent);
}

.quick-form-check-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.quick-form-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
  font-size: 0.82rem;
}

.quick-form-check input {
  accent-color: var(--accent);
}

.quick-form-hint {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.quick-form-error {
  margin: 10px 0 0;
  color: var(--danger-color);
  font-size: 0.82rem;
  font-weight: 700;
}

:deep(.modal.quick-cta-modal) {
  --modal-text: var(--fg-strong);
  --modal-bg: var(--bg-panel);
}

:deep(.modal.quick-cta-modal .modal-title) {
  color: var(--fg-strong);
  font-weight: 700;
}

:deep(.modal.quick-cta-modal .modal-message) {
  color: var(--muted);
  line-height: 1.5;
}

:deep(.modal.quick-cta-modal .btn) {
  font-weight: 800;
  padding: 11px 16px;
}

:deep(.modal.quick-cta-modal .btn.primary) {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--accent) 30%, transparent);
}

:deep(.modal.quick-cta-modal .btn.secondary) {
  border-color: var(--line-strong);
  color: var(--fg);
}

@media (max-width: 560px) {
  .quick-form-subgrid {
    grid-template-columns: 1fr;
  }

  .quick-form-check-grid {
    grid-template-columns: 1fr;
  }
}


@keyframes fadeSlide {
  0% { opacity: 0; transform: translateY(-12px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
