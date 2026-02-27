<template>
    <div class="workout-detail">
      <HeaderBar title="Workout" />

    <div class="content">
      <div v-if="loading" class="loading">{{ t('workoutDetail.loading') }}</div>

      <div v-else-if="error" class="error">
        <p>{{ t('workoutDetail.loadError') }}</p>
        <small>{{ error }}</small>
      </div>

      <div v-else-if="!workout" class="empty">
        <p>{{ t('workoutDetail.notFound') }}</p>
      </div>

      <div v-else class="workout">
        <div class="workout-header">
          <h2>{{ workout.name }}</h2>
          <div class="meta">
            <span class="badge">{{ workout.type?.toUpperCase() }}</span>
            <span>{{ formatDate(workout.date) }}</span>
            <span v-if="workout.completed" class="completed">✓</span>
          </div>
        </div>

          <div id="exercises" ref="exListRef" class="ex-list glass" :class="{ reordering: isReordering }">

          <div class="ex-list-header">
            <div class="ex-list-actions">
              <button class="primary add-exercise-btn" type="button" @click="showAddExerciseModal = true">
                + {{ t('workoutDetail.addExercise') }}
              </button>
              <button class="reorder-toggle" type="button" :aria-pressed="isReordering" @click="toggleReorder">
                {{ isReordering ? t('workoutDetail.done') : t('workoutDetail.editOrder') }}
              </button>
            </div>
          </div>
    <!-- Modal für Übungsauswahl -->
    <AppModal
      v-model="showAddExerciseModal"
      :title="t('workoutDetail.addExercise')"
      :show-cancel="true"
      :confirm-text="t('common.add')"
      :cancel-text="t('common.cancel')"
      type="info"
      @confirm="onAddExerciseConfirm"
    >
      <div class="picker-container">
        <div v-if="exercisesLoading" class="loading">{{ t('exercises.loading') }}</div>
        <ExerciseList
          v-else
          :show-title="false"
          :show-controls="false"
          :items="allExercises"
          :selectable="true"
          :selected-ids="selectedModalExerciseIds"
          @toggle="handleAddExerciseToggle"
        />
      </div>
    </AppModal>

          <div v-if="isDirty" class="banner dirty">{{ t('workoutDetail.unsaved') }}</div>
          <p v-if="isReordering" class="reorder-hint">{{ t('workoutDetail.reorderHint') }}</p>

          <div
            v-for="(ex, i) in workout.exercises || []"
            :key="ex.exerciseId || i"
            :data-ex-index="i"
            class="ex-item"
                  :class="{ reordering: isReordering, dragging: draggingIndex === i, 'drop-target': dropTargetIndex === i }"
                  :draggable="isReordering && !isMobile"
                    @pointerdown="onPointerDown($event, i)"
                @dragstart="onDragStart(i)"
                @dragover.prevent="onDragOver(i)"
                @dragleave.prevent="onDragLeave(i)"
                @drop.prevent="onDrop(i)"
                @dragend="stopDrag()"
          >
              <button
                v-if="isReordering"
                class="drag-handle"
                :title="t('workoutDetail.dragToReorder')"
                @touchstart.prevent="onTouchStart($event, i)"
                @pointerdown="onPointerDown($event, i)"
              >⋮⋮</button>
            <div class="ex-info" :class="{ minimal: isReordering }">
              <template v-if="isReordering">
                <strong class="ex-name-only">{{ getTranslatedExerciseName(ex.name) }}</strong>
              </template>
              <template v-else>
                <img
                  :src="getExerciseImage(ex)"
                  :alt="getTranslatedExerciseName(ex.name)"
                  class="ex-thumb"
                  @error="onImgError"
                  @click="openExerciseMedia(ex)"
                />
                <div class="ex-text">
                  <strong>{{ getTranslatedExerciseName(ex.name) }}</strong>
                  <small>{{ getTranslatedMuscleGroup ? getTranslatedMuscleGroup(ex.muscleGroup) : ex.muscleGroup }}</small>

                  <!-- Notiz-Button und Feld -->
                  <div style="margin-top: 6px;">
                    <button class="link" @click="toggleNote(i)">
                      📝
                      {{ getNote(i)
                        ? (showNote[i] ? 'ändern' : 'anzeigen')
                        : 'Notiz hinzufügen' }}
                    </button>

                    <button
                      class="link danger"
                      v-if="getNote(i)"
                      @click="deleteNote(i)"
                      style="margin-left:8px;"
                    >
                      🗑️ löschen
                    </button>
                  </div>

                  <div v-if="showNote && showNote[i]" style="margin-top: 4px;">
                    <textarea :value="getNote(i)" @input="setNote(i, $event.target.value)" rows="2" style="width:100%;resize:vertical" placeholder="Notiz zu dieser Übung..."></textarea>
                  </div>
                  <div v-if="mediaExercise" class="media-overlay" @click.self="closeExerciseMedia">
                    <div class="media-content">
                      <video
                        v-if="isVideoUrl(mediaUrl)"
                        :src="mediaUrl"
                        class="media-image"
                        autoplay
                        muted
                        loop
                        playsinline
                        controls
                      ></video>
                      <img
                        v-else
                        :src="mediaUrl || getExerciseLargeImage(mediaExercise)"
                        :alt="mediaExercise.name"
                        class="media-image"
                      />
                      <button class="close-btn" @click="closeExerciseMedia">OK</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div class="ex-sets" v-if="!isReordering">
              <div class="set-row header">
                <span class="col set">{{ t('workoutDetail.set') }}</span>
                <span class="col reps">{{ t('workoutDetail.reps') }}</span>
                <span class="col weight">{{ t('workoutDetail.weight') }}</span>
                <span class="col actions">{{ t('workoutDetail.actions') }}</span>
              </div>

              <div
                v-for="(row, rIdx) in (ex.setDetails || [])"
                :key="`${ex.exerciseId || i}-row-${rIdx}`"
                class="set-row"
              >
                <span class="col set">{{ rIdx + 1 }}</span>
                <span class="col reps">
                  <div class="number-with-spinner">
                      <input
                        v-model.number="row.reps"
                        type="number"
                        min="1"
                        max="500"
                        step="1"
                        inputmode="numeric"
                        :readonly="isMobile"
                        @input="() => { clampRowValue(row, 'reps', 1, 500, 1); triggerAutoSave() }"
                        @wheel.prevent="onNumberWheel($event, row, 'reps', 1, 1, 500)"
                        @keydown="onNumberKeyDown($event, false)"
                        @focus.prevent="openPicker(row, 'reps', 1, 1, 500)"
                        @click.prevent="openPicker(row, 'reps', 1, 1, 500)"
                      />
                      <div v-if="!isMobile" class="spinner-vertical">
                      <button
                        type="button"
                        class="spin-btn up"
                        aria-label="increment reps"
                        @click="adjustRowField(row, 'reps', 1, 1, 1, 500)"
                        @mousedown="startSpin(row, 'reps', 1, 1, 1, 500)"
                        @mouseup="stopSpin(row, 'reps')"
                        @mouseleave="stopSpin(row, 'reps')"
                        @touchstart.prevent="startSpin(row, 'reps', 1, 1, 1, 500)"
                        @touchend.prevent="stopSpin(row, 'reps')"
                        @touchcancel.prevent="stopSpin(row, 'reps')"
                      >▲</button>
                      <button
                        type="button"
                        class="spin-btn down"
                        aria-label="decrement reps"
                        @click="adjustRowField(row, 'reps', -1, 1, 1, 500)"
                        @mousedown="startSpin(row, 'reps', -1, 1, 1, 500)"
                        @mouseup="stopSpin(row, 'reps')"
                        @mouseleave="stopSpin(row, 'reps')"
                        @touchstart.prevent="startSpin(row, 'reps', -1, 1, 1, 500)"
                        @touchend.prevent="stopSpin(row, 'reps')"
                        @touchcancel.prevent="stopSpin(row, 'reps')"
                      >▼</button>
                    </div>
                  </div>
                </span>
                <span class="col weight">
                  <div class="weight-input">
                      <div class="number-with-spinner">
                      <input
                        v-model.number="row.weight"
                        type="number"
                        min="0"
                        max="1000"
                        step="2.5"
                        inputmode="decimal"
                        :readonly="isMobile"
                        @input="() => { clampRowValue(row, 'weight', 0, 1000, 2.5); triggerAutoSave() }"
                        @wheel.prevent="onNumberWheel($event, row, 'weight', 2.5, 0, 1000)"
                        @keydown="onNumberKeyDown($event, true)"
                        @focus.prevent="openPicker(row, 'weight', 2.5, 0, 1000)"
                        @click.prevent="openPicker(row, 'weight', 2.5, 0, 1000)"
                      />
                      <div v-if="!isMobile" class="spinner-vertical">
                        <button
                          type="button"
                          class="spin-btn up"
                          aria-label="increment weight"
                          @click="adjustRowField(row, 'weight', 1, 2.5, 0, 1000)"
                          @mousedown="startSpin(row, 'weight', 1, 2.5, 0, 1000)"
                          @mouseup="stopSpin(row, 'weight')"
                          @mouseleave="stopSpin(row, 'weight')"
                          @touchstart.prevent="startSpin(row, 'weight', 1, 2.5, 0, 1000)"
                          @touchend.prevent="stopSpin(row, 'weight')"
                          @touchcancel.prevent="stopSpin(row, 'weight')"
                        >▲</button>
                        <button
                          type="button"
                          class="spin-btn down"
                          aria-label="decrement weight"
                          @click="adjustRowField(row, 'weight', -1, 2.5, 0, 1000)"
                          @mousedown="startSpin(row, 'weight', -1, 2.5, 0, 1000)"
                          @mouseup="stopSpin(row, 'weight')"
                          @mouseleave="stopSpin(row, 'weight')"
                          @touchstart.prevent="startSpin(row, 'weight', -1, 2.5, 0, 1000)"
                          @touchend.prevent="stopSpin(row, 'weight')"
                          @touchcancel.prevent="stopSpin(row, 'weight')"
                        >▼</button>
                      </div>
                    </div>
                    <span class="unit">kg</span>
                  </div>
                </span>
                <span class="col actions">
                  <button class="remove-row-btn" :title="t('workoutDetail.removeSet')" @click="removeSetRow(i, rIdx)">−</button>
                </span>
              </div>

              <div class="row-actions">
                <button class="add-row-btn" :title="t('workoutDetail.addSet')" @click="addSetRow(i)">＋</button>
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="primary" :disabled="saving" @click="saveWorkout">
              {{ saving ? t('workoutDetail.saving') : t('workoutDetail.save') }}
            </button>
            <small v-if="saveMsg" class="save-msg" :class="{ error: saveError }">{{ saveMsg }}</small>
          </div>
        </div>

        <div class="actions">
          <button class="primary" @click="goDashboard">{{ t('workoutDetail.cancel') }}</button>
        </div>
      </div>
    </div>

    <BottomNav />

    <NumberPicker
      :visible="pickerVisible"
      :value="pickerValue"
      :min="pickerConfig.min"
      :max="pickerConfig.max"
      :step="pickerConfig.step"
      :title="pickerConfig.title"
      :confirm-text="pickerConfig.confirmText"
      :cancel-text="pickerConfig.cancelText"
      @update:value="val => pickerValue = val"
      @confirm="onPickerConfirm"
      @cancel="onPickerCancel"
    />

    <!-- Bestätigungsmodal bei ungespeicherten Änderungen -->
    <AppModal
      v-model="showLeaveModal"
      :title="t('workoutDetail.cancel')"
      :message="t('workoutDetail.leaveConfirm')"
      :confirm-text="t('workoutDetail.leaveConfirmBack')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="confirmLeave"
    />
  </div>
</template>

<script setup>
// State für Übung hinzufügen
const showAddExerciseModal = ref(false)
const allExercises = ref([])
const exercisesLoading = ref(false)
const selectedExerciseToAdd = ref(null)
function getExerciseIdentifier(ex) {
  const value = ex?._id || ex?.exerciseId || ex?.id || ex?.mediaId || null
  return value == null ? '' : String(value)
}
const selectedModalExerciseIds = computed(() => {
  const id = getExerciseIdentifier(selectedExerciseToAdd.value)
  return id ? [id] : []
})
// Übungen für Modal laden
import { getMergedSortedExercises } from '@/utils/exerciseList'
async function loadAllExercises() {
  exercisesLoading.value = true
  try {
    const type = (workout.value?.type || '').toLowerCase()
    const categoryMap = { push: 'Push', pull: 'Pull', legs: 'Legs' }
    const category = categoryMap[type] || ''
    const list = await getMergedSortedExercises({ category, locale: String(locale?.value || '') })
    allExercises.value = list
  } catch (e) {
    allExercises.value = []
  } finally {
    exercisesLoading.value = false
  }
}

watch(showAddExerciseModal, (val) => {
  if (val) loadAllExercises()
  if (!val) selectedExerciseToAdd.value = null
})

function handleAddExerciseToggle(ex) {
  if (!ex) return
  const nextId = getExerciseIdentifier(ex)
  const selectedId = getExerciseIdentifier(selectedExerciseToAdd.value)
  if (selectedId && selectedId === nextId) {
    selectedExerciseToAdd.value = null
    return
  }
  selectedExerciseToAdd.value = ex
}

function onAddExerciseConfirm() {
  if (!selectedExerciseToAdd.value) return
  const selectedId = getExerciseIdentifier(selectedExerciseToAdd.value)
  if (!selectedId) return
  // Füge die Übung ans Workout an (mit Default-Sets)
  if (!workout.value.exercises) workout.value.exercises = []
  // Verhindere Duplikate (optional)
  if (workout.value.exercises.some(e => String(e.exerciseId || e._id || e.id || '') === selectedId)) {
    toast.show('Übung bereits hinzugefügt', { type: 'warning', duration: 2000 })
    showAddExerciseModal.value = false
    selectedExerciseToAdd.value = null
    return
  }
  workout.value.exercises.push({
    exerciseId: selectedId,
    name: selectedExerciseToAdd.value.name,
    muscleGroup: selectedExerciseToAdd.value.muscleGroup,
    imageUrl: selectedExerciseToAdd.value.imageUrl || '',
    thumbnailUrl: selectedExerciseToAdd.value.thumbnailUrl || '',
    thumbnailStaticUrl: selectedExerciseToAdd.value.thumbnailStaticUrl || '',
    setDetails: [{ reps: 10, weight: 0 }],
    note: ''
  })
  showAddExerciseModal.value = false
  selectedExerciseToAdd.value = null
  ensureSetDetailsStructure()
  try { triggerAutoSave() } catch {}
  toast.show('Übung hinzugefügt', { type: 'success', duration: 1500 })
}
import { ref, onMounted, onBeforeUnmount, watch, nextTick, reactive, computed } from 'vue'
import NumberPicker from '@/components/NumberPicker.vue'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { resolveExerciseMedia, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { getWorkoutOffline, getExerciseOffline, getAllExercisesOffline, saveWorkoutOffline, db } from '@/utils/offlineStorage'
import { fetchWorkout } from '@/api/workouts'
// import { fetchExercise, fetchExercises } from '@/api/exercises'
import { useUserStore } from '@/stores/userStore'
import HeaderBar from '@/components/HeaderBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'
import ExerciseList from '@/components/ExerciseList.vue'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { buildWorkoutNotesSummary } from '@/utils/workoutNotes'

const userStore = useUserStore()
function getDetailDraftKey() {
  const userId = userStore?.user?.id || userStore?.user?._id || 'guest'
  return `workout_detail_draft_${userId}`
}
function clearAllDetailDraftSnapshots() {
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach((key) => {
      if (key.includes('workout_detail_draft_')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch {}
}

function clearAllWorkoutMapKeys() {
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach((key) => {
      if (key.startsWith('workout_map_')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch {}
}

async function postSaveCleanup() {
  try { await store.clearDraft() } catch {}
  try { await db.workouts.delete('draft') } catch {}
  clearAllDetailDraftSnapshots()
  clearAllWorkoutMapKeys()
}

const route = useRoute()
const router = useRouter()
const { getIdToken } = useFirebaseAuth()

const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()
const defaultExerciseByName = ref(new Map())
async function loadDefaultExerciseMap() {
  try {
    const defaultExercisesNormalized = await loadDefaultExercises()
    defaultExerciseByName.value = new Map(
      defaultExercisesNormalized.flatMap(ex => {
        const entries = []
        if (ex.name) entries.push([String(ex.name).trim().toLowerCase(), ex])
        if (ex.name_en) entries.push([String(ex.name_en).trim().toLowerCase(), ex])
        return entries
      })
    )
  } catch {
    defaultExerciseByName.value = new Map()
  }
}
// Optional: eigene Übersetzungsfunktion für Muskelgruppen
const getTranslatedMuscleGroup = (mg) => mg

const store = userStore
const toast = useToastStore()
const workout = ref(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveMsg = ref('')
const saveError = ref(false)
const suppressDraftPersistence = ref(false)
const mediaExercise = ref(null)
const mediaUrl = ref('')
const mediaRequestId = ref(0)
const isVideoUrl = (url) => typeof url === 'string' && /\.mp4($|[?#])/i.test(url)
const isReordering = ref(false)
const draggingIndex = ref(null)
const dropTargetIndex = ref(null)
const activeTouchPointerId = ref(null)
let pointerMoveListener = null
let pointerUpListener = null
let pointerCancelListener = null
const touchPointerTypes = new Set(['touch', 'pen'])
const supportsPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined'
const activeFallbackTouchId = ref(null)
let fallbackTouchMoveListener = null
let fallbackTouchEndListener = null
let fallbackTouchCancelListener = null
const isDirty = ref(false)
const exListRef = ref(null)
const didAutoScroll = ref(false)
let initialSnapshot = ''
const showLeaveModal = ref(false)

// Notiz-Logik
const showNote = ref([])
const exerciseNotes = ref([])
// Mobile detection (treat app as mobile-only if touch available or narrow)
const isMobile = ref(typeof window !== 'undefined' && ('ontouchstart' in window || window.innerWidth <= 768))

// Picker state
const pickerVisible = ref(false)
const pickerValue = ref(0)
const pickerConfig = reactive({ min: 0, max: 1000, step: 1, title: '', confirmText: 'OK', cancelText: 'Abbrechen' })
let pickerTarget = null // { row, field }

function shouldKeepAsDraft(workoutLike) {
  if (!workoutLike) return false
  const routeId = String(route.params.id || '')
  if (routeId === 'draft' || routeId.startsWith('draft-')) return true
  if (String(route.query?.created || '') === '1') return true
  return workoutLike._isDraft === true || workoutLike.isDraft === true
}

function resolveRealIdFromDraftId(id) {
  if (!String(id || '').startsWith('draft-')) return ''
  let realId = String(route.query?.realId || '')
  if (!realId) {
    try {
      realId = String(sessionStorage.getItem(`workout_map_${String(id)}`) || '')
    } catch {}
  }
  return realId
}

// Debounce Hilfsfunktion
function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// Debounced Auto-Save Funktion (muss vor Aufrufen deklariert sein)
const triggerAutoSave = async () => {
  const id = route.params.id
  const w = workout.value || {}

  // Übernehme alle aktuellen Notizen ins Workout-Objekt
  if (Array.isArray(w.exercises) && Array.isArray(exerciseNotes.value)) {
    w.exercises = w.exercises.map((ex, idx) => ({
      ...ex,
      note: typeof exerciseNotes.value[idx] === 'string' ? exerciseNotes.value[idx] : ex.note || ''
    }))
    w.notes = buildWorkoutNotesSummary(w.exercises)
  }

  try {
    if (id === 'draft') {
      const draftKey = getDetailDraftKey()
      await saveWorkoutOffline({ ...w, _id: draftKey, _isDraft: true, isDraft: true, updatedAt: Date.now() })
      saveMsg.value = 'Auto-gespeichert (Entwurf lokal).'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...w })
      logger.debug('Draft gespeichert (draft):', { ...w, _id: 'draft' })
    } else if (String(id).startsWith('draft-')) {
      const realId = resolveRealIdFromDraftId(id)
      if (realId) {
        const token = await getIdToken().catch(() => null)
        await store.updateWorkout(realId, w, token)
        saveMsg.value = 'Auto-gespeichert.'
        saveError.value = false
        initialSnapshot = snapshotCore({ ...w, _id: realId })
      } else {
        await saveWorkoutOffline({ ...w, _id: id, _isDraft: true, updatedAt: Date.now() })
        const idx = store.workouts.findIndex(wi => wi._id === id)
        if (idx !== -1) {
          store.workouts[idx] = { ...store.workouts[idx], ...w }
          initialSnapshot = snapshotCore({ ...store.workouts[idx] })
        } else {
          initialSnapshot = snapshotCore({ ...w, _id: id })
        }
        saveMsg.value = 'Auto-gespeichert (Entwurf lokal).'
        saveError.value = false
      }
    } else {
      let token = await getIdToken().catch(() => null)
      const keepDraft = shouldKeepAsDraft(w) && w.completed !== true
      const payload = { ...w, _isDraft: keepDraft, isDraft: keepDraft }
      await store.updateWorkout(route.params.id, payload, token)
      try { await saveWorkoutOffline({ ...payload, _id: route.params.id, updatedAt: Date.now() }) } catch {}
      saveMsg.value = 'Auto-gespeichert.'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...payload })
    }
  } catch (e) {
    logger.error('Auto-Save fehlgeschlagen:', e)
    saveMsg.value = 'Auto-Save fehlgeschlagen.'
    saveError.value = true
  }
}
// Initialisiere Notiz-Arrays, wenn Workout geladen wird
watch(workout, (w) => {
  if (w && Array.isArray(w.exercises)) {
    showNote.value = w.exercises.map(ex => !!ex.note)
    exerciseNotes.value = w.exercises.map(ex => typeof ex.note === 'string' ? ex.note : '')
  }
})

// Auto-Save wird in vielen Funktionen aufgerufen (Inputs, Notizen, Reihenfolge)

const toggleNote = (idx) => {
  showNote.value[idx] = !showNote.value[idx]
}
const getNote = (idx) => {
  return (exerciseNotes.value && typeof exerciseNotes.value[idx] !== 'undefined') ? exerciseNotes.value[idx] : ''
}
const setNote = (idx, val) => {
  if (exerciseNotes.value) exerciseNotes.value[idx] = val
  try { triggerAutoSave() } catch {}
}

function deleteNote(idx) {
  if (exerciseNotes.value) exerciseNotes.value[idx] = ''
  if (showNote.value) showNote.value[idx] = false
  try { triggerAutoSave() } catch {}
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
    return d.toLocaleString(loc)
  } catch {
    return String(dateStr)
  }
}

function snapshotCore(w) {
  if (!w) return ''
  try {
    const core = {
      name: w.name,
      type: w.type,
      date: w.date,
      completed: w.completed,
      exercises: (w.exercises || []).map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        setDetails: (ex.setDetails || []).map(s => ({ reps: s.reps, weight: s.weight }))
      }))
    }
    return JSON.stringify(core)
  } catch {
    return ''
  }
}

async function loadWorkout() {
  loading.value = true
  error.value = ''
  try {
    const id = route.params.id
    logger.debug('[WorkoutDetail] loadWorkout start', {
      id,
      routeName: route.name,
      query: { ...route.query }
    })
    if (route.query.created === '1') {
      toast.show(t('dashboard.successCreated'), { type: 'success', duration: 3000 })
    }

    // Draft-Workouts immer lokal laden
    if (id === 'draft') {
      const draftKey = getDetailDraftKey()
      // 1. Versuche aus sessionStorage zu laden (Resume aus Dashboard)
      let draft = null
      const raw = sessionStorage.getItem(draftKey)
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          // Kompatibilität: alter sessionStorage-Draft kann {workout: ...} oder direkt das Objekt sein
          draft = parsed.workout || parsed
        } catch {}
      }
      // 2. Fallback: aus IndexedDB
      if (!draft) {
        draft = await getWorkoutOffline(draftKey)
      }
      // 3. Fallback: Legacy Draft unter statischem Schlüssel 'draft'
      if (!draft) {
        draft = await getWorkoutOffline('draft')
      }
      logger.debug('[WorkoutDetail] draft lookup result', {
        draftKey,
        found: !!draft,
        hasExercises: Array.isArray(draft?.exercises),
        type: draft?.type || route.query.type || null
      })
      if (draft && draft.exercises && (draft.type || route.query.type)) {
        const allExercises = await getAllExercisesOffline({})
        const merged = draft.exercises.map(draftEx => {
          let dbEx = allExercises.find(e => e._id === draftEx._id)
          if (!dbEx) {
            const name = (draftEx.name || '').trim().toLowerCase()
            const mg = (draftEx.muscleGroup || '').trim().toLowerCase()
            dbEx = allExercises.find(e => (e.name || '').trim().toLowerCase() === name && (e.muscleGroup || '').trim().toLowerCase() === mg)
          }
          if (!dbEx) {
            const name = (draftEx.name || '').trim().toLowerCase()
            dbEx = allExercises.find(e => (e.name || '').trim().toLowerCase() === name)
          }
          if (dbEx) {
            return {
              ...dbEx,
              ...draftEx,
              setDetails: Array.isArray(draftEx.setDetails) ? draftEx.setDetails.map(s => ({ reps: s.reps, weight: s.weight })) : [],
            }
          } else {
            return {
              ...draftEx,
              setDetails: Array.isArray(draftEx.setDetails) ? draftEx.setDetails.map(s => ({ reps: s.reps, weight: s.weight })) : [],
            }
          }
        })
        const type = draft.type || route.query.type || null
        workout.value = { ...draft, type, exercises: merged }
      } else {
        const type = draft?.type || route.query.type || null
        workout.value = draft ? { ...draft, type } : { _id: 'draft', type, exercises: [] }
      }
      ensureSetDetailsStructure()
      await enrichExerciseImages()
      initialSnapshot = snapshotCore(workout.value)
      return
    }

    // Offline-IDs (lokal gespeicherte Workouts)
    if (String(id).startsWith('draft-') || String(id).startsWith('offline_')) {
      const fromStore = store.workouts.find(w => w._id === id) || null
      const fromOffline = fromStore ? null : (await getWorkoutOffline(id))
      workout.value = fromStore || fromOffline || null
      logger.debug('[WorkoutDetail] temp/offline lookup', {
        id,
        fromStore: !!fromStore,
        fromOffline: !!fromOffline,
        found: !!workout.value
      })
      if (!workout.value && String(id).startsWith('draft-')) {
        let realId = String(route.query?.realId || '')
        if (!realId) {
          try {
            realId = String(sessionStorage.getItem(`workout_map_${String(id)}`) || '')
          } catch {}
        }
        logger.debug('[WorkoutDetail] temp realId fallback', { id, realId: realId || null })
        if (realId) {
          const mappedFromStore = store.workouts.find(w => w._id === realId) || null
          const mappedFromOffline = mappedFromStore ? null : (await getWorkoutOffline(realId))
          workout.value = mappedFromStore || mappedFromOffline || null
          logger.debug('[WorkoutDetail] mapped realId lookup', {
            tempId: id,
            realId,
            fromStore: !!mappedFromStore,
            fromOffline: !!mappedFromOffline,
            found: !!workout.value
          })
          if (!workout.value) {
            const token = await getIdToken().catch(() => null)
            workout.value = await fetchWorkout(realId, token).catch(() => null)
            logger.debug('[WorkoutDetail] mapped realId api fallback', {
              realId,
              hasToken: !!token,
              found: !!workout.value
            })
          }
          if (workout.value) {
            try { sessionStorage.removeItem(`workout_map_${String(id)}`) } catch {}
            await router.replace({ name: 'workout-detail', params: { id: realId }, query: { created: '1', realId } }).catch(() => {})
            logger.debug('[WorkoutDetail] replaced temp route with realId', { tempId: id, realId })
          }
        }
      }
      if (!workout.value) {
        logger.warn('[WorkoutDetail] temp/offline workout unresolved', {
          id,
          query: { ...route.query },
          storeCount: Array.isArray(store.workouts) ? store.workouts.length : 0
        })
      }
      ensureSetDetailsStructure()
      await enrichExerciseImages()
      initialSnapshot = snapshotCore(workout.value)
      return
    }

    // Normale Workouts: offline-first, dann API-Fallback
    const normalFromStore = store.workouts.find(w => w._id === id) || null
    const normalFromOffline = normalFromStore ? null : (await getWorkoutOffline(id))
    workout.value = normalFromStore || normalFromOffline
    logger.debug('[WorkoutDetail] normal lookup', {
      id,
      fromStore: !!normalFromStore,
      fromOffline: !!normalFromOffline,
      found: !!workout.value
    })
    if (!workout.value) {
      const token = await getIdToken().catch(() => null)
      workout.value = await fetchWorkout(id, token).catch(() => null)
      logger.debug('[WorkoutDetail] normal api fallback', {
        id,
        hasToken: !!token,
        found: !!workout.value
      })
    }
    if (!workout.value) {
      logger.warn('[WorkoutDetail] workout unresolved after all fallbacks', {
        id,
        query: { ...route.query },
        storeCount: Array.isArray(store.workouts) ? store.workouts.length : 0
      })
    }
    ensureSetDetailsStructure()
    if (workout.value && shouldKeepAsDraft(workout.value) && workout.value.completed !== true) {
      workout.value._isDraft = true
      workout.value.isDraft = true
      try { await saveWorkoutOffline({ ...workout.value, _id: workout.value._id || id, _isDraft: true, isDraft: true, updatedAt: Date.now() }) } catch {}
      try {
        const idx = store.workouts.findIndex(w => String(w?._id || '') === String(workout.value?._id || id))
        if (idx !== -1) {
          store.workouts[idx] = { ...store.workouts[idx], _isDraft: true, isDraft: true, completed: false }
        }
      } catch {}
    }
    await enrichExerciseImages()
    initialSnapshot = snapshotCore(workout.value)
  } catch (e) {
    logger.error('Workout laden fehlgeschlagen:', e)
    error.value = e?.message || 'Unbekannter Fehler'
  } finally {
    loading.value = false
  }
}

async function enrichExerciseImages() {
  try {
    const list = workout.value?.exercises || []
    for (let idx = 0; idx < list.length; idx++) {
      const ex = list[idx]
      if (!ex.exerciseId) continue
      try {
        const full = await getExerciseOffline(ex.exerciseId)
        if (full?.imageUrl || full?.thumbnailUrl || full?.thumbnailStaticUrl) {
          ex.imageUrl = full.imageUrl
          ex.thumbnailUrl = full.thumbnailUrl
          ex.thumbnailStaticUrl = full.thumbnailStaticUrl
        }
      } catch {}
    }
  } catch {}
}

function getExerciseImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? ex.imageUrl : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '' : imageUrl
  const direct = ex?.thumbnailStaticUrl || ex?.thumbnailUrl || safeImage
  if (direct) return direct
  const nameKey = String(ex?.name || '').trim().toLowerCase()
  const mapped = nameKey ? defaultExerciseByName.value.get(nameKey) : null
  const mappedImage = typeof mapped?.imageUrl === 'string' && /\.gif($|[?#])/i.test(mapped.imageUrl) ? '' : mapped?.imageUrl
  return mapped?.thumbnailStaticUrl || mapped?.thumbnailUrl || mappedImage || '/exercises/play.svg'
}

function getExerciseLargeImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? ex.imageUrl : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '' : imageUrl
  const direct = safeImage || ex?.thumbnailUrl
  if (direct) return direct
  const nameKey = String(ex?.name || '').trim().toLowerCase()
  const mapped = nameKey ? defaultExerciseByName.value.get(nameKey) : null
  const mappedImage = typeof mapped?.imageUrl === 'string' && /\.gif($|[?#])/i.test(mapped.imageUrl) ? '' : mapped?.imageUrl
  return mappedImage || mapped?.thumbnailUrl || '/exercises/play.svg'
}

function openExerciseMedia(exercise) {
  if (!exercise || isReordering.value) return
  const requestId = ++mediaRequestId.value
  const nameKey = String(exercise?.name || '').trim().toLowerCase()
  const mapped = nameKey ? defaultExerciseByName.value.get(nameKey) : null
  const source = mapped ? Object.fromEntries(
    Object.entries({ ...mapped, ...exercise }).filter(([, value]) => value != null && value !== '')
  ) : exercise
  mediaExercise.value = source
  const fallbackMp4 = buildExerciseMediaUrl(source, 360, 'mp4')
  mediaUrl.value = fallbackMp4 || getExerciseLargeImage(source)
  resolveExerciseMedia(source, {
    size: 360,
    fallbackUrl: mediaUrl.value,
    onResolved: (url) => {
      if (mediaExercise.value && mediaRequestId.value === requestId) {
        mediaUrl.value = url
      }
    }
  }).catch(() => {})
}

function closeExerciseMedia() {
  mediaExercise.value = null
  mediaUrl.value = ''
}

function onImgError(evt) {
  const img = evt?.target
  if (!img) return
  if (img.src.includes('play.svg')) {
    img.onerror = null
    return
  }
  img.onerror = null
  img.src = '/exercises/play.svg'
}

function scrollToExercises() {
  const el = exListRef.value || document.getElementById('exercises')
  if (!el) return
  const headerOffset = 72
  try {
    const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  } catch {}
}

function openPicker(row, field, step = 1, min = 0, max = 1000, title = '') {
  // Only show the picker on mobile
  if (!isMobile.value) return
  pickerTarget = { row, field }
  pickerConfig.step = step
  pickerConfig.min = min
  pickerConfig.max = max
  pickerConfig.title = title || (field === 'weight' ? 'Gewicht (kg)' : 'Wiederholungen')
  pickerValue.value = Number(row[field]) || 0
  pickerVisible.value = true
}

function onPickerConfirm(val) {
  if (!pickerTarget) { pickerVisible.value = false; return }
  const { row, field } = pickerTarget
  row[field] = val
  try { triggerAutoSave() } catch {}
  pickerVisible.value = false
  pickerTarget = null
}

function onPickerCancel() {
  pickerVisible.value = false
  pickerTarget = null
}

function shouldAutoScroll() {
  return route.query.created === '1' || route.query.focus === 'exercises' || route.hash === '#exercises'
}

function goDashboard() {
  if (isDirty.value) {
    showLeaveModal.value = true
    return
  }
  router.push('/dashboard')
}

function confirmLeave() {
  router.push('/dashboard')
}


function toggleReorder() { isReordering.value = !isReordering.value }

function ensureSetDetailsStructure() {
  if (!workout.value || !Array.isArray(workout.value.exercises)) return
  workout.value.exercises = workout.value.exercises.map(ex => ({
    ...ex,
    setDetails: Array.isArray(ex.setDetails) && ex.setDetails.length > 0
      ? ex.setDetails
      : [{ reps: ex.reps || 10, weight: ex.weight || 0 }]
  }))
}

function addSetRow(exIndex) {
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex) return
  if (!Array.isArray(ex.setDetails)) ex.setDetails = []
  const last = ex.setDetails.at(-1)
  ex.setDetails.push({ reps: last?.reps || 10, weight: last?.weight || 0 })
  logger.debug('addSetRow', 'exIndex:', exIndex, 'newLen:', ex.setDetails.length)
  try { triggerAutoSave() } catch {}
}

function removeSetRow(exIndex, rowIndex) {
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex || !Array.isArray(ex.setDetails)) return
  ex.setDetails.splice(rowIndex, 1)
  if (ex.setDetails.length === 0) {
    ex.setDetails.push({ reps: ex.reps || 10, weight: ex.weight || 0 })
  }
  logger.debug('removeSetRow', 'exIndex:', exIndex, 'rowIndex:', rowIndex, 'remaining:', ex.setDetails.length)
  try { triggerAutoSave() } catch {}
}

// Wheel / Keyboard support and clamping for numeric inputs
function onNumberWheel(e, row, field, step = 1, min = -Infinity, max = Infinity) {
  try {
    // deltaY < 0 means wheel up (increase)
    const dir = e.deltaY < 0 ? 1 : -1
    const cur = Number(row[field]) || 0
    let next = cur + dir * step
    // snap to step
    next = Math.round(next / step) * step
    // clamp
    next = Math.min(max, Math.max(min, next))
    // fix float precision for fractional steps
    if (step < 1) next = Number(next.toFixed(3))
    row[field] = next
    try { triggerAutoSave() } catch {}
  } catch (err) {
    logger.warn('onNumberWheel error', err)
  }
}

function onNumberKeyDown(e, allowDecimal = false) {
  // allow navigation and control keys
  const allowed = ['Backspace','Tab','Enter','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Home','End']
  if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return

  // allow decimal separator if permitted
  if ((e.key === '.' || e.key === ',') && allowDecimal) {
    // translate comma to dot
    if (e.key === ',') {
      e.preventDefault()
      const el = e.target
      const pos = el.selectionStart || 0
      const val = el.value || ''
      el.value = val.slice(0, pos) + '.' + val.slice(pos)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return
  }

  // arrow up/down: increment/decrement by step
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const el = e.target
    const step = Number(el.step) || 1
    const min = Number(el.min) || -Infinity
    const max = Number(el.max) || Infinity
    const current = Number(el.value) || 0
    const dir = e.key === 'ArrowUp' ? 1 : -1
    let next = current + dir * step
    if (step < 1) next = Number((Math.round(next / step) * step).toFixed(3))
    next = Math.min(max, Math.max(min, next))
    el.value = next
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  // allow digits only otherwise
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault()
  }
}

function clampRowValue(row, field, min = -Infinity, max = Infinity, step = 1) {
  try {
    let val = Number(row[field])
    if (!Number.isFinite(val)) val = min
    if (val < min) val = min
    if (val > max) val = max
    if (step && step > 0) {
      val = Math.round(val / step) * step
      if (step < 1) {
        const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
        val = Number(val.toFixed(decimals + 1))
      }
    }
    row[field] = val
  } catch (err) {
    logger.warn('clampRowValue error', err)
  }
}

function adjustRowField(row, field, direction = 1, step = 1, min = -Infinity, max = Infinity) {
  try {
    const cur = Number(row[field]) || 0
    const delta = direction * step
    let next = cur + delta
    // snap to step
    next = Math.round(next / step) * step
    // clamp
    next = Math.min(max, Math.max(min, next))
    // fix float precision
    if (step < 1) next = Number(next.toFixed(3))
    row[field] = next
    try { triggerAutoSave() } catch {}
  } catch (err) {
    logger.warn('adjustRowField error', err)
  }
}

// Spin (press-and-hold) support with acceleration
// Stores per-row timers and state
const _spinMap = new WeakMap()

function startSpin(row, field, direction = 1, step = 1, min = -Infinity, max = Infinity) {
  try {
    stopSpin(row, field)

    const fn = () => adjustRowField(row, field, direction, step, min, max)
    // immediate feedback
    fn()

    // acceleration settings
    let currentInterval = 80 // initial repeat interval (ms)
    const minInterval = 20 // fastest allowed interval
    const accelFactor = 0.6 // interval multiplier when accelerating
    const accelPeriod = 500 // how often to accelerate (ms)

    // main repeating interval
    let intervalId = setInterval(fn, currentInterval)

    // acceleration timer: periodically shorten the interval to speed up repeats
    const accelId = setInterval(() => {
      try {
        if (currentInterval <= minInterval) return
        const nextInterval = Math.max(minInterval, Math.round(currentInterval * accelFactor))
        if (nextInterval >= currentInterval) return
        currentInterval = nextInterval
        clearInterval(intervalId)
        intervalId = setInterval(fn, currentInterval)
        // store updated interval id
        const obj = _spinMap.get(row) || {}
        const info = obj[field] || {}
        info.intervalId = intervalId
        info.accelId = accelId
        info.currentInterval = currentInterval
        _spinMap.set(row, { ...obj, [field]: info })
      } catch (err) {
        logger.warn('spin accel error', err)
      }
    }, accelPeriod)

    // save ids
    const obj = _spinMap.get(row) || {}
    obj[field] = { intervalId, accelId, currentInterval }
    _spinMap.set(row, obj)
  } catch (err) {
    logger.warn('startSpin error', err)
  }
}

function stopSpin(row, field) {
  try {
    const obj = _spinMap.get(row)
    if (!obj || !obj[field]) return
    const info = obj[field]
    try { if (info.intervalId) clearInterval(info.intervalId) } catch {}
    try { if (info.accelId) clearInterval(info.accelId) } catch {}
    delete obj[field]
    _spinMap.set(row, obj)
  } catch (err) {
    logger.warn('stopSpin error', err)
  }
}

async function saveWorkout() {
  try {
    suppressDraftPersistence.value = true
    saving.value = true
    const id = route.params.id
    const w = workout.value || {}
    const normalized = {
      name: w.name,
      type: w.type,
      date: w.date,
      completed: true,
      _isDraft: false,
      isDraft: false,
      exercises: (w.exercises || []).map((ex, idx) => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        reps: ex.setDetails?.[0]?.reps ?? ex.reps ?? 10,
        weight: ex.setDetails?.[0]?.weight ?? ex.weight ?? 0,
        setDetails: ex.setDetails || [],
        note: (exerciseNotes.value && typeof exerciseNotes.value[idx] !== 'undefined') ? exerciseNotes.value[idx] : ''
      }))
    }
    normalized.notes = buildWorkoutNotesSummary(normalized.exercises)

    if (String(id).startsWith('draft-')) {
      const realId = resolveRealIdFromDraftId(id)
      if (realId) {
        let token = await getIdToken().catch(() => null)
        await store.updateWorkout(realId, normalized, token)
        saveMsg.value = 'Gespeichert.'
        saveError.value = false
        initialSnapshot = snapshotCore({ ...normalized, _id: realId })
        try { await db.workouts.delete(id) } catch {}
        await postSaveCleanup()
        router.push('/dashboard')
        return
      }
      const idx = store.workouts.findIndex(wi => wi._id === id)
      if (idx !== -1) {
        store.workouts[idx] = { ...store.workouts[idx], ...normalized }
      }
      await saveWorkoutOffline({ ...normalized, _id: id, _isDraft: false, completed: true, updatedAt: Date.now() })
      saveMsg.value = 'Gespeichert.'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...(idx !== -1 ? store.workouts[idx] : normalized), _id: id })
      await postSaveCleanup()
      router.push('/dashboard')
      return
    }

    let token = await getIdToken().catch(() => null)
    await store.updateWorkout(id, normalized, token)
    saveMsg.value = 'Gespeichert.'
    saveError.value = false
    initialSnapshot = snapshotCore({ ...w, ...normalized })
    await postSaveCleanup()
    router.push('/dashboard')
  } catch (e) {
    suppressDraftPersistence.value = false
    error.value = e?.message || 'Speichern fehlgeschlagen'
    saveMsg.value = 'Speichern fehlgeschlagen.'
    saveError.value = true
  } finally {
    saving.value = false
  }
}

function onDragStart(index) { if (!isReordering.value) return; draggingIndex.value = index }
function onDragOver(index) { if (!isReordering.value) return; dropTargetIndex.value = index }
function onDragLeave(index) { if (!isReordering.value) return; if (dropTargetIndex.value === index) dropTargetIndex.value = null }
function onDrop(index) {
  if (!isReordering.value) return
  const from = draggingIndex.value
  const to = index
  if (from === null || to === null || from === to) return
  const list = workout.value?.exercises
  if (!Array.isArray(list)) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  stopDrag()
}

function onPointerDown(event, index) {
  if (!isReordering.value || !touchPointerTypes.has(event.pointerType)) return
  if (activeFallbackTouchId.value !== null) return
  event.preventDefault()
  draggingIndex.value = index
  dropTargetIndex.value = index
  activeTouchPointerId.value = event.pointerId
  attachPointerDragListeners()
}

function attachPointerDragListeners() {
  if (typeof window === 'undefined' || pointerMoveListener) return
  pointerMoveListener = handlePointerMove
  pointerUpListener = handlePointerUp
  pointerCancelListener = handlePointerCancel
  window.addEventListener('pointermove', pointerMoveListener, { passive: false })
  window.addEventListener('pointerup', pointerUpListener)
  window.addEventListener('pointercancel', pointerCancelListener)
}

function cleanupPointerDragListeners() {
  if (typeof window === 'undefined') return
  if (pointerMoveListener) {
    window.removeEventListener('pointermove', pointerMoveListener)
    pointerMoveListener = null
  }
  if (pointerUpListener) {
    window.removeEventListener('pointerup', pointerUpListener)
    pointerUpListener = null
  }
  if (pointerCancelListener) {
    window.removeEventListener('pointercancel', pointerCancelListener)
    pointerCancelListener = null
  }
  activeTouchPointerId.value = null
}

function handlePointerMove(event) {
  if (event.pointerId !== activeTouchPointerId.value) return
  event.preventDefault()
  const nextIndex = findExerciseIndexAtPoint(event.clientX, event.clientY)
  if (nextIndex !== null) {
    dropTargetIndex.value = nextIndex
  }
}

function handlePointerUp(event) {
  if (event.pointerId !== activeTouchPointerId.value) return
  const targetIndex = dropTargetIndex.value ?? draggingIndex.value
  if (targetIndex !== null) {
    onDrop(targetIndex)
  }
  stopDrag()
}

function handlePointerCancel(event) {
  if (event.pointerId !== activeTouchPointerId.value) return
  stopDrag()
}

function onTouchStart(event, index) {
  if (!isReordering.value) return
  if (activeTouchPointerId.value !== null || activeFallbackTouchId.value !== null) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  draggingIndex.value = index
  dropTargetIndex.value = index
  activeFallbackTouchId.value = touch.identifier
  attachTouchDragListeners()
}

function attachTouchDragListeners() {
  if (typeof window === 'undefined' || fallbackTouchMoveListener) return
  fallbackTouchMoveListener = handleTouchMove
  fallbackTouchEndListener = handleTouchEnd
  fallbackTouchCancelListener = handleTouchCancel
  window.addEventListener('touchmove', fallbackTouchMoveListener, { passive: false })
  window.addEventListener('touchend', fallbackTouchEndListener)
  window.addEventListener('touchcancel', fallbackTouchCancelListener)
}

function cleanupTouchDragListeners() {
  if (typeof window === 'undefined') return
  if (fallbackTouchMoveListener) {
    window.removeEventListener('touchmove', fallbackTouchMoveListener)
    fallbackTouchMoveListener = null
  }
  if (fallbackTouchEndListener) {
    window.removeEventListener('touchend', fallbackTouchEndListener)
    fallbackTouchEndListener = null
  }
  if (fallbackTouchCancelListener) {
    window.removeEventListener('touchcancel', fallbackTouchCancelListener)
    fallbackTouchCancelListener = null
  }
  activeFallbackTouchId.value = null
}

function handleTouchMove(event) {
  if (!activeFallbackTouchId.value) return
  const touches = event.touches || []
  let touch = null
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === activeFallbackTouchId.value) {
      touch = touches[i]
      break
    }
  }
  if (!touch) return
  event.preventDefault()
  const nextIndex = findExerciseIndexAtPoint(touch.clientX, touch.clientY)
  if (nextIndex !== null) {
    dropTargetIndex.value = nextIndex
  }
}

function handleTouchEnd(event) {
  if (!activeFallbackTouchId.value) return
  const changed = event.changedTouches || []
  let touch = null
  for (let i = 0; i < changed.length; i++) {
    if (changed[i].identifier === activeFallbackTouchId.value) {
      touch = changed[i]
      break
    }
  }
  if (!touch) return
  const targetIndex = dropTargetIndex.value ?? draggingIndex.value
  if (targetIndex !== null) {
    onDrop(targetIndex)
  }
  stopDrag()
}

function handleTouchCancel(event) {
  if (!activeFallbackTouchId.value) return
  const changed = event.changedTouches || []
  let touch = null
  for (let i = 0; i < changed.length; i++) {
    if (changed[i].identifier === activeFallbackTouchId.value) {
      touch = changed[i]
      break
    }
  }
  if (!touch) return
  stopDrag()
}

function stopDrag() {
  draggingIndex.value = null
  dropTargetIndex.value = null
  cleanupPointerDragListeners()
  cleanupTouchDragListeners()
}

function findExerciseIndexAtPoint(x, y) {
  if (typeof document === 'undefined') return null
  const element = document.elementFromPoint(x, y)
  if (!element || typeof element.closest !== 'function') return null
  const target = element.closest('[data-ex-index]')
  if (!target || !exListRef.value || !exListRef.value.contains(target)) return null
  const raw = target.dataset?.exIndex
  if (!raw) return null
  const idx = Number(raw)
  return Number.isNaN(idx) ? null : idx
}

function writeDraftSessionSnapshot() {
  try {
    if (suppressDraftPersistence.value) return
    const w = workout.value
    if (!w || w.completed === true) return
    if (!(shouldKeepAsDraft(w) || isDirty.value)) return
    const routeId = String(route.params.id || '')
    const effectiveId = String(w._id || routeId || '')
    if (!effectiveId) return
    const snapshot = {
      ...w,
      _id: effectiveId,
      _isDraft: true,
      isDraft: true,
      completed: false,
      timestamp: Date.now()
    }
    sessionStorage.setItem(getDetailDraftKey(), JSON.stringify(snapshot))
  } catch {}
}

async function persistInProgressDraft(reason = '') {
  if (suppressDraftPersistence.value) return
  writeDraftSessionSnapshot()
  try {
    const w = workout.value
    if (!w || w.completed === true) return
    if (!(shouldKeepAsDraft(w) || isDirty.value)) return
    const routeId = String(route.params.id || '')
    const effectiveId = String(w._id || routeId || '')
    if (!effectiveId) return
    const payload = {
      ...w,
      _id: effectiveId,
      _isDraft: true,
      isDraft: true,
      completed: false,
      updatedAt: Date.now()
    }
    await saveWorkoutOffline(payload)
    const idx = store.workouts.findIndex(item => String(item?._id || '') === effectiveId)
    if (idx !== -1) {
      store.workouts[idx] = { ...store.workouts[idx], ...payload }
    } else {
      store.workouts.unshift(payload)
    }
    logger.debug('[WorkoutDetail] in-progress draft persisted', { reason, id: effectiveId })
  } catch {}
}

function onVisibilityChange() {
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      persistInProgressDraft('visibility-hidden').catch(() => {})
    }
  } catch {}
}

function onPageHide() {
  persistInProgressDraft('pagehide').catch(() => {})
}

// Watchers for auto-scroll and dirty tracking
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
  window.addEventListener('pagehide', onPageHide)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  loadDefaultExerciseMap().catch(() => {})
  await loadWorkout()
  // Typ aus Query übernehmen, falls Draft geladen wird und Typ fehlt
  if (route.params.id === 'draft' && workout.value && !workout.value.type && route.query.type) {
    workout.value.type = route.query.type
  }
  await nextTick()
  if (shouldAutoScroll()) {
    setTimeout(scrollToExercises, 50)
    didAutoScroll.value = true
  }
})

watch(() => workout.value?.exercises?.length || 0, async (len) => {
  if (didAutoScroll.value) return
  if (!len) return
  if (!shouldAutoScroll()) return
  await nextTick()
  setTimeout(() => {
    scrollToExercises()
    didAutoScroll.value = true
  }, 0)
})

// Dirty-Tracking gegen initialen Snapshot & sofortiges Draft-Speichern
watch(() => workout.value, (w) => {
  const current = snapshotCore(w || {})
  isDirty.value = !!initialSnapshot && current !== initialSnapshot
  try {
    if (!w || w.completed === true) return
    if (!(shouldKeepAsDraft(w) || isDirty.value)) return
    writeDraftSessionSnapshot()
  } catch {}
}, { deep: true })

// Warnung beim Schließen/Reload
function beforeUnloadHandler(e) {
  if (!workout.value || workout.value.completed === true) return
  if (!(shouldKeepAsDraft(workout.value) || isDirty.value)) return
  try {
    writeDraftSessionSnapshot()
    logger.debug('beforeunload snapshot saved to sessionStorage (detail)')
  } catch (err) {
    logger.warn('⚠️ WorkoutDetail - beforeunload snapshot failed:', err)
  }
  e.preventDefault()
  e.returnValue = ''
}

onBeforeRouteLeave(async () => {
  await persistInProgressDraft('route-leave')
  return true
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  window.removeEventListener('pagehide', onPageHide)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
  if (!suppressDraftPersistence.value) {
    persistInProgressDraft('before-unmount').catch(() => {})
  }
  cleanupPointerDragListeners()
})
</script>

<style scoped>
.picker-container {
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: var(--surface);
}
.picker-container :deep(.exercise-list-root),
.picker-container :deep(.vue-recycle-scroller),
.picker-container :deep(.vue-recycle-scroller__item-wrapper) {
  overflow: visible !important;
}
.picker-list { padding: 12px 16px; }
.search-row.in-sheet { margin: 12px 16px; }
.exercises-list { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.exercise-item { background: var(--card-bg, #fff); border-radius: 12px; padding: 16px; border: 1px solid var(--card-border, #e5e7eb); box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px; }
.ex-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.exercise-item .title { font-weight: 700; color: var(--accent-color); font-size: 1.05rem; }
.exercise-item .sub { color: var(--muted); font-size: 0.9rem; }
.exercise-item .sub.small { font-size: 0.85rem; margin-left: auto; }
.exercises-list {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-bottom: 12px;
}
.exercise-item {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--card-border, #e5e7eb);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.exercise-item .title { font-weight: 700; color: var(--accent-color); font-size: 1.05rem; }
.exercise-item .sub { color: var(--muted); font-size: 0.9rem; }
.exercise-item .sub.small { font-size: 0.85rem; margin-left: auto; }
.picker-list { padding: 8px 4px; }
.picker-loading { text-align: center; padding: 16px; color: var(--muted); }
/* styles unchanged (same as provided) */
.workout-detail { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 80px; }
.content { padding: 0 clamp(14px, 3.5vw, 24px); }
.loading, .empty, .error { text-align: center; color: var(--muted); padding: 40px 0; }
.workout-header { margin-bottom: 16px; }
.workout-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
.meta { display: flex; gap: 8px; color: var(--muted); align-items: center; font-size: 0.9rem; }
.badge { background: var(--surface); padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; border: 1px solid var(--card-border); }
.completed { color: var(--success-color); }
.ex-list { background: transparent; border: 1px solid transparent; border-radius: 12px; padding: 12px; }
.ex-list input,
.ex-list button,
.ex-list textarea {
  font-size: 16px;
}
.ex-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ex-list-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; width: 100%; }
.ex-list-header h3 { margin: 0; font-size: 1.1rem; }
.reorder-toggle { background: var(--surface); color: var(--fg); border: 1px solid var(--card-border); border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem; }
.reorder-hint { color: var(--muted); margin: 0 0 8px; font-size: 0.85rem; }
.ex-item { padding: 10px 0; border-bottom: 1px solid var(--card-border); }
.ex-item:last-child { border-bottom: none; }
.ex-list.reordering { touch-action: pan-y; }
.ex-item.reordering { cursor: move; }
.ex-item.dragging { touch-action: none; }
.ex-item.dragging { opacity: 0.6; transform: scale(0.98); background: color-mix(in oklab, var(--accent) 10%, transparent); border-radius: 8px; }
.ex-item.drop-target { outline: 2px dashed color-mix(in oklab, var(--accent) 60%, transparent); outline-offset: 4px; background: color-mix(in oklab, var(--accent) 14%, transparent); border-radius: 8px; }
.media-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 22, 0.72);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 16px;
  max-width: min(90vw, 520px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.media-image {
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--card-border);
}
.drag-handle { background: transparent; border: none; color: var(--muted); cursor: grab; font-size: 16px; margin-right: 4px; padding: 0; }
.ex-sets { margin-top: 6px; }
.set-row { display: grid; grid-template-columns: 50px 1fr 1fr 60px; gap: 8px; align-items: center; padding: 4px 0; }
.set-row.header { color: var(--muted); font-size: 0.75rem; padding-top: 0; }
.set-row .col input { width: 100%; padding: 5px 6px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); text-align: center; font-size: 1rem; }
.weight-input { position: relative; }
.weight-input .unit { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.75rem; pointer-events: none; }
.row-actions { padding: 4px 0; }
.add-row-btn { background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 0.9rem; }
.remove-row-btn { background: var(--danger-color); color: var(--accent-contrast); border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; font-size: 1rem; }
.number-with-spinner { display: flex; align-items: center; gap: 6px; }
.spinner-vertical { display: flex; flex-direction: column; gap: 2px; }
.spin-btn { background: transparent; border: 1px solid var(--card-border); padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; line-height: 1; cursor: pointer; }
.spin-btn.up { transform-origin: center; }
.spin-btn.down { transform-origin: center; }
.spin-btn:active { transform: scale(0.98); }
.actions { margin-top: 12px; display: flex; gap: 8px; }
.primary { width: 100%; padding: 12px; border-radius: 10px; border: none; cursor: pointer; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
.add-exercise-btn {
  background: transparent;
  color: var(--accent);
  border: 2px solid var(--accent);
  font-weight: 700;
}
.add-exercise-btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.link.danger {
  color: var(--danger-color);
  border: 1px solid color-mix(in srgb, var(--danger-color) 45%, transparent);
  border-radius: 8px;
  padding: 4px 8px;
}
.remove-row-btn {
  background: var(--danger-color);
  border: 1px solid color-mix(in srgb, var(--danger-color) 68%, black 32%);
}
.banner { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.85rem; }
.banner.warning { background: color-mix(in oklab, var(--warning-color) 20%, transparent); border: 1px solid color-mix(in oklab, var(--warning-color) 50%, transparent); color: var(--fg); }
.banner.dirty { background: color-mix(in oklab, var(--warning-color) 16%, transparent); border: 1px solid color-mix(in oklab, var(--warning-color) 40%, transparent); color: var(--fg); margin-bottom: 6px; }
.banner .dismiss { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 0.9rem; padding: 0; }
.save-msg { display: block; margin-top: 6px; color: var(--success-color); font-size: 0.85rem; }
.save-msg.error { color: var(--danger-color); }
.ex-info { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.ex-info.minimal { align-items: center; gap: 12px; min-height: 48px; }
.ex-name-only { font-size: 1rem; font-weight: 600; }
.ex-thumb { width: 56px; height: 56px; flex-shrink: 0; object-fit: contain; background: var(--surface); border: 1px solid var(--card-border); border-radius: 8px; padding: 4px; cursor: pointer; }
.ex-text { flex: 1; min-width: 0; }
.ex-text strong { display: block; color: var(--fg); font-size: 0.95rem; }
.ex-text small { display: block; color: var(--muted); font-size: 0.8rem; margin-top: 2px; }
</style>