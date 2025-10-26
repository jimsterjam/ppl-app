<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">Übungen</h1>

    <!-- Schnellfilter -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="cat in ['Push', 'Pull', 'Legs']"
        :key="cat"
        class="px-4 py-2 rounded-lg font-semibold text-white"
        :class="selectedCategory === cat ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-700'"
        @click="setCategory(cat)"
      >
        {{ cat }}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-gray-300 text-black hover:bg-gray-400"
        @click="resetFilters"
      >
        Zurücksetzen
      </button>
    </div>

    <!-- Muskelgruppen Dropdown -->
    <div class="mb-4">
      <label class="block mb-1 text-sm text-gray-500">Muskelgruppe:</label>
      <select
        v-model="selectedMuscleGroup"
        class="border rounded-lg p-2 w-full"
        @change="loadExercises"
      >
        <option value="">Alle</option>
        <option v-for="group in muscleGroups" :key="group" :value="group">
          {{ group }}
        </option>
      </select>
    </div>

    <!-- Ladezustand -->
    <div v-if="loading" class="text-center text-gray-500 py-10">
      Lade Übungen...
    </div>

    <!-- Übungsliste -->
    <div v-else class="grid sm:grid-cols-2 gap-4">
      <div
        v-for="ex in exercises"
        :key="ex._id"
        class="p-4 border rounded-xl shadow-sm bg-white hover:shadow-md transition"
      >
        <h2 class="font-bold text-lg mb-1">{{ ex.name }}</h2>
        <p class="text-sm text-gray-600">{{ ex.category }} · {{ ex.muscleGroup }}</p>
        <p class="mt-2 text-gray-700">{{ ex.description }}</p>
        <p class="text-xs mt-1 text-gray-500">Equipment: {{ ex.equipment }}</p>
      </div>
    </div>

    <!-- Keine Ergebnisse -->
    <div v-if="!loading && exercises.length === 0" class="text-center text-gray-500 mt-8">
      Keine Übungen gefunden.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// Reaktive Variablen
const exercises = ref([]);
const loading = ref(false);
const selectedCategory = ref('');
const selectedMuscleGroup = ref('');

// Muskelgruppen (Dropdown)
const muscleGroups = [
  'Brust',
  'Schultern',
  'Trizeps',
  'Bizeps',
  'Rücken',
  'Quadrizeps',
  'Hamstrings',
  'Gluteus',
  'Waden'
];

// Lädt Übungen aus MongoDB
async function loadExercises() {
  loading.value = true;
  const params = new URLSearchParams();
  if (selectedCategory.value) params.append('category', selectedCategory.value);
  if (selectedMuscleGroup.value) params.append('muscleGroup', selectedMuscleGroup.value);

  try {
  // Relative URL; in Dev via Vite-Proxy -> 3001
  const res = await fetch(`/api/exercises?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP Fehler ${res.status}`);
    exercises.value = await res.json();
  } catch (err) {
    console.error('Fehler beim Laden der Übungen:', err);
  } finally {
    loading.value = false;
  }
}

// Filterfunktionen
function resetFilters() {
  selectedCategory.value = '';
  selectedMuscleGroup.value = '';
  loadExercises();
}

function setCategory(cat) {
  selectedCategory.value = cat;
  selectedMuscleGroup.value = '';
  loadExercises();
}

// Lädt initial alle Übungen
onMounted(() => loadExercises());
</script>
