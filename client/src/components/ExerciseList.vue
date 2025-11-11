<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">{{ t('exercises.title') }}</h1>

    <!-- Schnellfilter -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="cat in quickCategories"
        :key="cat.value"
        class="px-4 py-2 rounded-lg font-semibold text-white"
        :class="selectedCategory === cat.value ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-700'"
        @click="setCategory(cat.value)"
      >
        {{ cat.label }}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-gray-300 text-black hover:bg-gray-400"
        @click="resetFilters"
      >
        {{ t('exercises.filters.reset') }}
      </button>
    </div>

    <!-- Muskelgruppen Dropdown -->
    <div class="mb-4">
      <label class="block mb-1 text-sm text-gray-500">{{ t('exercises.filters.muscleGroup') }}:</label>
      <select
        v-model="selectedMuscleGroup"
        class="border rounded-lg p-2 w-full"
        @change="loadExercises"
      >
        <option value="">{{ t('exercises.filters.all') }}</option>
        <option v-for="group in muscleGroups" :key="group" :value="group">
          {{ group }}
        </option>
      </select>
    </div>

    <!-- Ladezustand -->
    <div v-if="loading" class="text-center text-gray-500 py-10">
      {{ t('exercises.loading') }}
    </div>

    <!-- Übungsliste -->
    <div v-else class="grid sm:grid-cols-2 gap-4">
      <div
        v-for="ex in exercises"
        :key="ex._id"
        class="exercise-card p-4 border rounded-xl shadow-sm bg-white hover:shadow-md transition"
      >
        <div class="thumb-row">
          <img :src="getExerciseImage(ex)" :alt="t('common.image')" class="thumb" @error="onImgError($event, ex)" />
          <div class="meta">
            <h2 class="title">{{ getTranslatedExerciseName(ex.name_en) }}</h2>
              <p class="sub">{{ ex.category }} · {{ getTranslatedMuscleGroup(ex.muscleGroup || (ex.muscleGroups?.[0] || '')) }}</p>
          </div>
        </div>
        <p class="desc">{{ ex.description }}</p>
    <p class="equip">{{ t('exercises.equipment') }}: {{ getTranslatedEquipment(ex.equipment) }}</p>
      </div>
    </div>

    <!-- Keine Ergebnisse -->
    <div v-if="!loading && exercises.length === 0" class="text-center text-gray-500 mt-8">
      {{ t('exercises.none') }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

const { t } = useI18n()

// Reaktive Variablen
const exercises = ref([]);
const loading = ref(false);
const selectedCategory = ref('');
const selectedMuscleGroup = ref('');

const { getTranslatedExerciseName, getAllTranslations } = useExerciseTranslation()

function getTranslatedMuscleGroup(muscleGroup) {
  if (!muscleGroup) return ''
  const all = getAllTranslations()
  // Suche nach passendem Eintrag (deutsch oder englisch)
  const found = all.find(e => e.muscleGroup === muscleGroup || e.muscleGroup_en === muscleGroup)
  const lang = (navigator.language || 'de').startsWith('de') ? 'de' : 'en'
  if (lang === 'de') return found ? found.muscleGroup : muscleGroup
  return found ? found.muscleGroup_en : muscleGroup
}

function getTranslatedEquipment(equipment) {
  if (!equipment) return ''
  const all = getAllTranslations()
  // Suche nach passendem Eintrag (deutsch oder englisch)
  const found = all.find(e => e.equipment === equipment || e.equipment_en === equipment)
  const lang = (navigator.language || 'de').startsWith('de') ? 'de' : 'en'
  if (lang === 'de') return found ? found.equipment : equipment
  return found ? found.equipment_en : equipment
}

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
    logger.error('Fehler beim Laden der Übungen:', err);
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

// Anzeige-Labels für Schnellfilter (Werte bleiben API-kompatibel)
const quickCategories = [
  { value: 'Push', label: t('exercises.filters.pushDay') },
  { value: 'Pull', label: t('exercises.filters.pullDay') },
  { value: 'Legs', label: t('exercises.filters.legDay') }
]

// Bildlogik: Versuche spezifisches Bild, sonst Kategorie-Fallback, sonst Placeholder
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Kategorie-Icons werden in der Liste nicht mehr verwendet; Kamera ist der generische Placeholder

function getExerciseImage(ex) {
  // 1) Bevorzugt Thumbnail, dann großes Bild, dann evtl. externe Media-URL
  if (ex?.thumbnailUrl) return ex.thumbnailUrl;
  if (ex?.imageUrl) return ex.imageUrl;
  if (ex?.mediaUrl) return ex.mediaUrl;
  // 2) Generischer Kamera-Placeholder
  return '/exercises/camera.svg';
}

function onImgError(evt, ex) {
  const img = evt?.target;
  if (!img) return;
  
  // Verhindere Endlosschleife: Wenn src schon camera.svg ist, nicht nochmal setzen
  if (img.src.includes('camera.svg')) {
    img.onerror = null;
    return;
  }
  
  // Einmalig auf Kamera-Placeholder fallen
  img.onerror = null;
  img.src = '/exercises/camera.svg';
}
</script>

<style scoped>
.exercise-card { display: flex; flex-direction: column; gap: 8px; }
.thumb-row { display: flex; align-items: center; gap: 12px; }
.thumb {
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  object-fit: contain;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #eef2f7;
  padding: 6px;
}
.meta { display: flex; flex-direction: column; min-width: 0; }
.title { font-weight: 700; font-size: 1.125rem; line-height: 1.4; }
.sub { color: #64748b; font-size: 0.875rem; }
.desc { margin-top: 6px; color: #334155; }
.equip { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
/* Mobile: Thumbnail rechts und größer */
@media (max-width: 480px) {
  .thumb-row { flex-direction: row-reverse; justify-content: space-between; }
  .thumb { width: 84px; height: 84px; flex-basis: 84px; }
  .meta { flex: 1 1 auto; }
}
</style>
