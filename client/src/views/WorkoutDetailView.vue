<template>
  <div class="workout-detail">
    <HeaderBar title="Workout" />

    <!-- Kleiner Timer (startet automatisch bei frisch erstelltem Workout) -->
  <WorkoutTimer :auto-start="route.query.created === '1'" @stop="onTimerStop" />

    <div class="content">
  <div v-if="loading" class="loading">{{ t('workoutDetail.loading') }}</div>

      <div v-else-if="error" class="error">
        <p>{{ t('workoutDetail.loadError') }}</p>
        <small>{{ error }}</small>
      </div>

      <div v-else-if="!workout" class="empty">
        <p>{{ t('workoutDetail.notFound') }}</p>
      </div>

      <div v-else class="workout">
        <div v-if="draftBanner" class="banner warning">
          {{ t('workoutDetail.localDraft') }}
          <button class="dismiss" @click="draftBanner=false">✕</button>
        </div>
        <h2 class="title">{{ workout.name }}</h2>
        <p class="meta">
          <span class="badge">{{ workout.type?.toUpperCase() }}</span>
          <span>{{ formatDate(workout.date) }}</span>
          <span v-if="workout.completed" class="completed">✓ {{ t('workoutDetail.completed') }}</span>
        </p>

  <div id="exercises" ref="exListRef" class="ex-list glass">
          <div class="ex-list-header">
            <h3>{{ t('workoutDetail.exercises') }}</h3>
            <button class="reorder-toggle" :aria-pressed="isReordering" @click="toggleReorder">
              {{ isReordering ? t('workoutDetail.done') : t('workoutDetail.editOrder') }}
            </button>
          </div>
          <div v-if="isDirty" class="banner dirty">{{ t('workoutDetail.unsaved') }}</div>
          <p v-if="isReordering" class="reorder-hint">{{ t('workoutDetail.reorderHint') }}</p>
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
            <button v-if="isReordering" class="drag-handle" :title="t('workoutDetail.dragToReorder')">⋮⋮</button>
            <div class="ex-header">
              <strong>{{ ex.name }}</strong>
              <small>{{ ex.muscleGroup }}</small>
            </div>
            <div class="ex-media">
              <img :src="getExerciseImage(ex)" :alt="t('common.image')" class="ex-thumb" @click="onExerciseImageClick(ex)" @error="onImgError" />
              <div class="img-actions" v-if="ex.imageUrl || ex.thumbnailUrl">
                <button class="link" @click.prevent="replaceExerciseImage(ex)">{{ t('common.replace') }}</button>
                <span class="sep">•</span>
                <button class="link danger" @click.prevent="openRemoveModal(ex)">{{ t('common.remove') }}</button>
              </div>
              <small class="media-hint">{{ t('workoutDetail.tapImage', { action: ex.imageUrl || ex.thumbnailUrl ? t('workoutDetail.enlarge') : t('workoutDetail.add') }) }}</small>
            </div>
            <div class="ex-sets">
              <div class="set-row header">
                <span class="col set">{{ t('workoutDetail.set') }}</span>
                <span class="col reps">{{ t('workoutDetail.reps') }}</span>
                <span class="col weight">{{ t('workoutDetail.weight') }}</span>
                <span class="col actions">{{ t('workoutDetail.actions') }}</span>
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
                  <button class="remove-row-btn" :title="t('workoutDetail.removeSet')" @click="removeSetRow(i, rIdx)">−</button>
                </span>
              </div>
              <div class="row-actions">
                <button class="add-row-btn" :title="t('workoutDetail.addSet')" @click="addSetRow(i)">＋</button>
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="primary" :disabled="saving" @click="saveWorkout">
              {{ saving ? t('workoutDetail.saving') : t('workoutDetail.save') }}
            </button>
            <small v-if="saveMsg" class="save-msg" :class="{ error: saveError }">{{ saveMsg }}</small>
          </div>
        </div>

        <div class="actions">
          <button class="primary" @click="goDashboard">{{ t('workoutDetail.cancel') }}</button>
        </div>
      </div>
    </div>

    <BottomNav />
    
    <!-- Vollbild-Bildvorschau -->
    <div v-if="preview.open" class="img-overlay" @click="closePreview">
      <img :src="preview.url" alt="Preview" class="img-large" />
    </div>
    
    <!-- Unsichtbarer File-Input für Uploads -->
    <input ref="uploadInput" type="file" accept="image/*" capture="environment" style="display:none" @change="onUploadSelected" />
    
    <!-- Bestätigungsmodal bei ungespeicherten Änderungen -->
    <AppModal
      v-model="showLeaveModal"
      :title="t('workoutDetail.cancel')"
      :message="t('workoutDetail.leaveConfirm')"
      :confirm-text="t('workoutDetail.leaveConfirmBack')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="confirmLeave"
    />

    <!-- Bestätigungsmodal für Foto-Entfernen -->
    <AppModal
      v-model="showRemoveModal"
      :title="t('workoutDetail.removePhotoTitle')"
      :message="t('workoutDetail.removePhotoMsg')"
      :confirm-text="t('common.remove')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="confirmRemoveImage"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, useClerk } from '@clerk/vue'
import { getAuthToken } from '@/utils/authToken'
import { fetchWorkout } from '@/api/workouts'
import { fetchExercise, fetchExercises, uploadExerciseImage, deleteExerciseImage } from '@/api/exercises'
import { useUserStore } from '@/stores/userStore'
import HeaderBar from '@/components/HeaderBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'
import WorkoutTimer from '@/components/WorkoutTimer.vue'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const clerk = useClerk()
const { t, locale } = useI18n()

const store = useUserStore()
const toast = useToastStore()
const workout = ref(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveMsg = ref('')
const saveError = ref(false)
const draftBanner = ref(false)
const isReordering = ref(false)
const draggingIndex = ref(null)
const isDirty = ref(false)
const exListRef = ref(null)
const didAutoScroll = ref(false)
let initialSnapshot = ''
const showLeaveModal = ref(false)
const showRemoveModal = ref(false)
const removeTarget = ref(null)
const uploadInput = ref(null)
const uploadTarget = ref(null)
const preview = reactive({ open: false, url: '' })

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
    return d.toLocaleString(loc)
  } catch {
    return String(dateStr)
  }
}

function snapshotCore(w) {
  if (!w) return ''
  try {
    const core = {
      name: w.name,
      type: w.type,
      date: w.date,
      completed: w.completed,
      exercises: (w.exercises || []).map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        setDetails: (ex.setDetails || []).map(s => ({ reps: s.reps, weight: s.weight }))
      }))
    }
    return JSON.stringify(core)
  } catch {
    return ''
  }
}

async function loadWorkout() {
  loading.value = true
  error.value = ''
  try {
    const id = route.params.id
    if (route.query.draft === '1') draftBanner.value = true
    // Nur Toast bei frisch erstellt (kein Banner, um Layout-Jitter zu vermeiden)
    if (route.query.created === '1') {
      toast.show(t('dashboard.successCreated'), { type: 'success', duration: 3000 })
    }
    // Draft-Fall: lokal aus dem Store
    if (String(id).startsWith('draft-')) {
      workout.value = store.workouts.find(w => w._id === id) || null
      ensureSetDetailsStructure()
      await enrichExerciseImages()
      initialSnapshot = snapshotCore(workout.value)
      return
    }
    const token = await getAuthToken({ clerk, auth }).catch(() => null)
    const data = await fetchWorkout(id, token)
    workout.value = data || null
    ensureSetDetailsStructure()
    await enrichExerciseImages()
    initialSnapshot = snapshotCore(workout.value)
  } catch (e) {
    logger.error('Workout laden fehlgeschlagen:', e)
    error.value = e?.message || 'Unbekannter Fehler'
  } finally {
    loading.value = false
  }
}

async function enrichExerciseImages() {
  try {
    const list = workout.value?.exercises || []
    for (let idx = 0; idx < list.length; idx++) {
      const ex = list[idx]
      if (!ex.exerciseId) continue
      try {
        const full = await fetchExercise(ex.exerciseId)
        if (full?.imageUrl || full?.thumbnailUrl) {
          ex.imageUrl = full.imageUrl
          ex.thumbnailUrl = full.thumbnailUrl
        }
      } catch {}
    }
  } catch {}
}

function getExerciseImage(ex) {
  return ex?.thumbnailUrl || ex?.imageUrl || '/exercises/camera.svg'
}

function onImgError(evt) {
  const img = evt?.target
  if (img) { img.onerror = null; img.src = '/exercises/camera.svg' }
}

function onExerciseImageClick(ex) {
  if (ex?.imageUrl || ex?.thumbnailUrl) {
    preview.url = ex.imageUrl || ex.thumbnailUrl
    preview.open = true
    return
  }
  // Kein Bild vorhanden: Upload starten
  uploadTarget.value = ex
  // Versuche ggf. die Exercise-ID zu ermitteln, falls noch nicht vorhanden
  ensureExerciseId(uploadTarget.value).finally(() => {
    try {
      uploadInput.value?.setAttribute?.('accept', 'image/*')
      uploadInput.value?.setAttribute?.('capture', 'environment')
    } catch {}
    uploadInput.value?.click?.()
  })
}

function closePreview() { preview.open = false; preview.url = '' }

async function onUploadSelected(e) {
  const files = e?.target?.files || []
  if (!files.length || !uploadTarget.value) return
  const file = files[0]
  // Reset Input
  try { e.target.value = '' } catch {}
  try {
    let token = await getAuthToken({ clerk, auth }).catch(() => null)
    if (!token) token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
    const target = uploadTarget.value
    if (!target?.exerciseId) {
      const ok = await ensureExerciseId(target)
      if (!ok || !target.exerciseId) {
        logger.warn('Kein exerciseId für Upload ermittelbar – Upload abgebrochen')
        return
      }
    }
    const res = await uploadExerciseImage(target.exerciseId, file, token)
    const updated = res?.exercise
    if (updated) {
      const bust = `?t=${Date.now()}`
      target.imageUrl = (updated.imageUrl || '') + bust
      target.thumbnailUrl = (updated.thumbnailUrl || '') + bust
  toast.show(t('workoutDetail.toastUploaded'), { type: 'success', duration: 3000, position: 'top' })
    }
  } catch (err) {
  logger.warn('Bild-Upload fehlgeschlagen:', err)
  toast.show(t('workoutDetail.uploadFailed'), { type: 'error', duration: 3000 })
  } finally {
    uploadTarget.value = null
  }
}

function replaceExerciseImage(ex) {
  // Expliziter Upload-Start ohne Preview
  uploadTarget.value = ex
  ensureExerciseId(uploadTarget.value).finally(() => {
    try {
      uploadInput.value?.setAttribute?.('accept', 'image/*')
      uploadInput.value?.setAttribute?.('capture', 'environment')
    } catch {}
    uploadInput.value?.click?.()
  })
}

function openRemoveModal(ex) {
  removeTarget.value = ex
  showRemoveModal.value = true
}

async function confirmRemoveImage() {
  try {
    const ex = removeTarget.value
    if (!ex) return
    let token = await getAuthToken({ clerk, auth }).catch(() => null)
    if (!token) token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
    // Stelle sicher, dass eine exerciseId vorhanden ist
    if (!ex.exerciseId) {
      const okId = await ensureExerciseId(ex)
      if (!okId || !ex.exerciseId) {
  toast.show(t('workoutDetail.removeFailedNoId'), { type: 'error', duration: 3000 })
        return
      }
    }
    await deleteExerciseImage(ex.exerciseId, token)
    // Lokalen Zustand bereinigen
    ex.imageUrl = undefined
    ex.thumbnailUrl = undefined
  toast.show(t('workoutDetail.toastRemoved'), { type: 'success', duration: 2500 })
    showRemoveModal.value = false
    removeTarget.value = null
  } catch (err) {
  logger.warn('Bild entfernen fehlgeschlagen:', err)
  toast.show(t('workoutDetail.toastRemoveFailed'), { type: 'error', duration: 3000 })
  } finally {
    // Falls Modal offen blieb (Fehler), bleibt es offen; Nutzer kann erneut versuchen oder abbrechen
  }
}

// Falls ein Übungseintrag im Workout keine exerciseId trägt, versuche diese über den Namen zu ermitteln
async function ensureExerciseId(ex) {
  try {
    if (!ex || ex.exerciseId) return true
    const list = await fetchExercises({})
    if (!Array.isArray(list) || list.length === 0) return false
    const name = (ex.name || '').trim().toLowerCase()
    const mg = (ex.muscleGroup || '').trim().toLowerCase()
    let match = list.find(e => String(e.name || '').trim().toLowerCase() === name && String(e.muscleGroup || '').trim().toLowerCase() === mg)
    if (!match) {
      // Fallback: nur nach Name
      match = list.find(e => String(e.name || '').trim().toLowerCase() === name)
    }
    if (match?._id) {
      ex.exerciseId = match._id
      return true
    }
    return false
  } catch {
    return false
  }
}

function scrollToExercises() {
  const el = exListRef.value || document.getElementById('exercises')
  if (!el) return
  const headerOffset = 72
  try {
    const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  } catch {}
}

function shouldAutoScroll() {
  return route.query.created === '1' || route.query.focus === 'exercises' || route.hash === '#exercises'
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

async function onTimerStop(ms) {
  try {
    const id = route.params.id
    if (!workout.value || !id) return
    const mins = Math.max(0, Math.round(ms / 60000))
    // Bei sehr kurzen Zeiten nicht speichern
    if (!Number.isFinite(mins)) return
    let token = await getAuthToken({ clerk, auth }).catch(() => null)
    if (!token) token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
    await store.updateWorkout(id, { duration: mins }, token)
    // Lokalen Zustand aktualisieren, falls nötig
    if (workout.value) workout.value.duration = mins
  } catch (err) {
    logger.warn('Timer-Dauer speichern fehlgeschlagen:', err)
  }
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
  const last = ex.setDetails.at(-1)
  ex.setDetails.push({ reps: last?.reps || 10, weight: last?.weight || 0 })
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
    const w = workout.value || {}
    // Aggregiere optionale Legacy-Felder aus erstem Satz und behalte setDetails
    const normalized = {
      name: w.name,
      type: w.type,
      date: w.date,
      completed: w.completed,
      exercises: (w.exercises || []).map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        reps: ex.setDetails?.[0]?.reps ?? ex.reps ?? 10,
        weight: ex.setDetails?.[0]?.weight ?? ex.weight ?? 0,
        setDetails: ex.setDetails || []
      }))
    }

    // Draft-Workouts nur lokal aktualisieren
    if (String(id).startsWith('draft-')) {
      const idx = store.workouts.findIndex(wi => wi._id === id)
      if (idx !== -1) {
        store.workouts[idx] = { ...store.workouts[idx], ...normalized }
      }
      saveMsg.value = 'Gespeichert (Entwurf lokal).'
      saveError.value = false
      initialSnapshot = snapshotCore({ ...store.workouts[idx] })
      router.push('/dashboard')
      return
    }
    let token = await getAuthToken({ clerk, auth }).catch(() => null)
    if (!token) token = await getAuthToken({ clerk, auth, options: { skipCache: true } }).catch(() => null)
    await store.updateWorkout(id, normalized, token)
    saveMsg.value = 'Gespeichert.'
    saveError.value = false
    initialSnapshot = snapshotCore({ ...w, ...normalized })
    router.push('/dashboard')
  } catch (e) {
    logger.error('Speichern fehlgeschlagen:', e)
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

onMounted(async () => {
  await loadWorkout()
  await nextTick()
  // Nach Erstellen direkt zu den Übungen scrollen
  if (shouldAutoScroll()) {
    setTimeout(scrollToExercises, 50)
    didAutoScroll.value = true
  }
})

// Falls Daten erst später kommen: bei erstem Auftreten der Übungen automatisch scrollen
watch(() => workout.value?.exercises?.length || 0, async (len) => {
  if (didAutoScroll.value) return
  if (!len) return
  if (!shouldAutoScroll()) return
  await nextTick()
  setTimeout(() => {
    scrollToExercises()
    didAutoScroll.value = true
  }, 0)
})

// Dirty-Tracking gegen initialen Snapshot
watch(() => workout.value, (w) => {
  const current = snapshotCore(w || {})
  isDirty.value = !!initialSnapshot && current !== initialSnapshot
}, { deep: true })

// Warnung beim Schließen/Reload
function beforeUnloadHandler(e) {
  if (!isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnloadHandler))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadHandler))
</script>

<style scoped>
.workout-detail { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 80px; }
.content { padding: 16px; }
.loading, .empty, .error { text-align: center; color: var(--muted); padding: 40px 0; }
.title { margin: 0 0 8px 0; }
.meta { display: flex; gap: 12px; color: var(--muted); margin-bottom: 16px; align-items: center; }
.badge { background: var(--surface); color: var(--fg); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid var(--card-border); }
.completed { color: #4ade80; font-weight: 600; }
.ex-list { background: transparent; border: 1px solid transparent; border-radius: 12px; padding: 16px; }
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

/* Bildbereich je Übung */
.ex-media { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.ex-thumb { width: 72px; height: 72px; object-fit: contain; background: #0b1220; border: 1px solid var(--card-border); border-radius: 10px; padding: 6px; cursor: pointer; }
.media-hint { color: var(--muted); font-size: 0.8rem; }

/* Actions unter dem Bild */
.img-actions { display: flex; align-items: center; gap: 8px; }
.img-actions .link { background: transparent; border: none; color: var(--accent); cursor: pointer; padding: 0; font-size: 0.85rem; }
.img-actions .link.danger { color: var(--danger-color); }
.img-actions .sep { color: var(--muted); }

/* Overlay für Großansicht */
.img-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.img-large { max-width: min(92vw, 1200px); max-height: 86vh; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 1px solid var(--card-border); }
</style>
