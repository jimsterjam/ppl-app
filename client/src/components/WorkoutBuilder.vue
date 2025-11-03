<template>
  <div class="workout-builder">
    <!-- Glaubenssatz / Affirmation vor dem Plan -->
    <AppModal
      v-model="showBelief"
      :title="'Kurzer Impuls'"
      :message="beliefText"
      confirm-text="Weiter"
      :show-cancel="false"
      :persistent="true"
      type="info"
      @confirm="continuePlan"
    />
    <!-- Oben immer sichtbarer Zurück-Button -->
    <div class="builder-topbar">
      <button class="back-top-btn" title="Zurück zum Dashboard" @click="goDashboard">← Zurück</button>
      <h2>Workout erstellen</h2>
    </div>

    <!-- Step Indicator -->
    <StepIndicator :active="activeStep" />


    <!-- Auth-Gate: Ohne Login keine Builder-UI -->
    <div v-if="!isSignedIn" class="auth-gate">
      <p class="auth-gate-text">Du musst angemeldet sein, um ein Workout zu erstellen.</p>
      <p class="auth-hint">Bitte melde dich auf der Welcome-Seite an.</p>
    </div>
    
    <!-- Workout-Typ Auswahl (Dropdown) -->
    <div v-else class="type-select">
      <label for="wb-type" class="type-label">Typ</label>

      <!-- Mobile: gleiches Design wie Übungen (Button + Bottom-Sheet) -->
      <div v-if="isMobile" class="mobile-ex-picker">
        <button class="open-picker-btn" @click="showTypePicker = true">
          {{ currentTypeLabel ? `Typ: ${currentTypeLabel}` : 'Typ auswählen' }}
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
          <h4>Workout-Typ auswählen</h4>
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
          <button class="done-btn" @click="showTypePicker = false">Fertig</button>
        </div>
      </div>
    </div>

    <!-- Übungen für gewählten Typ -->
    <div v-if="isSignedIn" class="exercises-section">
      <h3>Verfügbare {{ currentTypeLabel }} Übungen</h3>

      <!-- Mobile: Öffne Dropdown -->
      <div v-if="isMobile" class="mobile-ex-picker">
        <button class="open-picker-btn" @click="showMobilePicker = true">Übungen auswählen</button>
      </div>

      <template v-if="!isMobile">
      <!-- Suche -->
      <div class="search-row">
        <input
          v-model="search"
          class="search-input"
          type="search"
          placeholder="Übung suchen…"
          aria-label="Übung suchen"
        />
      </div>

      <!-- Skeleton während Loading -->
      <div v-if="loading" class="exercises-grid">
        <div v-for="n in 6" :key="n" class="exercise-item sk"></div>
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
            <img :src="getExerciseImage(exercise)" alt="Bild der Übung" class="thumb" @error="onImgError($event, exercise)" />
            <div class="meta">
              <h4 class="title">{{ exercise.name }}</h4>
              <p class="sub">{{ exercise.muscleGroup }}</p>
              <p class="sub small">{{ exercise.equipment || 'Körpergewicht' }}</p>
            </div>
          </div>
        </div>
      </div>
      </template>

  <!-- Mobile Dropdown Top-Sheet -->
      <div v-if="isMobile && showMobilePicker" class="picker-overlay" @click.self="showMobilePicker = false">
        <div class="picker-sheet">
          <div class="picker-header">
            <h4>Übungen auswählen</h4>
            <button class="close-picker" @click="showMobilePicker = false">✕</button>
          </div>
          <div class="search-row in-sheet">
            <input
              v-model="search"
              class="search-input"
              type="search"
              placeholder="Übung suchen…"
              aria-label="Übung suchen"
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
                  <img :src="getExerciseImage(exercise)" alt="Bild der Übung" class="thumb" @error="onImgError($event, exercise)" />
                  <div class="meta">
                    <h4 class="title">{{ exercise.name }}</h4>
                    <p class="sub">{{ exercise.muscleGroup }}</p>
                    <p class="sub small">{{ exercise.equipment || 'Körpergewicht' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="picker-actions">
            <button class="done-btn" @click="showMobilePicker = false">Fertig</button>
          </div>
        </div>
      </div>

      <!-- Ausgewählte Übungen -->
      <div v-if="selectedExercises.length > 0" id="workout-plan" ref="planRef" class="selected-exercises">
        <h3>Workout Plan ({{ selectedExercises.length }} Übungen)</h3>

        <p class="reorder-hint">Tipp: Ziehe die Griffe, um die Reihenfolge zu ändern.</p>

        <div
          v-for="(exercise, index) in selectedExercises"
          :key="exercise._id"
          class="selected-exercise"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover.prevent="onDragOver(index)"
          @drop.prevent="onDrop(index)"
        >
          <button class="drag-handle" aria-label="Reihenfolge ändern" title="Ziehen zum Umordnen">⋮⋮</button>
          <div class="sel-row">
            <img :src="getExerciseImage(exercise)" alt="Bild der Übung" class="thumb small" @error="onImgError($event, exercise)" />
            <span class="ex-name">{{ exercise.name }}</span>
          </div>
          <!-- Mini-Plan pro Übung: Sätze/Reps/Gewicht -->
          <div class="sets-editor">
            <div class="set-list">
              <div v-for="(set, sIdx) in exercise.setDetails" :key="sIdx" class="set-row">
                <span class="set-label">#{{ sIdx + 1 }}</span>
                <label class="set-field">
                  <span>Wdh</span>
                  <input type="number" min="1" max="50" :value="set.reps || 10" @input="updateSet(index, sIdx, 'reps', $event.target.value)" />
                </label>
                <label class="set-field">
                  <span>kg</span>
                  <input type="number" min="0" max="999" step="0.5" :value="set.weight || 0" @input="updateSet(index, sIdx, 'weight', $event.target.value)" />
                </label>
                <button class="remove-set" title="Satz entfernen" @click="removeSet(index, sIdx)">×</button>
              </div>
            </div>
            
            
          </div>
          <div class="row-actions">
            <button class="remove-btn" title="Übung entfernen" @click="removeExercise(index)">×</button>
          </div>
        </div>
        <p v-if="!isSignedIn" class="auth-hint">Bitte melde dich an, um ein Workout zu erstellen.</p>
        <p v-if="errorMsg" class="error-hint">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- Loading State außerhalb nicht nötig, da innerhalb der exercises-section bereits Skeleton/Loading angezeigt wird -->

    <!-- Sticky Bottom CTA -->
    <div v-if="isSignedIn" class="sticky-cta">
      <button 
        class="create-btn" 
        :disabled="!isSignedIn || creating || selectedExercises.length === 0" 
        :title="!isSignedIn ? 'Bitte zuerst anmelden' : (selectedExercises.length === 0 ? 'Wähle Übungen aus' : 'Workout erstellen')"
        @click="createWorkout"
      >
        {{ creating ? 'Erstelle…' : `Erstellen (${selectedExercises.length})` }}
      </button>
    </div>

    <!-- App Navigation unten -->
    <BottomNav />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { useAuth, useUser, useClerk } from '@clerk/vue'
import { getAuthToken } from '@/utils/authToken'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import axios from 'axios'
import { fetchWorkout } from '@/api/workouts'
import StepIndicator from './StepIndicator.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'
import { useToastStore } from '@/stores/toastStore'

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
const { isSignedIn } = useUser()
const auth = useAuth()
const clerk = useClerk()
const router = useRouter()
const route = useRoute()
const store = useUserStore()
const toast = useToastStore()

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
const didPlanScroll = ref(false)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isMobile = computed(() => viewportWidth.value <= 480)
const showMobilePicker = ref(false)
const showTypePicker = ref(false)
const showBelief = ref(true)
const beliefText = ref('')

onMounted(() => {
  const onResize = () => { viewportWidth.value = window.innerWidth }
  window.addEventListener('resize', onResize)
  // Store handler referenz für Cleanup
  resizeHandler.value = onResize
  // Init Affirmation
  const beliefs = [
    'Jede Wiederholung bringt dich deinem Ziel näher.',
    'Konstanz schlägt Intensität – heute zählts.',
    'Kleiner Schritt, große Wirkung: jetzt starten.',
    'Du bist stärker als deine Ausreden.',
    'Fortschritt, nicht Perfektion.'
  ]
  beliefText.value = beliefs[Math.floor(Math.random() * beliefs.length)]
})
onUnmounted(() => {
  if (resizeHandler.value) window.removeEventListener('resize', resizeHandler.value)
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

// Prefill aus "repeat"-Query: Vorheriges Workout laden und Übungen vorwählen
async function prefillFromRepeatIfAny() {
  const repeatId = (route.query.repeat || '').toString()
  if (!repeatId) return
  try {
    // Workout aus Store oder API holen
    let base = store.workouts.find(w => w._id === repeatId) || null
    if (!base) {
      const token = await getAuthToken({ clerk, auth }).catch(() => null)
      base = await fetchWorkout(repeatId, token).catch(() => null)
    }
    if (!base) return

    // Typ übernehmen (sofern erlaubt) und Übungen laden
    const t = (base.type || '').toLowerCase()
    if (['push','pull','legs'].includes(t)) {
      selectedType.value = t
    }
    await loadExercises()

    // Übungen aus dem Basis-Workout in der gleichen Reihenfolge übernehmen
    const ordered = []
    const baseList = Array.isArray(base.exercises) ? base.exercises : []
    for (const be of baseList) {
      const match = exercises.value.find(ex => (be.exerciseId && ex._id === be.exerciseId) || (!be.exerciseId && be.name && ex.name === be.name))
      if (match && !ordered.some(x => x._id === match._id)) {
        ordered.push(match)
      }
    }
    selectedExercises.value = ordered
    await nextTick()
    if (!didPlanScroll.value && selectedExercises.value.length > 0) {
      scrollToPlan()
      didPlanScroll.value = true
    }
  } catch (e) {
    console.warn('⚠️ Prefill (repeat) fehlgeschlagen:', e)
  }
}

onMounted(() => { prefillFromRepeatIfAny() })

// Beim ersten Hinzufügen scrollen
let lastLen = 0
watch(() => selectedExercises.value.length, async (len) => {
  if (didPlanScroll.value) { lastLen = len; return }
  if (lastLen === 0 && len > 0) {
    await nextTick()
    scrollToPlan()
    didPlanScroll.value = true
  }
  lastLen = len
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
}
async function selectWorkoutType(type) {
  selectedType.value = type
  selectedExercises.value = [] // Reset selection
  if (isSignedIn.value) {
    await loadExercises()
  }
}

async function loadExercises() {
  loading.value = true
  console.log('🔄 WorkoutBuilder - Lade Übungen für Typ:', selectedType.value)
  if (!isSignedIn.value) {
    console.warn('⚠️ WorkoutBuilder - Nicht angemeldet, lade keine Übungen')
    exercises.value = []
    loading.value = false
    return
  }
  
  try {
    let headers = {}
    // Token hinzufügen falls verfügbar
    if (isSignedIn.value) {
      try {
  const token = await getAuthToken({ clerk, auth })
        if (token) {
          headers.Authorization = `Bearer ${token}`
          console.log('🔑 WorkoutBuilder - Token verfügbar')
        } else {
          console.warn('⚠️ WorkoutBuilder - Kein Token erhalten')
        }
      } catch (tokenError) {
        console.warn('⚠️ WorkoutBuilder - Token konnte nicht abgerufen werden:', tokenError)
      }
    } else {
      console.warn('⚠️ WorkoutBuilder - Nutzer nicht angemeldet')
    }

  // Relative URL; Vite-Proxy leitet in Dev auf 3001 weiter
  const apiUrl = '/api/exercises'
    console.log('🌐 WorkoutBuilder - API-Anfrage an:', apiUrl)

    // Versuche zuerst API-Call ohne Authentifizierung für Debugging
    console.log('🔄 WorkoutBuilder - Teste API ohne Authentifizierung...')
    try {
      const testResponse = await axios.get(apiUrl, { timeout: 5000 })
      console.log('✅ WorkoutBuilder - API ohne Auth funktioniert, Übungen:', testResponse.data?.length)
      
      // Verwende die Daten ohne Authentifizierung
      let allExercises = testResponse.data || []
      let filteredExercises = []
      
      // Mappe interne Typen zu Backend-Kategorien
      const categoryMap = {
        'push': 'Push',
        'pull': 'Pull', 
        'legs': 'Legs'
      }
      
      const targetCategory = categoryMap[selectedType.value]
      console.log('🎯 WorkoutBuilder - Filtere für Kategorie:', targetCategory)
      
      if (targetCategory && allExercises.length > 0) {
        filteredExercises = allExercises.filter(exercise => 
          exercise.category === targetCategory
        )
        console.log('✅ WorkoutBuilder - Gefilterte Übungen:', filteredExercises.length, 'von', allExercises.length)
      } else {
        filteredExercises = allExercises
        console.log('⚠️ WorkoutBuilder - Keine Filterung, alle Übungen:', filteredExercises.length)
      }
      
      exercises.value = filteredExercises
      console.log('✅ WorkoutBuilder - Übungen erfolgreich geladen!')
      return // Erfolgreich geladen, exit function
      
    } catch (testError) {
      console.warn('⚠️ WorkoutBuilder - API ohne Auth fehlgeschlagen:', testError.message)
    }

    // Fallback: Versuche mit Authentifizierung
    console.log('🔄 WorkoutBuilder - Versuche API mit Authentifizierung...')
    const response = await axios.get(apiUrl, {
      headers,
      timeout: 10000 // 10 Sekunden Timeout
    })
    
    console.log('📦 WorkoutBuilder - API Response Status:', response.status)
    console.log('📦 WorkoutBuilder - API Response Data Length:', response.data?.length)
    
    // Filtere die Übungen clientseitig basierend auf selectedType
    let allExercises = response.data || []
    let filteredExercises = []
    
    // Mappe interne Typen zu Backend-Kategorien
    const categoryMap = {
      'push': 'Push',
      'pull': 'Pull', 
      'legs': 'Legs'
    }
    
    const targetCategory = categoryMap[selectedType.value]
    console.log('🎯 WorkoutBuilder - Filtere für Kategorie:', targetCategory)
    
    if (targetCategory && allExercises.length > 0) {
      filteredExercises = allExercises.filter(exercise => 
        exercise.category === targetCategory
      )
      console.log('✅ WorkoutBuilder - Gefilterte Übungen:', filteredExercises.length, 'von', allExercises.length)
    } else {
      filteredExercises = allExercises
      console.log('⚠️ WorkoutBuilder - Keine Filterung, alle Übungen:', filteredExercises.length)
    }
    
    exercises.value = filteredExercises
    console.log('✅ WorkoutBuilder - Übungen vom Backend geladen und gefiltert:', filteredExercises.length, 'von', allExercises.length)
    
  } catch (error) {
    console.error('❌ WorkoutBuilder - API-Fehler Details:', {
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
    console.log('⚠️ WorkoutBuilder - Verwende Fallback-Übungen:', exercises.value.length, 'für Typ:', selectedType.value)
    console.log('⚠️ WorkoutBuilder - Verwende Fallback-Übungen:', exercises.value.length)
  } finally {
    loading.value = false
  }
}

function toggleExercise(exercise) {
  const index = selectedExercises.value.findIndex(e => e._id === exercise._id)
  
  if (index > -1) {
    selectedExercises.value.splice(index, 1)
  } else {
    selectedExercises.value.push({
      ...exercise
    })
  }
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
    if (!isSignedIn.value) {
      console.warn('⛔️ Nicht angemeldet – Erstellen abgebrochen')
      errorMsg.value = 'Nicht angemeldet. Bitte melde dich an.'
      return
    }
    creating.value = true
    const workoutData = {
      name: `${currentTypeLabel.value} - ${new Date().toLocaleDateString('de-DE')}`,
      type: selectedType.value,
      // Nur Übungen ohne Satz-Details speichern; Details werden erst später im Detail bearbeitet
      exercises: selectedExercises.value.map(ex => ({
        exerciseId: ex._id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        category: ex.category,
        setDetails: Array.isArray(ex.setDetails) ? ex.setDetails.map(s => ({
          reps: Number(s.reps) || 10,
          weight: Number(s.weight) || 0
        })) : []
      })),
      date: new Date().toISOString(),
      completed: false
    }

    // Token holen (Preflight)
    let token = await getAuthToken({ clerk, auth }).catch(() => null)
    if (!token) {
      // Zweiter Versuch ohne Cache
  token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
    }
    if (!token) {
      errorMsg.value = 'Sitzung noch nicht bereit. Bitte kurz warten und erneut versuchen.'
      console.warn('⚠️ Kein Token verfügbar – Abbruch')
      return
    }
    // Workout über Store erstellen (inkl. Fehlerbehandlung)
  const created = await store.createWorkout(workoutData, token)

    // Kein Workout-Cover-Upload im Erstell-Flow

    // Event für Parent-Komponente
    emit('workout-created', created)

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
    
    console.log('✅ Workout erfolgreich erstellt:', newId || workoutData)
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Workouts:', error)
    if (error?.code === 'AUTH_REQUIRED' || error?.code === 'UNAUTHORIZED') {
      errorMsg.value = 'Nicht angemeldet oder nicht autorisiert. Bitte melde dich an.'
    } else if (error?.response?.status === 401 || error?.response?.status === 403) {
      errorMsg.value = 'Nicht autorisiert (401/403). Bitte neu anmelden.'
    } else {
      errorMsg.value = 'Erstellen fehlgeschlagen. Bitte später erneut versuchen.'
    }
  } finally {
    creating.value = false
  }
}

function removeSet(exIdx, setIdx) {
  const ex = selectedExercises.value[exIdx]
  if (!ex?.setDetails) return
  ex.setDetails.splice(setIdx, 1)
}

function updateSet(exIdx, setIdx, field, val) {
  const ex = selectedExercises.value[exIdx]
  if (!ex?.setDetails?.[setIdx]) return
  const num = Number(val)
  if (field === 'reps') ex.setDetails[setIdx].reps = isFinite(num) ? num : ex.setDetails[setIdx].reps
  if (field === 'weight') ex.setDetails[setIdx].weight = isFinite(num) ? num : ex.setDetails[setIdx].weight
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
watch(isSignedIn, async (signedIn) => {
  if (signedIn) {
    await loadExercises()
  } else {
    exercises.value = []
  }
}, { immediate: true })

// Login-Redirect wird zentral über AuthLayout/Welcome gehandhabt

function goDashboard() {
  router.push({ name: 'dashboard' })
}

function continuePlan() {
  showBelief.value = false
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
  img.onerror = null
  img.src = '/exercises/camera.svg'
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