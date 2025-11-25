<template>
  <div class="exercises-view">
    <HeaderBar :title="t('exercises.title')" />

    <div class="exercises-content">
  <h2>{{ t('exercises.allTitle') }}</h2>

      <!-- Schnellfilter -->
      <div class="quick-buttons">
        <button class="push-btn" :class="selectedCategory === 'Push' ? 'active' : ''" @click="loadPushExercises">{{ t('exercises.filters.pushDay') }}</button>
        <button class="pull-btn" :class="selectedCategory === 'Pull' ? 'active' : ''" @click="loadPullExercises">{{ t('exercises.filters.pullDay') }}</button>
        <button class="leg-btn" :class="selectedCategory === 'Legs' ? 'active' : ''" @click="loadLegExercises">{{ t('exercises.filters.legDay') }}</button>
        <button class="all-btn" :class="!selectedCategory && !selectedEquipment ? 'active' : ''" @click="loadAllExercises">{{ t('exercises.filters.all') }}</button>
      </div>
      <!-- Equipment-Filter (klein) -->
  <div class="equipment-filter-row">
          <button
            class="px-2 py-1 rounded text-xs font-semibold text-white" style="min-width:120px"
            :class="selectedEquipment === 'bodyweight' ? 'bg-blue-500' : 'bg-gray-400 hover:bg-gray-500'"
            @click="setEquipment('bodyweight')"
          >
            {{ t('exercises.filters.bodyweight') }}
          </button>
          <button
            class="px-2 py-1 rounded text-xs font-semibold text-white" style="min-width:120px"
            :class="selectedEquipment === 'gym' ? 'bg-blue-500' : 'bg-gray-400 hover:bg-gray-500'"
            @click="setEquipment('gym')"
          >
            {{ t('exercises.filters.gym') }}
          </button>
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
  <div v-else-if="(exercises && exercises.length === 0)" class="no-exercises">
        {{ t('exercises.none') }}
      </div>

      <!-- Übungsliste (mit Thumbnail) -->
  <div v-else-if="exercises && exercises.length" class="exercises-list">
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
              <div style="display: flex; align-items: center; gap: 6px;">
                <h3 class="title" style="margin-bottom:0;">{{ getTranslatedExerciseName(exercise.name) }}</h3>
                <button class="info-btn" :aria-label="t('exercises.info')" @click="showInfo(exercise)">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="#888" stroke-width="2"/><rect x="9" y="8" width="2" height="6" rx="1" fill="#888"/><rect x="9" y="5" width="2" height="2" rx="1" fill="#888"/></svg>
                </button>
              </div>
              <p class="sub">{{ exercise.category }} · {{ exercise.muscleGroup }}</p>
            </div>
          </div>
          <p class="equip"><strong>{{ t('exercises.equipment') }}:</strong> {{ exercise.equipment || t('exercises.bodyweight') }}</p>
        </div>
      </div>
      <!-- Info Overlay (außerhalb der v-for) -->
      <div v-if="infoExercise" class="info-overlay" @click.self="closeInfo">
        <div class="info-content">
          <h3>{{ getTranslatedExerciseName(infoExercise.name) }}</h3>
          <p>{{ getTranslatedDescription(infoExercise) }}</p>
          <button class="close-btn" @click="closeInfo">OK</button>
        </div>
      </div>



    <BottomNav />
  </div>
</div>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { useToastStore } from '@/stores/toastStore'
import { logger } from '@/utils/logger'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
// import { fetchExercises, uploadExerciseImage, deleteExerciseImage } from '@/api/exercises'

// Komponenten explizit registrieren (für <script setup> reicht der Import)

// Reaktive Variablen für das Template
const selectedCategory = ref('')
const selectedEquipment = ref('')
const selectedMuscleGroup = ref('')
const loading = ref(false)
const exercises = ref([])
const infoExercise = ref(null)
const fileInput = ref(null)
// Info-Overlay Methoden
function showInfo(exercise) {
  infoExercise.value = exercise
}
function closeInfo() {
  infoExercise.value = null
}
function getTranslatedDescription(exercise) {
  if (!exercise) return ''
  if (t && t.locale && t.locale.value === 'en') {
    return exercise.description_en || exercise.description || ''
  }
  return exercise.description || exercise.description_en || ''
}
const targetExerciseId = ref('')
const bust = ref({})

const { onAuthStateChanged } = useFirebaseAuth()
const firebaseUser = ref(null)
const isSignedIn = computed(() => !!firebaseUser.value)
onAuthStateChanged((user) => {
  firebaseUser.value = user
})
const { t } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()


const toast = useToastStore()

// 🔄 Übungen direkt aus default-exercises.json laden (offlinefähig)
import defaultExercises from '@/data/default-exercises.json'
function loadExercises() {
  loading.value = true
  try {
    logger.debug('🔄 Lade Exercises aus default-exercises.json')
    let allExercises = Array.isArray(defaultExercises) ? defaultExercises : (defaultExercises?.default || [])
    // Filter anwenden
    if (selectedCategory.value) {
      allExercises = allExercises.filter(ex => ex.category === selectedCategory.value)
    }
    if (selectedMuscleGroup.value) {
      allExercises = allExercises.filter(ex => ex.muscleGroup === selectedMuscleGroup.value)
    }
    if (selectedEquipment.value === 'bodyweight') {
      allExercises = allExercises.filter(ex => (
        ex.equipment === 'Körpergewicht' ||
        ex.equipment === 'Bodyweight' ||
        ex.equipment_en === 'Bodyweight' ||
        ex.equipment_en === 'Körpergewicht'
      ))
    } else if (selectedEquipment.value === 'gym') {
      allExercises = allExercises.filter(ex => !(
        ex.equipment === 'Körpergewicht' ||
        ex.equipment === 'Bodyweight' ||
        ex.equipment_en === 'Bodyweight' ||
        ex.equipment_en === 'Körpergewicht'
      ))
    }
    // Füge _id hinzu, falls nicht vorhanden (für v-for key)
    allExercises = allExercises.map((ex, idx) => ({ _id: ex._id || idx, ...ex }))
    exercises.value = allExercises
    logger.debug(`✅ ${exercises.value.length} Übungen geladen (Filter:`, selectedCategory.value, selectedMuscleGroup.value, selectedEquipment.value, ')')
  } catch (err) {
    logger.error('❌ Fehler beim Laden der Übungen:', err.message)
    exercises.value = []
  } finally {
    loading.value = false
  }
}

// 🔘 Filterfunktionen

function loadAllExercises() {
  selectedCategory.value = ''
  selectedEquipment.value = ''
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
  selectedEquipment.value = ''
  selectedMuscleGroup.value = ''
  loadExercises()
}

function setEquipment(equip) {
  selectedEquipment.value = equip
  loadExercises()
}

onMounted(() => {
  loadAllExercises()
})

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

    // OFFLINE: Speichere Foto lokal als Base64 in IndexedDB
    if (!navigator.onLine) {
      const dataUrl = await fileToDataURL(resized)
      
      // Finde Exercise in Cache und aktualisiere mit lokalem Foto
      const exercise = await db.exercises.get(targetExerciseId.value)
      if (exercise) {
        exercise.imageUrl = dataUrl
        exercise._pendingImageSync = true // Markiere für späteren Upload
        exercise._offlineImageData = dataUrl // Speichere für Sync
        await db.exercises.put(exercise)
        
        logger.debug('📸 Offline: Foto lokal gespeichert für Exercise:', targetExerciseId.value)
        bust.value = { ...bust.value, [targetExerciseId.value]: Date.now() }
        await loadExercises()
        toast.show('📸 Foto offline gespeichert - wird später hochgeladen', { 
          type: 'info', 
          duration: 3000, 
          position: 'top' 
        })
      }
      return
    }

    // ONLINE: Direkter Upload zum Backend

    let token = null
    // Warte auf Clerk-Initialisierung und Login
    logger.debug('Clerk loaded:', window.Clerk?.loaded, 'isSignedIn:', isSignedIn.value)
    if (window.Clerk?.loaded && isSignedIn.value) {
      try {
        token = await getAuthToken({ clerk, auth })
      } catch (err) {
        logger.warn('⚠️ Token-Abruf fehlgeschlagen:', err.message)
      }
    } else {
      logger.warn('⚠️ Clerk noch nicht bereit oder User nicht eingeloggt')
    }

    await uploadExerciseImage(targetExerciseId.value, resized, token)
    bust.value = { ...bust.value, [targetExerciseId.value]: Date.now() }
    await loadExercises()
    toast.show(t('exercises.toastUploaded'), { type: 'success', duration: 3000, position: 'top' })
  } catch (err) {
    logger.error('❌ Fehler beim Foto-Upload:', err)
    toast.show(t('exercises.toastUploadFailed') || 'Foto-Upload fehlgeschlagen', { 
      type: 'error', 
      duration: 3000 
    })
  } finally {
    if (fileInput.value) fileInput.value.value = ''
    targetExerciseId.value = ''
  }
}

async function removeImage(exercise) {
  if (!exercise?._id) return
  
  // OFFLINE: Entferne Foto nur lokal aus Cache
  if (!navigator.onLine) {
    try {
      const cachedExercise = await db.exercises.get(exercise._id)
      if (cachedExercise) {
        cachedExercise.imageUrl = null
        cachedExercise._pendingImageSync = false
        cachedExercise._offlineImageData = null
        await db.exercises.put(cachedExercise)
        
        logger.debug('🗑️ Offline: Foto lokal entfernt für Exercise:', exercise._id)
        bust.value = { ...bust.value, [exercise._id]: Date.now() }
        await loadExercises()
        toast.show('🗑️ Foto offline entfernt', { type: 'info', duration: 3000 })
      }
    } catch (err) {
      logger.error('❌ Fehler beim lokalen Entfernen:', err)
      toast.show('Foto konnte nicht entfernt werden', { type: 'error', duration: 3000 })
    }
    return
  }
  
  // ONLINE: Backend-Delete
  let token = null
  logger.debug('Clerk loaded:', window.Clerk?.loaded, 'isSignedIn:', isSignedIn.value)
  if (window.Clerk?.loaded && isSignedIn.value) {
    try { token = await getAuthToken({ clerk, auth }) } catch {}
  } else {
    logger.warn('⚠️ Clerk noch nicht bereit oder User nicht eingeloggt')
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

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
  
  // Verhindere Endlosschleife: Wenn src schon camera.svg ist, nicht nochmal setzen
  if (img.src.includes('camera.svg')) {
    img.onerror = null
    return
  }
  
  img.onerror = null
  img.src = '/exercises/camera.svg'
}
</script>
<style scoped>
.info-btn {
  background: none;
  border: none;
  padding: 0 2px;
  margin-left: 2px;
  cursor: pointer;
  vertical-align: middle;
  border-radius: 50%;
  transition: background 0.15s;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.info-btn:hover {
  background: #e5e7eb;
}
.info-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.info-content {
  background: var(--card-bg, #fff);
  color: var(--fg, #222);
  border-radius: 14px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  padding: 28px 22px 18px 22px;
  max-width: 340px;
  width: 90vw;
  text-align: center;
  position: relative;
}
.info-content h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.15rem;
}
.info-content p {
  font-size: 1rem;
  margin-bottom: 18px;
}
.close-btn {
  background: #2563EB;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 18px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.15s;
}
.close-btn:hover {
  background: #1D4ED8;
}
</style>

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

/* Equipment-Filter Buttons: gleichmäßig verteilt */
.equipment-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 1rem;
  /* margin-left: 0.25rem; */
  justify-content: space-evenly;
}

.equipment-filter-row button {
  min-width: 120px;
  max-width: 140px;
}

/* Mobile: Thumbnail rechts und größer */
@media (max-width: 480px) {
  .thumb-row { flex-direction: row-reverse; justify-content: space-between; }
  .thumb { width: 84px; height: 84px; flex-basis: 84px; }
  .meta { flex: 1 1 auto; }
}
</style>


