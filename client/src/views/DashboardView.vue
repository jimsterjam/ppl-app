<template>
  <div class="dashboard">
    <!-- Header -->
    <HeaderBar
      :title="userSubtitle || $t('dashboard.yourNamePlaceholder')"
      :show-user-name="false"
      title-clickable
      @title-click="showNameModal = true"
    >
      <template #leading>
        <AvatarEditor :initials="avatarInitials" />
      </template>
    </HeaderBar>

    <NameEditModal v-model="showNameModal" />

    <main class="dashboard-content" :class="{ 'has-draft': hasDraft }">
      <CoachMarks :marks="coachMarks" :active="coachActive" />
      <WeekStrip class="dashboard-week" :workouts="store.workouts || []" :caption="weeklyProgressLabel" />

      <SessionStopwatch v-if="showStopwatchCard" @session-time="onSessionTime" />

      <MonthlyReportRow />

      <section v-if="todayPlan && !showStartOptions && !hasDraft" class="today-card" aria-labelledby="today-plan-eyebrow">
        <div class="today-text">
          <p id="today-plan-eyebrow" class="today-eyebrow">{{ $t('plans.today') }}</p>
          <h3 class="today-title">{{ todayDayTitle }}</h3>
          <p class="today-sub">{{ todaySubline }}</p>
          <p v-if="!todayPlan.hasWorkout" class="today-warn">{{ $t('plans.todayFavoriteMissing') }}</p>
          <button class="today-other" type="button" @click="showPlanDayPicker = true">{{ $t('plans.chooseOtherDay') }}</button>
        </div>
        <button v-if="todayPlan.hasWorkout" class="today-start" type="button" @click="startPlanDay(todayPlan.plan, todayPlan.day)">
          {{ $t('plans.startShort') }}
        </button>
        <button v-else class="today-start" type="button" @click="router.push({ name: 'plan-detail', params: { id: todayPlan.plan.id } })">
          {{ $t('plans.openPlan') }}
        </button>
        <button class="today-remove" type="button" :aria-label="$t('plans.removeAria')" :title="$t('plans.remove')" @click="showRemovePlan = true">✕</button>
      </section>

      <section class="quick-start">
        <div v-if="!showStartOptions" class="quick-area">
          <p class="quick-section-label">{{ $t('dashboard.freeTrainingTitle') }}</p>
          <div class="type-grid">
            <button v-for="tile in typeTiles" :key="tile.type" class="type-tile" type="button" @click="openStartMode(tile.type)">
              <span class="type-icon" aria-hidden="true"><component :is="tile.icon" :size="16" :stroke-width="2.4" /></span>
              <span class="type-text">
                <strong>{{ tile.label }}</strong>
                <small>{{ tile.muscles }}</small>
              </span>
              <span class="type-info" role="button" tabindex="0" :aria-label="$t('dashboard.workoutTypeInfo')" @click.stop="openWorkoutInfo(tile.type)" @keydown.enter.stop="openWorkoutInfo(tile.type)">
                <Info :size="15" aria-hidden="true" />
              </span>
            </button>
          </div>
          <div class="quick-bar">
            <button class="quick-bar-btn" type="button" :aria-label="$t('dashboard.allFavorites')" @click="openAllFavorites">
              <Star :size="17" aria-hidden="true" /><span>{{ $t('dashboard.shortFavorites') }}</span>
            </button>
            <button class="quick-bar-btn" type="button" @click="showTimerMenu = true">
              <Timer :size="17" aria-hidden="true" /><span>Timer</span>
            </button>
            <button class="quick-bar-btn quick-bar-btn--wide" type="button" @click="router.push({ name: 'plans' })">
              <ClipboardList :size="17" aria-hidden="true" /><span>{{ $t('dashboard.plansButton') }}</span>
            </button>
          </div>
          <p v-if="isFirstUse" class="quick-first-hint">{{ $t('dashboard.firstHint') }}</p>
          <TimerMenu v-if="showTimerMenu" @close="showTimerMenu = false" @select="onTimerMenuSelect" />
          <RestTimerSettings v-if="showRestSettings" @close="showRestSettings = false" />
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
            <div v-for="favorite in allFavoriteWorkouts" :key="favorite.id" class="favorite-item favorite-item--compact">
              <!-- Aufgeräumt (Wunsch Paul: zu viele Buttons): nur "Starten" sichtbar, Anpassen/
                   Namen ändern/Löschen im "⋮"-Menü (favoriteMenu-Modal). -->
              <div class="favorite-main">
                <div class="favorite-name">{{ favorite.name }}<span class="fav-type-badge">{{ favorite.type }}</span></div>
                <div class="favorite-meta">{{ favoriteMetaLine(favorite) }}</div>
              </div>
              <button class="favorite-start-btn" type="button" @click="startFavoriteWorkout(favorite)">{{ $t('dashboard.favoriteStart') }}</button>
              <button class="favorite-more-btn" type="button" :aria-label="$t('dashboard.favoriteMore')" @click="openFavoriteMenu(favorite)">⋮</button>
            </div>
          </div>
        </div>

        <div v-else class="quick-mode-panel">
          <div class="quick-mode-head">
            <strong>{{ $t('dashboard.startModeTypeTitle', { type: pendingWorkoutTypeLabel }) }}</strong>
            <button class="cta-inline" type="button" @click="closeStartModePanel">{{ $t('common.back') }}</button>
          </div>
          <template v-if="startFlowStep === 'mode'">
            <OneTimeHint
              hint-id="favorites-explainer"
              :title="$t('onboarding.hintFavoritesTitle')"
              :text="$t('onboarding.hintFavoritesText')"
            />
            <button class="quick-mode-btn" type="button" @click="chooseStartPath('manual')">
              {{ $t('dashboard.startModeManual') }}
            </button>
            <button class="quick-mode-btn" type="button" @click="openFavoritesForType">
              {{ $t('dashboard.startModeFavorites') }}
            </button>
            <button class="quick-mode-btn" type="button" @click="chooseStartPath('generate')">
              {{ $t('dashboard.startModeGenerate') }}
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

            <div v-for="favorite in favoriteWorkouts" :key="favorite.id" class="favorite-item favorite-item--compact">
              <!-- Aufgeräumt (Wunsch Paul: zu viele Buttons): nur "Starten" sichtbar, Anpassen/
                   Namen ändern/Löschen im "⋮"-Menü (favoriteMenu-Modal). -->
              <div class="favorite-main">
                <div class="favorite-name">{{ favorite.name }}</div>
                <div class="favorite-meta">{{ favoriteMetaLine(favorite) }}</div>
              </div>
              <button class="favorite-start-btn" type="button" @click="startFavoriteWorkout(favorite)">{{ $t('dashboard.favoriteStart') }}</button>
              <button class="favorite-more-btn" type="button" :aria-label="$t('dashboard.favoriteMore')" @click="openFavoriteMenu(favorite)">⋮</button>
            </div>
          </div>
        </div>

        <div v-if="hasDraft" class="draft-note">
          <span>{{ $t('dashboard.draftAvailable') }}</span>
          <div class="draft-actions">
            <button class="cta-inline" type="button" @click="startWorkout(draftId)">{{ $t('common.resume') }}</button>
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

    <!-- Ziel-Abfrage als eigenes Fenster (Wunsch Paul: rest tritt in den Hintergrund, kein
         Scrollen). Für Manuell, Generieren und Favoriten ohne gespeichertes Ziel. -->
    <AppModal
      v-model="showGoalModal"
      :title="$t('workoutGoal.question')"
      :confirm-text="$t('dashboard.favoriteStart')"
      :cancel-text="$t('common.cancel')"
      :close-on-confirm="false"
      type="info"
      @confirm="confirmGoalModal"
      @cancel="closeGoalModal"
    >
      <WorkoutGoalPicker v-model="goalModalChoice" :goals="goalModalGoals" :show-error="goalModalError" hide-question />
    </AppModal>

    <!-- "⋯"-Menü eines Favoriten: Anpassen, Namen ändern (im Fenster), Löschen. -->
    <AppModal
      v-model="showFavoriteMenu"
      :title="favoriteMenuTarget?.name || ''"
      :confirm-text="favoriteMenuRenaming ? $t('common.save') : $t('common.close')"
      :cancel-text="$t('common.cancel')"
      :show-cancel="favoriteMenuRenaming"
      :close-on-confirm="false"
      type="info"
      @confirm="onFavoriteMenuConfirm"
      @cancel="closeFavoriteMenu"
    >
      <div v-if="!favoriteMenuRenaming" class="favorite-menu-actions">
        <button class="favorite-menu-btn" type="button" @click="favoriteMenuAdjust">{{ $t('dashboard.favoriteAdjust') }}</button>
        <button class="favorite-menu-btn" type="button" @click="favoriteMenuBeginRename">{{ $t('dashboard.favoriteRename') }}</button>
        <button class="favorite-menu-btn favorite-menu-btn--danger" type="button" @click="favoriteMenuDelete">{{ $t('dashboard.favoriteDelete') }}</button>
      </div>
      <div v-else class="favorite-menu-rename">
        <input
          v-model="favoriteRenameInput"
          class="favorite-rename-input"
          type="text"
          maxlength="40"
          :placeholder="$t('dashboard.favoriteNamePlaceholder')"
        />
        <p v-if="favoriteMenuError" class="favorite-menu-error">{{ favoriteMenuError }}</p>
      </div>
    </AppModal>

    <AppModal
      v-model="showInfoModal"
      :title="$t('dashboard.workoutTypeInfoTitle')"
      :message="infoMessage"
      :show-cancel="false"
      :confirm-text="$t('common.confirm')"
      type="info"
    />

    <AppModal
      v-model="showRemovePlan"
      :title="$t('plans.removeTitle')"
      :message="$t('plans.removeMessage', { name: todayPlan?.plan?.name || '' })"
      :confirm-text="$t('plans.remove')"
      :cancel-text="$t('common.cancel')"
      type="warning"
      @confirm="removeTodayPlan"
    />

    <AppModal
      v-model="showPlanDayPicker"
      :title="$t('plans.pickDayTitle')"
      :confirm-text="$t('common.close')"
      :show-cancel="false"
      type="info"
    >
      <p class="plan-pick-hint">{{ $t('plans.pickDayHint') }}</p>
      <div v-if="todayPlan" class="plan-pick-list">
        <button
          v-for="(day, index) in todayPlan.plan.days"
          :key="day.id"
          type="button"
          class="plan-pick-btn"
          :class="{ 'is-next': index === todayPlan.plan.activeDayIndex }"
          :disabled="!planDayInfo(day)?.hasWorkout"
          @click="pickPlanDay(day)"
        >
          <span class="plan-pick-text">
            <span>{{ planDayLabel(day) }}</span>
            <small v-if="planDayMuscles(day)">{{ planDayMuscles(day) }}</small>
          </span>
          <small v-if="index === todayPlan.plan.activeDayIndex">{{ $t('plans.nextDay') }}</small>
          <small v-else-if="!planDayInfo(day)?.hasWorkout">{{ $t('plans.favoriteMissing') }}</small>
        </button>
      </div>
    </AppModal>

    <AppModal
      v-model="showFavoriteDeleteConfirm"
      :title="$t('dashboard.favoriteDeleteConfirmTitle')"
      :message="favoriteDeleteMessage"
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
import { ref, computed, onMounted, onActivated, onUnmounted, watch } from 'vue'
import { startAiWarmup } from '@/utils/aiWarmup'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from "../stores/userStore";
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { useWarmupTimerStore } from '@/stores/warmupTimerStore'
import { isOnline, getWorkoutOffline, saveWorkoutOffline } from '@/utils/offlineStorage'
import { isDraftDeleted } from '@/utils/draftTombstones'
import { deleteWorkout } from '@/api/workouts'
import { buildWorkoutBuilderRoute, normalizeBuilderWorkoutType, saveWorkoutBuilderPrefill, getDetailDraftKey as buildDetailDraftKey } from '@/utils/workoutBuilderFlow'
import { hasActiveDraft, getActiveDraft, clearActiveDraft } from '@/utils/activeWorkoutDraft'
import {
  getFavoritesByType,
  renameFavoriteWorkout,
  updateFavoriteWorkout,
  deleteFavoriteWorkout,
  getFavoriteLimitPerType,
  getFavoriteNameValidationError,
  normalizeWorkoutType
} from '@/utils/workoutFavorites'

import HeaderBar from "../components/HeaderBar.vue";
import AppModal from "../components/AppModal.vue";
import WorkoutTimerConfig from '@/components/timer/WorkoutTimerConfig.vue'
import TimerMenu from '@/components/timer/TimerMenu.vue'
import RestTimerSettings from '@/components/timer/RestTimerSettings.vue'
import OneTimeHint from '@/components/OneTimeHint.vue'
import { logger } from '@/utils/logger'
import SessionStopwatch from '@/components/SessionStopwatch.vue'
import MonthlyReportRow from '@/components/MonthlyReportRow.vue'
import AvatarEditor from '@/components/AvatarEditor.vue'
import NameEditModal from '@/components/NameEditModal.vue'
import WorkoutGoalPicker from '@/components/WorkoutGoalPicker.vue'
import { getTrainingPlans, updateTrainingPlan, deleteTrainingPlan } from '@/utils/trainingPlanStorage'
import { useToastStore } from '@/stores/toastStore'
import { getTodayPlanInfo, getPlanDayInfo, getDayMuscleGroups, buildDayStartFavorite, planDayTitle as planDayTitleOf } from '@/utils/planProgress'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { migrateTemplateFavoritesToPlans, removeOrphanTemplateFavorites } from '@/utils/planMigration'
import { messages } from '@/i18n'
import WeekStrip from '@/components/WeekStrip.vue'
import CoachMarks from '@/components/CoachMarks.vue'
import { countWeekWorkouts } from '@/utils/weekStrip'
import { ArrowUpRight, ArrowDownLeft, ChevronsDown, Target, Star, ClipboardList, Timer, Info } from 'lucide-vue-next'
import { findPlansUsingFavorite, removeFavoriteFromPlan } from '@/utils/trainingPlan'
import { sanitizeWorkoutGoal, WORKOUT_GOALS, GENERATOR_GOALS, WORKOUT_GOAL_LABEL_KEYS } from '@/utils/workoutGoal'


const store = useUserStore()
const settings = useSettingsStore()
const { t: $t, locale } = useI18n()
const router = useRouter()
const toast = useToastStore()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const authStore = useAuthStore()
const sessionStopwatchStore = useSessionStopwatchStore()
const restTimerStore = useRestTimerStore()
const warmupTimerStore = useWarmupTimerStore()
const draftStateVersion = ref(0)
const user = ref(null)
const isSignedIn = ref(false)
const selectedWorkoutType = ref('push')
const isOffline = ref(!isOnline())
const workoutCreated = ref(false)
const showFavoriteDeleteConfirm = ref(false)
const pendingFavoriteToDelete = ref(null)
const showDiscardDraftConfirm = ref(false)
const showTimerConfig = ref(false)
// Timer-Knopf: erst Auswahl "Pausentimer" oder "Workout-Timer"
const showTimerMenu = ref(false)
const showRestSettings = ref(false)
function onTimerMenuSelect(target) {
  showTimerMenu.value = false
  if (target === 'rest') showRestSettings.value = true
  else showTimerConfig.value = true
}
const detailDraft = ref(null)
const showInfoModal = ref(false)
const infoMessage = ref('')
// Name-Bearbeiten direkt im Dashboard (Klick auf den Titel/Namen im Header) statt Umleitung zu
// den Settings - siehe HeaderBar.vue titleClickable/@title-click und NameEditModal.vue.
const showNameModal = ref(false)
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

function getActiveDraftUserId() {
  return String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || store.user?.uid || '').trim()
}

const activeDraftState = computed(() => {
  void draftStateVersion.value // erzwingt Neuberechnung bei manuellem Trigger
  const uid = getActiveDraftUserId()
  if (!uid || !hasActiveDraft(uid)) return null
  const draft = getActiveDraft(uid)
  if (!draft?.workout) return null
  if (draft.workout?._adjustDraft === true) return null
  return draft
})

const hasDraft = computed(() => Boolean(activeDraftState.value?.workout))
const draftId = computed(() => {
  const workout = activeDraftState.value?.workout || null
  if (!workout) return ''
  const draftWorkoutId = String(workout._id || '').trim()
  if (draftWorkoutId) return draftWorkoutId
  return String(activeDraftState.value?.editingWorkoutId || '').trim() || 'draft'
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

function onSessionTime({ totalMs, formattedTime }) {
  console.log('Session-Zeit:', formattedTime, totalMs)
}

const weeklyGoal = computed(() => Number(settings.weeklyGoal) || 4)
// Diese Woche = Montag bis Sonntag (passend zum Wochenstreifen), nicht mehr „die letzten 7 Tage“.
const weeklyCount = computed(() => countWeekWorkouts({ workouts: store.workouts || [] }))

// Kacheln „Selbst zusammenstellen“: Icon, Name und die trainierten Muskeln (erklärt Einsteigern, was dahintersteckt).
// Sprechblasen auf dem Dashboard (Absprache Paul 29.10.): Wochenstreifen und, mit aktivem Plan, „Heute“.
const coachMarks = computed(() => [
  { id: 'coach-week', selector: '.dashboard-week', title: $t('coach.weekTitle'), text: $t('coach.weekText') },
  { id: 'coach-today', selector: '.today-card', title: $t('coach.todayTitle'), text: $t('coach.todayText') }
])
// Nicht über Fenstern und nicht, solange der Start-Ablauf (Favoriten, Ziel ...) offen ist.
const coachActive = computed(() => isSignedIn.value && !showStartOptions.value && !showNameModal.value && !showGoalModal.value
  && !showTimerMenu.value && !showFavoriteMenu.value && !showPlanDayPicker.value && !showRemovePlan.value && !showInfoModal.value
  && !showDiscardDraftConfirm.value && !showFavoriteDeleteConfirm.value)

const typeTiles = computed(() => [
  { type: 'push', label: 'Push', icon: ArrowUpRight, muscles: $t('dashboard.pushMuscles') },
  { type: 'pull', label: 'Pull', icon: ArrowDownLeft, muscles: $t('dashboard.pullMuscles') },
  { type: 'legs', label: 'Legs', icon: ChevronsDown, muscles: $t('dashboard.legsMuscles') },
  { type: 'fullbody', label: $t('dashboard.fullBodyLabel'), icon: Target, muscles: $t('dashboard.fullBodyMuscles') }
])
const weeklyProgressLabel = computed(() => $t('dashboard.weeklyProgress', { done: weeklyCount.value, goal: weeklyGoal.value }))

// Erstnutzung (Absprache Paul 22.10.): noch kein abgeschlossenes Workout und kein Entwurf -> kurze Erklärung unter den
// Kacheln, die Gym-Zeit-Karte erscheint erst, wenn sie gebraucht wird (laufende Zeit oder vorhandene Workouts).
// Erst nach dem Laden der Workouts entscheiden: davor ist die Liste leer, und der Hinweis blitzte bei jedem App-Start
// kurz auf, bis die Workouts da waren (User-Report 24.10.).
const isFirstUse = computed(() => store.workoutsLoaded && !hasDraft.value && !(store.workouts || []).some(w => w?.completed === true))
// Gym-Zeit erst zeigen, wenn sie läuft oder pausiert ist (Absprache Paul 28.10.): sie startet mit Workout/Warm-up.
const showStopwatchCard = computed(() => Boolean(sessionStopwatchStore.startedAt))

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

// Zeigt Bild/Upload/Crop nun direkt AvatarEditor.vue (siehe #leading-Slot oben) - Initialen für
// dessen Fallback werden weiterhin hier berechnet, da diese Komponente den angezeigten Namen
// nicht selbst kennt.
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
  const uid = String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || '').trim()
  return buildDetailDraftKey(uid)
}

function buildFavoriteDetailDraft(favorite) {
  const fav = favorite?.workout || {}
  const type = normalizeBuilderWorkoutType(favorite?.type || pendingWorkoutType.value)
  const draftId = `draft-favorite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const userId = String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || 'guest')
  const exercises = (Array.isArray(fav.exercises) ? fav.exercises : []).map((exercise = {}) => {
    const setDetails = Array.isArray(exercise?.setDetails) && exercise.setDetails.length > 0
      ? exercise.setDetails.map((set) => ({ reps: Number(set?.reps) || 0, weight: Number(set?.weight) || 0, ...(set?.isWarmup ? { isWarmup: true } : {}), ...(Number(set?.durationSeconds) > 0 ? { durationSeconds: Number(set.durationSeconds) } : {}) }))
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
    // Favorit anpassen: Ziel des Favoriten beibehalten (sonst ginge es beim Speichern verloren).
    goal: sanitizeWorkoutGoal(fav.goal),
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

function startQuick(type, goal) {
  router.push(buildWorkoutBuilderRoute(normalizeBuilderWorkoutType(type), { goal }))
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

// Ablauf neues Workout: Weg wählen (Manuell/Generieren) -> Ziel-Fenster -> Starten.
// Favoriten ohne gespeichertes Ziel nutzen dasselbe Fenster (goalModalContext.kind === 'favorite').
const showGoalModal = ref(false)
const goalModalChoice = ref('')
const goalModalError = ref(false)
const goalModalContext = ref(null)

watch(goalModalChoice, (goal) => {
  if (goal) goalModalError.value = false
})

// Der Generator kennt nur Muskelaufbau/Kraft (Absprache Paul 19.10.); sonst alle vier Ziele.
const goalModalGoals = computed(() => (goalModalContext.value?.path === 'generate' ? GENERATOR_GOALS : WORKOUT_GOALS))

function openGoalModal(context) {
  goalModalContext.value = context
  const last = sanitizeWorkoutGoal(settings.lastWorkoutGoal) || ''
  const allowed = context?.path === 'generate' ? GENERATOR_GOALS : WORKOUT_GOALS
  goalModalChoice.value = allowed.includes(last) ? last : ''
  goalModalError.value = false
  showGoalModal.value = true
}

function closeGoalModal() {
  showGoalModal.value = false
  goalModalContext.value = null
}

function chooseStartPath(path) {
  openGoalModal({ kind: 'path', path })
}

function confirmGoalModal() {
  const goal = sanitizeWorkoutGoal(goalModalChoice.value)
  if (!goal) {
    goalModalError.value = true
    return
  }
  settings.setLastWorkoutGoal(goal)
  const context = goalModalContext.value
  closeGoalModal()
  if (context?.kind === 'favorite') {
    startFavoriteWithNewGoal(context.favorite, goal, context.planRef || null)
    return
  }
  const type = pendingWorkoutType.value
  closeStartModePanel()
  if (context?.path === 'generate') {
    router.push({ name: 'quick-workout-generator', query: { type, goal } })
  } else {
    startQuick(type, goal)
  }
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

function openFavoriteInBuilder(favorite, { autoStart = false, goal = null, planRef = null } = {}) {
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
  router.push(buildWorkoutBuilderRoute(type, {
    quick: true,
    favoriteStart: autoStart,
    favoriteAdjust: !autoStart,
    goal,
    planId: planRef?.planId,
    planDayId: planRef?.planDayId
  }))
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

// --- Ziel bei Favoriten ------------------------------------------------------------------
// Favorit mit gespeichertem Ziel startet direkt damit. Ohne Ziel (alte Favoriten) erscheint das
// Ziel-Fenster einmal; das Ziel wird sofort im Favoriten gespeichert.
function favoriteGoalOf(favorite) {
  return sanitizeWorkoutGoal(favorite?.workout?.goal)
}

function favoriteGoalLabel(favorite) {
  const goal = favoriteGoalOf(favorite)
  if (!goal) return ''
  return $t(WORKOUT_GOAL_LABEL_KEYS[goal])
}

function favoriteMetaLine(favorite) {
  return [favoriteGoalLabel(favorite), formatFavoriteDate(favorite?.updatedAt || favorite?.createdAt)]
    .filter(Boolean)
    .join(' · ')
}

function startFavoriteWithNewGoal(favorite, goal, planRef = null) {
  const result = updateFavoriteWorkout({
    userId: getCurrentFavoritesUserId(),
    type: favorite?.type,
    id: favorite?.id,
    name: favorite?.name,
    workout: { ...(favorite?.workout || {}), goal }
  })
  if (!result?.success) {
    logger.warn('[Dashboard] Ziel konnte nicht im Favoriten gespeichert werden', result?.code)
  }
  // Angezeigte Favoritenlisten neu laden, sonst fehlt dort das Ziel bis zum nächsten Öffnen.
  loadFavoriteWorkoutsForCurrentType()
  loadAllFavoriteWorkouts()
  const updated = result?.success && result.favorite ? result.favorite : { ...favorite, workout: { ...(favorite?.workout || {}), goal } }
  try {
    openFavoriteInBuilder(updated, { autoStart: true, goal, planRef })
  } catch {
    favoriteInfoText.value = $t('dashboard.favoriteStartFailed')
  }
}

// --- Trainingsplan: „Heute“-Karte -------------------------------------------------------------
const todayPlan = ref(null)
const showPlanDayPicker = ref(false)
const showRemovePlan = ref(false)

// Plan vom Dashboard entfernen: der Plan wird gelöscht (Favoriten und Workouts bleiben). Gibt es weitere Pläne, wird einer davon aktiv.
function removeTodayPlan() {
  const plan = todayPlan.value?.plan
  if (!plan) return
  const result = deleteTrainingPlan({ userId: getCurrentFavoritesUserId(), planId: plan.id })
  refreshTodayPlan()
  if (result.ok) toast.show($t('plans.removed', { name: plan.name }), { type: 'success' })
}

// Einmalige Umstellung: Vorlagen-Pläne der ersten Fassung hatten je Tag einen Favoriten angelegt (siehe utils/planMigration.js).
async function migrateLegacyPlans() {
  try {
    const userId = getCurrentFavoritesUserId()
    let changed = false
    if (getTrainingPlans(userId).some((plan) => plan.days.some((day) => day.favoriteId && !day.exercises?.length))) {
      const catalog = await loadDefaultExercises().catch(() => [])
      changed = migrateTemplateFavoritesToPlans({ userId, catalog }).plans > 0
    }
    // Vorlagen-Favoriten gelöschter oder ausprobierter Pläne (beide Sprachen) aufräumen.
    const dayLabels = ['de', 'en'].flatMap((lang) => Object.values(messages[lang]?.plans?.dayLabel || {}))
    if (removeOrphanTemplateFavorites({ userId, dayLabels }) > 0) changed = true
    if (changed) {
      refreshTodayPlan()
      if (startFlowStep.value === 'all-favorites') loadAllFavoriteWorkouts()
    }
  } catch (err) {
    logger.warn('[Dashboard] Plan-Umstellung fehlgeschlagen', err?.message)
  }
}

function refreshTodayPlan() {
  try {
    todayPlan.value = getTodayPlanInfo(getCurrentFavoritesUserId())
  } catch (err) {
    logger.warn('[Dashboard] Trainingsplan konnte nicht gelesen werden', err?.message)
    todayPlan.value = null
  }
}

// Tag samt Übungen (im Plan-Tag selbst oder im verknüpften Favoriten), siehe utils/planProgress.js.
function planDayInfo(day) {
  return todayPlan.value && day ? getPlanDayInfo(getCurrentFavoritesUserId(), todayPlan.value.plan.id, day.id) : null
}

function planDayLabel(day) {
  return planDayTitleOf(planDayInfo(day)) || $t('plans.favoriteMissing')
}

const todayDayTitle = computed(() => planDayTitleOf(todayPlan.value) || $t('plans.favoriteMissing'))

const { getTranslatedMuscleGroup } = useExerciseTranslation()

// Muskeln eines Plan-Tages in der App-Sprache („Brust, Schultern, Trizeps“) - erklärt, was hinter „Push A“ steckt.
function planDayMuscles(day) {
  const labels = getDayMuscleGroups(planDayInfo(day)?.exercises).map((group) => getTranslatedMuscleGroup(group))
  return [...new Set(labels.filter(Boolean))].join(', ')
}

const todaySubline = computed(() => {
  const muscles = planDayMuscles(todayPlan.value?.day)
  const plan = todayPlan.value?.plan?.name || ''
  return muscles ? $t('plans.todayPlanLine', { plan, muscles }) : $t('plans.todayPlanOnly', { plan })
})

// Tag des Plans starten: wie ein Favorit (inkl. Zielabfrage bei alten Favoriten), plus Plan/Tag zum Speichern am Workout.
async function startPlanDay(plan, day) {
  const info = getPlanDayInfo(getCurrentFavoritesUserId(), plan.id, day.id)
  let catalog = []
  try { catalog = await loadDefaultExercises() } catch { catalog = [] }
  const favorite = buildDayStartFavorite(info, catalog)
  if (!favorite) return
  const planRef = { planId: plan.id, planDayId: day.id }
  const goal = favoriteGoalOf(favorite)
  if (!goal) {
    openGoalModal({ kind: 'favorite', favorite, planRef })
    return
  }
  try {
    openFavoriteInBuilder(favorite, { autoStart: true, goal, planRef })
  } catch {
    favoriteInfoText.value = $t('dashboard.favoriteStartFailed')
  }
}

function pickPlanDay(day) {
  showPlanDayPicker.value = false
  if (todayPlan.value) startPlanDay(todayPlan.value.plan, day)
}

// --- "⋯"-Menü eines Favoriten -------------------------------------------------------------
const showFavoriteMenu = ref(false)
const favoriteMenuTarget = ref(null)
const favoriteMenuRenaming = ref(false)
const favoriteMenuError = ref('')

function openFavoriteMenu(favorite) {
  favoriteMenuTarget.value = favorite
  favoriteMenuRenaming.value = false
  favoriteMenuError.value = ''
  showFavoriteMenu.value = true
}

function closeFavoriteMenu() {
  showFavoriteMenu.value = false
  favoriteMenuRenaming.value = false
  favoriteMenuError.value = ''
  renamingFavoriteId.value = null
  favoriteRenameInput.value = ''
}

function favoriteMenuAdjust() {
  const favorite = favoriteMenuTarget.value
  closeFavoriteMenu()
  if (favorite) adjustFavoriteWorkout(favorite)
}

function favoriteMenuBeginRename() {
  beginRenameFavorite(favoriteMenuTarget.value)
  favoriteMenuRenaming.value = true
}

function favoriteMenuDelete() {
  const favorite = favoriteMenuTarget.value
  closeFavoriteMenu()
  if (favorite) askRemoveFavorite(favorite)
}

function onFavoriteMenuConfirm() {
  if (!favoriteMenuRenaming.value) {
    closeFavoriteMenu()
    return
  }
  const validationError = getFavoriteNameValidationError(favoriteRenameInput.value)
  if (validationError) {
    favoriteMenuError.value = validationError
    return
  }
  confirmRenameFavorite(favoriteMenuTarget.value)
  closeFavoriteMenu()
}

function startFavoriteWorkout(favorite) {
  const goal = favoriteGoalOf(favorite)
  if (!goal) {
    openGoalModal({ kind: 'favorite', favorite })
    return
  }
  try {
    openFavoriteInBuilder(favorite, { autoStart: true, goal })
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

const favoriteDeleteMessage = ref('')

function plansUsingFavorite(favorite) {
  return findPlansUsingFavorite(getTrainingPlans(getCurrentFavoritesUserId()), favorite?.id)
}

function askRemoveFavorite(favorite) {
  pendingFavoriteToDelete.value = favorite
  const plans = plansUsingFavorite(favorite)
  favoriteDeleteMessage.value = plans.length
    ? `${$t('dashboard.favoriteDeleteConfirmMsg')} ${$t('plans.favoriteInPlans', { plans: plans.map((plan) => plan.name).join(', ') })}`
    : $t('dashboard.favoriteDeleteConfirmMsg')
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
  // Tage, die auf den gelöschten Favoriten zeigen, aus den Plänen nehmen (leere Pläne entfallen).
  const planUserId = getCurrentFavoritesUserId()
  plansUsingFavorite(favorite).forEach((plan) => {
    updateTrainingPlan({ userId: planUserId, planId: plan.id, updater: (p) => removeFavoriteFromPlan(p, favorite.id) })
  })
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
  showDiscardDraftConfirm.value = false
  // Abgebrochenes Workout: Gesamtzeit, Pause und Warm-up-Timer enden mit.
  sessionStopwatchStore.reset()
  restTimerStore.clear()
  if (warmupTimerStore.isActive) warmupTimerStore.cancel()
  // Aktiven Draft aus localStorage entfernen (verhindert Re-Anzeige des Banners)
  const uid = getActiveDraftUserId()
  if (uid) clearActiveDraft(uid)
  draftStateVersion.value++
  // Sammle alle IDs die mit dem aktuellen Draft zusammenhängen können:
  // 1. workout_map_{tempId} → realId (Server-Workout, vom WorkoutBuilder erzeugt)
  // 2. detailDraft._id wenn echte ObjectId (nach router.replace)
  // 3. draftId aus Store (kann direkt realId sein wenn Draft als solche markiert)
  // Alle IDs werden BEDINGUNGSLOS gesammelt – wenn der Delete-Button sichtbar ist,
  // kann kein completed Workout betroffen sein.
  const serverDraftIds = new Set()
  const pendingCreateTempIds = new Set()
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('workout_map_'))
      .forEach(k => {
        const realId = String(sessionStorage.getItem(k) || '').trim()
        if (realId && /^[a-f\d]{24}$/i.test(realId)) serverDraftIds.add(realId)
        const tempId = k.slice('workout_map_'.length).trim()
        if (tempId) pendingCreateTempIds.add(tempId)
      })
    // detailDraft selbst kann bereits eine echte MongoDB-ID sein (nach router.replace)
    const draftObjId = String(detailDraft.value?._id || '').trim()
    if (draftObjId && /^[a-f\d]{24}$/i.test(draftObjId)) serverDraftIds.add(draftObjId)
    if (draftObjId && (draftObjId.startsWith('draft-') || draftObjId.startsWith('offline_'))) {
      pendingCreateTempIds.add(draftObjId)
    }
    // Alle Draft-Workouts im Store mit echter ObjectId ebenfalls erfassen
    ;(store.workouts || [])
      .filter(w => (w?._isDraft === true || w?.isDraft === true) && w?.completed !== true)
      .forEach(w => {
        const id = String(w?._id || '').trim()
        if (id && /^[a-f\d]{24}$/i.test(id)) serverDraftIds.add(id)
        if (id && (id.startsWith('draft-') || id.startsWith('offline_'))) {
          pendingCreateTempIds.add(id)
        }
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
// Dashboard ist der Startpunkt für neue Workouts: Server und KI-Relay (Render Free-Plan) schon
// hier wecken, damit Generator und Feedback später ohne Kaltstart-Wartezeit laufen.
const stopAiWarmup = startAiWarmup()
onUnmounted(stopAiWarmup)

onMounted(() => {
  draftSourceLogged.value = false
  refreshTodayPlan()
  migrateLegacyPlans()
  window.addEventListener('fbe:plans-changed', refreshTodayPlan)
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
  window.removeEventListener('fbe:plans-changed', refreshTodayPlan)
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
  refreshTodayPlan()
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
  /* Wunsch Paul: Dashboard soll NICHT scrollen, auch mit der größeren Stoppuhr-Karte.
     Vorher: min-height + Workout-Kacheln mit fester aspect-ratio (Höhe hing an der Breite) - kam
     mehr Inhalt dazu, wurde die Seite länger als der Bildschirm. Jetzt (wie bisher schon im
     Entwurfs-Modus): feste Höhe = Platz zwischen Header und Bottom-Nav, Hero und Stoppuhr in
     ihrer natürlichen Höhe, der Kachel-Bereich teilt sich den Rest (siehe .quick-grid). Scrollen
     nur noch als Notlösung innerhalb des Bereichs (overflow-y), z.B. bei langen Favoritenlisten. */
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px clamp(12px, 3vw, 32px);
  padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px));
  height: calc(100dvh - var(--header-height) - var(--safe-top) - 64px - var(--safe-bottom, 0px));
  overflow-y: auto;
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
}

/* Kein Block schrumpft unter seine Höhe (sonst überlappen sie sich, z. B. bei laufender Gym-Zeit); Platzmangel -> scrollen. */
.dashboard-content > * {
  flex-shrink: 0;
}

.dashboard-content > .quick-start {
  flex-shrink: 0;
}

/* Gym-Zeit-Karte im Dashboard kleiner (Wunsch Paul 29.10.): weniger Höhe, damit alles ohne Scrollen passt. */
.dashboard-content :deep(.sw-card) {
  gap: 10px;
  padding: 8px 12px;
}

.dashboard-content :deep(.sw-card-time) {
  margin-top: 0;
  font-size: 1.45rem;
}

.dashboard-content :deep(.sw-card-hint) {
  display: none;
}

.dashboard-content :deep(.sw-card-main-btn) {
  width: 44px;
  height: 44px;
}

/* Mit Entwurf-Hinweis: Kacheln und Wochenstreifen enger, damit alles auf den Bildschirm passt. */
.dashboard-content.has-draft .quick-section-label,
.dashboard-content.has-draft .type-text small {
  display: none;
}

.dashboard-content.has-draft .type-grid {
  grid-template-rows: repeat(2, minmax(44px, 64px));
  gap: 8px;
}

.dashboard-content.has-draft .type-tile {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 6px 10px;
}

.dashboard-content.has-draft .type-info {
  top: 50%;
  transform: translateY(-50%);
}

.dashboard-content.has-draft .quick-bar-btn {
  min-height: 40px;
}

.dashboard-content.has-draft .week-strip {
  padding: 6px 8px 4px;
  gap: 4px;
}

.dashboard-content.has-draft {
  gap: 8px;
  padding-top: 10px;
}

.dashboard-week {
  /* Mehr Luft zwischen Kopfzeile und Wochenstreifen (Wunsch Paul 29.10.). */
  margin-top: 14px;
}

.today-card {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--card-radius);
  border: 1.5px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 7%, var(--card-bg));
}

.today-text {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  gap: 1px;
}

.today-eyebrow {
  margin: 0;
  color: var(--accent);
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.today-title {
  margin: 0;
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}

.today-remove {
  position: absolute;
  top: 0;
  right: 2px;
  min-width: 32px;
  min-height: 32px;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.today-sub,
.today-warn {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.today-warn {
  color: var(--danger);
}

.today-start {
  flex: 0 0 auto;
  align-self: center;
  min-height: 44px;
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.today-other {
  justify-self: start;
  min-height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.75rem;
  text-decoration: underline;
  cursor: pointer;
}

.plan-pick-hint {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 0.85rem;
}

.plan-pick-list {
  display: grid;
  gap: 8px;
}

.plan-pick-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.plan-pick-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.plan-pick-text small {
  color: var(--muted);
  font-weight: 400;
}

.plan-pick-btn.is-next {
  border-color: var(--accent);
}

.plan-pick-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.quick-start {
  display: flex;
  flex-direction: column;
  /* Nicht unter die Mindesthöhe der Kacheln schrumpfen: sonst ragt der Inhalt über die Nachbarn (laufende Gym-Zeit,
     Entwurfs-Hinweis). Reicht der Platz nicht, scrollt der Bereich. */
  flex: 1 0 auto;
  min-height: 0;
  gap: 10px;
}


.quick-area {
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-height: 0;
  gap: 8px;
}

.quick-section-label {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* Zwei Kachel-Reihen teilen sich den verfügbaren Platz (mind. 64px, höchstens 120px): so scrollt das Dashboard nicht. */
.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(64px, 120px));
  gap: 10px;
  flex: 1 0 auto;
  min-height: 0;
}

.type-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
  min-height: 0;
  padding: 12px 12px 10px;
  border-radius: var(--card-radius);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.type-tile:hover,
.type-tile:active {
  border-color: var(--accent);
}

.type-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

.type-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.type-text strong {
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-size: 1.1rem;
}

.type-text small {
  color: var(--muted);
  font-size: 0.7rem;
  line-height: 1.3;
}

.type-info {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border-radius: 50%;
}

.quick-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

/* Trainingspläne darunter über die ganze Breite (Wunsch Paul 29.10.). */
.quick-bar-btn--wide {
  grid-column: 1 / -1;
}

.quick-bar-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: var(--card-radius);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.quick-bar-btn svg {
  color: var(--accent);
}

.quick-bar-btn:hover,
.quick-bar-btn:active {
  border-color: var(--accent);
}

.quick-first-hint {
  margin: 2px 4px 0;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.quick-mode-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: var(--card-radius);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
}

/* Doppelte Klasse: muss die spätere Grundregel .favorite-item (flex-direction: column) schlagen -
   Name links, "Starten" und "⋮" rechts in derselben Zeile. */
.favorite-item.favorite-item--compact {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 6px 8px 10px;
}

.favorite-main {
  flex: 1;
  min-width: 0;
}

.favorite-main .favorite-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-meta {
  margin-top: 2px;
  font-size: 0.78rem;
  color: var(--muted);
}

.favorite-start-btn {
  flex-shrink: 0;
  min-height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 9px;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.favorite-more-btn {
  /* Schmal und hochkant (Wunsch Paul) - Tippfläche bleibt über die Höhe groß genug. */
  flex-shrink: 0;
  width: 24px;
  min-width: 0; /* globale Button-Regel (style.css) setzt 48px */
  min-height: 34px;
  margin-right: -4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.favorite-menu-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.favorite-menu-btn {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.favorite-menu-btn--danger {
  border-color: var(--danger);
  color: var(--danger-text, var(--danger));
}

.favorite-menu-rename .favorite-rename-input {
  width: 100%;
}

.favorite-menu-error {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--danger-text, var(--danger));
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
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  background: var(--card-soft);
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

.quick-mode-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast, #060606);
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
  border: 1px dashed var(--card-border);
  border-radius: var(--card-radius);
  padding: 10px;
  color: var(--muted);
  font-size: 0.85rem;
}

.favorite-item {
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
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
  border-radius: var(--card-radius);
  border: 1px solid var(--card-border);
  background: var(--card-soft);
  font-size: 0.85rem;
  flex-wrap: wrap;
  margin-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
}

.dashboard-content.has-draft .draft-note {
  position: static;
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
  border-radius: var(--card-radius);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
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
  color: var(--danger);
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
