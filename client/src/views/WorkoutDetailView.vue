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

        <div id="exercises" ref="exListRef" class="ex-list glass">

          <div class="ex-list-header">
            <!-- <h3>{{ t('workoutDetail.exercises') }}</h3> -->
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="primary" style="padding: 6px 12px; font-size: 0.95em;" @click="showAddExerciseModal = true">
                + {{ t('workoutDetail.addExercise') }}
              </button>
              <button class="reorder-toggle" :aria-pressed="isReordering" @click="toggleReorder">
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
        <ExercisePicker
          :exercises="allExercises"
          :loading="exercisesLoading"
          :showHeader="false"
          :showClose="false"
          :showSearch="true"
          :showDone="true"
          :title="t('workoutDetail.addExercise')"
          :searchPlaceholder="t('exercises.searchPlaceholder') || 'Suchen…'"
          :bodyweightLabel="t('exercises.bodyweight')"
          :doneLabel="t('common.done')"
          :translateName="getTranslatedExerciseName"
          :translateMuscle="getTranslatedMuscleGroup"
          @select="selectExerciseToAdd"
          @done="showAddExerciseModal = false"
        />
      </div>
    </AppModal>

          <div v-if="isDirty" class="banner dirty">{{ t('workoutDetail.unsaved') }}</div>
          <p v-if="isReordering" class="reorder-hint">{{ t('workoutDetail.reorderHint') }}</p>

          <div
            v-for="(ex, i) in workout.exercises || []"
            :key="ex.exerciseId || i"
            class="ex-item"
            :class="{ reordering: isReordering }"
            :draggable="isReordering"
            @dragstart="onDragStart(i)"
            @dragover.prevent="onDragOver(i)"
            @drop.prevent="onDrop(i)"
          >
            <button v-if="isReordering" class="drag-handle" :title="t('workoutDetail.dragToReorder')">⋮⋮</button>
            <div class="ex-info">
              <img :src="getExerciseImage(ex)" :alt="getTranslatedExerciseName(ex.name)" class="ex-thumb" @error="onImgError" />
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
              </div>
            </div>

            <div class="ex-sets">
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
                        step="0.125"
                        inputmode="decimal"
                        :readonly="isMobile"
                        @input="() => { clampRowValue(row, 'weight', 0, 1000, 0.125); triggerAutoSave() }"
                        @wheel.prevent="onNumberWheel($event, row, 'weight', 0.125, 0, 1000)"
                        @keydown="onNumberKeyDown($event, true)"
                        @focus.prevent="openPicker(row, 'weight', 0.125, 0, 1000)"
                        @click.prevent="openPicker(row, 'weight', 0.125, 0, 1000)"
                      />
                      <div v-if="!isMobile" class="spinner-vertical">
                        <button
                          type="button"
                          class="spin-btn up"
                          aria-label="increment weight"
                          @click="adjustRowField(row, 'weight', 1, 0.125, 0, 1000)"
                          @mousedown="startSpin(row, 'weight', 1, 0.125, 0, 1000)"
                          @mouseup="stopSpin(row, 'weight')"
                          @mouseleave="stopSpin(row, 'weight')"
                          @touchstart.prevent="startSpin(row, 'weight', 1, 0.125, 0, 1000)"
                          @touchend.prevent="stopSpin(row, 'weight')"
                          @touchcancel.prevent="stopSpin(row, 'weight')"
                        >▲</button>
                        <button
                          type="button"
                          class="spin-btn down"
                          aria-label="decrement weight"
                          @click="adjustRowField(row, 'weight', -1, 0.125, 0, 1000)"
                          @mousedown="startSpin(row, 'weight', -1, 0.125, 0, 1000)"
                          @mouseup="stopSpin(row, 'weight')"
                          @mouseleave="stopSpin(row, 'weight')"
                          @touchstart.prevent="startSpin(row, 'weight', -1, 0.125, 0, 1000)"
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
let selectedExerciseToAdd = null
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
})

function selectExerciseToAdd(ex) {
  selectedExerciseToAdd = ex
  onAddExerciseConfirm()
}

function onAddExerciseConfirm() {
  if (!selectedExerciseToAdd) return
  // Füge die Übung ans Workout an (mit Default-Sets)
  if (!workout.value.exercises) workout.value.exercises = []
  // Verhindere Duplikate (optional)
  if (workout.value.exercises.some(e => e.exerciseId === selectedExerciseToAdd._id)) {
    toast.show('Übung bereits hinzugefügt', { type: 'warning', duration: 2000 })
    showAddExerciseModal.value = false
    selectedExerciseToAdd = null
    return
  }
  workout.value.exercises.push({
    exerciseId: selectedExerciseToAdd._id,
    name: selectedExerciseToAdd.name,
    muscleGroup: selectedExerciseToAdd.muscleGroup,
    setDetails: [{ reps: 10, weight: 0 }],
    note: ''
  })
  showAddExerciseModal.value = false
  selectedExerciseToAdd = null
  ensureSetDetailsStructure()
  try { triggerAutoSave() } catch {}
  toast.show('Übung hinzugefügt', { type: 'success', duration: 1500 })
}
import { ref, onMounted, onBeforeUnmount, watch, nextTick, reactive } from 'vue'
import NumberPicker from '@/components/NumberPicker.vue'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { useRoute, useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { getWorkoutOffline, getExerciseOffline, getAllExercisesOffline, saveWorkoutOffline } from '@/utils/offlineStorage'
// import { fetchWorkout } from '@/api/workouts'
// import { fetchExercise, fetchExercises } from '@/api/exercises'
import { useUserStore } from '@/stores/userStore'
import HeaderBar from '@/components/HeaderBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'
import ExercisePicker from '@/components/ExercisePicker.vue'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

const userStore = useUserStore()
function getDetailDraftKey() {
  const userId = userStore?.user?.id || userStore?.user?._id || 'guest'
  return `workout_detail_draft_${userId}`
}
const DETAIL_DRAFT_KEY = getDetailDraftKey()

const route = useRoute()
const router = useRouter()
const { getIdToken } = useFirebaseAuth()

const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()
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
const isReordering = ref(false)
const draggingIndex = ref(null)
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

// Debounce Hilfsfunktion
function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// Debounced Auto-Save Funktion (muss vor Aufrufen deklariert sein)
const triggerAutoSave = debounce(async () => {
  const id = route.params.id
  const w = workout.value || {}

  // Übernehme alle aktuellen Notizen ins Workout-Objekt
  if (Array.isArray(w.exercises) && Array.isArray(exerciseNotes.value)) {
    w.exercises = w.exercises.map((ex, idx) => ({
      ...ex,
      note: typeof exerciseNotes.value[idx] === 'string' ? exerciseNotes.value[idx] : ex.note || ''
    }))
  }

  try {
    if (id === 'draft') {
      const draftKey = getDetailDraftKey()
      await saveWorkoutOffline({ ...w, _id: draftKey, isDraft: true, updatedAt: Date.now() })
      saveMsg.value = 'Auto-gespeichert (Entwurf lokal).'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...w })
      logger.debug('Draft gespeichert (draft):', { ...w, _id: 'draft' })
    } else if (String(id).startsWith('draft-')) {
      const idx = store.workouts.findIndex(wi => wi._id === id)
      if (idx !== -1) {
        store.workouts[idx] = { ...store.workouts[idx], ...w }
      }
      saveMsg.value = 'Auto-gespeichert (Entwurf lokal).'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...store.workouts[idx] })
    } else {
      let token = await getIdToken().catch(() => null)
      await store.updateWorkout(route.params.id, w, token)
      saveMsg.value = 'Auto-gespeichert.'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...w })
    }
  } catch (e) {
    logger.error('Auto-Save fehlgeschlagen:', e)
    saveMsg.value = 'Auto-Save fehlgeschlagen.'
    saveError.value = true
  }
}, 600)

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
      workout.value = store.workouts.find(w => w._id === id) || (await getWorkoutOffline(id)) || null
      ensureSetDetailsStructure()
      await enrichExerciseImages()
      initialSnapshot = snapshotCore(workout.value)
      return
    }

    // Normale Workouts: immer offline laden
    workout.value = await getWorkoutOffline(id)
    ensureSetDetailsStructure()
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
        if (full?.imageUrl || full?.thumbnailUrl) {
          ex.imageUrl = full.imageUrl
          ex.thumbnailUrl = full.thumbnailUrl
        }
      } catch {}
    }
  } catch {}
}

function getExerciseImage(ex) {
  return ex?.thumbnailUrl || ex?.imageUrl || '/exercises/play.svg'
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
    saving.value = true
    const id = route.params.id
    const w = workout.value || {}
    const normalized = {
      name: w.name,
      type: w.type,
      date: w.date,
      completed: true,
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

    // Nach dem Speichern: Draft aus sessionStorage entfernen
    const userId = store?.user?.id || store?.user?._id || 'guest'
    const detailDraftKey = `workout_detail_draft_${userId}`

    if (String(id).startsWith('draft-')) {
      const idx = store.workouts.findIndex(wi => wi._id === id)
      if (idx !== -1) {
        store.workouts[idx] = { ...store.workouts[idx], ...normalized }
      }
      saveMsg.value = 'Gespeichert (Entwurf lokal).'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...store.workouts[idx] })
      try { await db.workouts.delete('draft') } catch {}
      try { sessionStorage.removeItem(detailDraftKey) } catch {}
      router.push('/dashboard')
      return
    }

    let token = await getIdToken().catch(() => null)
    await store.updateWorkout(id, normalized, token)
    saveMsg.value = 'Gespeichert.'
    saveError.value = false
    initialSnapshot = snapshotCore({ ...w, ...normalized })
    try { await db.workouts.delete('draft'); } catch {}
    try { sessionStorage.removeItem(detailDraftKey); } catch {}
    router.push('/dashboard')
  } catch (e) {
    error.value = e?.message || 'Speichern fehlgeschlagen'
    saveMsg.value = 'Speichern fehlgeschlagen.'
    saveError.value = true
  } finally {
    saving.value = false
  }
}

function onDragStart(index) { if (!isReordering.value) return; draggingIndex.value = index }
function onDragOver(_index) { /* optional visual */ }
function onDrop(index) {
  if (!isReordering.value) return
  const from = draggingIndex.value
  const to = index
  if (from === null || to === null || from === to) return
  const list = workout.value?.exercises
  if (!Array.isArray(list)) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  draggingIndex.value = null
}

// Watchers for auto-scroll and dirty tracking
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
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
  // Speichere Draft sofort in sessionStorage, damit Dashboard-Resume immer aktuell ist
  try {
    const snapshot = w ? { ...w, timestamp: Date.now() } : null
    if (snapshot) sessionStorage.setItem(DETAIL_DRAFT_KEY, JSON.stringify(snapshot))
  } catch {}
}, { deep: true })

// Warnung beim Schließen/Reload
function beforeUnloadHandler(e) {
  if (!isDirty.value) return
  try {
    const snapshot = { workout: workout.value || null, timestamp: Date.now() }
    try { sessionStorage.setItem(DETAIL_DRAFT_KEY, JSON.stringify(snapshot)) } catch {}
    logger.debug('beforeunload snapshot saved to sessionStorage (detail)')
  } catch (err) {
    logger.warn('⚠️ WorkoutDetail - beforeunload snapshot failed:', err)
  }
  e.preventDefault()
  e.returnValue = ''
}

onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadHandler))
</script>

<style scoped>
.picker-container { max-height: 80vh; overflow: auto; }
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
.content { padding: 16px; }
.loading, .empty, .error { text-align: center; color: var(--muted); padding: 40px 0; }
.workout-header { margin-bottom: 16px; }
.workout-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
.meta { display: flex; gap: 8px; color: var(--muted); align-items: center; font-size: 0.9rem; }
.badge { background: var(--surface); padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; border: 1px solid var(--card-border); }
.completed { color: #4ade80; }
.ex-list { background: transparent; border: 1px solid transparent; border-radius: 12px; padding: 12px; }
.ex-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ex-list-header h3 { margin: 0; font-size: 1.1rem; }
.reorder-toggle { background: var(--surface); color: var(--fg); border: 1px solid var(--card-border); border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem; }
.reorder-hint { color: var(--muted); margin: 0 0 8px; font-size: 0.85rem; }
.ex-item { padding: 10px 0; border-bottom: 1px solid var(--card-border); }
.ex-item:last-child { border-bottom: none; }
.ex-item.reordering { cursor: move; }
.drag-handle { background: transparent; border: none; color: var(--muted); cursor: grab; font-size: 16px; margin-right: 4px; padding: 0; }
.ex-sets { margin-top: 6px; }
.set-row { display: grid; grid-template-columns: 50px 1fr 1fr 60px; gap: 8px; align-items: center; padding: 4px 0; }
.set-row.header { color: var(--muted); font-size: 0.75rem; padding-top: 0; }
.set-row .col input { width: 100%; padding: 5px 6px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); text-align: center; font-size: 0.9rem; }
.weight-input { position: relative; }
.weight-input .unit { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.75rem; pointer-events: none; }
.row-actions { padding: 4px 0; }
.add-row-btn { background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 0.9rem; }
.remove-row-btn { background: var(--danger-color); color: #fff; border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; font-size: 1rem; }
.number-with-spinner { display: flex; align-items: center; gap: 6px; }
.spinner-vertical { display: flex; flex-direction: column; gap: 2px; }
.spin-btn { background: transparent; border: 1px solid var(--card-border); padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; line-height: 1; cursor: pointer; }
.spin-btn.up { transform-origin: center; }
.spin-btn.down { transform-origin: center; }
.spin-btn:active { transform: scale(0.98); }
.actions { margin-top: 12px; display: flex; gap: 8px; }
.primary { width: 100%; padding: 12px; border-radius: 10px; border: none; cursor: pointer; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
.banner { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.85rem; }
.banner.warning { background: color-mix(in oklab, var(--warning-color) 20%, transparent); border: 1px solid color-mix(in oklab, var(--warning-color) 50%, transparent); color: var(--fg); }
.banner.dirty { background: rgba(244,114,182,0.12); border: 1px solid rgba(244,114,182,0.4); color: #fbcfe8; margin-bottom: 6px; }
.banner .dismiss { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 0.9rem; padding: 0; }
.save-msg { display: block; margin-top: 6px; color: var(--success-color); font-size: 0.85rem; }
.save-msg.error { color: var(--danger-color); }
.ex-info { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.ex-thumb { width: 56px; height: 56px; flex-shrink: 0; object-fit: contain; background: #0b1220; border: 1px solid var(--card-border); border-radius: 8px; padding: 4px; cursor: pointer; }
.ex-text { flex: 1; min-width: 0; }
.ex-text strong { display: block; color: var(--fg); font-size: 0.95rem; }
.ex-text small { display: block; color: var(--muted); font-size: 0.8rem; margin-top: 2px; }
</style>
