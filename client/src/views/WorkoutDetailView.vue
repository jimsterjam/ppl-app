<template>
  <div class="workout-detail">
    <HeaderBar title="Workout" />

    <div class="content">
      <div v-if="loading" class="loading">Lade Workout...</div>

      <div v-else-if="error" class="error">
        <p>Fehler beim Laden des Workouts.</p>
        <small>{{ error }}</small>
      </div>

      <div v-else-if="!workout" class="empty">
        <p>Kein Workout gefunden.</p>
      </div>

      <div v-else class="workout">
        <div v-if="createdBanner" class="banner success">
          Workout erstellt.
          <button class="dismiss" @click="createdBanner=false">✕</button>
        </div>
        <div v-if="draftBanner" class="banner warning">
          Lokaler Entwurf – bitte anmelden, um dauerhaft zu speichern.
          <button class="dismiss" @click="draftBanner=false">✕</button>
        </div>
        <h2 class="title">{{ workout.name }}</h2>
        <p class="meta">
          <span class="badge">{{ workout.type?.toUpperCase() }}</span>
          <span>{{ formatDate(workout.date) }}</span>
          <span v-if="workout.completed" class="completed">✓ Abgeschlossen</span>
        </p>

        <div class="ex-list">
          <div class="ex-list-header">
            <h3>Übungen</h3>
            <button class="reorder-toggle" :aria-pressed="isReordering" @click="toggleReorder">
              {{ isReordering ? 'Fertig' : 'Reihenfolge bearbeiten' }}
            </button>
          </div>
          <div v-if="isDirty" class="banner dirty">Ungespeicherte Änderungen</div>
          <p v-if="isReordering" class="reorder-hint">Ziehen und ablegen, um die Reihenfolge zu ändern.</p>
          <div
            v-for="(ex, i) in workout.exercises || []"
            :key="ex.exerciseId || i"
            class="ex-item"
            :class="{ reordering: isReordering }"
            :draggable="isReordering"
            @dragstart="onDragStart(i)"
            @dragover.prevent="onDragOver(i)"
            @drop.prevent="onDrop(i)"
          >
            <button v-if="isReordering" class="drag-handle" title="Ziehen zum Umordnen">⋮⋮</button>
            <div class="ex-header">
              <strong>{{ ex.name }}</strong>
              <small>{{ ex.muscleGroup }}</small>
            </div>
            <div class="ex-sets">
              <div class="set-row header">
                <span class="col set">Satz</span>
                <span class="col reps">Reps</span>
                <span class="col weight">Gewicht</span>
                <span class="col actions">Aktion</span>
              </div>
              <div
                v-for="(row, rIdx) in (ex.setDetails || [])"
                :key="`${ex.exerciseId || i}-row-${rIdx}`"
                class="set-row"
              >
                <span class="col set">{{ rIdx + 1 }}</span>
                <span class="col reps">
                  <input v-model.number="row.reps" type="number" min="1" max="50" inputmode="numeric" />
                </span>
                <span class="col weight">
                  <div class="weight-input">
                    <input v-model.number="row.weight" type="number" min="0" max="400" step="0.5" inputmode="decimal" />
                    <span class="unit">kg</span>
                  </div>
                </span>
                <span class="col actions">
                  <button class="remove-row-btn" title="Satz entfernen" @click="removeSetRow(i, rIdx)">−</button>
                </span>
              </div>
              <div class="row-actions">
                <button class="add-row-btn" title="Satz hinzufügen" @click="addSetRow(i)">＋</button>
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="primary" :disabled="saving" @click="saveWorkout">
              {{ saving ? 'Speichere…' : 'Speichern' }}
            </button>
            <small v-if="saveMsg" class="save-msg" :class="{ error: saveError }">{{ saveMsg }}</small>
          </div>
        </div>

        <div class="actions">
          <button class="primary" @click="goDashboard">Abbrechen</button>
        </div>
      </div>
    </div>

    <BottomNav />
    
    <!-- Bestätigungsmodal bei ungespeicherten Änderungen -->
    <AppModal
      v-model="showLeaveModal"
      title="Änderungen verwerfen?"
      message="Du hast ungespeicherte Änderungen. Wirklich zum Dashboard zurückkehren?"
      confirm-text="Verwerfen und zurück"
      cancel-text="Weiter bearbeiten"
      type="warning"
      @confirm="confirmLeave"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, useClerk } from '@clerk/vue'
import { getAuthToken } from '@/utils/authToken'
import { fetchWorkout } from '@/api/workouts'
import { useUserStore } from '@/stores/userStore'
import HeaderBar from '@/components/HeaderBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const clerk = useClerk()

const store = useUserStore()
const workout = ref(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const createdBanner = ref(false)
const saveMsg = ref('')
const saveError = ref(false)
const draftBanner = ref(false)
const isReordering = ref(false)
const draggingIndex = ref(null)
const isDirty = ref(false)
let initialSnapshot = ''
const showLeaveModal = ref(false)

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('de-DE')
  } catch {
    return String(dateStr)
  }
}

async function loadWorkout() {
  loading.value = true
  error.value = ''
  try {
    const id = route.params.id
    // Banner aus Query ableiten
    if (route.query.created === '1') createdBanner.value = true
    if (route.query.draft === '1') draftBanner.value = true
    // Draft-Fall: Aus Store lesen und nicht vom Server
    if (String(id).startsWith('draft-')) {
      workout.value = store.workouts.find(w => w._id === id) || null
      return
    }
  const token = await getAuthToken({ clerk, auth }).catch(() => null)
    const data = await fetchWorkout(id, token)
    workout.value = data || null
  } catch (e) {
    console.error('Workout laden fehlgeschlagen:', e)
    error.value = e?.message || 'Unbekannter Fehler'
  } finally {
    loading.value = false
  }
}

function goDashboard() {
  if (isDirty.value) {
    showLeaveModal.value = true
    return
  }
  router.push('/dashboard')
}

function confirmLeave() {
  router.push('/dashboard')
}

function toggleReorder() {
  isReordering.value = !isReordering.value
}

function ensureSetDetailsStructure() {
  if (!workout.value || !Array.isArray(workout.value.exercises)) return
  workout.value.exercises = workout.value.exercises.map(ex => ({
    ...ex,
    setDetails: Array.isArray(ex.setDetails) && ex.setDetails.length > 0
      ? ex.setDetails
      : [{ reps: ex.reps || 10, weight: ex.weight || 0 }]
  }))
}

function addSetRow(exIndex) {
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex) return
  if (!Array.isArray(ex.setDetails)) ex.setDetails = []
  ex.setDetails.push({ reps: ex.setDetails.at(-1)?.reps || 10, weight: ex.setDetails.at(-1)?.weight || 0 })
}

function removeSetRow(exIndex, rowIndex) {
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex || !Array.isArray(ex.setDetails)) return
  ex.setDetails.splice(rowIndex, 1)
  if (ex.setDetails.length === 0) {
    // Halte immer mindestens eine Zeile bereit für bessere UX
    ex.setDetails.push({ reps: ex.reps || 10, weight: ex.weight || 0 })
  }
}

async function saveWorkout() {
  try {
    saving.value = true
    const id = route.params.id
    // Aggregiere optionale Legacy-Felder aus erstem Satz und behalte setDetails
    const normalized = {
      ...workout.value,
      exercises: (workout.value.exercises || []).map(ex => ({
        ...ex,
        sets: Array.isArray(ex.setDetails) ? ex.setDetails.length : ex.sets || 0,
        reps: ex.setDetails?.[0]?.reps ?? ex.reps ?? 10,
        weight: ex.setDetails?.[0]?.weight ?? ex.weight ?? 0,
        setDetails: ex.setDetails || [] // Übertrage die setDetails!
      }))
    }
    
    // Draft-Workouts nur lokal aktualisieren
    if (String(id).startsWith('draft-')) {
      const idx = store.workouts.findIndex(w => w._id === id)
      if (idx !== -1) {
        store.workouts[idx] = { ...store.workouts[idx], ...normalized }
      }
      saveMsg.value = 'Gespeichert (Entwurf lokal).'
      saveError.value = false
      // Direkt zurück zum Dashboard – kein zusätzlicher Toast nötig
      router.push('/dashboard')
      return
    }
  let token = await getAuthToken({ clerk, auth }).catch(() => null)
  if (!token) token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
    await store.updateWorkout(id, normalized, token)
    saveMsg.value = 'Gespeichert.'
    saveError.value = false
    // Direkt weiterleiten – ein separater Toast ist hier nicht erforderlich
    router.push('/dashboard')
  } catch (e) {
    console.error('Speichern fehlgeschlagen:', e)
    error.value = e?.message || 'Speichern fehlgeschlagen'
    saveMsg.value = 'Speichern fehlgeschlagen.'
    saveError.value = true
  } finally {
    saving.value = false
  }
}

function onDragStart(index) {
  if (!isReordering.value) return
  draggingIndex.value = index
}

function onDragOver(_index) {
  // Optional: visuelle Platzhalter
}

function onDrop(index) {
  if (!isReordering.value) return
  const from = draggingIndex.value
  const to = index
  if (from === null || to === null || from === to) return
  const list = workout.value?.exercises
  if (!Array.isArray(list)) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  draggingIndex.value = null
}

onMounted(async () => { await loadWorkout(); ensureSetDetailsStructure() })

// Snapshot initialisieren, nachdem Daten geladen und normalisiert wurden
watch(workout, (w, _prev) => {
  if (w && !initialSnapshot) {
    try {
      const core = {
        name: w.name,
        type: w.type,
        date: w.date,
        exercises: (w.exercises || []).map(ex => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          setDetails: (ex.setDetails || []).map(s => ({ reps: s.reps, weight: s.weight }))
        }))
      }
      initialSnapshot = JSON.stringify(core)
    } catch {}
  }
}, { immediate: true })

// Dirty-Tracking bei Änderungen
watch(() => workout.value, (w) => {
  if (!w || !initialSnapshot) { isDirty.value = false; return }
  try {
    const core = {
      name: w.name,
      type: w.type,
      date: w.date,
      exercises: (w.exercises || []).map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        setDetails: (ex.setDetails || []).map(s => ({ reps: s.reps, weight: s.weight }))
      }))
    }
    isDirty.value = JSON.stringify(core) !== initialSnapshot
  } catch {
    isDirty.value = true
  }
}, { deep: true })

// Warnung beim Schließen/Reload
function beforeUnloadHandler(e) {
  if (!isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnloadHandler))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadHandler))

// Token-Helfer wird zentral aus '@/utils/authToken' importiert

// Abschluss-Flow entfernt – Speichern/Redirect ist der primäre Abschlussweg
</script>

<style scoped>
.workout-detail { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 80px; }
.content { padding: 16px; }
.loading, .empty, .error { text-align: center; color: var(--muted); padding: 40px 0; }
.title { margin: 0 0 8px 0; }
.meta { display: flex; gap: 12px; color: var(--muted); margin-bottom: 16px; align-items: center; }
.badge { background: var(--surface); color: var(--fg); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid var(--card-border); }
.completed { color: #4ade80; font-weight: 600; }
.ex-list { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; }
.ex-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.reorder-toggle { background: var(--surface); color: var(--fg); border: 1px solid var(--card-border); border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.reorder-hint { color: var(--muted); margin: 4px 0 8px; font-size: 0.9rem; }
.ex-item { padding: 12px 0; border-bottom: 1px solid var(--card-border); }
.ex-item:last-child { border-bottom: none; }
.ex-item.reordering { cursor: move; }
.drag-handle { background: transparent; border: none; color: var(--muted); cursor: grab; font-size: 18px; margin-right: 8px; }
.ex-header { display: flex; justify-content: space-between; color: var(--fg); }
.ex-header small { color: var(--muted); }
.ex-details { display: flex; gap: 12px; color: var(--muted); margin-top: 6px; }
.ex-sets { margin-top: 8px; }
.set-row { display: grid; grid-template-columns: 60px 1fr 1fr 80px; gap: 12px; align-items: center; padding: 6px 0; }
.set-row.header { color: var(--muted); font-size: 0.8rem; padding-top: 0; }
.set-row .col input { width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); text-align: center; }
.weight-input { position: relative; }
.weight-input .unit { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.8rem; pointer-events: none; }
.add-row-btn { background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
.remove-row-btn { background: var(--danger-color); color: #fff; border: none; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; }
.actions { margin-top: 16px; display: flex; gap: 8px; }
.primary { width: 100%; padding: 14px; border-radius: 12px; border: none; cursor: pointer; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
.complete { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #4ade80; cursor: pointer; background: rgba(74, 222, 128, 0.1); color: #4ade80; font-weight: 600; }
.banner { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 0.9rem; }
.banner.success { background: color-mix(in oklab, var(--success-color) 20%, transparent); border: 1px solid color-mix(in oklab, var(--success-color) 50%, transparent); color: var(--fg); }
.banner.warning { background: color-mix(in oklab, var(--warning-color) 20%, transparent); border: 1px solid color-mix(in oklab, var(--warning-color) 50%, transparent); color: var(--fg); }
.banner.dirty { background: rgba(244,114,182,0.12); border: 1px solid rgba(244,114,182,0.4); color: #fbcfe8; margin-bottom: 8px; }
.banner .dismiss { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 1rem; }
.save-msg { display: block; margin-top: 8px; color: var(--success-color); }
.save-msg.error { color: var(--danger-color); }
</style>
