<template>
  <div class="exercise-list-root">
    <h1 v-if="showTitle" class="text-3xl font-bold mb-6">{{ t('exercises.title') }}</h1>

    <!-- Filter wie im WorkoutBuilder -->
    <div v-if="showControls" class="filter-row">
      <div class="equipment-filter-wrap">
        <label for="type-filter-select" class="equipment-filter-label">
          {{ t('exercises.filters.type') !== 'exercises.filters.type' ? t('exercises.filters.type') : 'Typ' }}
        </label>
        <select id="type-filter-select" v-model="selectedCategory" @change="setCategory($event.target.value)" class="equipment-filter-select">
          <option :value="''">{{ t('exercises.filters.all') || 'Alle' }}</option>
          <option v-for="cat in quickCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
      </div>

      <div class="equipment-filter-wrap">
        <label for="equipment-filter-select" class="equipment-filter-label">
          {{ t('builder.filterEquipment') !== 'builder.filterEquipment' ? t('builder.filterEquipment') : 'Equipment filtern' }}
        </label>
        <select id="equipment-filter-select" v-model="selectedEquipment" @change="setEquipment($event.target.value)" class="equipment-filter-select">
          <option :value="''">{{ t('exercises.filters.all') || 'Alle' }}</option>
          <option v-for="equip in allEquipmentTypes" :key="equip" :value="equip">{{ equipmentTranslation(equip) }}</option>
        </select>
      </div>

      <div class="equipment-filter-wrap">
        <label for="muscle-group-select" class="equipment-filter-label">{{ t('exercises.filters.muscleGroup') }}</label>
        <select
          id="muscle-group-select"
          v-model="selectedMuscleGroup"
          class="equipment-filter-select"
          @change="loadExercises"
        >
          <option value="">{{ t('exercises.filters.all') }}</option>
          <option v-for="group in muscleGroups" :key="group" :value="group">
            {{ group }}
          </option>
        </select>
      </div>

      <button class="filter-btn ghost" @click="resetFilters">
        {{ t('exercises.filters.reset') }}
      </button>
    </div>

    <div v-if="showControls" class="search-row">
      <input
        v-model="searchQuery"
        class="equipment-filter-select search-input"
        type="search"
        :placeholder="t('exercises.searchPlaceholder') || 'Suchen…'"
        @input="onSearchInput"
      />
      <p v-if="searchError" class="search-error">{{ searchError }}</p>
    </div>

    <!-- Ladezustand -->
    <div v-if="loading" class="text-center text-gray-500 py-10">
      {{ t('exercises.loading') }}
    </div>

    <!-- Übungsliste -->
    <div v-else class="exercise-grid">
      <div
        v-for="(ex, index) in filteredExercises"
        :key="ex?._id || ex?.exerciseId || ex?.id || index"
        class="exercise-card"
        :class="{ selected: selectable && isSelected(ex) }"
        @click="onCardClick(ex)"
      >
        <div class="thumb-row">
          <img
            :src="getExerciseListImage(ex)"
            :alt="t('common.image')"
            class="thumb"
            loading="lazy"
            decoding="async"
            @error="onImgError($event, ex)"
            @click.stop="openMedia(ex)"
          />
          <div class="meta">
            <h2 class="title">{{ getTranslatedExerciseName(ex.name_en || ex.name) }}</h2>
            <p class="sub">{{ getTranslatedCategory(ex.category) }} · {{ getTranslatedMuscleGroup(ex.muscleGroup || (ex.muscleGroups?.[0] || '')) }}</p>
          </div>
        </div>
        <p class="desc">{{ getLocalizedDescription(ex) }}</p>
        <p class="equip">{{ t('exercises.equipment') }}: {{ getTranslatedEquipment(ex.equipment) }}</p>
      </div>
    </div>

    <!-- Keine Ergebnisse -->
    <div v-if="!loading && filteredExercises.length === 0" class="empty-hint">
      {{ t('exercises.none') }}
    </div>

    <div v-if="mediaExercise" class="media-overlay" @click.self="closeMedia">
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
        <p class="media-disclaimer">Visualisierung dient nur zur Orientierung. Keine Garantie für technisch korrekte Ausführung.</p>
        <button class="close-btn" @click="closeMedia">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { resolveExerciseMedia, getExerciseThumb, preloadExerciseMedia, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'

const props = defineProps({
  showTitle: {
    type: Boolean,
    default: true
  },
  items: {
    type: Array,
    default: null
  },
  showControls: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedIds: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['toggle'])

const { t } = useI18n()
const showTitle = computed(() => props.showTitle)
const showControls = computed(() => props.showControls)
const selectable = computed(() => props.selectable)

// Reaktive Variablen
const exercises = ref([]);
const searchQuery = ref('');
const selectedEquipment = ref('');
const normalizedExercises = ref([])
const allEquipmentTypes = computed(() => {
  const set = new Set()
  normalizedExercises.value.forEach(e => {
    if (e.equipment) set.add(e.equipment)
  })
  return Array.from(set)
})
const equipmentTranslation = (equip) => {
  const keyMap = {
    'Körpergewicht': 'bodyweight',
    'Langhantel': 'barbell',
    'Hanteln': 'dumbbell',
    'Maschine': 'machine',
    'Kabelzug': 'cable',
    'Band': 'band',
    'Kettlebell': 'kettlebell',
    'Medizinball': 'medicineball',
    'Sandbag': 'sandbag',
    'Eigengewicht': 'bodyweight',
    'Bodyweight': 'bodyweight',
    'Barbell': 'barbell',
    'Dumbbells': 'dumbbell',
    'Dumbbell': 'dumbbell',
    'Cable': 'cable',
    'Machine': 'machine',
    'Band': 'band',
    'Kettlebell': 'kettlebell',
    'Medicineball': 'medicineball',
    'Sandbag': 'sandbag',
  }
  const key = keyMap[equip] || equip.toLowerCase()
  const translated = t(`exercises.equipment.${key}`)
  if (translated && !translated.startsWith('exercises.equipment.')) return translated
  const found = normalizedExercises.value.find(e => e.equipment === equip)
  if (found && found.equipment_en) return found.equipment_en
  return equip
}
function setEquipment(equip) {
  selectedEquipment.value = equip
  loadExercises()
}
const searchError = ref('');
const loading = ref(false);
const selectedCategory = ref('');
const selectedMuscleGroup = ref('');
const brokenImageIds = ref(new Set())
const mediaExercise = ref(null)
const mediaUrl = ref('')
const mediaRequestId = ref(0)
const isVideoUrl = (url) => typeof url === 'string' && /\.mp4($|[?#])/i.test(url)

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

// Lädt Übungen aus props.items oder aus default-exercises
async function loadExercises() {
  loading.value = true;
  try {
    const source = Array.isArray(props.items) ? props.items : await loadDefaultExercises()
    let allExercises = Array.isArray(source) ? [...source] : []
    if (selectedCategory.value) {
      allExercises = allExercises.filter(ex => ex.category === selectedCategory.value)
    }
    if (selectedMuscleGroup.value) {
      allExercises = allExercises.filter(ex => ex.muscleGroup === selectedMuscleGroup.value || (ex.muscleGroups && ex.muscleGroups.includes(selectedMuscleGroup.value)))
    }
    if (selectedEquipment.value) {
      allExercises = allExercises.filter(ex => ex.equipment === selectedEquipment.value)
    }
    exercises.value = allExercises
    logger.debug(`✅ ExerciseList loaded ${exercises.value.length} Übungen`)
  } catch (err) {
    logger.error('ExerciseList Fehler beim Laden der Übungen:', err)
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
onMounted(async () => {
  try {
    normalizedExercises.value = await loadDefaultExercises()
  } catch {}
  loadExercises()
});

watch(() => props.items, () => {
  loadExercises()
}, { deep: true })

const filteredExercises = computed(() => {
  const list = Array.isArray(exercises.value) ? exercises.value : []
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(ex => {
    const name = String(getTranslatedExerciseName(ex?.name_en || ex?.name || '')).toLowerCase()
    const muscle = String(getTranslatedMuscleGroup(ex?.muscleGroup || (ex?.muscleGroups?.[0] || ''))).toLowerCase()
    const equipment = String(getTranslatedEquipment(ex?.equipment || '')).toLowerCase()
    return name.includes(q) || muscle.includes(q) || equipment.includes(q)
  })
})

watch(exercises, (list) => {
  if (!Array.isArray(list) || list.length === 0) return
  preloadExerciseMedia(list, { size: 360, limit: 12 }).catch(() => {})
})

function getSearchErrorMessage() {
  const msg = t('exercises.searchLettersOnly')
  if (msg && !msg.startsWith('exercises.searchLettersOnly')) return msg
  return 'Nur Buchstaben erlaubt.'
}

function onSearchInput(event) {
  const raw = event?.target?.value ?? ''
  const sanitized = String(raw).replace(/[^A-Za-zÄÖÜäöüß\s-]/g, '')
  if (raw !== sanitized) {
    searchError.value = getSearchErrorMessage()
  } else {
    searchError.value = ''
  }
  searchQuery.value = sanitized
  if (event?.target) event.target.value = sanitized
}

// Anzeige-Labels für Schnellfilter (Werte bleiben API-kompatibel)
const quickCategories = [
  { value: 'Push', label: t('exercises.filters.pushDay') },
  { value: 'Pull', label: t('exercises.filters.pullDay') },
  { value: 'Legs', label: t('exercises.filters.legDay') }
]

function isSelected(exercise) {
  const id = String(exercise?._id || exercise?.exerciseId || exercise?.id || '')
  if (!id) return false
  const selected = Array.isArray(props.selectedIds) ? props.selectedIds : []
  return selected.map(v => String(v)).includes(id)
}

function onCardClick(exercise) {
  if (!selectable.value) return
  emit('toggle', exercise)
}

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
  const imageUrl = typeof ex?.imageUrl === 'string' ? ex.imageUrl : ''
  const mediaUrl = typeof ex?.mediaUrl === 'string' ? ex.mediaUrl : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '' : imageUrl
  const safeMedia = /\.gif($|[?#])/i.test(mediaUrl) ? '' : mediaUrl
  return ex?.thumbnailStaticUrl || ex?.thumbnailUrl || safeImage || safeMedia || '/exercises/play.svg'
}

function getExerciseLargeImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? ex.imageUrl : ''
  const mediaUrl = typeof ex?.mediaUrl === 'string' ? ex.mediaUrl : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '' : imageUrl
  const safeMedia = /\.gif($|[?#])/i.test(mediaUrl) ? '' : mediaUrl
  return safeImage || ex?.thumbnailStaticUrl || ex?.thumbnailUrl || safeMedia || '/exercises/play.svg'
}

function onImgError(evt, ex) {
  const id = ex?._id
  if (id != null) {
    brokenImageIds.value = new Set([...brokenImageIds.value, id])
  }
}

function openMedia(exercise) {
  if (!exercise) return
  const requestId = ++mediaRequestId.value
  mediaExercise.value = exercise
  const fallbackMp4 = buildExerciseMediaUrl(exercise, 360, 'mp4')
  mediaUrl.value = fallbackMp4 || getExerciseLargeImage(exercise) || getExerciseThumb(exercise)
  resolveExerciseMedia(exercise, {
    size: 360,
    fallbackUrl: mediaUrl.value,
    onResolved: (url) => {
      if (mediaExercise.value && mediaRequestId.value === requestId) {
        mediaUrl.value = url
      }
    }
  }).catch(() => {})
}

function closeMedia() {
  mediaExercise.value = null
  mediaUrl.value = ''
}
</script>

<style scoped>
.exercise-list-root {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(14px, 3.5vw, 24px);
  overflow-y: visible;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
  justify-content: flex-start;
  align-items: flex-end;
}
.equipment-filter-wrap {
  width: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  justify-content: flex-start;
}
.equipment-filter-label {
  font-weight: 600;
}
.equipment-filter-select {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  min-width: 140px;
  background: var(--bg-panel);
  color: var(--fg);
}
.filter-row.secondary {
  width: auto;
  display: flex;
  gap: 10px;
  align-items: flex-end;
  justify-content: flex-start;
}
.filter-label {
  font-weight: 600;
}
.filter-btn {
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  color: var(--fg-strong);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.filter-btn.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
}
.filter-btn.ghost {
  background: transparent;
  color: var(--fg);
}
.filter-select {
  flex: 1;
  min-width: 180px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  color: var(--fg);
}
.search-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
}
.search-input {
  width: min(420px, 100%);
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: var(--bg-panel);
  color: var(--fg);
}
.search-error {
  margin-top: 6px;
  color: var(--danger-text);
  font-size: 0.85rem;
}
.empty-hint {
  text-align: center;
  color: var(--muted);
  margin-top: 20px;
}
.exercise-card { display: flex; flex-direction: column; gap: 8px; }
.exercise-card {
  padding: 16px;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: var(--card-bg);
  box-shadow: var(--shadow-soft);
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.exercise-card:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--card-border));
}
.exercise-card.selected {
  position: relative;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--card-bg));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
.exercise-card.selected::after {
  content: '✓';
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
}
.thumb-row { display: flex; align-items: center; gap: 12px; }
.thumb {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  object-fit: contain;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--card-border);
  padding: 8px;
  box-sizing: border-box;
  cursor: pointer;
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
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.meta { display: flex; flex-direction: column; min-width: 0; }
.title {
  font-weight: 800;
  font-size: 1.15rem;
  line-height: 1.35;
  color: var(--fg-strong);
  letter-spacing: 0.01em;
}
.sub { color: var(--muted); font-size: 0.875rem; }
.desc { margin-top: 8px; color: var(--fg); line-height: 1.45; }
.equip { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
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
.media-disclaimer {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
  text-align: center;
}
/* Mobile: Thumbnail rechts und größer */
@media (max-width: 480px) {
  .thumb-row { flex-direction: row-reverse; justify-content: space-between; }
  .thumb { width: 72px; height: 72px; flex-basis: 72px; }
  .meta { flex: 1 1 auto; }
}
</style>
