<template>
  <div class="exercise-picker">
    <div class="picker-header" v-if="showHeader">
      <h4>{{ title }}</h4>
      <button class="close-picker" v-if="showClose" @click="$emit('close')">×</button>
    </div>
    <div class="search-row" v-if="showSearch">
      <input
        class="search-input"
        type="text"
        :placeholder="searchPlaceholder"
        v-model="search"
      />
    </div>
    <div class="picker-list" role="list">
      <div v-if="loading" class="picker-loading">{{ loadingText }}</div>
      <div v-else class="exercises-grid">
        <div
          v-for="ex in filtered"
          :key="ex._id"
          class="exercise-item"
          role="button"
          @click="$emit('select', ex)"
        >
          <div class="thumb-row">
            <img
              :src="getExerciseListImage(ex)"
              :alt="getName(ex)"
              class="thumb"
              loading="lazy"
              decoding="async"
              @error="onImgError($event, ex)"
              @click.stop="openMedia(ex)"
            />
            <div class="meta">
              <span class="title">{{ getName(ex) }}</span>
              <span class="sub">{{ getCategory(ex) }} · {{ getMuscle(ex) }}</span>
            </div>
          </div>
          <p class="desc">{{ getDescription(ex) }}</p>
          <p class="equip">{{ equipmentLabel }}: {{ getEquipment(ex) }}</p>
        </div>
      </div>
    </div>
    <div class="picker-actions" v-if="showDone">
      <button class="done-btn" @click="$emit('done')">{{ doneLabel }}</button>
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
          :alt="getName(mediaExercise)"
          class="media-image"
        />
        <button class="close-btn" @click="closeMedia">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { resolveExerciseMedia, getExerciseThumb, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { searchAndRankExercises } from '@/utils/exerciseSearch'

const props = defineProps({
  exercises: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showHeader: { type: Boolean, default: false },
  showClose: { type: Boolean, default: false },
  showSearch: { type: Boolean, default: false },
  showDone: { type: Boolean, default: false },
  title: { type: String, default: 'Übungen' },
  searchPlaceholder: { type: String, default: 'Suchen…' },
  bodyweightLabel: { type: String, default: 'Bodyweight' },
  doneLabel: { type: String, default: 'Fertig' },
  translateName: { type: Function, default: (n) => n },
  translateMuscle: { type: Function, default: (m) => m },
  translateCategory: { type: Function, default: (c) => c },
  translateEquipment: { type: Function, default: (e) => e },
  getDescription: { type: Function, default: () => '' },
  equipmentLabel: { type: String, default: 'Equipment' }
})

const search = ref('')
const brokenImageIds = ref(new Set())
const mediaExercise = ref(null)
const mediaUrl = ref('')
const mediaRequestId = ref(0)
const isVideoUrl = (url) => typeof url === 'string' && /\.mp4($|[?#])/i.test(url)

const filtered = computed(() => {
  const q = search.value.trim()
  const list = Array.isArray(props.exercises) ? props.exercises : []

  const safeTranslate = (fn, val) => {
    try {
      const out = typeof fn === 'function' ? fn(val) : val
      return typeof out === 'string' ? out : (out == null ? '' : String(out))
    } catch {
      return String(val || '')
    }
  }

  if (!q) return list

  return searchAndRankExercises(list, q, {
    getPrimaryText: (exercise) => safeTranslate(props.translateName, exercise?.name),
    getSecondaryTexts: (exercise) => [
      safeTranslate(props.translateName, exercise?.name_en || ''),
      safeTranslate(props.translateMuscle, exercise?.muscleGroup),
      safeTranslate(props.translateCategory, exercise?.category),
      safeTranslate(props.translateEquipment, exercise?.equipment)
    ]
  })
})

function getName(ex) {
  try {
    const out = props.translateName ? props.translateName(ex?.name) : ex?.name
    return typeof out === 'string' ? out : (out == null ? '' : String(out))
  } catch {
    return String(ex?.name || '')
  }
}
function getMuscle(ex) {
  try {
    const mg = ex?.muscleGroup
    const out = props.translateMuscle ? props.translateMuscle(mg) : mg
    return typeof out === 'string' ? out : (out == null ? '' : String(out))
  } catch {
    return String(ex?.muscleGroup || '')
  }
}

function getCategory(ex) {
  try {
    const cat = ex?.category
    const out = props.translateCategory ? props.translateCategory(cat) : cat
    return typeof out === 'string' ? out : (out == null ? '' : String(out))
  } catch {
    return String(ex?.category || '')
  }
}

function getEquipment(ex) {
  try {
    const eq = ex?.equipment || props.bodyweightLabel
    const out = props.translateEquipment ? props.translateEquipment(eq) : eq
    return typeof out === 'string' ? out : (out == null ? '' : String(out))
  } catch {
    return String(ex?.equipment || props.bodyweightLabel || '')
  }
}

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

function openMedia(ex) {
  if (!ex) return
  const requestId = ++mediaRequestId.value
  mediaExercise.value = ex
  const fallbackMp4 = buildExerciseMediaUrl(ex, 360, 'mp4')
  mediaUrl.value = fallbackMp4 || getExerciseLargeImage(ex) || getExerciseThumb(ex)
  resolveExerciseMedia(ex, {
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
.picker-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--card-border); }
.picker-list { padding:12px 16px; overflow:auto; }
.picker-loading { text-align:center; padding:16px; color:var(--muted); }
.exercises-grid { display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.exercise-item { background: var(--card-bg); border-radius:12px; padding:16px; border:1px solid var(--card-border); box-shadow:var(--shadow-soft); cursor:pointer; transition:all 0.2s; display:flex; flex-direction:column; gap:6px; }
.thumb-row { display:flex; align-items:center; gap:12px; }
.thumb { width:56px; height:56px; border-radius:12px; object-fit:cover; background: var(--surface); flex:0 0 auto; cursor: pointer; }
.meta { display:flex; flex-direction:column; gap:4px; }
.title { font-weight:700; color: var(--accent-color); font-size:1.05rem; }
.sub { color: var(--muted); font-size:0.9rem; }
.desc { color: var(--muted); font-size:0.9rem; line-height:1.35; }
.equip { color: var(--muted); font-size:0.85rem; }
.search-row { margin:8px 16px; }
.search-input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.picker-actions { padding: 12px 16px 16px; border-top: 1px solid var(--card-border); }
.done-btn { width:100%; padding:12px; border:none; border-radius:10px; background: var(--accent); color: var(--accent-contrast); font-weight:600; }
.close-picker { background:transparent; border:none; color:var(--fg); font-size:1.1rem; cursor:pointer; }
.media-overlay { position:fixed; inset:0; background: rgba(0,0,0,0.35); z-index: 1000; display:flex; align-items:center; justify-content:center; }
.media-content { background: var(--card-bg); color: var(--fg); border-radius: 14px; box-shadow: 0 4px 24px rgba(0,0,0,0.18); padding: 18px; max-width: 360px; width: 90vw; text-align: center; }
.media-image { width: 100%; height: auto; border-radius: 12px; }
.close-btn { background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 8px; padding: 7px 18px; font-size: 1rem; cursor: pointer; font-weight: 600; margin-top: 10px; }
</style>