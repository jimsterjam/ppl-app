<template>
  <!-- 1. Ersatz-Vorschläge -->
  <AppModal
    v-model="listOpen"
    :title="t('swap.title')"
    :confirm-text="t('common.close')"
    :show-cancel="false"
    type="info"
    @update:model-value="onListToggle"
  >
    <p class="swap-hint">{{ t('swap.hint') }}</p>
    <p v-if="loading" class="swap-hint">{{ t('exercises.loading') }}</p>
    <div v-else class="swap-list">
      <div v-for="item in suggestions" :key="item.entry._id || item.entry.name_en" class="swap-row">
        <!-- Vorschaubild: Tippen zeigt Bild/Video groß (Einsteiger kennen die Übung oft nur dem Namen nach nicht). -->
        <button type="button" class="swap-thumb-btn" :aria-label="t('swap.preview', { name: getTranslatedExerciseName(item.entry.name_en) })" @click="openPreview(item.entry)">
          <img :src="thumbOf(item.entry)" alt="" class="swap-thumb" @error="onThumbError" />
        </button>
        <button type="button" class="swap-item" @click="choose(item.entry)">
          <span class="swap-name">{{ getTranslatedExerciseName(item.entry.name_en) }}</span>
          <span class="swap-kind" :class="`swap-kind--${item.kind}`">{{ t(`swap.kind.${item.kind}`) }}</span>
        </button>
      </div>
      <p v-if="!suggestions.length" class="swap-hint">{{ t('swap.empty') }}</p>
      <button type="button" class="swap-search" @click="openSearch">{{ t('swap.search') }}</button>
    </div>
  </AppModal>

  <!-- Bild/Video groß -->
  <Teleport to="body">
    <div v-if="previewEntry" class="swap-preview-overlay" role="presentation" @click.self="closePreview">
      <div class="swap-preview" role="dialog" aria-modal="true" :aria-label="getTranslatedExerciseName(previewEntry.name_en)">
        <strong>{{ getTranslatedExerciseName(previewEntry.name_en) }}</strong>
        <video v-if="isVideoUrl(previewUrl)" :src="previewUrl" class="swap-preview-media" autoplay muted loop playsinline @error="onPreviewVideoError"></video>
        <img v-else :src="previewUrl" :alt="getTranslatedExerciseName(previewEntry.name_en)" class="swap-preview-media" />
        <p class="swap-hint">{{ t('workoutDetail.mediaDisclaimer') }}</p>
        <button type="button" class="swap-preview-close" @click="closePreview">{{ t('common.close') }}</button>
      </div>
    </div>
  </Teleport>

  <!-- 2. Eigene Suche im Übungskatalog -->
  <AppModal
    v-model="searchOpen"
    :title="t('swap.searchTitle')"
    :confirm-text="t('swap.searchConfirm')"
    :cancel-text="t('common.cancel')"
    :close-on-confirm="false"
    type="info"
    @confirm="confirmSearch"
    @cancel="emit('update:modelValue', false)"
  >
    <div class="swap-picker">
      <ExerciseList
        :show-title="false"
        :show-controls="true"
        :items="allExercises"
        :selectable="true"
        :selected-ids="pickedIds"
        :user-id="userId"
        @toggle="togglePicked"
        @custom-added="emit('custom-added')"
      />
    </div>
  </AppModal>

  <!-- 3. Nur heute oder auch im Plan-Tag (nur bei Plan-Training) -->
  <AppModal
    v-model="scopeOpen"
    :title="t('swap.scopeTitle')"
    :message="scopeMessage"
    :confirm-text="t('swap.scopeToday')"
    :extra-text="t('swap.scopePlan', { day: planDayLabel })"
    :cancel-text="t('common.cancel')"
    type="info"
    @confirm="finish('today')"
    @extra="finish('plan')"
    @cancel="emit('update:modelValue', false)"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/AppModal.vue'
import ExerciseList from '@/components/ExerciseList.vue'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { getSwapSuggestions } from '@/utils/exerciseSwaps'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { resolveExerciseMedia, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { resolveServerMediaUrl } from '@/api/http'
import { useScrollLock } from '@/composables/useScrollLock'

// „Übung wechseln“ (Absprache Paul 28.10.): Ersatz-Vorschläge (Einsteiger-freundlich zuerst), eigene Suche und bei einem
// Plan-Training die Frage „nur heute“ oder „auch im Plan-Tag“. Die Komponente ersetzt nichts selbst, sie meldet nur die Wahl.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  exercise: { type: Object, default: null },
  excludeNames: { type: Array, default: () => [] },
  allExercises: { type: Array, default: () => [] },
  userId: { type: String, default: '' },
  // Plan-Tag, zu dem das Workout gehört: nur dann kommt die Frage „nur heute / auch im Plan-Tag“.
  planDayLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'swap', 'custom-added'])

const { t } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const listOpen = ref(false)
const searchOpen = ref(false)
const scopeOpen = ref(false)
const loading = ref(false)
const catalog = ref([])
const chosen = ref(null)
const pickedEntry = ref(null)

watch(() => props.modelValue, async (open) => {
  listOpen.value = open
  if (!open) return
  chosen.value = null
  pickedEntry.value = null
  loading.value = true
  try {
    catalog.value = await loadDefaultExercises()
  } catch {
    catalog.value = []
  } finally {
    loading.value = false
  }
})

const suggestions = computed(() => getSwapSuggestions({
  exercise: props.exercise,
  catalog: catalog.value,
  exclude: props.excludeNames
}))

// --- Bild/Video-Vorschau (gleiche Quellen wie im Workout, siehe WorkoutDetailView openExerciseMedia) ---------------
const PLACEHOLDER = '/exercises/play.svg'
const isVideoUrl = (url) => typeof url === 'string' && /\.mp4($|[?#])/i.test(url)
const isGif = (url) => /\.gif($|[?#])/i.test(url)

function thumbOf(entry) {
  const image = typeof entry?.imageUrl === 'string' ? resolveServerMediaUrl(entry.imageUrl) : ''
  return entry?.thumbnailStaticUrl || entry?.thumbnailUrl || (image && !isGif(image) ? image : '') || PLACEHOLDER
}

function largeImageOf(entry) {
  const image = typeof entry?.imageUrl === 'string' ? resolveServerMediaUrl(entry.imageUrl) : ''
  return (image && !isGif(image) ? image : '') || entry?.thumbnailUrl || entry?.thumbnailStaticUrl || PLACEHOLDER
}

function onThumbError(evt) {
  const img = evt?.target
  if (!img || img.src.includes('play.svg')) return
  img.onerror = null
  img.src = PLACEHOLDER
}

const previewEntry = ref(null)
const previewUrl = ref('')
let previewRequest = 0
const { lock, unlock } = useScrollLock()

function openPreview(entry) {
  const request = ++previewRequest
  previewEntry.value = entry
  previewUrl.value = buildExerciseMediaUrl(entry, 360, 'mp4') || largeImageOf(entry)
  lock()
  resolveExerciseMedia(entry, {
    size: 360,
    fallbackUrl: previewUrl.value,
    onResolved: (url) => { if (previewEntry.value && previewRequest === request) previewUrl.value = url }
  }).catch(() => {})
}

// Kein Video vorhanden oder nicht ladbar: stattdessen das Foto groß zeigen.
function onPreviewVideoError() {
  if (!previewEntry.value) return
  previewRequest += 1
  previewUrl.value = largeImageOf(previewEntry.value)
}

function closePreview() {
  if (!previewEntry.value) return
  previewEntry.value = null
  previewUrl.value = ''
  unlock()
}

onBeforeUnmount(closePreview)

function onListToggle(open) {
  // Schließen der Liste meldet nur dann „zu“, wenn nicht gerade Suche oder Rückfrage folgen.
  if (!open && !searchOpen.value && !scopeOpen.value) emit('update:modelValue', false)
}

function choose(entry) {
  chosen.value = entry
  listOpen.value = false
  searchOpen.value = false
  if (props.planDayLabel) {
    scopeOpen.value = true
    return
  }
  finish('today')
}

function openSearch() {
  pickedEntry.value = null
  listOpen.value = false
  searchOpen.value = true
}

const entryId = (entry) => String(entry?._id || entry?.exerciseId || entry?.id || entry?.mediaId || '')
const pickedIds = computed(() => (pickedEntry.value ? [entryId(pickedEntry.value)] : []))

function togglePicked(entry) {
  pickedEntry.value = entryId(entry) === entryId(pickedEntry.value) ? null : entry
}

function confirmSearch() {
  if (pickedEntry.value) choose(pickedEntry.value)
}

const scopeMessage = computed(() => t('swap.scopeMessage', {
  old: getTranslatedExerciseName(props.exercise?.name || ''),
  new: getTranslatedExerciseName(chosen.value?.name_en || chosen.value?.name || '')
}))

function finish(scope) {
  const entry = chosen.value
  scopeOpen.value = false
  emit('update:modelValue', false)
  if (entry) emit('swap', { entry, scope })
  chosen.value = null
}
</script>

<style scoped>
.swap-hint { margin: 0 0 10px; color: var(--muted); font-size: 0.85rem; line-height: 1.4; }
.swap-list { display: grid; gap: 8px; }
.swap-row { display: flex; align-items: stretch; gap: 8px; }
.swap-thumb-btn { flex: 0 0 auto; width: 56px; padding: 0; border-radius: 12px; border: 1px solid var(--card-border); background: var(--surface); overflow: hidden; cursor: pointer; }
.swap-thumb { width: 100%; height: 100%; min-height: 52px; object-fit: cover; display: block; }
.swap-item { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 52px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.swap-name { min-width: 0; overflow-wrap: anywhere; }
.swap-kind { flex: 0 0 auto; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--card-border); color: var(--muted); font-size: 0.72rem; font-weight: 600; }
.swap-kind--machine { border-color: var(--accent); color: var(--accent); }
.swap-search { min-height: 48px; border: none; background: transparent; color: var(--accent); font: inherit; font-weight: 700; text-align: left; padding: 0 4px; cursor: pointer; }
.swap-picker { max-height: 60vh; overflow-y: auto; }
.swap-preview-overlay { position: fixed; inset: 0; z-index: 1400; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(8, 13, 22, 0.72); }
.swap-preview { display: flex; flex-direction: column; gap: 10px; width: min(90vw, 520px); padding: 16px; border-radius: 16px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.swap-preview-media { width: 100%; height: auto; border-radius: 12px; background: var(--surface); border: 1px solid var(--card-border); }
.swap-preview-close { min-height: 44px; border: none; border-radius: 12px; background: var(--accent); color: var(--accent-contrast, #060606); font: inherit; font-weight: 800; cursor: pointer; }
</style>
