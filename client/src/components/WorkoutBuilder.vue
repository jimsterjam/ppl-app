// Entferne alle fremden Drafts aus SessionStorage und IndexedDB beim Nutzerwechsel
async function clearOtherUserDrafts() {
  const myKey = getDraftStorageKey()
  // SessionStorage: alle Keys durchgehen
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key && key.startsWith('workout_builder_draft_') && key !== myKey) {
      sessionStorage.removeItem(key)
    }
  }
  // IndexedDB: alle Drafts mit anderem Key löschen
  try {
    const { db } = await import('@/utils/offlineStorage')
    const allDrafts = await db.workouts.toArray()
    for (const draft of allDrafts) {
      if (draft._id && draft._id.startsWith('workout_builder_draft_') && draft._id !== myKey) {
        await db.workouts.delete(draft._id)
      }
    }
  } catch (e) { /* ignore */ }
}

// Beim Mounten: Fremde Drafts entfernen
import { onMounted } from 'vue'
onMounted(() => {
  clearOtherUserDrafts()
})
<template>
  <div class="workout-builder">
    <!-- Glaubenssatz / Affirmation vor dem Plan -->
    <AppModal
      v-model="showBelief"
      :title="t('builder.impulseTitle')"
      :message="beliefText"
      :confirm-text="t('builder.continue')"
      :show-cancel="false"
      :persistent="true"
      type="info"
      @confirm="continuePlan"
    />
    <!-- Oben immer sichtbarer Zurück-Button -->
    <div class="builder-topbar">
  <button class="back-top-btn" :title="t('builder.backToDashboardTitle')" @click="goDashboard">{{ t('builder.backToDashboard') }}</button>
  <h2>{{ t('builder.createTitle') }}</h2>
    </div>

    <!-- Step Indicator -->
    <StepIndicator :active="activeStep" />


    <!-- Auth-Gate: User muss eingeloggt sein -->
    <div v-if="!isLoaded || loadingUser" class="auth-gate">
      <p class="auth-gate-text">{{ t('builder.authLoading') }}</p>
    </div>
    <div v-else-if="!isSignedIn" class="auth-gate">
      <p class="auth-gate-text">{{ t('builder.authGate') }}</p>
    </div>
    
    <!-- Workout-Typ Auswahl (Dropdown) -->
    <div v-else class="type-select">
  <label for="wb-type" class="type-label">{{ t('builder.stepType') }}</label>

      <!-- Mobile: gleiches Design wie Übungen (Button + Bottom-Sheet) -->
      <div v-if="isMobile" class="mobile-ex-picker">
        <button class="open-picker-btn" @click="showTypePicker = true">
          {{ currentTypeLabel ? `${t('builder.stepType')}: ${currentTypeLabel}` : t('builder.selectType') }}
        </button>
      </div>

      <!-- Desktop: klassisches Select -->
      <select v-else id="wb-type" v-model="selectedType" class="type-dropdown" @change="onTypeChange">
        <option v-for="type in workoutTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
      </select>
    </div>

  <!-- Mobile Typauswahl Top-Sheet -->
    <div v-if="isMobile && showTypePicker" class="picker-overlay" @click.self="showTypePicker = false">
      <div class="picker-sheet">
        <div class="picker-header">
          <h4>{{ t('builder.pickWorkoutType') }}</h4>
          <button class="close-picker" @click="showTypePicker = false">✕</button>
        </div>
        <div class="picker-list">
          <div class="type-list">
            <button
              v-for="t in workoutTypes"
              :key="t.value"
              class="type-item"
              :aria-pressed="selectedType === t.value"
              @click="pickType(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="picker-actions">
          <button class="done-btn" @click="showTypePicker = false">{{ t('builder.done') }}</button>
        </div>
      </div>
    </div>

    <!-- Übungen für gewählten Typ -->
    <div v-if="isSignedIn" class="exercises-section">
  <h3>{{ t('builder.availableExercises', { type: currentTypeLabel }) }}</h3>
  
  <!-- Sticky CTA -->
    <div v-if="isSignedIn" class="sticky-cta">
      <button 
        class="create-btn" 
        :disabled="!isSignedIn || creating || selectedExercises.length === 0" 
        :title="!isSignedIn ? t('builder.signInFirst') : (selectedExercises.length === 0 ? t('builder.pickFirst') : t('builder.createCta'))"
        @click="createWorkout"
      >
        {{ creating ? t('builder.creating') : `${t('builder.create')} (${selectedExercises.length})` }}
      </button>
    </div>

      <!-- Mobile: Öffne Dropdown -->
      <div v-if="isMobile" class="mobile-ex-picker">
  <button class="open-picker-btn" @click="showMobilePicker = true">{{ t('builder.pickExercises') }}</button>
      </div>

      <template v-if="!isMobile">
      <!-- Suche -->
      <div class="search-row">
        <input
          v-model="search"
          class="search-input"
          type="search"
          :placeholder="t('builder.searchPlaceholder')"
          :aria-label="t('builder.searchPlaceholder')"
        />
      </div>

      <!-- Skeleton während Loading -->
      <div v-if="loading" class="exercises-grid">
        <div v-for="n in 6" :key="n" class="exercise-item sk"></div>
      </div>

      <!-- Keine Übungen -->
      <div v-else-if="!loading && filteredExercises.length === 0" class="empty-state">
        <p>😅 Keine Übungen für diese Kategorie verfügbar</p>
        <p class="hint">exercises.value.length: {{ exercises.length }} | loading: {{ loading }}</p>
      </div>

      <!-- Liste -->
      <div v-else class="exercises-grid">
        <div 
          v-for="exercise in filteredExercises" 
          :key="exercise._id"
          :class="{ selected: isSelected(exercise) }"
          class="exercise-item"
          @click="toggleExercise(exercise)"
        >
          <div class="ex-row">
            <img :src="getExerciseImage(exercise)" :alt="t('common.image')" class="thumb" @error="onImgError($event, exercise)" />
            <div class="meta">
              <h4 class="title">{{ getTranslatedExerciseName(exercise.name) }}</h4>
              <p class="sub">{{ getTranslatedMuscleGroup(exercise.muscleGroup) }}</p>
              <p class="sub small">{{ getTranslatedEquipment(exercise.equipment) || t('exercises.bodyweight') }}</p>
            </div>
          </div>
        </div>
      </div>
      </template>

  <!-- Mobile Dropdown Top-Sheet -->
      <div v-if="isMobile && showMobilePicker" class="picker-overlay" @click.self="showMobilePicker = false">
        <div class="picker-sheet">
          <div class="picker-header">
            <h4>{{ t('builder.selectExercises') }}</h4>
            <button class="close-picker" @click="showMobilePicker = false">✕</button>
          </div>
          <div class="search-row in-sheet">
            <input
              v-model="search"
              class="search-input"
              type="search"
              :placeholder="t('builder.searchPlaceholder')"
              :aria-label="t('builder.searchPlaceholder')"
            />
          </div>
          <div class="picker-list" :aria-busy="loading">
            <div v-if="loading" class="exercises-grid">
              <div v-for="n in 6" :key="n" class="exercise-item sk"></div>
            </div>
            <div v-else class="exercises-grid">
              <div 
                v-for="exercise in filteredExercises" 
                :key="exercise._id"
                :class="{ selected: isSelected(exercise) }"
                class="exercise-item"
                @click="toggleExercise(exercise)"
              >
                <div class="ex-row">
                  <img :src="getExerciseImage(exercise)" :alt="t('common.image')" class="thumb" @error="onImgError($event, exercise)" />
                  <div class="meta">
                    <h4 class="title">{{ getTranslatedExerciseName(exercise.name) }}</h4>
                    <p class="sub">{{ getTranslatedMuscleGroup(exercise.muscleGroup) }}</p>
                    <p class="sub small">{{ getTranslatedEquipment(exercise.equipment) || t('exercises.bodyweight') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="picker-actions">
            <button class="done-btn" @click="showMobilePicker = false">{{ t('builder.done') }}</button>
          </div>
        </div>
      </div>

      <!-- Ausgewählte Übungen -->
      <div v-if="selectedExercises.length > 0" id="workout-plan" ref="planRef" class="selected-exercises">
  <h3>{{ t('builder.planTitle', { count: selectedExercises.length }) }}</h3>

  <p class="reorder-hint">{{ t('workoutDetail.reorderHint') }}</p>

        <div
          v-for="(exercise, index) in selectedExercises"
          :key="exercise._id"
          class="selected-exercise"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover.prevent="onDragOver(index)"
          @drop.prevent="onDrop(index)"
        >
          <button class="drag-handle" :aria-label="t('workoutDetail.dragToReorder')" :title="t('workoutDetail.dragToReorder')">⋮⋮</button>
          <div class="sel-row">
            <img :src="getExerciseImage(exercise)" :alt="t('common.image')" class="thumb small" @error="onImgError($event, exercise)" />
            <div class="ex-info-col">
              <span class="ex-name">{{ getTranslatedExerciseName(exercise.name) }}</span>
              <div class="exercise-note-input" style="margin:2px 0 6px 0;">
                <input
                  type="text"
                  v-model="exercise.note"
                  :placeholder="t('builder.notePlaceholder') !== 'builder.notePlaceholder' ? t('builder.notePlaceholder') : 'Notiz (optional)'"
                  maxlength="150"
                  style="width:100%; font-size:0.92em; color:var(--muted); background:var(--bg2); border:1px solid var(--border); border-radius:4px; padding:2px 6px; margin-bottom:2px;"
                />
                <span v-if="exercise.note" style="font-size:0.85em; color:var(--muted);">📝 {{ exercise.note.length }}/150</span>
              </div>
            </div>
          </div>
          <!-- Mini-Plan pro Übung: Sätze/Reps/Gewicht -->
          <div class="sets-editor">
            <div class="set-list">
              <div v-for="(set, sIdx) in exercise.setDetails" :key="sIdx" class="set-row">
                <span class="set-label">#{{ sIdx + 1 }}</span>
                <label class="set-field">
                  <span>{{ t('common.reps') }}</span>
                  <input type="number" min="1" max="50" :value="set.reps || 10" @input="updateSet(index, sIdx, 'reps', $event.target.value)" />
                </label>
                <label class="set-field">
                  <span>kg</span>
                  <input type="number" min="0" max="999" step="0.5" :value="set.weight || 0" @input="updateSet(index, sIdx, 'weight', $event.target.value)" />
                </label>
                <button class="remove-set" :title="t('builder.removeSet')" @click="removeSet(index, sIdx)">×</button>
              </div>
            </div>
            
            
          </div>
          <div class="row-actions">
            <button class="remove-btn" :title="t('builder.removeExercise')" @click="removeExercise(index)">×</button>
          </div>
        </div>
        <p v-if="!isSignedIn" class="auth-hint">{{ t('builder.authGate') }}</p>
        <p v-if="errorMsg" class="error-hint">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- Loading State außerhalb nicht nötig, da innerhalb der exercises-section bereits Skeleton/Loading angezeigt wird -->

    <!-- App Navigation unten -->
    <BottomNav />

    <!-- Upgrade Modal -->
    <UpgradeModal 
      v-model:show="showUpgradeModal"
      :limit-type="upgradeLimitType"
      @close="showUpgradeModal = false"
      @continue-free="showUpgradeModal = false"
      @upgraded="handleUpgradeSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { saveWorkoutOffline } from '@/utils/offlineStorage'
import { useI18n } from 'vue-i18n'
import { useAuth, useUser, useClerk } from '@clerk/vue'
import { getAuthToken } from '@/utils/authToken'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { getWorkoutOffline, getAllExercisesOffline } from '@/utils/offlineStorage'
import StepIndicator from './StepIndicator.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'
import UpgradeModal from '@/components/UpgradeModal.vue'
import { useToastStore } from '@/stores/toastStore'
import { logger } from '@/utils/logger'
import { prefillExercises, matchExerciseByIdOrName } from '@/utils/workoutHelpers'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

// Props
const props = defineProps({
  initialType: {
    type: String,
    default: 'push'
  }
})

// Emits
const emit = defineEmits(['workout-created'])

// Composables
const { isSignedIn, isLoaded } = useUser()
const loadingUser = ref(true)
watch(isLoaded, (val) => { loadingUser.value = !val }, { immediate: true })
const auth = useAuth()
const clerk = useClerk()
const router = useRouter()
const route = useRoute()
const store = useUserStore()
const subscriptionStore = useSubscriptionStore()
const toast = useToastStore()
const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()
// Hilfsfunktionen für Muskelgruppe und Equipment (nutzen default-exercises.json)
const { getAllTranslations } = useExerciseTranslation()
function getTranslatedMuscleGroup(muscleGroup) {
  if (!muscleGroup) return ''
  const all = getAllTranslations()
  const found = all.find(e => e.muscleGroup === muscleGroup || e.muscleGroup_en === muscleGroup)
  const lang = locale.value.startsWith('de') ? 'de' : 'en'
  if (lang === 'de') return found ? found.muscleGroup : muscleGroup
  return found ? found.muscleGroup_en : muscleGroup
}
function getTranslatedEquipment(equipment) {
  if (!equipment) return ''
  const all = getAllTranslations()
  const found = all.find(e => e.equipment === equipment || e.equipment_en === equipment)
  const lang = locale.value.startsWith('de') ? 'de' : 'en'
  if (lang === 'de') return found ? found.equipment : equipment
  return found ? found.equipment_en : equipment
}

// Subscription state
const showUpgradeModal = ref(false)
const upgradeLimitType = ref('')

// State
const allowedTypes = ["push","pull","legs"]
const initialFromRoute = (() => {
  const rq = (route.query.type || '').toString().toLowerCase()
  return allowedTypes.includes(rq) ? rq : props.initialType
})()
const selectedType = ref(initialFromRoute)
const exercises = ref([])
const selectedExercises = ref([])
const loading = ref(false)
const creating = ref(false)
const errorMsg = ref('')
const search = ref('')
const draggingIndex = ref(null)
const planRef = ref(null)

// Draft-Storage-Key dynamisch nach userId
import { useUserStore } from '@/stores/userStore'
const userStore = useUserStore()
function getDraftStorageKey() {
  const userId = userStore?.user?.id || userStore?.user?._id || 'guest'
  return `workout_builder_draft_${userId}`
}

// Draft aus SessionStorage laden (userId-spezifisch)
async function loadDraft() {
  console.log('💡 loadDraft called')
  const DRAFT_STORAGE_KEY = getDraftStorageKey()
  // 1. Versuche aus IndexedDB (offline, userId-spezifisch)
  try {
    const draft = await getWorkoutOffline(DRAFT_STORAGE_KEY)
    if (draft && draft.exercises && draft.type) {
      console.log('📦 [DEBUG] Draft geladen (IndexedDB):', JSON.stringify(draft, null, 2))
      selectedType.value = draft.type
      await loadExercises()
      const merged = draft.exercises.map(draftEx => {
        let dbEx = exercises.value.find(e => e._id === draftEx._id)
        if (!dbEx) {
          dbEx = exercises.value.find(e => (e.name || '').toLowerCase() === (draftEx.name || '').toLowerCase())
        }
        if (dbEx) {
          return {
            ...dbEx,
            setDetails: Array.isArray(draftEx.setDetails) ? draftEx.setDetails.map(s => ({ reps: s.reps, weight: s.weight })) : [],
            note: draftEx.note || ''
          }
        } else {
          return {
            ...draftEx,
            setDetails: Array.isArray(draftEx.setDetails) ? draftEx.setDetails.map(s => ({ reps: s.reps, weight: s.weight })) : [],
            note: draftEx.note || ''
          }
        }
      })
      selectedExercises.value = merged
      logger.debug('✅ WorkoutBuilder - Draft aus IndexedDB wiederhergestellt (mit DB-Merge):', merged.length, 'Übungen')
      return true
    }
  } catch (e) {
    logger.warn('⚠️ WorkoutBuilder - Fehler beim Laden des Drafts aus IndexedDB:', e)
  }
  // 2. Fallback: SessionStorage (userId-spezifisch)
  try {
    const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (draft) {
      const parsed = JSON.parse(draft)
      console.log('📦 [DEBUG] Draft geladen (sessionStorage):', JSON.stringify(parsed, null, 2))
      if (parsed.selectedType && parsed.selectedExercises) {
        selectedType.value = parsed.selectedType
        selectedExercises.value = parsed.selectedExercises
        logger.debug('✅ WorkoutBuilder - Draft aus sessionStorage wiederhergestellt:', parsed.selectedExercises.length, 'Übungen')
        return true
      }
    }
  } catch (e) {
    logger.warn('⚠️ WorkoutBuilder - Fehler beim Laden des Drafts aus sessionStorage:', e)
  }
  return false
}

// Draft in SessionStorage speichern (userId-spezifisch)
async function saveDraft() {
  console.log('💡 saveDraft called')
  const DRAFT_STORAGE_KEY = getDraftStorageKey()
  try {
    if (selectedExercises.value.length > 0) {
      const exercisesForDraft = selectedExercises.value.map(ex => ({
        ...ex,
        setDetails: Array.isArray(ex.setDetails)
          ? ex.setDetails.map(s => ({ reps: s.reps, weight: s.weight }))
          : [],
        note: ex.note || ''
      }))
      const draft = {
        _id: DRAFT_STORAGE_KEY,
        type: selectedType.value,
        exercises: exercisesForDraft,
        isDraft: true,
        updatedAt: Date.now(),
      }
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedType: selectedType.value, selectedExercises: exercisesForDraft, timestamp: Date.now() }))
      await saveWorkoutOffline(draft)
      logger.debug('💾 WorkoutBuilder - Draft gespeichert (sessionStorage & IndexedDB):', exercisesForDraft.length, 'Übungen')
      console.log('💾 [DEBUG] Draft gespeichert:', JSON.stringify(draft, null, 2))
    }
  } catch (e) {
    logger.warn('⚠️ WorkoutBuilder - Fehler beim Speichern des Drafts:', e)
  }
}

// Draft löschen (nach erfolgreichem Erstellen, userId-spezifisch)
function clearDraft() {
  const DRAFT_STORAGE_KEY = getDraftStorageKey()
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    logger.debug('🗑️ WorkoutBuilder - Draft gelöscht')
    console.log('🗑️ [DEBUG] Draft cleared from sessionStorage')
  } catch (e) {
    logger.warn('⚠️ WorkoutBuilder - Fehler beim Löschen des Drafts:', e)
  }
}

// Synchronous snapshot for unload - sessionStorage as a fast fallback (userId-spezifisch)
function handleBeforeUnload(e) {
  const DRAFT_STORAGE_KEY = getDraftStorageKey()
  try {
    if (selectedExercises.value && selectedExercises.value.length > 0) {
      const exercisesForDraft = selectedExercises.value.map(ex => ({
        ...ex,
        setDetails: Array.isArray(ex.setDetails)
          ? ex.setDetails.map(s => ({ reps: s.reps, weight: s.weight }))
          : [],
        note: ex.note || ''
      }))
      const snapshot = { selectedType: selectedType.value, selectedExercises: exercisesForDraft, timestamp: Date.now() }
      try { sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot)) } catch {}
      console.log('🚪 [DEBUG] beforeunload snapshot saved to sessionStorage:', snapshot)
    }
  } catch (err) {
    console.warn('⚠️ WorkoutBuilder - beforeunload snapshot failed:', err)
  }
}
const didPlanScroll = ref(false)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isMobile = computed(() => viewportWidth.value <= 480)
const showMobilePicker = ref(false)
const showTypePicker = ref(false)
const showBelief = ref(true)
const beliefText = ref('')

// Quick Boost Modal: pro Tag nur einmal anzeigen
const BELIEF_KEY = 'wb_belief_last_shown'
function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

onMounted(async () => {
  console.log('🏁 WorkoutBuilder mounted')
  // Load subscription status
  subscriptionStore.checkSubscription()

  // 1. Draft laden (hat Priorität!)
  const hasDraft = await loadDraft()
  if (hasDraft) {
    toast.show(t('builder.draftRestored') || 'Workout-Entwurf wiederhergestellt', {
      type: 'info',
      duration: 3000
    })
  } else {
    // 2. Prefill aus Repeat oder AI-Suggestion, falls KEIN Draft vorhanden
    await prefillFromRepeatIfAny()
    if (selectedExercises.value.length === 0) {
      await prefillFromAISuggestion()
    }
  }

  // Resize-Handler
  const onResize = () => { viewportWidth.value = window.innerWidth }
  window.addEventListener('resize', onResize)
  resizeHandler.value = onResize
  // beforeunload snapshot to ensure at least sessionStorage has the latest plan
  window.addEventListener('beforeunload', handleBeforeUnload)

  // Init Affirmation
  const beliefsDe = [
    'Jede Wiederholung bringt dich deinem Ziel näher.',
    'Konstanz schlägt Intensität – heute zählt’s.',
    'Kleiner Schritt, große Wirkung: jetzt starten.',
    'Du bist stärker als deine Ausreden.',
    'Fortschritt, nicht Perfektion.'
  ]
  const beliefsEn = [
    'Each rep gets you closer to your goal.',
    'Consistency beats intensity — today counts.',
    'Small step, big impact: start now.',
    'You’re stronger than your excuses.',
    'Progress, not perfection.'
  ]
  const beliefs = String(locale.value).startsWith('de') ? beliefsDe : beliefsEn
  beliefText.value = beliefs[Math.floor(Math.random() * beliefs.length)]

  // Sichtbarkeit anhand LocalStorage steuern (nur einmal täglich)
  try {
    const last = localStorage.getItem(BELIEF_KEY)
    showBelief.value = last !== todayKey()
  } catch {
    showBelief.value = true
  }
})
onUnmounted(() => {
  if (resizeHandler.value) window.removeEventListener('resize', resizeHandler.value)
  try { window.removeEventListener('beforeunload', handleBeforeUnload) } catch {}
})

const resizeHandler = ref(null)

function scrollToPlan() {
  const el = planRef.value || document.getElementById('workout-plan')
  if (!el) return
  const headerOffset = 72
  let attempts = 0
  const maxAttempts = 6
  const doScroll = () => {
    attempts += 1
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
    setTimeout(() => {
      try {
        const rect = el.getBoundingClientRect()
        const top = rect.top + window.pageYOffset - headerOffset
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      } catch {}
    }, 60)
    setTimeout(() => {
      const rectNow = el.getBoundingClientRect()
      const threshold = headerOffset + 8
      const good = rectNow.top >= 0 && rectNow.top <= threshold
      if (!good && attempts < maxAttempts) requestAnimationFrame(doScroll)
    }, 120)
  }
  requestAnimationFrame(doScroll)
}

// Prefill aus AI-Suggestion
async function prefillFromAISuggestion() {
  logger.debug('🔍 WorkoutBuilder - prefillFromAISuggestion aufgerufen')
  logger.debug('🔍 route.state:', route.state)
  logger.debug('🔍 route.state?.workout:', route.state?.workout)
  
  // Versuche zuerst route.state, dann localStorage
  let aiWorkout = route.state?.workout
  
  if (!aiWorkout) {
    logger.debug('⚠️ WorkoutBuilder - Kein Workout in route.state, versuche localStorage...')
    try {
      const stored = localStorage.getItem('ai_workout_to_builder')
      if (stored) {
        aiWorkout = JSON.parse(stored)
        logger.debug('✅ WorkoutBuilder - AI Workout aus localStorage geladen')
        logger.debug('📦 WorkoutBuilder - Workout hat', aiWorkout.exercises?.length, 'Übungen')
        localStorage.removeItem('ai_workout_to_builder') // Nach dem Laden löschen
      } else {
        logger.debug('⚠️ WorkoutBuilder - localStorage ist leer')
      }
    } catch (e) {
      logger.warn('⚠️ WorkoutBuilder - localStorage Parse Error:', e.message)
    }
  }
  
  if (!aiWorkout) {
    logger.debug('❌ WorkoutBuilder - Keine AI-Suggestion in route.state oder localStorage')
    return
  }
  
  logger.debug('🤖 WorkoutBuilder - Lade AI-Suggestion:', aiWorkout)
  
  try {
    // Typ setzen
    const t = (aiWorkout.type || aiWorkout.focus || 'push').toLowerCase()
    logger.debug('🔍 WorkoutBuilder - Workout-Typ:', t)
    
    if (['push','pull','legs','fullbody'].includes(t)) {
      selectedType.value = t
      logger.debug('✅ WorkoutBuilder - Typ gesetzt auf:', selectedType.value)
    }
    
    // Verbinde AI-Übungen mit Datenbank-Übungen
    const aiExercises = Array.isArray(aiWorkout.exercises) ? aiWorkout.exercises : []
    logger.debug('� WorkoutBuilder - AI-Übungen erhalten:', aiExercises.length)
    logger.debug('🔍 WorkoutBuilder - AI-Übungen Details:', aiExercises.map(ex => ({ 
      name: ex.name, 
      _id: ex._id, 
      sets: ex.sets, 
      reps: ex.reps 
    })))
    
    // Strategie 1: Nutze _id vom Backend (am zuverlässigsten)
    const ordered = []
    const idsToUse = []
    
    for (const aiEx of aiExercises) {
      logger.debug('🔍 WorkoutBuilder - Verarbeite AI-Übung:', aiEx.name, 'ID:', aiEx._id)
      // Wenn AI _id enthält, nutze diese direkt
      if (aiEx._id) {
        logger.debug('✅ WorkoutBuilder - Nutze _id vom Backend:', aiEx._id)
        idsToUse.push(aiEx._id)
      }
    }
    logger.debug('🔄 WorkoutBuilder - Lade Übungen für Typ:', selectedType.value)
    await loadExercises()
    logger.debug('✅ WorkoutBuilder - Datenbank-Übungen geladen:', exercises.value.length)
    logger.debug('✅ WorkoutBuilder - Gefilterte Kategorien:', exercises.value.map(ex => ({ name: ex.name, _id: ex._id, category: ex.category })))

    // Matched Übungen nach _id oder Name, Fallback: AI-Objekt als Platzhalter
    for (const aiEx of aiExercises) {
      logger.debug('🔍 WorkoutBuilder - Suche nach AI-Übung:', aiEx.name, 'ID:', aiEx._id)
      let match = null
      // Versuch 1: Direkt nach _id suchen
      if (aiEx._id) {
        match = exercises.value.find(ex => ex._id === aiEx._id)
        if (match) {
          logger.debug('✅ WorkoutBuilder - Gefunden via _id:', match.name)
        }
      }
      // Versuch 2: Nach Namen suchen (Fallback)
      if (!match) {
        match = exercises.value.find(ex => {
          const dbName = (ex.name || '').toLowerCase().trim()
          const aiName = (aiEx.name || '').toLowerCase().trim()
          const match = dbName === aiName
          if (match) logger.debug('✅ WorkoutBuilder - Gefunden via Name-Match:', dbName, '===', aiName)
          return match
        })
      }
      // Fallback: Wenn kein Match, nutze AI-Objekt als Platzhalter
      if (match && !ordered.some(x => x._id === match._id)) {
        const enriched = {
          ...match,
          suggestedSets: aiEx.sets || 3,
          suggestedReps: aiEx.reps || 10,
          suggestedWeight: aiEx.weight || 0
        }
        ordered.push(enriched)
        logger.debug('✅ WorkoutBuilder - AI-Übung in Plan aufgenommen:', aiEx.name, '→', match.name)
      } else if (!match) {
        // Fallback: AI-Objekt als Platzhalter
        const fallback = {
          ...aiEx,
          _id: aiEx._id || `ai_${aiEx.name?.replace(/\s+/g, '_') || Math.random().toString(36).slice(2)}`,
          name: aiEx.name || 'Unbenannte Übung',
          category: selectedType.value,
          muscleGroup: aiEx.muscleGroup || '',
          equipment: aiEx.equipment || '',
          suggestedSets: aiEx.sets || 3,
          suggestedReps: aiEx.reps || 10,
          suggestedWeight: aiEx.weight || 0
        }
        ordered.push(fallback)
        logger.warn('⚠️ WorkoutBuilder - AI-Übung nicht in DB gefunden, als Platzhalter übernommen:', aiEx.name)
      } else {
        logger.debug('ℹ️ WorkoutBuilder - AI-Übung bereits im Plan:', aiEx.name)
      }
    }
  selectedExercises.value = [...ordered]
    logger.debug('✅ WorkoutBuilder - AI-Suggestion vollständig geladen')
    logger.debug('📊 WorkoutBuilder - selectedExercises:', selectedExercises.value.length, 'Übungen')
    logger.debug('📊 WorkoutBuilder - selectedExercises Details:', selectedExercises.value.map(ex => ({ 
      name: ex.name, 
      _id: ex._id, 
      category: ex.category 
    })))
    
    await nextTick()
    if (!didPlanScroll.value && selectedExercises.value.length > 0) {
      scrollToPlan()
      didPlanScroll.value = true
    }
  } catch (e) {
    logger.error('❌ WorkoutBuilder - AI-Prefill fehlgeschlagen:', e)
  }
}

// Prefill aus "repeat"-Query: Vorheriges Workout laden und Übungen vorwählen
async function prefillFromRepeatIfAny() {
  const repeatId = (route.query.repeat || '').toString()
  if (!repeatId) return
  
  try {
    // Workout aus Store oder API holen
    let base = store.workouts.find(w => w._id === repeatId) || null
    if (!base) {
      const token = await getAuthToken({ clerk, auth }).catch(() => null)
      base = await getWorkoutOffline(repeatId)
    }
    if (!base) return

    // Typ übernehmen (sofern erlaubt) und Übungen laden
    const t = (base.type || '').toLowerCase()
    if (['push','pull','legs'].includes(t)) {
      selectedType.value = t
    }
    await loadExercises()

    // Übernehme die Übungen exakt wie im Original-Workout
    const baseExercises = Array.isArray(base.exercises) ? base.exercises : []
    // Prüfe, ob alle Übungen noch in der DB existieren (optional)
    // Wenn nicht, kann ein Fallback erfolgen, aber Standard: Übernehme alle Felder wie gespeichert
    selectedExercises.value = baseExercises.map(ex => ({ ...ex }))
    logger.debug('✅ WorkoutBuilder - Repeat Workout geladen (exakt übernommen):', baseExercises.length, 'Übungen')
    
    await nextTick()
    if (!didPlanScroll.value && selectedExercises.value.length > 4) {
      scrollToPlan()
      didPlanScroll.value = true
    }
  } catch (e) {
    logger.warn('⚠️ Prefill (repeat) fehlgeschlagen:', e)
  }
}



// Auto-save auch bei Typ-Änderung
watch(selectedType, () => {
  saveDraft()
})

// Workout Types
const workoutTypes = [
  { value: 'push', label: 'Push Day' },
  { value: 'pull', label: 'Pull Day' },
  { value: 'legs', label: 'Leg Day' }
]

// Fallback-Übungen für jeden Typ (gleiche Struktur wie Backend)
const fallbackExercises = {
  push: [
    { _id: '1', name: 'Bankdrücken', muscleGroup: 'Brust', equipment: 'Langhantel', recommendedReps: 8 },
    { _id: '2', name: 'Schulterdrücken', muscleGroup: 'Schultern', equipment: 'Kurzhanteln', recommendedReps: 10 },
    { _id: '3', name: 'Dips', muscleGroup: 'Trizeps', equipment: 'Körpergewicht', recommendedReps: 12 },
    { _id: '4', name: 'Seitheben', muscleGroup: 'Schultern', equipment: 'Kurzhanteln', recommendedReps: 12 },
    { _id: '5', name: 'Trizeps Drücken', muscleGroup: 'Trizeps', equipment: 'Kabelzug', recommendedReps: 10 }
  ],
  pull: [
    { _id: '6', name: 'Klimmzüge', muscleGroup: 'Rücken', equipment: 'Körpergewicht', recommendedReps: 8 },
    { _id: '7', name: 'Rudern', muscleGroup: 'Rücken', equipment: 'Kabelzug', recommendedReps: 10 },
    { _id: '8', name: 'Bizeps Curls', muscleGroup: 'Bizeps', equipment: 'Kurzhanteln', recommendedReps: 12 },
    { _id: '9', name: 'Latzug', muscleGroup: 'Rücken', equipment: 'Kabelzug', recommendedReps: 10 },
    { _id: '10', name: 'Hammer Curls', muscleGroup: 'Bizeps', equipment: 'Kurzhanteln', recommendedReps: 12 }
  ],
  legs: [
    { _id: '11', name: 'Kniebeugen', muscleGroup: 'Quadrizeps', equipment: 'Langhantel', recommendedReps: 10 },
    { _id: '12', name: 'Kreuzheben', muscleGroup: 'Hamstrings', equipment: 'Langhantel', recommendedReps: 8 },
    { _id: '13', name: 'Beinpresse', muscleGroup: 'Quadrizeps', equipment: 'Maschine', recommendedReps: 12 },
    { _id: '14', name: 'Wadenheben', muscleGroup: 'Waden', equipment: 'Maschine', recommendedReps: 15 },
    { _id: '15', name: 'Ausfallschritte', muscleGroup: 'Gesäß', equipment: 'Körpergewicht', recommendedReps: 10 }
  ]
}

// Computed
const currentTypeLabel = computed(() => {
  const type = workoutTypes.find(t => t.value === selectedType.value)
  return type ? type.label : ''
})
const activeStep = computed(() => {
  if (!isSignedIn.value) return 1
  if (selectedExercises.value.length === 0) return loading.value ? 2 : 2
  return 3
})
const filteredExercises = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return exercises.value
  return exercises.value.filter(e =>
    e.name?.toLowerCase().includes(term) ||
    e.muscleGroup?.toLowerCase().includes(term) ||
    e.equipment?.toLowerCase().includes(term)
  )
})

// Methods
function onTypeChange() {
  // Re-use bestehende Logik
  selectWorkoutType(selectedType.value)
  saveDraft()
}
async function selectWorkoutType(type) {
  selectedType.value = type
  selectedExercises.value = [] // Reset selection
  if (isSignedIn.value) {
    await loadExercises()
  }
}

async function loadExercises() {
  // Verhindere parallele Aufrufe (Guard gegen Endlosschleife)
  if (loading.value) {
    logger.debug('⏭️ WorkoutBuilder - Überspringe loadExercises (bereits am Laden)')
    return
  }
  
  loading.value = true
  logger.debug('🔄 WorkoutBuilder - Lade Übungen für Typ:', selectedType.value)
  
  if (!isSignedIn.value) {
    logger.warn('⚠️ WorkoutBuilder - Nicht angemeldet, lade keine Übungen')
    exercises.value = []
    loading.value = false
    return
  }
  
  try {
    // Nutze die exercises.js API mit eingebautem Offline-Fallback
    logger.debug('🔄 WorkoutBuilder - Lade Übungen via API (mit Offline-Support)...')
    
    // Mappe interne Typen zu Backend-Kategorien
    const categoryMap = {
      'push': 'Push',
      'pull': 'Pull', 
      'legs': 'Legs'
    }
    
    const targetCategory = categoryMap[selectedType.value]
    logger.debug('🎯 WorkoutBuilder - Filtere für Kategorie:', targetCategory)
    
    // Nutze getAllExercisesOffline mit category filter (rein offline)
    const allExercises = await getAllExercisesOffline({ category: targetCategory })
    
    logger.debug('✅ WorkoutBuilder - Übungen erfolgreich geladen:', allExercises.length)
    
    exercises.value = allExercises
    logger.debug('📊 WorkoutBuilder - exercises.value jetzt:', exercises.value.length, 'Items')
    if (exercises.value.length > 0) {
      logger.debug('📊 WorkoutBuilder - Erste 5 Übungen:', exercises.value.slice(0, 5).map(e => e.name))
    }
    
  } catch (error) {
    logger.error('❌ WorkoutBuilder - API-Fehler Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    })
    
    // Fallback zu lokalen Übungen
    exercises.value = fallbackExercises[selectedType.value] || []
    logger.debug('⚠️ WorkoutBuilder - Verwende Fallback-Übungen:', exercises.value.length, 'für Typ:', selectedType.value)
    logger.debug('⚠️ WorkoutBuilder - Verwende Fallback-Übungen:', exercises.value.length)
  } finally {
    loading.value = false
  }
}

function toggleExercise(exercise) {
  const index = selectedExercises.value.findIndex(e => e._id === exercise._id)
  
  if (index > -1) {
    selectedExercises.value.splice(index, 1)
    console.log('➖ [DEBUG] toggleExercise - removed:', exercise._id, exercise.name)
  } else {
    // Check exercise limit for free users
    if (!subscriptionStore.canAddExercise(selectedExercises.value.length)) {
      upgradeLimitType.value = 'exercises'
      showUpgradeModal.value = true
      return
    }
    
    selectedExercises.value.push({
      ...exercise
    })
    console.log('➕ [DEBUG] toggleExercise - added:', exercise._id, exercise.name)
  }
  saveDraft()
}

function isSelected(exercise) {
  return selectedExercises.value.some(e => e._id === exercise._id)
}

function removeExercise(index) {
  selectedExercises.value.splice(index, 1)
}

function onDragStart(index) {
  draggingIndex.value = index
}

function onDragOver(_index) {
  // Optional: visuelle Platzhalter könnten hier gesetzt werden
}

function onDrop(index) {
  const from = draggingIndex.value
  const to = index
  if (from === null || to === null || from === to) return
  const list = selectedExercises.value
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  draggingIndex.value = null
}

async function createWorkout() {
  try {
    errorMsg.value = ''
    
    // User MUSS eingeloggt sein (online oder offline mit cached Session)
    if (!isSignedIn.value) {
      logger.warn('⛔️ Nicht angemeldet – Erstellen abgebrochen')
      errorMsg.value = t('builder.signInFirst')
      return
    }
    
    // Check workout limit for free users
    if (!subscriptionStore.canCreateWorkout) {
      upgradeLimitType.value = 'workouts'
      showUpgradeModal.value = true
      return
    }
    
    creating.value = true
    const workoutData = {
      name: `${currentTypeLabel.value} - ${new Date().toLocaleDateString(String(locale.value).startsWith('de') ? 'de-DE' : 'en-US')}`,
      type: selectedType.value,
      exercises: selectedExercises.value.map(ex => ({
        name: ex.name,
        sets: Array.isArray(ex.setDetails) ? ex.setDetails.length : (ex.sets || 3),
        reps: Array.isArray(ex.setDetails) && ex.setDetails[0] ? Number(ex.setDetails[0].reps) || 10 : (ex.reps || 10),
        weight: Array.isArray(ex.setDetails) && ex.setDetails[0] ? Number(ex.setDetails[0].weight) || 0 : (ex.weight || 0),
        category: ex.category,
        note: typeof ex.note === 'string' ? ex.note : '',
        setDetails: Array.isArray(ex.setDetails) ? ex.setDetails.map(s => ({
          reps: Number(s.reps) || 10,
          weight: Number(s.weight) || 0
        })) : []
      })),
      date: new Date().toISOString(),
      completed: false
    }

    // Token holen (auch offline möglich aus Clerk Session Cache)
  // Debug: Show final payload that will be sent / saved
  try { console.log('📤 [DEBUG] createWorkout - payload:', JSON.stringify(workoutData, null, 2)) } catch (e) { console.log('📤 [DEBUG] createWorkout - payload (stringify failed)') }
    let token = null
    try {
      token = await getAuthToken({ clerk, auth }).catch(() => null)
      
      if (!token) {
        // Zweiter Versuch ohne Cache (mit Timeout)
        await new Promise(resolve => setTimeout(resolve, 300))
        token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
      }
      
      if (!token) {
        // Kein Token verfügbar (offline, Session expired, oder Clerk noch nicht ready)
        logger.warn('⚠️ WorkoutBuilder - Kein Token verfügbar, Workout wird offline gespeichert')
      } else {
        logger.debug('✅ WorkoutBuilder - Token erfolgreich abgerufen')
      }
    } catch (tokenError) {
      logger.warn('⚠️ WorkoutBuilder - Token-Abruf fehlgeschlagen:', tokenError.message)
      token = null
    }
    
    // Workout über Store erstellen (inkl. Offline-Handling)
  const created = await store.createWorkout(workoutData, token)

    // Kein Workout-Cover-Upload im Erstell-Flow

    // Event für Parent-Komponente
    emit('workout-created', created)

    // Track workout creation for subscription usage
    subscriptionStore.trackWorkoutCreated()

    // Draft löschen nach erfolgreichem Erstellen
    clearDraft()

    // Navigiere zur Detailseite (Draft-IDs werden unterstützt)
  const newId = created?._id || null
    if (newId) {
      await router.push({ 
        name: 'workout-detail', 
        params: { id: newId },
        query: { created: '1', focus: 'exercises', ...(created?.isDraft ? { draft: '1' } : {}) }
      })
    } else {
      // Fallback: zurück zum Dashboard
      await router.push('/dashboard')
    }
    
    logger.debug('✅ Workout erfolgreich erstellt:', newId || workoutData)
  } catch (error) {
    logger.error('❌ Fehler beim Erstellen des Workouts:', error)
    if (error?.code === 'AUTH_REQUIRED' || error?.code === 'UNAUTHORIZED') {
      errorMsg.value = t('builder.signInFirst')
    } else if (error?.response?.status === 401 || error?.response?.status === 403) {
      errorMsg.value = t('builder.signInFirst')
    } else {
      errorMsg.value = t('builder.createFailed')
    }
  } finally {
    creating.value = false
  }
}

function removeSet(exIdx, setIdx) {
  const ex = selectedExercises.value[exIdx]
  if (!ex?.setDetails) return
  ex.setDetails.splice(setIdx, 1)
  console.log('🗑️ [DEBUG] removeSet - exIdx:', exIdx, 'setIdx:', setIdx, 'remainingSets:', ex.setDetails.length)
  saveDraft()
}

function updateSet(exIdx, setIdx, field, val) {
  const ex = selectedExercises.value[exIdx]
  if (!ex?.setDetails?.[setIdx]) return
  const num = Number(val)
  if (field === 'reps') ex.setDetails[setIdx].reps = isFinite(num) ? num : ex.setDetails[setIdx].reps
  if (field === 'weight') ex.setDetails[setIdx].weight = isFinite(num) ? num : ex.setDetails[setIdx].weight
  console.log('✏️ [DEBUG] updateSet - exIdx:', exIdx, 'setIdx:', setIdx, 'field:', field, 'value:', val, 'currentSet:', ex.setDetails[setIdx])
  saveDraft()
}

// Preset-Reps entfernt

// Watchers
// Reagiere auf Typ aus der Route (?type=push|pull|legs)
watch(() => route.query.type, (t) => {
  const val = String(t || '').toLowerCase()
  if (["push","pull","legs"].includes(val)) {
    selectWorkoutType(val)
  }
}, { immediate: true })

watch(() => props.initialType, (newType) => {
  // Überschreibe nicht, wenn Route bereits explizit vorgibt
  if (!route.query.type) selectWorkoutType(newType)
}, { immediate: true })

// Lade Übungen automatisch, sobald der User angemeldet ist
watch(isSignedIn, async (signedIn, oldSignedIn) => {
  // Nur laden wenn sich der Status ÄNDERT (nicht bei initialem Mount)
  if (signedIn && signedIn !== oldSignedIn) {
    await loadExercises()
  } else if (!signedIn) {
    exercises.value = []
  }
})

// Login-Redirect wird zentral über AuthLayout/Welcome gehandhabt

function goDashboard() {
  router.push({ name: 'dashboard' })
}

function continuePlan() {
  showBelief.value = false
  // Heutiges Datum als "gesehen" speichern
  try { localStorage.setItem(BELIEF_KEY, todayKey()) } catch {}
}

// Handle successful upgrade
function handleUpgradeSuccess() {
  // Refresh subscription status
  subscriptionStore.checkSubscription()
  showUpgradeModal.value = false
  toast.success(t('upgrade.upgradeSuccess'))
}

function pickType(val) {
  if (!val || val === selectedType.value) {
    showTypePicker.value = false
    return
  }
  selectedType.value = val
  onTypeChange()
  showTypePicker.value = false
}

// Token-Helfer wird zentral aus '@/utils/authToken' importiert

// Bildlogik für Übungs-Thumbs
function categoryToImage(category) {
  const map = {
    push: '/exercises/push.svg',
    pull: '/exercises/pull.svg',
    legs: '/exercises/legs.svg'
  }
  const key = String(category || '').toLowerCase()
  return map[key] || '/exercises/camera.svg'
}

function getExerciseImage(ex) {
  if (ex?.thumbnailUrl) return ex.thumbnailUrl
  if (ex?.imageUrl) return ex.imageUrl
  if (ex?.mediaUrl) return ex.mediaUrl
  // Fallback: Kamera-Placeholder, nicht mehr Kategorie
  return '/exercises/camera.svg'
}

function onImgError(evt, ex) {
  const img = evt?.target
  if (!img) return
  
  // Verhindere Endlosschleife: Wenn src schon camera.svg ist oder data-fallback gesetzt, nicht nochmal setzen
  if (img.src.includes('camera.svg') || img.dataset.fallback === 'true') {
    img.onerror = null
    return
  }
  
  // Markiere als Fallback und setze camera.svg
  img.dataset.fallback = 'true'
  img.onerror = null
  img.src = '/exercises/camera.svg'
  
  logger.debug('🖼️ WorkoutBuilder - Fallback zu camera.svg für:', ex?.name || 'unbekannt')
}

// (Cover-Image Hilfsfunktionen entfernt)
</script>

<style scoped>
.workout-builder { padding: 20px; padding-bottom: 80px; color: var(--fg); background: var(--bg); }

.builder-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0 16px 0;
  background: var(--bg); /* Hintergrund, damit sticky über Content liegt */
}

.back-top-btn { padding: 8px 12px; border-radius: 10px; border: 2px solid var(--accent-color); background: transparent; color: var(--fg); cursor: pointer; }
.back-top-btn:hover { background: var(--accent-soft); }

.type-select {
  display: grid;
  grid-template-columns: 60px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.type-label { color: var(--muted); font-size: 0.9rem; }

.type-dropdown { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }

/* Typ-List im Mobile-Sheet */
.type-list { display: grid; gap: 8px; }
.type-item { width: 100%; text-align: left; padding: 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); cursor: pointer; }
.type-item[aria-pressed="true"] { border-color: var(--accent-color); background: var(--accent-soft); }

.exercises-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.search-row { margin: 8px 0 16px; }
.search-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }

.exercise-item { padding: 16px; background: var(--card-bg); border-radius: 12px; border: 2px solid transparent; cursor: pointer; transition: all 0.2s ease; }
.exercise-item.sk { height: 84px; background: var(--surface); border: 1px solid var(--card-border); }

.exercise-item:hover { border-color: var(--card-border); }

.exercise-item.selected { border-color: var(--accent-color); background: var(--accent-soft); }

.exercise-item h4 {
  margin: 0 0 8px 0;
  font-size: 1rem;
}

.exercise-item p { margin: 4px 0; color: var(--muted); font-size: 0.85rem; }

/* Thumbnail-Layout */
.ex-row { display: flex; align-items: center; gap: 12px; }
.thumb {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  object-fit: contain;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  padding: 6px;
}
.meta { display: flex; flex-direction: column; min-width: 0; }
.title { margin: 0; font-size: 1rem; line-height: 1.2; }
.sub { color: var(--muted); font-size: 0.85rem; margin: 2px 0 0; }
.sub.small { font-size: 0.78rem; }

.selected-exercises { background: var(--card-bg); border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid var(--card-border); }

.selected-exercise {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--card-border);
}

.selected-exercise:last-child {
  border-bottom: none;
}

.row-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.drag-handle { background: transparent; border: none; color: var(--muted); cursor: grab; font-size: 18px; }
.drag-handle:active { cursor: grabbing; }
.ex-name { color: var(--fg); }
.reorder-hint { color: var(--muted); margin: 0 0 8px 0; font-size: 0.9rem; }

/* Selected list row with thumbnail */
.sel-row { display: flex; align-items: center; gap: 12px; }
.thumb.small { width: 40px; height: 40px; flex: 0 0 40px; padding: 4px; }

/* Mobile: Thumbnail rechts und größer */
@media (max-width: 480px) {
  .ex-row { flex-direction: row-reverse; justify-content: space-between; }
  .sel-row { flex-direction: row-reverse; justify-content: space-between; }
  .ex-row .thumb { width: 80px; height: 80px; flex-basis: 80px; padding: 6px; }
  .sel-row .thumb { width: 64px; height: 64px; flex-basis: 64px; padding: 6px; }
  .meta { flex: 1 1 auto; }
}

/* (Cover Foto UI entfernt) */

/* Sets-Editor */
.sets-editor { grid-column: 2 / span 1; margin-top: 8px; }
/* (Sets-Actions unten entfernt) */
.chip { padding: 6px 10px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font-weight: 600; cursor: pointer; }
.chip:disabled { opacity: 0.6; cursor: not-allowed; }
.set-list { display: grid; gap: 6px; }
.set-row { display: grid; grid-template-columns: 36px 1fr 1fr 28px; gap: 8px; align-items: center; }
.set-label { color: var(--muted); font-size: 0.85rem; text-align: center; }
.set-field { display: flex; align-items: center; gap: 6px; }
.set-field span { color: var(--muted); font-size: 0.85rem; }
.set-field input { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.remove-set { background: transparent; border: none; color: var(--danger-color); font-size: 18px; cursor: pointer; }
/* (Preset-Reihe entfernt) */

.remove-btn { background: var(--danger-color); color: #fff; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: bold; }

.create-btn { width: 100%; padding: 16px; background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; }
.create-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.auth-hint { margin-top: 8px; color: var(--warning-color); font-size: 0.9rem; }
.error-hint { margin-top: 8px; color: var(--danger-color); font-size: 0.95rem; }

.auth-gate { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.auth-gate-text { color: #fbbf24; margin: 0 0 12px 0; }
.login-btn { padding: 12px 16px; background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }

.loading { text-align: center; padding: 40px; color: var(--muted); }

.sticky-cta {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  backdrop-filter: blur(6px);
  padding: 12px 0 8px;
}

/* Mobile Exercises Dropdown */
.mobile-ex-picker { margin: 8px 0 12px; }
.open-picker-btn { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font-weight: 600; }
.picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-start; z-index: 50; }
.picker-sheet { background: var(--bg); border-radius: 0 0 12px 12px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; border: 1px solid var(--card-border); }
.picker-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
.picker-header h4 { margin: 0; }
.close-picker { background: transparent; border: none; color: var(--fg); font-size: 1.1rem; cursor: pointer; }
.picker-list { padding: 12px 16px; overflow: auto; }
.search-row.in-sheet { margin: 12px 16px; }
.picker-actions { padding: 12px 16px 16px; border-top: 1px solid var(--card-border); }
.done-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }

@media (min-width: 481px) {
  .mobile-ex-picker, .picker-overlay { display: none; }
}
</style>