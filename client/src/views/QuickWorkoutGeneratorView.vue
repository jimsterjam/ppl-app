<template>
  <div class="quick-generator-view">
    <HeaderBar :title="t('quickGenerator.title')" />

    <main class="content">
      <div v-if="!loading && !error && !preview" class="form glass">
        <p class="intro">
          {{ t('quickGenerator.intro') }}
        </p>

        <!-- Ziel wird einheitlich vorher im Dashboard abgefragt (WorkoutGoalPicker.vue) und hier
             nur angezeigt - keine zweite Abfrage. -->
        <p class="hint goal-fixed">
          {{ t('quickGenerator.goalLabel') }}: <strong>{{ form.goal === 'strength' ? t('quickGenerator.goalStrength') : t('quickGenerator.goalHypertrophy') }}</strong>
        </p>

        <div class="field">
          <label>{{ t('quickGenerator.levelLabel') }}</label>
          <div class="chip-row">
            <button
              v-for="opt in levelOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: form.level === opt.value }"
              @click="form.level = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.typeLabel') }}</label>
          <div class="chip-row">
            <button
              v-for="opt in typeOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: form.requestedType === opt.value }"
              @click="form.requestedType = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.equipmentLabel') }}</label>
          <div class="chip-row">
            <button
              v-for="opt in equipmentOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: form.equipmentMode === opt.value }"
              @click="form.equipmentMode = opt.value"
            >{{ opt.label }}</button>
          </div>
          <p v-if="form.equipmentMode === 'bodyweight_only'" class="hint">
            {{ t('quickGenerator.bodyweightHint') }}
          </p>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.durationLabel') }}</label>
          <div class="chip-row">
            <button
              v-for="opt in durationOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: !durationManual && form.durationMinutes === opt.value }"
              @click="selectDurationPreset(opt.value)"
            >{{ opt.label }}</button>
            <button
              type="button"
              class="chip"
              :class="{ active: durationManual }"
              @click="enableManualDuration"
            >{{ t('quickGenerator.exerciseCountManual') }}</button>
          </div>
          <!-- User-Report: bisher nur 3 feste Zeit-Presets wählbar, keine Möglichkeit zur
               Feinabstimmung (analog zur Übungsanzahl-Kontrolle oben). Stepper in 5-Min-Schritten,
               20-120 min, wie im Zeitmodell serverseitig (selectExercisesWithinTimeBudget) erlaubt. -->
          <div v-if="durationManual" class="exercise-count-stepper">
            <button type="button" class="stepper-btn" :disabled="form.durationMinutes <= 20" @click="form.durationMinutes -= 5">−</button>
            <span class="stepper-value">{{ form.durationMinutes }} min</span>
            <button type="button" class="stepper-btn" :disabled="form.durationMinutes >= 120" @click="form.durationMinutes += 5">+</button>
          </div>
          <p v-if="durationManual" class="hint">
            {{ t('quickGenerator.durationManualHint') }}
          </p>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.exerciseCountLabel') }}</label>
          <div class="chip-row">
            <button
              type="button"
              class="chip"
              :class="{ active: form.exerciseCountOverride === null }"
              @click="form.exerciseCountOverride = null"
            >{{ t('quickGenerator.exerciseCountAuto') }}</button>
            <button
              type="button"
              class="chip"
              :class="{ active: form.exerciseCountOverride !== null }"
              @click="form.exerciseCountOverride = form.exerciseCountOverride ?? manualExerciseCountSeed"
            >{{ t('quickGenerator.exerciseCountManual') }}</button>
          </div>
          <div v-if="form.exerciseCountOverride !== null" class="exercise-count-stepper">
            <button type="button" class="stepper-btn" :disabled="form.exerciseCountOverride <= 2" @click="form.exerciseCountOverride--">−</button>
            <span class="stepper-value">{{ form.exerciseCountOverride }}</span>
            <button type="button" class="stepper-btn" :disabled="form.exerciseCountOverride >= 8" @click="form.exerciseCountOverride++">+</button>
          </div>
          <p v-else class="hint">
            {{ t('quickGenerator.exerciseCountAutoHint') }}
          </p>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.restrictionsLabel') }}</label>
          <textarea
            v-model="form.restrictions"
            rows="2"
            maxlength="200"
            :placeholder="t('quickGenerator.restrictionsPlaceholder')"
          />
        </div>

        <button class="primary generate-btn" type="button" :disabled="loading" @click="generate">
          {{ t('quickGenerator.generate') }}
        </button>
      </div>

      <div v-if="loading" class="state-message">
        <div class="spinner spin-indicator"></div>
        <p>{{ t('quickGenerator.generating') }}</p>
      </div>

      <!-- Bug-Fix (User-Report): Trainingsdauer/Übungsanzahl/Warm-up wurden bisher nirgends
           angezeigt - der Nutzer landete direkt im Builder, ohne zu sehen, dass z.B. "60 min"
           NUR die reine Trainingszeit ist und das Warm-up zusätzlich obendrauf kommt. Zweiter
           Bug-Fix (Folgereport): die angezeigte Zahl war vorher unter dem Label "ohne Warm-up"
           zu sehen, enthielt serverseitig aber bereits das Warm-up - jetzt zeigen wir konsistent
           die Gesamtzeit inkl. Warm-up, dazu die reine Trainingszeit als Zusatzangabe. Dritter
           Bug-Fix (Folgereport): die Vorschau erschien bisher als normaler Seiteninhalt an der
           Scrollposition des Formulars, statt als zentriertes Popup - wenn der User beim Klick
           auf "Workout generieren" weiter unten im Formular gescrollt war, blieb die Vorschau
           dadurch außerhalb des Sichtfelds. Jetzt: echtes zentriertes Modal wie im Rest der App
           (Teleport + Overlay + Scroll-Lock), analog zu AvatarEditor.vue/AppModal.vue. -->
      <Teleport to="body">
      <Transition name="modal" appear>
        <div v-if="preview && !loading && !error" class="modal-overlay" @click.self="preview = null">
          <div class="modal-content preview-panel">
            <h2 class="preview-title">{{ preview.workoutName }}</h2>
            <div class="preview-stats">
              <div class="preview-stat">
                <span class="preview-stat-value">{{ preview.estimatedDuration }} min</span>
                <span class="preview-stat-label">{{ t('quickGenerator.previewDuration') }}</span>
              </div>
              <div class="preview-stat">
                <span class="preview-stat-value">{{ preview.exerciseCount }}</span>
                <span class="preview-stat-label">{{ t('quickGenerator.previewExerciseCount') }}</span>
              </div>
            </div>
            <p class="hint preview-training-time">
              {{ t('quickGenerator.previewTrainingTime', { minutes: preview.trainingDuration }) }}
            </p>
            <p class="hint preview-warmup">{{ preview.warmup }}</p>

            <div class="preview-actions">
              <button class="secondary" type="button" @click="preview = null">
                {{ t('quickGenerator.previewBack') }}
              </button>
              <button class="primary generate-btn" type="button" @click="confirmPreview">
                {{ t('quickGenerator.previewConfirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>

      <div v-if="error" class="state-message error">
        <p>{{ error }}</p>
        <button class="secondary" type="button" @click="error = null">
          {{ t('common.retry') }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import HeaderBar from '@/components/HeaderBar.vue'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { quickGenerateWorkout } from '@/api/workouts'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { saveWorkoutBuilderPrefill, buildWorkoutBuilderRoute, normalizeBuilderWorkoutType } from '@/utils/workoutBuilderFlow'
import { logger } from '@/utils/logger'
import { useScrollLock } from '@/composables/useScrollLock'
import { useSettingsStore } from '@/stores/settingsStore'
import { sanitizeWorkoutGoal } from '@/utils/workoutGoal'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { getIdToken } = useFirebaseAuth()

const loading = ref(false)
const error = ref(null)
const preview = ref(null)

// Hintergrund-Scroll sperren, solange die Vorschau als zentriertes Modal offen ist.
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = useScrollLock()
watch(preview, (value) => (value ? lockBodyScroll() : unlockBodyScroll()))
onBeforeUnmount(unlockBodyScroll)
// Zwischenspeicher für die gemappten Builder-Übungen, während der Nutzer die Vorschau sieht -
// erst bei "Ins Workout übernehmen" tatsächlich in den Prefill-Speicher schreiben/navigieren.
let pendingBuilderPrefill = null

// Ziel kommt aus der Abfrage im Dashboard (Route-Query `goal`), Fallback: zuletzt gewähltes Ziel.
const settingsStore = useSettingsStore()

const form = reactive({
  goal: sanitizeWorkoutGoal(route.query?.goal) || settingsStore.lastWorkoutGoal || 'hypertrophy',
  level: 'beginner',
  requestedType: normalizeBuilderWorkoutType(route.query?.type || 'fullbody'),
  equipmentMode: 'gym_plus_bodyweight',
  durationMinutes: 45,
  restrictions: '',
  // User-Wunsch (mehr Kontrolle): null = automatische Obergrenze (siehe getMaxExerciseCount()
  // server-seitig, abhängig von Ziel+Dauer), sonst manuell 2-8.
  exerciseCountOverride: null
})

// Nur als sinnvoller Startwert für den Stepper beim Umschalten auf "Manuell" - spiegelt grob
// dieselbe Ziel-/Dauer-Tabelle wie getTimeAdjustedExerciseTarget() im Server, damit der Stepper
// nicht bei 2 oder 8 (den Rändern) startet, sondern in der Nähe des automatischen Werts.
const manualExerciseCountSeed = computed(() => {
  const duration = Number(form.durationMinutes) || 45
  const isStrength = form.goal === 'strength'
  if (duration <= 30) return isStrength ? 3 : 4
  if (duration <= 45) return isStrength ? 4 : 5
  return isStrength ? 4 : 6
})

const levelOptions = [
  { value: 'beginner', label: t('quickGenerator.levelBeginner') },
  { value: 'intermediate', label: t('quickGenerator.levelIntermediate') },
  { value: 'advanced', label: t('quickGenerator.levelAdvanced') }
]

const typeOptions = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'fullbody', label: 'Fullbody' }
]

const equipmentOptions = [
  { value: 'gym_only', label: t('quickGenerator.equipmentGym') },
  { value: 'gym_plus_bodyweight', label: t('quickGenerator.equipmentMixed') },
  { value: 'bodyweight_only', label: t('quickGenerator.equipmentBodyweight') }
]

const durationOptions = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' }
]

// User-Report: die Trainingsdauer war bisher nur über die 3 festen Presets wählbar, keine
// Feinabstimmung möglich - analog zur Übungsanzahl-Kontrolle jetzt ein manueller Stepper
// (5-Min-Schritte, 20-120 min) zusätzlich zu den Presets.
const durationManual = ref(!durationOptions.some((opt) => opt.value === form.durationMinutes))

function selectDurationPreset(value) {
  durationManual.value = false
  form.durationMinutes = value
}

function enableManualDuration() {
  durationManual.value = true
}

let catalogPromise = null
onMounted(() => {
  catalogPromise = loadDefaultExercises()
})

function findCatalogMatch(catalog, name) {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return null
  // Matcht sowohl gegen den deutschen als auch den englischen Katalog-Namen - die KI-Antwort
  // (ex.name) kann je nach Prompt-Sprache beides liefern. Vorher wurde nur gegen entry.name
  // (Deutsch) geprüft, ein englisch formulierter KI-Vorschlag hätte also nie gematcht.
  return catalog.find((entry) => {
    const de = String(entry?.name || '').trim().toLowerCase()
    const en = String(entry?.name_en || '').trim().toLowerCase()
    return de === normalized || en === normalized
  }) || null
}

async function generate() {
  loading.value = true
  error.value = null

  try {
    const token = await getIdToken().catch(() => null)
    const response = await quickGenerateWorkout({
      goal: form.goal,
      level: form.level,
      requestedType: form.requestedType,
      equipmentMode: form.equipmentMode,
      durationMinutes: form.durationMinutes,
      restrictions: form.restrictions || undefined,
      exerciseCountOverride: form.exerciseCountOverride ?? undefined
    }, token)

    const rawExercises = Array.isArray(response?.exercises) ? response.exercises : []
    if (rawExercises.length === 0) {
      error.value = t('quickGenerator.error')
      loading.value = false
      return
    }

    const catalog = await (catalogPromise || loadDefaultExercises())
    const exercises = rawExercises.map((ex, index) => {
      const match = findCatalogMatch(catalog, ex.name)
      const setsCount = Math.max(1, Math.min(6, Number(ex.sets) || 3))
      const setDetails = Array.from({ length: setsCount }, () => ({
        reps: Math.max(1, Number(ex.reps) || 10),
        weight: Math.max(0, Number(ex.weight) || 0),
        restTime: Math.max(20, Number(ex.rest) || 90),
        isWarmup: false
      }))

      return {
        ...(match || {}),
        _id: match?._id || `quick_${index}`,
        exerciseId: match?._id || null,
        name: ex.name,
        sets: setsCount,
        reps: Math.max(1, Number(ex.reps) || 10),
        weight: Math.max(0, Number(ex.weight) || 0),
        // War bisher "note: ex.note || ''" - das ließ das Feld für die Session-Notiz des
        // Nutzers (siehe WorkoutDetailView.vue "Notiz hinzufügen") fälschlich schon als
        // "ausgefüllt" erscheinen, weil der Server dort einen statischen Technik-Tipp
        // mitschickte. Server liefert diesen Tipp jetzt als eigenes Feld coachingNote (siehe
        // routes/workouts.js) - hier nur noch durchreichen, nicht mehr in note kopieren, damit
        // "Notizen unvollständig"/"Später bewerten" auch bei KI-generierten Workouts korrekt
        // erkennt, dass der Nutzer noch keine eigene Notiz geschrieben hat.
        note: '',
        coachingNote: ex.coachingNote || '',
        setDetails
      }
    })

    pendingBuilderPrefill = {
      workoutName: response.workoutName || 'KI-Workout',
      type: form.requestedType,
      notes: response.notes || '',
      exercises,
      favoriteSource: false
    }

    // Vorschau statt direktem Sprung in den Builder (User-Report: Trainingsdauer/Übungsanzahl/
    // Warm-up wurden dem Nutzer bisher nie gezeigt - "60 min" ist nur die reine Trainingszeit,
    // das Warm-up kommt separat obendrauf).
    preview.value = {
      workoutName: pendingBuilderPrefill.workoutName,
      // estimatedDuration ist die Gesamtzeit inkl. Warm-up (siehe server/routes/workouts.js,
      // enforceWorkoutProgrammingRules) - trainingDuration die reine Trainingszeit separat, damit
      // beide Werte konsistent zueinander angezeigt werden können.
      estimatedDuration: response.estimatedDuration ?? form.durationMinutes,
      trainingDuration: response.estimatedTrainingDuration ?? form.durationMinutes,
      exerciseCount: exercises.length,
      warmup: response.warmup || ''
    }
  } catch (err) {
    logger.error('[QuickWorkoutGenerator] generate failed', err?.message)
    error.value = t('quickGenerator.error')
  } finally {
    loading.value = false
  }
}

function confirmPreview() {
  if (!pendingBuilderPrefill) return
  saveWorkoutBuilderPrefill(pendingBuilderPrefill)
  router.push(buildWorkoutBuilderRoute(form.requestedType, { quick: true, goal: form.goal }))
}
</script>

<style scoped>
.quick-generator-view {
  min-height: 100%;
}

.content {
  padding: 1rem;
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
}

.form {
  padding: 1.25rem;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.intro {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  font-size: 0.9rem;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  /* War var(--border, #ddd)/var(--text-primary, #000) - beide Variablen existieren im
     Design-System nicht (siehe style.css: --card-border/--fg), die Chips fielen dadurch
     IMMER auf schwarzen Text mit hellgrauem Rahmen zurück, unabhängig vom Theme - im Dark
     Mode praktisch unsichtbarer schwarzer Text auf dunklem Hintergrund. */
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font-size: 0.85rem;
  cursor: pointer;
}

.chip.active {
  /* War var(--primary, #007AFF) - existiert nicht, blieb dadurch immer fest iOS-blau statt
     der vom Nutzer gewählten Akzentfarbe ("Farbmodus wird nicht übernommen"). */
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast, #060606);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

textarea {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--card-border);
  padding: 0.6rem;
  font-size: 0.9rem;
  resize: vertical;
  background: transparent;
  color: var(--fg);
}

.generate-btn {
  padding: 0.9rem;
  border-radius: 0.75rem;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}

.generate-btn:disabled {
  opacity: 0.6;
}

.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.state-message.error p {
  color: var(--danger-text, var(--danger, #ff5f5f));
  margin: 0;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--card-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.secondary {
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}

.exercise-count-stepper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stepper-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.stepper-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stepper-value {
  min-width: 1.5rem;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
}

/* Zentriertes Modal für die Vorschau (siehe Bug-Fix oben) - Overlay/Content-Stil analog zu
   AvatarEditor.vue/AppModal.vue, damit sich das Popup konsistent zum Rest der App verhält. */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in oklab, #000000 40%, transparent);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.preview-panel {
  align-items: stretch;
}

.preview-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.preview-stats {
  display: flex;
  gap: 1.5rem;
}

.preview-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.preview-stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--accent);
}

.preview-stat-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.preview-warmup {
  margin: 0;
}

.preview-actions {
  display: flex;
  gap: 0.75rem;
}

.preview-actions .secondary {
  flex: 1;
}

.preview-actions .generate-btn {
  flex: 2;
}
</style>
