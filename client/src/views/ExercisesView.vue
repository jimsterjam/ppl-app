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

      <!-- Übungsliste -->
      <div v-else class="exercises-list">
        <div v-for="exercise in exercises" :key="exercise._id" class="exercise-card">
          <h3>{{ exercise.name }}</h3>
          <p><strong>Kategorie:</strong> {{ exercise.category }}</p>
          <p><strong>Muskelgruppe:</strong> {{ exercise.muscleGroup }}</p>
          <p><strong>Equipment:</strong> {{ exercise.equipment || 'Körpergewicht' }}</p>
          <p v-if="exercise.description" class="description">{{ exercise.description }}</p>
          <p><strong>ID:</strong> {{ exercise._id }}</p>
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

const { isSignedIn } = useUser()
const clerk = useClerk()

const exercises = ref([])
const loading = ref(false)
const selectedCategory = ref('')
const selectedMuscleGroup = ref('')

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
</style>
