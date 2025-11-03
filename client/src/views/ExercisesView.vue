<template>
  <div class="exercises-view">
    <HeaderBar title="Übungen" />

    <div class="exercises-content">
      <h2>Übersicht aller Übungen:</h2>

      <!-- Schnellfilter -->
      <div class="quick-buttons">
        <button class="push-btn" @click="loadPushExercises">Push Day</button>
        <button class="pull-btn" @click="loadPullExercises">Pull Day</button>
        <button class="leg-btn" @click="loadLegExercises">Leg Day</button>
        <button class="all-btn" @click="loadAllExercises">Alle</button>
      </div>

      <!-- Aktiver Filterstatus -->
      <div v-if="selectedCategory || selectedMuscleGroup" class="filter-status">
        <span v-if="selectedCategory">Kategorie: {{ selectedCategory }}</span>
        <span v-if="selectedMuscleGroup">Muskelgruppe: {{ selectedMuscleGroup }}</span>
        <button class="reset-btn" @click="resetFilters">Reset</button>
      </div>

      <!-- Ladezustand -->
      <div v-if="loading" class="loading">Lade MongoDB-Übungen...</div>

      <!-- Keine Ergebnisse -->
      <div v-else-if="exercises.length === 0" class="no-exercises">
        Keine Übungen aus MongoDB gefunden. Backend prüfen!
      </div>

      <!-- Übungsliste (mit Thumbnail) -->
      <div v-else class="exercises-list">
        <div v-for="exercise in exercises" :key="exercise._id" class="exercise-card">
          <div class="thumb-row">
            <img :src="getExerciseImage(exercise)" alt="Bild der Übung" class="thumb" @error="onImgError($event, exercise)" />
            <div class="meta">
              <h3 class="title">{{ exercise.name }}</h3>
              <p class="sub">{{ exercise.category }} · {{ exercise.muscleGroup }}</p>
            </div>
          </div>
          <p v-if="exercise.description" class="description">{{ exercise.description }}</p>
          <p class="equip"><strong>Equipment:</strong> {{ exercise.equipment || 'Körpergewicht' }}</p>

          <div class="img-actions">
            <button class="img-btn" @click="pickImage(exercise)">Foto hinzufügen/ändern</button>
            <button v-if="exercise.imageUrl" class="img-btn danger" @click="removeImage(exercise)">Foto entfernen</button>
          </div>

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

const { isSignedIn } = useUser()
const clerk = useClerk()

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
    console.log('🔄 Lade MongoDB-Übungen von:', API_URL)

    const headers = {}
    if (isSignedIn.value && clerk.session) {
      try {
        const token = await clerk.session.getToken()
        if (token) headers.Authorization = `Bearer ${token}`
      } catch (err) {
        console.warn('⚠️ Konnte kein Token abrufen:', err)
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
      console.log(`🎯 Gefiltert für Kategorie ${selectedCategory.value}:`, filteredExercises.length)
    }

    // Filter: Muskelgruppe
    if (selectedMuscleGroup.value) {
      filteredExercises = filteredExercises.filter(
        e => e.muscleGroup === selectedMuscleGroup.value
      )
      console.log(`🎯 Gefiltert für Muskelgruppe ${selectedMuscleGroup.value}:`, filteredExercises.length)
    }

    exercises.value = filteredExercises
    console.log(`✅ ${filteredExercises.length} Übungen erfolgreich geladen!`)
  } catch (err) {
    console.error('❌ Fehler beim Laden der MongoDB-Übungen:', err.message)
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
  toast.show('Foto hochgeladen.', { type: 'success', duration: 3000, position: 'top' })
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
    toast.show('Foto entfernt.', { type: 'success', duration: 3000 })
  } catch (e) {
    toast.show('Entfernen fehlgeschlagen.', { type: 'error', duration: 3000 })
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
  padding-bottom: 80px;
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
}

.push-btn { background: var(--accent); color: var(--accent-contrast); }

.pull-btn { background: color-mix(in oklab, var(--accent-color) 40%, #4d8aff); color: #fff; }

.leg-btn { background: color-mix(in oklab, var(--accent-color) 40%, #3cb371); color: #fff; }

.all-btn { background: color-mix(in oklab, var(--accent-color) 20%, #666); color: #fff; }

.loading, .no-exercises { text-align: center; padding: 40px; color: var(--muted); }

.exercises-list {
  display: grid;
  gap: 16px;
}

.exercise-card { background: var(--card-bg); border-radius: 12px; padding: 16px; border: 1px solid var(--card-border); }

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
