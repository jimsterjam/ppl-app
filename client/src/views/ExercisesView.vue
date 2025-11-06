<template>
  <div class="exercises-view">
    <HeaderBar :title="t('exercises.title')" />

    <div class="exercises-content">
  <h2>{{ t('exercises.allTitle') }}</h2>

      <!-- Schnellfilter -->
      <div class="quick-buttons">
  <button class="push-btn" @click="loadPushExercises">{{ t('exercises.filters.pushDay') }}</button>
  <button class="pull-btn" @click="loadPullExercises">{{ t('exercises.filters.pullDay') }}</button>
  <button class="leg-btn" @click="loadLegExercises">{{ t('exercises.filters.legDay') }}</button>
  <button class="all-btn" @click="loadAllExercises">{{ t('exercises.filters.all') }}</button>
      </div>

      <!-- Aktiver Filterstatus -->
      <div v-if="selectedCategory || selectedMuscleGroup" class="filter-status">
  <span v-if="selectedCategory">{{ t('exercises.filters.category') }}: {{ selectedCategory }}</span>
  <span v-if="selectedMuscleGroup">{{ t('exercises.filters.muscleGroup') }}: {{ selectedMuscleGroup }}</span>
  <button class="reset-btn" @click="resetFilters">{{ t('exercises.filters.reset') }}</button>
      </div>

      <!-- Ladezustand -->
  <div v-if="loading" class="loading">{{ t('exercises.loading') }}</div>

      <!-- Keine Ergebnisse -->
      <div v-else-if="exercises.length === 0" class="no-exercises">
        {{ t('exercises.none') }}
      </div>

      <!-- Übungsliste (mit Thumbnail) -->
      <div v-else class="exercises-list">
  <div v-for="exercise in exercises" :key="exercise._id" class="exercise-card glass">
          <div class="thumb-row">
            <div class="thumb-wrapper">
              <button
                type="button"
                class="thumb-btn"
                :title="t('exercises.addOrChangePhoto')"
                :aria-label="t('exercises.addOrChangePhoto')"
                @click="pickImage(exercise)"
                @keydown.enter.prevent="pickImage(exercise)"
                @keydown.space.prevent="pickImage(exercise)"
              >
                <img :src="getExerciseImage(exercise)" :alt="t('common.image')" class="thumb" @error="onImgError($event, exercise)" />
              </button>
              <button
                v-if="exercise.imageUrl"
                type="button"
                class="thumb-remove"
                :title="t('exercises.removePhoto')"
                :aria-label="t('exercises.removePhoto')"
                @click.stop="removeImage(exercise)"
              >
                ×
              </button>
            </div>
            <div class="meta">
              <h3 class="title">{{ getTranslatedExerciseName(exercise.name) }}</h3>
              <p class="sub">{{ exercise.category }} · {{ exercise.muscleGroup }}</p>
            </div>
          </div>
          <p v-if="exercise.description" class="description">{{ exercise.description }}</p>
          <p class="equip"><strong>{{ t('exercises.equipment') }}:</strong> {{ exercise.equipment || t('exercises.bodyweight') }}</p>

          <!-- Bildaktionen jetzt direkt am Thumbnail: Klick = hinzufügen/ändern, Overlay = entfernen -->

        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useClerk, useUser } from '@clerk/vue'
import HeaderBar from '../components/HeaderBar.vue'
import BottomNav from '../components/BottomNav.vue'
import { deleteExerciseImage, uploadExerciseImage } from '@/api/exercises'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { logger } from '@/utils/logger'

const { isSignedIn } = useUser()
const clerk = useClerk()
const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const exercises = ref([])
const loading = ref(false)
const selectedCategory = ref('')
const selectedMuscleGroup = ref('')
const fileInput = ref(null)
const targetExerciseId = ref('')
const bust = ref({}) // Cache-Busting pro Übung nach Upload
const toast = useToastStore()

// Relative URL; in Dev routed über Vite-Proxy auf 3001
const API_URL = '/api/exercises'

// 🔄 Übungen laden
async function loadExercises() {
  loading.value = true
  try {
    logger.debug('🔄 Lade MongoDB-Übungen von:', API_URL)

    const headers = {}
    if (isSignedIn.value && clerk.session) {
      try {
        const token = await clerk.session.getToken()
        if (token) headers.Authorization = `Bearer ${token}`
      } catch (err) {
        logger.warn('⚠️ Konnte kein Token abrufen:', err)
      }
    }

    const res = await axios.get(API_URL, { headers, timeout: 10000 })
    let allExercises = res.data || []

    // Filter: Kategorie
    let filteredExercises = allExercises
    if (selectedCategory.value) {
      filteredExercises = filteredExercises.filter(
        e => e.category === selectedCategory.value
      )
      logger.debug(`🎯 Gefiltert für Kategorie ${selectedCategory.value}:`, filteredExercises.length)
    }

    // Filter: Muskelgruppe
    if (selectedMuscleGroup.value) {
      filteredExercises = filteredExercises.filter(
        e => e.muscleGroup === selectedMuscleGroup.value
      )
      logger.debug(`🎯 Gefiltert für Muskelgruppe ${selectedMuscleGroup.value}:`, filteredExercises.length)
    }

    exercises.value = filteredExercises
    logger.debug(`✅ ${filteredExercises.length} Übungen erfolgreich geladen!`)
  } catch (err) {
    logger.error('❌ Fehler beim Laden der MongoDB-Übungen:', err.message)
    exercises.value = []
  } finally {
    loading.value = false
  }
}

// 🔘 Filterfunktionen
function loadAllExercises() {
  selectedCategory.value = ''
  selectedMuscleGroup.value = ''
  loadExercises()
}

function loadPushExercises() {
  selectedCategory.value = 'Push'
  selectedMuscleGroup.value = ''
  loadExercises()
}

function loadPullExercises() {
  selectedCategory.value = 'Pull'
  selectedMuscleGroup.value = ''
  loadExercises()
}

function loadLegExercises() {
  selectedCategory.value = 'Legs'
  selectedMuscleGroup.value = ''
  loadExercises()
}

function resetFilters() {
  selectedCategory.value = ''
  selectedMuscleGroup.value = ''
  loadExercises()
}

// 🔁 Initiale Ladung
onMounted(() => loadAllExercises())

function ensureFileInput() {
  if (fileInput.value) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  input.style.display = 'none'
  input.addEventListener('change', onFileSelected)
  document.body.appendChild(input)
  fileInput.value = input
}

function pickImage(exercise) {
  targetExerciseId.value = exercise._id
  ensureFileInput()
  try {
    fileInput.value.setAttribute('accept', 'image/*')
    fileInput.value.setAttribute('capture', 'environment')
  } catch {}
  fileInput.value.click()
}

async function onFileSelected(e) {
  try {
    const files = e.target.files || []
    if (!files.length || !targetExerciseId.value) return
    const rawFile = files[0]
    const resized = await resizeImageFile(rawFile, 1280, 0.85).catch(() => rawFile)

    // Auth-Token (optional)
    let token = null
    if (isSignedIn.value && clerk.session) {
      try { token = await clerk.session.getToken() } catch {}
    }

    // Einheitlicher Upload mit Fallbacks (Multipart → Alias → JSON)
    await uploadExerciseImage(targetExerciseId.value, resized, token)
    // Cache-Busting für genau diese Übung
    bust.value = { ...bust.value, [targetExerciseId.value]: Date.now() }
    await loadExercises()
  toast.show(t('exercises.toastUploaded'), { type: 'success', duration: 3000, position: 'top' })
  } finally {
    if (fileInput.value) fileInput.value.value = ''
    targetExerciseId.value = ''
  }
}

async function removeImage(exercise) {
  if (!exercise?._id) return
  let token = null
  if (isSignedIn.value && clerk.session) {
    try { token = await clerk.session.getToken() } catch {}
  }
  try {
    await deleteExerciseImage(exercise._id, token)
    await loadExercises()
  toast.show(t('exercises.toastRemoved'), { type: 'success', duration: 3000 })
  } catch (e) {
  toast.show(t('exercises.toastRemoveFailed'), { type: 'error', duration: 3000 })
  }
}

function resizeImageFile(file, maxSize = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        if (blob) {
          const f = new File([blob], (file.name || 'upload').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
          resolve(f)
        } else {
          reject(new Error('Blob-Erzeugung fehlgeschlagen'))
        }
      }, 'image/jpeg', quality)
    }
    img.onerror = reject
    const reader = new FileReader()
    reader.onload = () => { img.src = reader.result }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Bildlogik analog ExerciseList / WorkoutBuilder
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
  const base = ex?.thumbnailUrl || ex?.imageUrl || ex?.mediaUrl || '/exercises/camera.svg'
  const id = ex?._id
  const stamp = id && bust.value?.[id] ? `?t=${bust.value[id]}` : ''
  return `${base}${stamp}`
}

function onImgError(evt, ex) {
  const img = evt?.target
  if (!img) return
  img.onerror = null
  img.src = '/exercises/camera.svg'
}
</script>

<style scoped>
.exercises-view {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 70px;
}

.exercises-content {
  padding: 16px;
}

.quick-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.quick-buttons button {
  flex: 1;
  padding: 12px 20px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px; /* iOS Touch-Target */
}

/* Kraftvolle Fitness-Farben */
.push-btn { 
  background: #DC2626; /* Kräftiges Rot */
  color: white;
}

.push-btn:hover { 
  background: #B91C1C; 
  transform: translateY(-1px);
}

.pull-btn { 
  background: #2563EB; /* Kräftiges Blau */
  color: white;
}

.pull-btn:hover { 
  background: #1D4ED8;
  transform: translateY(-1px);
}

.leg-btn { 
  background: #16A34A; /* Kräftiges Grün */
  color: white;
}

.leg-btn:hover { 
  background: #15803D;
  transform: translateY(-1px);
}

.all-btn { 
  background: #374151; /* Dunkles Grau */
  color: white;
}

.all-btn:hover { 
  background: #1F2937;
  transform: translateY(-1px);
}

/* Light Mode - kräftige Farben */
@media (prefers-color-scheme: light) {
  .push-btn { 
    background: #DC2626; /* Kräftiges Rot */
    color: white;
  }
  
  .pull-btn { 
    background: #2563EB; /* Kräftiges Blau */
    color: white;
  }
  
  .leg-btn { 
    background: #16A34A; /* Kräftiges Grün */
    color: white;
  }
  
  .all-btn { 
    background: #374151; /* Dunkles Grau */
    color: white;
  }
}

/* Dark Mode - noch intensivere Farben */
@media (prefers-color-scheme: dark) {
  .push-btn { 
    background: #EF4444; /* Leuchtend Rot */
    color: white;
  }
  
  .pull-btn { 
    background: #3B82F6; /* Leuchtend Blau */
    color: white;
  }
  
  .leg-btn { 
    background: #22C55E; /* Leuchtend Grün */
    color: white;
  }
  
  .all-btn { 
    background: #6B7280; /* Helles Grau */
    color: white;
  }
}

.loading, .no-exercises { text-align: center; padding: 40px; color: var(--muted); }

.exercises-list {
  display: grid;
  gap: 16px;
}

.exercise-card { background: transparent; border-radius: 12px; padding: 16px; border: 1px solid transparent; }

.exercise-card h3 { margin: 0 0 8px 0; color: var(--accent-color); font-size: 1.1rem; }

.exercise-card p { margin: 4px 0; font-size: 0.9rem; color: var(--muted); }

.img-actions { display: flex; gap: 8px; margin-top: 10px; }
.img-btn { padding: 8px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); cursor: pointer; font-weight: 600; }
.img-btn:hover { background: var(--accent-soft); }
.img-btn.danger { border-color: var(--danger-color); color: var(--danger-color); }

.description { color: var(--muted) !important; font-style: italic; }

.filter-status {
  margin-bottom: 16px;
}

.filter-status span {
  display: inline-block;
  margin-right: 12px;
  font-weight: 600;
}

.reset-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--accent-color); background: transparent; color: var(--accent-color); cursor: pointer; }
.reset-btn:hover { background: var(--accent-soft); }

/* Thumbnail-Styles */
.thumb-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.thumb-wrapper { position: relative; display: inline-block; }
.thumb-btn { padding: 0; margin: 0; border: none; background: transparent; cursor: pointer; border-radius: 10px; }
.thumb-btn:focus { outline: 2px solid var(--accent-color); outline-offset: 2px; }
.thumb {
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  object-fit: contain;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  padding: 6px;
}
.thumb-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--danger-color);
  background: var(--bg);
  color: var(--danger-color);
  font-weight: 700;
  line-height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.meta { display: flex; flex-direction: column; min-width: 0; }
.title { margin: 0; line-height: 1.2; }
.sub { color: var(--muted); font-size: 0.9rem; }
.equip, .id { color: var(--muted); font-size: 0.85rem; }

/* Mobile: Thumbnail rechts und größer */
@media (max-width: 480px) {
  .thumb-row { flex-direction: row-reverse; justify-content: space-between; }
  .thumb { width: 84px; height: 84px; flex-basis: 84px; }
  .meta { flex: 1 1 auto; }
}
</style>
