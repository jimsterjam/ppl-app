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

    <!-- Übungsliste (virtualisiert, GIFs erst beim Tap) -->
    <DynamicScroller v-else class="exercise-grid" :items="exercises" :min-item-size="140" page-mode>
      <template #default="{ item: ex, index, active }">
        <DynamicScrollerItem :item="ex" :active="active" :data-index="index">
          <div class="exercise-card p-4 border rounded-xl shadow-sm bg-white hover:shadow-md transition">
            <div class="thumb-row">
              <img
                :src="getExerciseListImage(ex)"
                :alt="t('common.image')"
                class="thumb"
                loading="lazy"
                decoding="async"
                @error="onImgError($event, ex)"
                @click="openMedia(ex)"
              />
              <div class="meta">
                <h2 class="title">{{ getTranslatedExerciseName(ex.name_en) }}</h2>
                  <p class="sub">{{ getTranslatedCategory(ex.category) }} · {{ getTranslatedMuscleGroup(ex.muscleGroup || (ex.muscleGroups?.[0] || '')) }}</p>
              </div>
            </div>
                    <p class="desc">{{ getLocalizedDescription(ex) }}</p>
        <p class="equip">{{ t('exercises.equipment') }}: {{ getTranslatedEquipment(ex.equipment) }}</p>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <!-- Keine Ergebnisse -->
    <div v-if="!loading && exercises.length === 0" class="text-center text-gray-500 mt-8">
      {{ t('exercises.none') }}
    </div>

    <div v-if="mediaExercise" class="media-overlay" @click.self="closeMedia">
      <div class="media-content">
        <img :src="getExerciseLargeImage(mediaExercise)" :alt="mediaExercise.name" class="media-image" />
        <button class="close-btn" @click="closeMedia">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'

const { t } = useI18n()

// Reaktive Variablen
const exercises = ref([]);
const loading = ref(false);
const selectedCategory = ref('');
const selectedMuscleGroup = ref('');
const brokenImageIds = ref(new Set())
const mediaExercise = ref(null)

const {
  getTranslatedExerciseName,
  getTranslatedMuscleGroup,
  getTranslatedEquipment,
  getLocalizedDescription,
  getTranslatedCategory
} = useExerciseTranslation()

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

// Lädt Übungen aus localStorage (Offline/Demo)
async function loadExercises() {
  loading.value = true;
  try {
    const data = localStorage.getItem('bro_split_exercises')
    if (data) {
      let allExercises = JSON.parse(data)
      // Filter nach Kategorie und Muskelgruppe
      if (selectedCategory.value) {
        allExercises = allExercises.filter(ex => ex.category === selectedCategory.value)
      }
      if (selectedMuscleGroup.value) {
        allExercises = allExercises.filter(ex => ex.muscleGroup === selectedMuscleGroup.value || (ex.muscleGroups && ex.muscleGroups.includes(selectedMuscleGroup.value)))
      }
      exercises.value = allExercises
      logger.debug(`✅ [Demo] Loaded ${exercises.value.length} Übungen aus localStorage`)
    } else {
      exercises.value = []
      logger.debug('⚠️ [Demo] Keine Übungen in localStorage gefunden')
    }
  } catch (err) {
    logger.error('[Demo] Fehler beim Laden der Übungen:', err)
    exercises.value = []
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

// Kategorie-Icons werden in der Liste nicht mehr verwendet; Play-Button ist der generische Placeholder

function getExerciseListImage(ex) {
  if (!ex) return '/exercises/play.svg'
  const id = ex._id
  if (id != null && brokenImageIds.value.has(id)) return '/exercises/play.svg'
  return ex?.thumbnailStaticUrl || ex?.thumbnailUrl || ex?.imageUrl || ex?.mediaUrl || '/exercises/play.svg'
}

function getExerciseLargeImage(ex) {
  return ex?.imageUrl || ex?.thumbnailUrl || ex?.mediaUrl || '/exercises/play.svg'
}

function onImgError(evt, ex) {
  const id = ex?._id
  if (id != null) {
    brokenImageIds.value = new Set([...brokenImageIds.value, id])
  }
}

function openMedia(exercise) {
  if (!exercise) return
  mediaExercise.value = exercise
}

function closeMedia() {
  mediaExercise.value = null
}
</script>

<style scoped>
.exercise-card { display: flex; flex-direction: column; gap: 8px; }
.thumb-row { display: flex; align-items: center; gap: 12px; }
.thumb {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  object-fit: contain;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #eef2f7;
  padding: 8px;
  box-sizing: border-box;
}
.thumb-fallback {
  padding: 0;
  display: grid;
  place-items: center;
}

.thumb-fallback-icon {
  width: 26px;
  height: 26px;
  opacity: 0.7;
}
.exercise-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.meta { display: flex; flex-direction: column; min-width: 0; }
.title { font-weight: 700; font-size: 1.125rem; line-height: 1.4; }
.sub { color: #64748b; font-size: 0.875rem; }
.desc { margin-top: 6px; color: #334155; }
.equip { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
.media-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 22, 0.72);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-content {
  background: var(--surface, #0b1220);
  border: 1px solid var(--card-border, #1f2937);
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
  background: #0b1220;
  border: 1px solid var(--card-border, #1f2937);
}
/* Mobile: Thumbnail rechts und größer */
@media (max-width: 480px) {
  .thumb-row { flex-direction: row-reverse; justify-content: space-between; }
  .thumb { width: 72px; height: 72px; flex-basis: 72px; }
  .meta { flex: 1 1 auto; }
}
</style>
