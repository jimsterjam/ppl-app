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
          <div class="ex-row">
            <span class="title">{{ getName(ex) }}</span>
            <span class="sub">{{ getMuscle(ex) }}</span>
            <span class="sub small">{{ ex.equipment || bodyweightLabel }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="picker-actions" v-if="showDone">
      <button class="done-btn" @click="$emit('done')">{{ doneLabel }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

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
})

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
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

  return list.filter(ex => {
    const name = safeTranslate(props.translateName, ex?.name).toLowerCase()
    const muscle = safeTranslate(props.translateMuscle, ex?.muscleGroup).toLowerCase()
    return name.includes(q) || muscle.includes(q)
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
</script>

<style scoped>
.picker-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--card-border); }
.picker-list { padding:12px 16px; overflow:auto; }
.picker-loading { text-align:center; padding:16px; color:var(--muted); }
.exercises-grid { display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.exercise-item { background: var(--card-bg, #fff); border-radius:12px; padding:16px; border:1px solid var(--card-border, #e5e7eb); box-shadow:0 2px 8px rgba(0,0,0,0.04); cursor:pointer; transition:all 0.2s; display:flex; flex-direction:column; gap:6px; }
.ex-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.title { font-weight:700; color: var(--accent-color); font-size:1.05rem; }
.sub { color: var(--muted); font-size:0.9rem; }
.sub.small { font-size:0.85rem; margin-left:auto; }
.search-row { margin:8px 16px; }
.search-input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.picker-actions { padding: 12px 16px 16px; border-top: 1px solid var(--card-border); }
.done-btn { width:100%; padding:12px; border:none; border-radius:10px; background: var(--accent); color: var(--accent-contrast); font-weight:600; }
.close-picker { background:transparent; border:none; color:var(--fg); font-size:1.1rem; cursor:pointer; }
</style>