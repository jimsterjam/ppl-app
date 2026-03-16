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
        <div v-if="!showStartOptions" class="quick-grid">
          <WorkoutCard
            label="Push"
            :active="lastWorkoutType === 'push'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('push')"
            @info="openWorkoutInfo('push')"
          />
          <WorkoutCard
            label="Pull"
            :active="lastWorkoutType === 'pull'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('pull')"
            @info="openWorkoutInfo('pull')"
          />
          <WorkoutCard
            label="Legs"
            :active="lastWorkoutType === 'legs'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('legs')"
            @info="openWorkoutInfo('legs')"
          />
          <WorkoutCard
            :label="$t('dashboard.fullBodyLabel')"
            :active="lastWorkoutType === 'fullbody'"
            :info-label="$t('dashboard.workoutTypeInfo')"
            @click="openStartMode('fullbody')"
            @info="openWorkoutInfo('fullbody')"
          />
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
            <button class="quick-mode-btn" type="button" @click="onGenerateSelected">
              {{ $t('dashboard.startModeGenerate') }}
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
                <button class="cta-inline danger" type="button" @click="removeFavorite(favorite)">{{ $t('dashboard.favoriteDelete') }}</button>
              </div>
            </div>
          </div>
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

    <AppModal
      v-model="showQuickIntroModal"
      modal-class="quick-cta-modal"
      :title="$t('dashboard.quickGenIntroTitle')"
      :message="$t('dashboard.quickGenIntroText')"
      :cancel-text="$t('dashboard.quickGenLearnPro')"
      :confirm-text="$t('dashboard.quickGenGenerateNow')"
      type="info"
      @cancel="openUpgrade"
      @confirm="onQuickIntroConfirmed"
    />

    <AppModal
      v-model="showQuickLimitModal"
      modal-class="quick-cta-modal"
      :title="$t('dashboard.quickGenLimitTitle')"
      :message="quickLimitText"
      :cancel-text="$t('dashboard.quickGenLearnPro')"
      :confirm-text="$t('common.close')"
      type="warning"
      @cancel="openUpgrade"
    />

    <AppModal
      v-model="showQuickLastHintModal"
      modal-class="quick-cta-modal"
      :title="$t('dashboard.quickGenLastHintTitle')"
      :message="quickLastHintText"
      :cancel-text="$t('dashboard.quickGenLearnPro')"
      :confirm-text="$t('dashboard.quickGenContinueFree')"
      type="warning"
      @cancel="openUpgrade"
      @confirm="showQuickFormModal = true"
    />

    <AppModal
      v-model="showQuickFormModal"
      modal-class="quick-cta-modal"
      :title="$t('dashboard.quickGenFormTitle')"
      :confirm-text="isGeneratingQuickWorkout ? $t('dashboard.quickGenGenerating') : $t('dashboard.quickGenGenerateNow')"
      :cancel-text="$t('common.cancel')"
      :show-cancel="!isGeneratingQuickWorkout"
      :persistent="isGeneratingQuickWorkout"
      :close-on-confirm="false"
      type="info"
      @confirm="generateQuickWorkout"
    >
      <div class="quick-form-grid">
        <section class="quick-form-section quick-form-field--full">
          <h4>Basics</h4>
          <div class="quick-form-subgrid">
            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenDuration') }}</span>
              <select v-model.number="quickGeneratorForm.durationMinutes">
                <option :value="30">30 min</option>
                <option :value="45">45 min</option>
                <option :value="60">60 min</option>
                <option :value="75">75 min</option>
              </select>
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenGoal') }}</span>
              <select v-model="quickGeneratorForm.goal">
                <option value="muscle_building">{{ $t('dashboard.quickGenGoalMuscle') }}</option>
                <option value="strength">{{ $t('dashboard.quickGenGoalStrength') }}</option>
              </select>
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenLevel') }}</span>
              <select v-model="quickGeneratorForm.level">
                <option value="beginner">{{ $t('dashboard.quickGenLevelBeginner') }}</option>
                <option value="intermediate">{{ $t('dashboard.quickGenLevelIntermediate') }}</option>
                <option value="advanced">{{ $t('dashboard.quickGenLevelAdvanced') }}</option>
              </select>
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenFrequency') }}</span>
              <select v-model.number="quickGeneratorForm.trainingFrequencyPerWeek">
                <option :value="2">2x / Woche</option>
                <option :value="3">3x / Woche</option>
                <option :value="4">4x / Woche</option>
                <option :value="5">5x / Woche</option>
                <option :value="6">6x / Woche</option>
              </select>
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenGender') }}</span>
              <select v-model="quickGeneratorForm.gender">
                <option value="male">{{ $t('dashboard.quickGenGenderMale') }}</option>
                <option value="female">{{ $t('dashboard.quickGenGenderFemale') }}</option>
                <option value="diverse">{{ $t('dashboard.quickGenGenderDiverse') }}</option>
              </select>
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenBodyweight') }}</span>
              <input v-model.number="quickGeneratorForm.bodyweightKg" type="number" min="35" max="250" step="1" />
            </label>
          </div>
        </section>

        <section class="quick-form-section quick-form-field--full">
          <h4>Equipment</h4>
          <div class="quick-form-subgrid">
            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenEquipment') }}</span>
              <select v-model="quickGeneratorForm.equipmentMode">
                <option value="gym_only">{{ $t('dashboard.quickGenEquipmentGymOnly') }}</option>
                <option value="gym_plus_bodyweight">{{ $t('dashboard.quickGenEquipmentBodyweight') }}</option>
                <option value="bodyweight_only">{{ $t('dashboard.quickGenEquipmentBodyweightOnly') }}</option>
              </select>
            </label>
          </div>

          <div class="quick-form-field quick-form-field--full">
            <span>{{ $t('dashboard.quickGenEquipmentAvailable') }}</span>
            <div class="quick-form-check-grid">
              <label class="quick-form-check">
                <input v-model="quickGeneratorForm.equipmentAvailability" type="checkbox" value="barbell" :disabled="quickGeneratorForm.equipmentMode === 'bodyweight_only'" />
                <span>{{ $t('dashboard.quickGenEquipBarbell') }}</span>
              </label>
              <label class="quick-form-check">
                <input v-model="quickGeneratorForm.equipmentAvailability" type="checkbox" value="dumbbells" :disabled="quickGeneratorForm.equipmentMode === 'bodyweight_only'" />
                <span>{{ $t('dashboard.quickGenEquipDumbbells') }}</span>
              </label>
              <label class="quick-form-check">
                <input v-model="quickGeneratorForm.equipmentAvailability" type="checkbox" value="machines" :disabled="quickGeneratorForm.equipmentMode === 'bodyweight_only'" />
                <span>{{ $t('dashboard.quickGenEquipMachines') }}</span>
              </label>
              <label class="quick-form-check">
                <input v-model="quickGeneratorForm.equipmentAvailability" type="checkbox" value="cable_station" :disabled="quickGeneratorForm.equipmentMode === 'bodyweight_only'" />
                <span>{{ $t('dashboard.quickGenEquipCable') }}</span>
              </label>
              <label class="quick-form-check">
                <input v-model="quickGeneratorForm.equipmentAvailability" type="checkbox" value="pull_up_bar" :disabled="quickGeneratorForm.equipmentMode === 'bodyweight_only'" />
                <span>{{ $t('dashboard.quickGenEquipPullupBar') }}</span>
              </label>
            </div>
            <p v-if="quickGeneratorForm.equipmentMode === 'bodyweight_only'" class="quick-form-inline-note">
              Nur Bodyweight aktiviert.
            </p>
          </div>
        </section>

        <section class="quick-form-section quick-form-field--full">
          <h4>Leistungswerte</h4>
          <div class="quick-form-subgrid">
            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenMaxPullups') }}</span>
              <input v-model.number="quickGeneratorForm.maxStrictPullups" type="number" min="0" max="50" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenMaxDips') }}</span>
              <input v-model.number="quickGeneratorForm.maxStrictDips" type="number" min="0" max="50" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenMaxPushups') }}</span>
              <input v-model.number="quickGeneratorForm.maxStrictPushups" type="number" min="0" max="100" step="1" />
            </label>
          </div>

          <button class="quick-form-advanced-toggle" type="button" @click="showQuickAdvancedMetrics = !showQuickAdvancedMetrics">
            {{ showQuickAdvancedMetrics ? 'Erweiterte Kraftwerte ausblenden' : 'Erweiterte Kraftwerte (optional)' }}
          </button>

          <div v-if="showQuickAdvancedMetrics" class="quick-form-subgrid quick-form-advanced-grid">
            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenSquat1RM') }}</span>
              <input v-model.number="quickGeneratorForm.squat1RM" type="number" min="0" max="500" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenBench1RM') }}</span>
              <input v-model.number="quickGeneratorForm.bench1RM" type="number" min="0" max="400" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenDeadlift1RM') }}</span>
              <input v-model.number="quickGeneratorForm.deadlift1RM" type="number" min="0" max="500" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenSquat5RM') }}</span>
              <input v-model.number="quickGeneratorForm.squat5RM" type="number" min="0" max="450" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenBench5RM') }}</span>
              <input v-model.number="quickGeneratorForm.bench5RM" type="number" min="0" max="350" step="1" />
            </label>

            <label class="quick-form-field">
              <span>{{ $t('dashboard.quickGenDeadlift5RM') }}</span>
              <input v-model.number="quickGeneratorForm.deadlift5RM" type="number" min="0" max="450" step="1" />
            </label>
          </div>
        </section>

        <section class="quick-form-section quick-form-field--full">
          <h4>Hinweise</h4>
          <div class="quick-form-subgrid">
            <label class="quick-form-field quick-form-field--full">
              <span>{{ $t('dashboard.quickGenRestrictions') }}</span>
              <input v-model="quickGeneratorForm.restrictions" type="text" maxlength="180" :placeholder="$t('dashboard.quickGenRestrictionsPlaceholder')" />
            </label>

            <label class="quick-form-field quick-form-field--full">
              <span>{{ $t('dashboard.quickGenInjuries') }}</span>
              <input v-model="quickGeneratorForm.injuries" type="text" maxlength="180" :placeholder="$t('dashboard.quickGenInjuriesPlaceholder')" />
            </label>
          </div>
        </section>
      </div>
      <p class="quick-form-hint">{{ $t('dashboard.quickGenRemaining', { count: quickGenerationsRemainingLabel }) }}</p>
      <p v-if="quickFormError" class="quick-form-error">{{ quickFormError }}</p>
    </AppModal>

    <UpgradeModal
      v-model:show="showUpgradeModal"
      limit-type="general"
      @close="showUpgradeModal = false"
      @continue-free="showUpgradeModal = false"
    />
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
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { isOnline, deleteWorkoutOffline, getWorkoutOffline } from '@/utils/offlineStorage'
import { http } from '@/api/http'
import { loadDefaultExercises, getCachedDefaultExercises } from '@/utils/defaultExercisesLoader'
import { buildWorkoutBuilderRoute, normalizeBuilderWorkoutType, QUICK_PREFILL_KEY, saveWorkoutBuilderPrefill } from '@/utils/workoutBuilderFlow'
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
import UpgradeModal from '@/components/UpgradeModal.vue'
import { logger } from '@/utils/logger'

const store = useUserStore()
const settings = useSettingsStore()
const subscriptionStore = useSubscriptionStore()
const { t: $t, locale } = useI18n()
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
const showQuickIntroModal = ref(false)
const showQuickFormModal = ref(false)
const showQuickLimitModal = ref(false)
const showQuickLastHintModal = ref(false)
const showUpgradeModal = ref(false)
const pendingWorkoutType = ref('push')
const startFlowStep = ref('idle')
const favoriteWorkouts = ref([])
const favoriteInfoText = ref('')
const renamingFavoriteId = ref(null)
const favoriteRenameInput = ref('')
const isGeneratingQuickWorkout = ref(false)
const quickFormError = ref('')
const showQuickAdvancedMetrics = ref(false)
const quickGeneratorForm = ref({
  durationMinutes: 45,
  goal: 'muscle_building',
  gender: 'male',
  bodyweightKg: 80,
  level: 'beginner',
  trainingFrequencyPerWeek: 3,
  equipmentMode: 'gym_plus_bodyweight',
  equipmentAvailability: ['barbell', 'dumbbells', 'machines', 'cable_station', 'pull_up_bar'],
  maxStrictPullups: 5,
  maxStrictDips: 8,
  maxStrictPushups: 20,
  squat1RM: null,
  bench1RM: null,
  deadlift1RM: null,
  squat5RM: null,
  bench5RM: null,
  deadlift5RM: null,
  restrictions: '',
  injuries: ''
})

function normalizeQuickEquipmentMode(mode) {
  const value = String(mode || '').toLowerCase()
  if (value === 'gym_only' || value === 'gym_plus_bodyweight' || value === 'bodyweight_only') return value
  return 'gym_plus_bodyweight'
}

function normalizeEquipmentAvailabilitySelection(list) {
  const allowed = ['barbell', 'dumbbells', 'machines', 'cable_station', 'pull_up_bar', 'none']
  if (!Array.isArray(list)) return []
  const normalized = [...new Set(list
    .map((entry) => String(entry || '').toLowerCase().trim())
    .filter((entry) => allowed.includes(entry)))]
  return normalized
}

function hasQuickGeneratorRequiredInputs() {
  const form = quickGeneratorForm.value
  if (!form) return false
  if (!Number(form.durationMinutes)) return false
  if (!form.goal || !form.level || !form.equipmentMode) return false
  if (!Array.isArray(form.equipmentAvailability) || form.equipmentAvailability.length === 0) return false
  if (form.maxStrictPullups === null || form.maxStrictPullups === undefined || form.maxStrictPullups === '') return false
  if (form.maxStrictDips === null || form.maxStrictDips === undefined || form.maxStrictDips === '') return false
  if (form.maxStrictPushups === null || form.maxStrictPushups === undefined || form.maxStrictPushups === '') return false
  return true
}

function normalizeOptionalMetricInput(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}


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
  return (workout?._isDraft === true || workout?.isDraft === true) && workout?.completed !== true
}

const hasDraft = computed(() => {
  const storeHasDraft = (store.workouts || []).some(isOpenDraftWorkout)
  return storeHasDraft || Boolean(resolveDetailDraftTargetId())
})
const draftId = computed(() => {
  const storeDraft = store.workouts.find(isOpenDraftWorkout)?._id
  return storeDraft || resolveDetailDraftTargetId()
})
const quickGenerationsRemainingLabel = computed(() => {
  const remaining = subscriptionStore.quickGenerationsRemaining
  return remaining === Infinity ? '∞' : String(remaining)
})
const quickGenerationsRemainingCount = computed(() => {
  const remaining = subscriptionStore.quickGenerationsRemaining
  return remaining === Infinity ? Number.MAX_SAFE_INTEGER : Number(remaining)
})
const quickResetDateLabel = computed(() => {
  const dateValue = subscriptionStore.quickGeneratorResetDate
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  try {
    return date.toLocaleDateString(String(locale.value || '').startsWith('en') ? 'en-US' : 'de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return date.toLocaleDateString('de-DE')
  }
})
const quickLimitText = computed(() => $t('dashboard.quickGenLimitText', { date: quickResetDateLabel.value }))
const quickLastHintText = computed(() => $t('dashboard.quickGenLastHintText', { date: quickResetDateLabel.value }))
const showStartOptions = computed(() => startFlowStep.value !== 'idle')
const showFavoritesSelection = computed(() => startFlowStep.value === 'favorites')
const pendingWorkoutTypeLabel = computed(() => {
  const type = normalizeBuilderWorkoutType(pendingWorkoutType.value)
  if (type === 'fullbody') return $t('dashboard.fullBodyLabel')
  return type.charAt(0).toUpperCase() + type.slice(1)
})

function getCurrentFavoritesUserId() {
  return String(getCurrentUser?.()?.uid || authStore.user?.id || 'guest')
}

function loadFavoriteWorkoutsForCurrentType() {
  const userId = getCurrentFavoritesUserId()
  const type = normalizeWorkoutType(pendingWorkoutType.value)
  favoriteWorkouts.value = getFavoritesByType(userId, type)
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

const DRAFT_TOMBSTONES_KEY = 'deleted_draft_ids_v1'
const DRAFT_TOMBSTONE_TTL_MS = 6 * 60 * 60 * 1000
function readDraftTombstones() {
  try {
    const raw = localStorage.getItem(DRAFT_TOMBSTONES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
function isDraftDeleted(id) {
  if (!id) return false
  const map = readDraftTombstones()
  const entry = map[String(id)]
  if (!entry) return false
  const timestamp = Number(typeof entry === 'object' ? (entry?.timestamp || entry?.deletedAt || 0) : entry)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return (Date.now() - timestamp) <= DRAFT_TOMBSTONE_TTL_MS
  }
  return Boolean(entry)
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
  return 'workout_detail_draft'
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

function onGenerateSelected() {
  closeStartModePanel()
  nextTick(() => {
    showQuickIntroModal.value = true
  })
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

function openFavoriteInBuilder(favorite, { autoStart = false } = {}) {
  const fav = favorite?.workout || {}
  const type = normalizeBuilderWorkoutType(favorite?.type || pendingWorkoutType.value)
  const exercises = Array.isArray(fav.exercises) ? fav.exercises : []
  const prefill = {
    workoutName: favorite?.name || fav.workoutName || 'Favorite Workout',
    type,
    notes: typeof fav.notes === 'string' ? fav.notes : '',
    exercises
  }
  saveWorkoutBuilderPrefill(prefill)
  closeStartModePanel()
  router.push(buildWorkoutBuilderRoute(type, { quick: true, favoriteStart: autoStart }))
}

function startFavoriteWorkout(favorite) {
  try {
    openFavoriteInBuilder(favorite, { autoStart: true })
  } catch {
    favoriteInfoText.value = $t('dashboard.favoriteStartFailed')
  }
}

function adjustFavoriteWorkout(favorite) {
  try {
    openFavoriteInBuilder(favorite, { autoStart: false })
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
  loadFavoriteWorkoutsForCurrentType()
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
  loadFavoriteWorkoutsForCurrentType()
}

function onQuickIntroConfirmed() {
  openQuickGeneratorForm()
}

function openUpgrade() {
  showUpgradeModal.value = true
}

function openQuickGeneratorForm() {
  quickFormError.value = ''
  showQuickAdvancedMetrics.value = false
  if (!subscriptionStore.canUseQuickGenerator) {
    showQuickLimitModal.value = true
    return
  }
  if (subscriptionStore.subscription?.plan === 'free' && quickGenerationsRemainingCount.value === 1) {
    showQuickLastHintModal.value = true
    return
  }
  showQuickFormModal.value = true
}

watch(() => quickGeneratorForm.value.equipmentMode, (mode) => {
  if (mode === 'bodyweight_only') {
    quickGeneratorForm.value.equipmentAvailability = ['none']
    return
  }
  const next = normalizeEquipmentAvailabilitySelection(quickGeneratorForm.value.equipmentAvailability)
  const withoutNone = next.filter((item) => item !== 'none')
  quickGeneratorForm.value.equipmentAvailability = withoutNone.length ? withoutNone : ['barbell', 'dumbbells', 'machines']
})

async function buildLocalQuickFallback(type, context) {
  const requestedType = ['push', 'pull', 'legs', 'fullbody'].includes(String(type)) ? String(type) : 'fullbody'
  const strength = context?.goal === 'strength'
  const requestedCategory = requestedType === 'fullbody'
    ? 'Full Body'
    : requestedType.charAt(0).toUpperCase() + requestedType.slice(1)

  let localPool = []
  try {
    const defaults = await loadDefaultExercises()
    const byType = requestedType === 'fullbody'
      ? defaults
      : defaults.filter((exercise) => String(exercise?.category || '').toLowerCase() === requestedCategory.toLowerCase())

    const equipmentMode = normalizeQuickEquipmentMode(context?.equipmentMode)
    const byEquipment = equipmentMode === 'gym_only'
      ? byType.filter((exercise) => String(exercise?.equipment || '').toLowerCase() !== 'körpergewicht')
      : equipmentMode === 'bodyweight_only'
        ? byType.filter((exercise) => String(exercise?.equipment || '').toLowerCase() === 'körpergewicht')
        : byType

    localPool = (byEquipment.length ? byEquipment : byType)
      .filter((exercise) => typeof exercise?.name === 'string' && exercise.name.trim())
      .slice(0, 8)
      .map((exercise) => ({
        name: exercise.name,
        sets: strength ? 4 : 3,
        reps: strength ? 6 : 10,
        weight: 0,
        rest: strength ? 120 : 90,
        category: requestedType,
        muscleGroup: exercise.muscleGroup || requestedType,
        exerciseId: exercise._id || null,
        _id: exercise._id || null
      }))
  } catch {
    const cached = getCachedDefaultExercises()
    const byType = requestedType === 'fullbody'
      ? cached
      : cached.filter((exercise) => String(exercise?.category || '').toLowerCase() === requestedCategory.toLowerCase())

    const equipmentMode = normalizeQuickEquipmentMode(context?.equipmentMode)
    const byEquipment = equipmentMode === 'gym_only'
      ? byType.filter((exercise) => String(exercise?.equipment || '').toLowerCase() !== 'körpergewicht')
      : equipmentMode === 'bodyweight_only'
        ? byType.filter((exercise) => String(exercise?.equipment || '').toLowerCase() === 'körpergewicht')
        : byType

    localPool = (byEquipment.length ? byEquipment : byType)
      .filter((exercise) => typeof exercise?.name === 'string' && exercise.name.trim())
      .slice(0, 8)
      .map((exercise) => ({
        name: exercise.name,
        sets: strength ? 4 : 3,
        reps: strength ? 6 : 10,
        weight: 0,
        rest: strength ? 120 : 90,
        category: requestedType,
        muscleGroup: exercise.muscleGroup || requestedType,
        exerciseId: exercise._id || null,
        _id: exercise._id || null
      }))
  }

  const list = localPool.slice(0, 5).map((exercise, index) => ({
    ...exercise,
    reps: strength ? Math.min(Number(exercise.reps) || 10, 8) : Number(exercise.reps) || 10,
    sets: strength ? Math.max(Number(exercise.sets) || 3, 4) : Number(exercise.sets) || 3,
    _id: exercise._id || `quick_local_${index}`,
    category: requestedType,
    muscleGroup: exercise.muscleGroup || requestedType,
    setDetails: [{
      reps: strength ? Math.min(Number(exercise.reps) || 10, 8) : Number(exercise.reps) || 10,
      weight: Number(exercise.weight) || 0
    }]
  }))

  return {
    workoutName: `${requestedType === 'fullbody' ? 'Full Body' : requestedType.toUpperCase()} ${strength ? 'Strength' : 'Quick'} Session`,
    type: requestedType,
    exercises: list
  }
}

async function generateQuickWorkout() {
  if (isGeneratingQuickWorkout.value) return
  isGeneratingQuickWorkout.value = true
  try {
    quickFormError.value = ''

    if (!hasQuickGeneratorRequiredInputs()) {
      quickFormError.value = $t('dashboard.quickGenMissingRequired')
      return
    }

    const token = await getIdToken().catch(async () => {
      const currentUser = getCurrentUser()
      if (!currentUser?.getIdToken) return null
      try {
        return await currentUser.getIdToken(true)
      } catch {
        return null
      }
    })
    if (!token) {
      throw new Error('NO_AUTH_TOKEN')
    }

    const headers = {}
    headers.Authorization = `Bearer ${token}`

    const payload = {
      durationMinutes: Number(quickGeneratorForm.value.durationMinutes) || 45,
      goal: quickGeneratorForm.value.goal,
      gender: quickGeneratorForm.value.gender,
      bodyweightKg: Number(quickGeneratorForm.value.bodyweightKg) || 80,
      level: quickGeneratorForm.value.level,
      trainingFrequencyPerWeek: Number(quickGeneratorForm.value.trainingFrequencyPerWeek) || 3,
      equipmentMode: normalizeQuickEquipmentMode(quickGeneratorForm.value.equipmentMode),
      equipmentAvailability: normalizeEquipmentAvailabilitySelection(quickGeneratorForm.value.equipmentAvailability),
      maxStrictPullups: Number(quickGeneratorForm.value.maxStrictPullups),
      maxStrictDips: Number(quickGeneratorForm.value.maxStrictDips),
      maxStrictPushups: Number(quickGeneratorForm.value.maxStrictPushups),
      squat1RM: normalizeOptionalMetricInput(quickGeneratorForm.value.squat1RM),
      bench1RM: normalizeOptionalMetricInput(quickGeneratorForm.value.bench1RM),
      deadlift1RM: normalizeOptionalMetricInput(quickGeneratorForm.value.deadlift1RM),
      squat5RM: normalizeOptionalMetricInput(quickGeneratorForm.value.squat5RM),
      bench5RM: normalizeOptionalMetricInput(quickGeneratorForm.value.bench5RM),
      deadlift5RM: normalizeOptionalMetricInput(quickGeneratorForm.value.deadlift5RM),
      restrictions: String(quickGeneratorForm.value.restrictions || '').trim(),
      injuries: String(quickGeneratorForm.value.injuries || '').trim(),
      requestedType: pendingWorkoutType.value,
      requireCompleteInput: true
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API timeout after 20s')), 20000)
    )
    
    const { data } = await Promise.race([
      http.post('/workouts/quick-generator', payload, { headers }),
      timeoutPromise
    ])
    const responseRequestedType = ['push', 'pull', 'legs', 'fullbody'].includes(String(data?.requestedType))
      ? String(data?.requestedType)
      : pendingWorkoutType.value || 'fullbody'
    const exercises = Array.isArray(data?.exercises) ? data.exercises : []
    const aiUsageMeta = data?.metadata?.aiUsage || null
    if (aiUsageMeta) {
      subscriptionStore.applyAiUsageSnapshot(aiUsageMeta)
    }

    const prefill = {
      workoutName: data?.workoutName || 'Quick Workout',
      type: responseRequestedType,
      notes: typeof data?.notes === 'string' ? data.notes : '',
      metadata: data?.metadata || {},
      exercises: exercises.map((exercise, index) => ({
        _id: exercise._id || `quick_${index}`,
        exerciseId: exercise.exerciseId || exercise._id || null,
        name: exercise.name,
        category: exercise.category || responseRequestedType,
        muscleGroup: exercise.muscleGroup || responseRequestedType,
        setDetails: [{
          reps: Number(exercise.reps) || 10,
          weight: Number(exercise.weight) || 0
        }],
        sets: Number(exercise.sets) || 3,
        reps: Number(exercise.reps) || 10,
        weight: Number(exercise.weight) || 0,
        rest: Number(exercise.rest) || 90
      }))
    }

    try {
      saveWorkoutBuilderPrefill(prefill)
    } catch {}

    if (!aiUsageMeta) {
      subscriptionStore.trackQuickGeneration()
    }
    showQuickFormModal.value = false
    router.push(buildWorkoutBuilderRoute(responseRequestedType, { quick: true }))
  } catch (error) {
    logger.error('Quick generator failed', error)
    const localFallback = await buildLocalQuickFallback(pendingWorkoutType.value, quickGeneratorForm.value)
    try {
      saveWorkoutBuilderPrefill(localFallback)
    } catch {}

    quickFormError.value = $t('dashboard.quickGenFallbackUsed')
    infoMessage.value = $t('dashboard.quickGenFallbackUsed')
    showInfoModal.value = true
    showQuickFormModal.value = false
    router.push(buildWorkoutBuilderRoute(pendingWorkoutType.value, { quick: true }))
  } finally {
    isGeneratingQuickWorkout.value = false
  }
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
  subscriptionStore.checkSubscription()

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
