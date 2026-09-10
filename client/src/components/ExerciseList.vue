<template>
  <div class="exercise-list-root">
    <h1 v-if="showTitle" class="text-3xl font-bold mb-6">{{ t('exercises.title') }}</h1>

    <!-- Filter wie im WorkoutBuilder -->
    <div v-if="showControls" class="filter-row">
      <div class="equipment-filter-wrap">
        <label for="type-filter-select" class="equipment-filter-label">
          {{ t('exercises.filters.type') }}
        </label>
        <select id="type-filter-select" v-model="selectedCategory" @change="setCategory($event.target.value)" class="equipment-filter-select">
          <option :value="''">{{ t('exercises.filters.all') || 'Alle' }}</option>
          <option v-for="cat in quickCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
      </div>

      <div class="equipment-filter-wrap">
        <label for="equipment-filter-select" class="equipment-filter-label">
          {{ t('builder.filterEquipment') }}
        </label>
        <select id="equipment-filter-select" v-model="selectedEquipment" @change="setEquipment($event.target.value)" class="equipment-filter-select">
          <option :value="''">{{ t('exercises.filters.all') || 'Alle' }}</option>
          <option v-for="equip in allEquipmentTypes" :key="equip" :value="equip">{{ getTranslatedEquipment(equip) }}</option>
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
            {{ getTranslatedMuscleGroup(group) }}
          </option>
        </select>
      </div>

      <button class="filter-btn ghost" @click="resetFilters">
        {{ t('exercises.filters.reset') }}
      </button>
    </div>

    <!-- Eigene Filter/Such-UI nur wenn showControls aktiv ist (verhindert doppelte Such-/
         Filterzeilen, wenn eine einbettende Ansicht - z.B. WorkoutBuilder - bereits ihre eigene
         Filterung/Suche hat). Der "Eigene Übung hinzufügen"-Button ist davon unabhängig: er
         soll überall sichtbar sein, wo eine userId vorhanden ist, auch wenn showControls aus ist. -->
    <div v-if="showControls || userId" class="search-row">
      <template v-if="showControls">
        <input
          v-model="searchDraft"
          class="equipment-filter-select search-input"
          type="search"
          :placeholder="t('exercises.searchPlaceholder') || 'Suchen…'"
          @input="onSearchInput"
        />
        <p v-if="searchError" class="search-error">{{ searchError }}</p>
      </template>
      <button
        v-if="userId"
        class="add-custom-exercise-btn"
        type="button"
        @click="editingCustomExercise = null; showAddCustomModal = true"
        >
        <span class="add-custom-exercise-icon" aria-hidden="true">+</span>
        {{ t('exercises.addCustom') || 'Eigene Übung' }}
      </button>
    </div>

    <!-- Ladezustand -->
    <div v-if="loading" class="text-center text-gray-500 py-10">
      {{ t('exercises.loading') }}
    </div>

    <!-- Übungsliste -->
    <div v-else>
      <div class="result-toolbar">
        <span class="result-count">{{ visibleExercises.length }} / {{ filteredExercises.length }}</span>
      </div>

      <div class="exercise-grid">
        <div
          v-for="(ex, index) in visibleExercises"
          :key="ex?._id || ex?.exerciseId || ex?.id || index"
          class="exercise-card"
          :class="{ selected: selectable && isSelected(ex), 'exercise-card--selectable': selectable }"
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
              <h2 class="title">
                {{ ex.renderedName || ex.name }}
                <span v-if="ex._isCustom" class="custom-badge">{{ t('exercises.customBadge') }}</span>
              </h2>
              <p class="sub">{{ ex.renderedCategory || ex.category }} · {{ ex.renderedMuscle || ex.muscleGroup || (ex.muscleGroups?.[0] || '') }}</p>
            </div>
            <div v-if="ex._isCustom" class="custom-actions">
              <button
                class="custom-action-btn"
                type="button"
                :title="t('exercises.editCustomTitle') || 'Bearbeiten'"
                @click.stop="openEditCustom(ex)"
              >
                ✏️
              </button>
              <button
                class="custom-action-btn danger"
                type="button"
                :title="t('exercises.deleteCustomTitle') || 'Löschen'"
                @click.stop="askDeleteCustom(ex)"
              >
                🗑️
              </button>
            </div>
          </div>
          <p class="desc">{{ ex.renderedDescription }}</p>
          <p class="equip">{{ t('exercises.equipment') }}: {{ ex.renderedEquipment || ex.equipment }}</p>
        </div>
      </div>

      <button v-if="canLoadMore" class="load-more-btn" type="button" @click="loadMore">
        {{ t('exercises.loadMore') }}
      </button>
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
        ></video>
        <img
          v-else
          :src="mediaUrl || getExerciseLargeImage(mediaExercise)"
          :alt="mediaExercise.name"
          class="media-image"
        />
        <p class="media-disclaimer">{{ t('exercises.mediaDisclaimer') }}</p>
        <button class="close-btn" @click="closeMedia">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
  <AddCustomExerciseModal
    v-model="showAddCustomModal"
    :user-id="userId"
    :exercise="editingCustomExercise"
    @created="onCustomExerciseCreated"
    @updated="onCustomExerciseUpdated"
  />
  <AppModal
    v-model="showDeleteCustomModal"
    :title="t('exercises.deleteCustomConfirmTitle') || 'Übung löschen'"
    :message="t('exercises.deleteCustomConfirmMsg') || 'Diese eigene Übung wirklich löschen?'"
    :confirm-text="t('common.delete') || 'Löschen'"
    :cancel-text="t('common.cancel')"
    type="warning"
    @confirm="confirmDeleteCustom"
  />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { resolveExerciseMedia, getExerciseThumb, preloadExerciseMedia, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { loadDefaultExercises, getCachedDefaultExercises } from '@/utils/defaultExercisesLoader'
import { searchAndRankExercises } from '@/utils/exerciseSearch'
import AddCustomExerciseModal from '@/components/AddCustomExerciseModal.vue'
import AppModal from '@/components/AppModal.vue'
import { deleteCustomExercise } from '@/api/customExercises'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { resolveServerMediaUrl } from '@/api/http'

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
  },
  userId: { 
    type: String, 
    default: '' 
  }
})
const emit = defineEmits(['toggle', 'custom-added'])
const { t, locale } = useI18n()
const showTitle = computed(() => props.showTitle)
const showControls = computed(() => props.showControls)
const selectable = computed(() => props.selectable)
const { getIdToken } = useFirebaseAuth()
const showAddCustomModal = ref(false)
const editingCustomExercise = ref(null)
const showDeleteCustomModal = ref(false)
const pendingDeleteCustom = ref(null)

function openEditCustom(exercise) {
  editingCustomExercise.value = exercise
  showAddCustomModal.value = true
}

function askDeleteCustom(exercise) {
  pendingDeleteCustom.value = exercise
  showDeleteCustomModal.value = true
}

async function confirmDeleteCustom() {
  const exercise = pendingDeleteCustom.value
  showDeleteCustomModal.value = false
  if (!exercise?._id) return
  try {
    const token = await getIdToken().catch(() => null)
    await deleteCustomExercise(exercise._id, token)
    emit('custom-added')
  } catch (err) {
    logger.error('[ExerciseList] Löschen fehlgeschlagen', err)
  } finally {
    pendingDeleteCustom.value = null
  }
}

function onCustomExerciseCreated() {
  showAddCustomModal.value = false
  emit('custom-added')
}

function onCustomExerciseUpdated() {
  showAddCustomModal.value = false
  editingCustomExercise.value = null
  emit('custom-added')
}

// Reaktive Variablen
const exercises = ref([]);
const searchQuery = ref('');
const searchDraft = ref('')
const selectedEquipment = ref('');
const normalizedExercises = ref([])
const allEquipmentTypes = computed(() => {
  const set = new Set()
  normalizedExercises.value.forEach(e => {
    if (e.equipment) set.add(e.equipment)
  })
  return Array.from(set)
})
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
const visibleCount = ref(80)
let searchDebounceTimer = null

const {
  getTranslatedExerciseName,
  getTranslatedMuscleGroup,
  getTranslatedEquipment,
  getLocalizedDescription,
  getTranslatedCategory
} = useExerciseTranslation()

// Muskelgruppen (Dropdown). Die Werte entsprechen dem "muscleGroup"-Feld in den Übungsdaten und
// sind bewusst der Filterwert (nicht der Anzeigetext) - die Anzeige läuft über
// getTranslatedMuscleGroup() (siehe exerciseTranslation.js), die z.B. "Quadrizeps" als "Beine"
// zeigt. "Hamstrings"/"Gluteus" waren früher eigene Einträge hier, obwohl die Daten Beinmuskeln
// gar nicht so fein unterscheiden (alle stehen dort als "Quadrizeps") - die beiden Filter
// matchten deshalb nie echte Übungen und ihre Anzeige kollidierte mit "Quadrizeps". Entfernt,
// zusammengeführt zu einem einzigen "Quadrizeps"-Eintrag, der als "Beine" angezeigt wird.
const muscleGroups = [
  'Brust',
  'Schultern',
  'Trizeps',
  'Bizeps',
  'Rücken',
  'Quadrizeps',
  'Waden'
];

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function dedupeExercises(list = []) {
  const normalizeKey = (value) => String(value || '').trim().toLowerCase()
  const seen = new Set()
  const unique = []

  for (const exercise of Array.isArray(list) ? list : []) {
    if (!exercise) continue
    const canonicalName = normalizeKey(exercise.displayName || exercise.name || exercise.name_en)
    if (!canonicalName) continue
    if (seen.has(canonicalName)) continue
    seen.add(canonicalName)
    unique.push(exercise)
  }

  return unique
}

// Lädt Übungen aus props.items oder aus default-exercises
async function loadExercises() {
  loading.value = true;
  try {
    const source = Array.isArray(props.items)
      ? props.items
      : (getCachedDefaultExercises().length ? getCachedDefaultExercises() : await loadDefaultExercises())
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
    exercises.value = dedupeExercises(allExercises)
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
  selectedEquipment.value = '';
  searchQuery.value = '';
  searchDraft.value = '';
  searchError.value = '';
  visibleCount.value = 80
  loadExercises();
}

function setCategory(cat) {
  selectedCategory.value = cat;
  selectedMuscleGroup.value = '';
  loadExercises();
}

// Lädt initial alle Übungen
onMounted(() => {
  const cached = getCachedDefaultExercises()
  if (cached.length) normalizedExercises.value = cached
  loadDefaultExercises().then(list => { normalizedExercises.value = list }).catch(() => {})
  loadExercises()
});

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

watch(() => props.items, () => {
  loadExercises()
}, { deep: true })

watch([exercises, searchQuery], () => {
  visibleCount.value = searchQuery.value.trim() ? 120 : 80
})

const preparedExercises = computed(() => {
  const list = Array.isArray(exercises.value) ? exercises.value : []
  const mapped = list.map((exercise) => {
    const translationSourceName = String(locale.value || '').toLowerCase().startsWith('de')
      ? (exercise?.name || exercise?.name_en || '')
      : (exercise?.name_en || exercise?.name || '')
    const renderedName = String(getTranslatedExerciseName(translationSourceName))
    const renderedCategory = String(getTranslatedCategory(exercise?.category || ''))
    const renderedMuscle = String(getTranslatedMuscleGroup(exercise?.muscleGroup || (exercise?.muscleGroups?.[0] || '')))
    const renderedEquipment = String(getTranslatedEquipment(exercise?.equipment || ''))
    const renderedDescription = String(getLocalizedDescription(exercise) || '')

    return {
      ...exercise,
      renderedName,
      renderedCategory,
      renderedMuscle,
      renderedEquipment,
      renderedDescription,
      _searchPrimary: normalizeSearchText(renderedName),
      _searchSecondary: [
        normalizeSearchText(exercise?.name || ''),
        normalizeSearchText(exercise?.name_en || ''),
        normalizeSearchText(renderedMuscle),
        normalizeSearchText(renderedEquipment),
        normalizeSearchText(renderedCategory),
        normalizeSearchText(renderedDescription)
      ]
    }
  })

  // Final UI dedupe by translated/visible name to avoid duplicate-looking cards.
  const seenRenderedNames = new Set()
  const unique = []
  for (const exercise of mapped) {
    const key = normalizeSearchText(exercise?.renderedName || exercise?.name || '')
    if (!key) continue
    if (seenRenderedNames.has(key)) continue
    seenRenderedNames.add(key)
    unique.push(exercise)
  }

  return unique
})

const filteredExercises = computed(() => {
  const list = preparedExercises.value
  const q = searchQuery.value.trim()
  if (!q) return list

  return searchAndRankExercises(list, q, {
    getPrimaryText: (exercise) => exercise?._searchPrimary || '',
    getSecondaryTexts: (exercise) => exercise?._searchSecondary || []
  })
})

const visibleExercises = computed(() => filteredExercises.value.slice(0, visibleCount.value))
const canLoadMore = computed(() => filteredExercises.value.length > visibleCount.value)

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
  const sanitized = String(raw).replace(/\s+/g, ' ').replace(/^\s+/, '')
  searchError.value = ''
  searchDraft.value = sanitized
  if (event?.target) event.target.value = sanitized
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchQuery.value = sanitized
    visibleCount.value = sanitized ? 120 : 80
  }, 40)
}

function loadMore() {
  visibleCount.value += searchQuery.value.trim() ? 120 : 80
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
  const imageUrl = typeof ex?.imageUrl === 'string' ? resolveServerMediaUrl(ex.imageUrl) : ''
  const mediaUrl = typeof ex?.mediaUrl === 'string' ? ex.mediaUrl : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '' : imageUrl
  const safeMedia = /\.gif($|[?#])/i.test(mediaUrl) ? '' : mediaUrl
  return ex?.thumbnailStaticUrl || ex?.thumbnailUrl || safeImage || safeMedia || '/exercises/play.svg'
}

function getExerciseLargeImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? resolveServerMediaUrl(ex.imageUrl) : ''
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
/* Bewusst als gefüllter Akzent-Button statt (vorher) unauffälligem Outline-Button - Rückmeldung:
   Nutzer bemerken die Möglichkeit, eigene Übungen hinzuzufügen, sonst kaum. Style/Farbverlauf
   angelehnt an button.primary in style.css (App-weite CTA-Konvention). */
.add-custom-exercise-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(120deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast, #0b1220);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.add-custom-exercise-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-contrast, #0b1220) 18%, transparent);
  font-size: 0.85rem;
  line-height: 1;
}

.add-custom-exercise-btn:hover {
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 45%, transparent);
}

.add-custom-exercise-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.add-custom-exercise-btn:active {
  transform: scale(0.96);
}

.custom-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent, #4f9dff) 20%, transparent);
  color: var(--accent, #4f9dff);
  font-size: 0.65rem;
  font-weight: 700;
  vertical-align: middle;
}

.custom-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  align-self: flex-start;
}

.custom-action-btn {
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px;
  opacity: 0.8;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.custom-action-btn:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--fg, #fff) 8%, transparent);
}

.custom-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: none;
}

.custom-action-btn:active {
  transform: scale(0.9);
}

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
  transition: border-color 0.15s ease;
}

.equipment-filter-select:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--card-border));
}

.equipment-filter-select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
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
.filter-btn:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line-strong));
}
.filter-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.filter-btn:active {
  transform: scale(0.97);
}
.filter-btn.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
}
.filter-btn.ghost {
  background: transparent;
  color: var(--fg);
}
.filter-btn.ghost:hover {
  background: color-mix(in srgb, var(--fg) 6%, transparent);
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
  transition: border-color 0.15s ease;
}

.search-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
.search-error {
  margin-top: 6px;
  color: var(--danger-text);
  font-size: 0.85rem;
}
.result-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
.result-count {
  color: var(--muted);
  font-size: 0.84rem;
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
.exercise-card--selectable:active {
  transform: scale(0.985);
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
  transition: transform 0.1s ease;
}
.thumb:active {
  transform: scale(0.92);
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
.load-more-btn {
  display: block;
  margin: 18px auto 0;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--bg-panel);
  color: var(--fg);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.load-more-btn:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--card-border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-panel));
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.load-more-btn:active {
  transform: scale(0.97);
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