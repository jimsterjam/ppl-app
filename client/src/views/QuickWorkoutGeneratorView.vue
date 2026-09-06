<template>
  <div class="quick-generator-view">
    <HeaderBar :title="t('quickGenerator.title') || 'KI-Workout generieren'" />

    <main class="content">
      <div v-if="!loading && !error" class="form glass">
        <p class="intro">
          {{ t('quickGenerator.intro') || 'Beantworte ein paar kurze Fragen, dann erstellen wir ein passendes Workout für dich.' }}
        </p>

        <div class="field">
          <label>{{ t('quickGenerator.goalLabel') || 'Ziel' }}</label>
          <div class="chip-row">
            <button
              v-for="opt in goalOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: form.goal === opt.value }"
              @click="form.goal = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.levelLabel') || 'Erfahrung' }}</label>
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
          <label>{{ t('quickGenerator.typeLabel') || 'Workout-Typ' }}</label>
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
          <label>{{ t('quickGenerator.equipmentLabel') || 'Equipment' }}</label>
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
            {{ t('quickGenerator.bodyweightHint') || 'Bei reinem Bodyweight-Training kann die Übungsauswahl noch ungenauer sein — wir verbessern das laufend.' }}
          </p>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.durationLabel') || 'Zeit pro Einheit' }}</label>
          <div class="chip-row">
            <button
              v-for="opt in durationOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: form.durationMinutes === opt.value }"
              @click="form.durationMinutes = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('quickGenerator.restrictionsLabel') || 'Einschränkungen (optional)' }}</label>
          <textarea
            v-model="form.restrictions"
            rows="2"
            :placeholder="t('quickGenerator.restrictionsPlaceholder') || 'z.B. keine Kniebeugen wegen Knieproblemen'"
          />
        </div>

        <button class="primary generate-btn" type="button" :disabled="loading" @click="generate">
          {{ t('quickGenerator.generate') || 'Workout generieren' }}
        </button>
      </div>

      <div v-if="loading" class="state-message">
        <div class="spinner spin-indicator"></div>
        <p>{{ t('quickGenerator.generating') || 'Erstelle dein Workout...' }}</p>
      </div>

      <div v-if="error" class="state-message error">
        <p>{{ error }}</p>
        <button class="secondary" type="button" @click="error = null">
          {{ t('common.retry') || 'Erneut versuchen' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import HeaderBar from '@/components/HeaderBar.vue'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { quickGenerateWorkout } from '@/api/workouts'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { saveWorkoutBuilderPrefill, buildWorkoutBuilderRoute, normalizeBuilderWorkoutType } from '@/utils/workoutBuilderFlow'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { getIdToken } = useFirebaseAuth()

const loading = ref(false)
const error = ref(null)

const form = reactive({
  goal: 'hypertrophy',
  level: 'beginner',
  requestedType: normalizeBuilderWorkoutType(route.query?.type || 'fullbody'),
  equipmentMode: 'gym_plus_bodyweight',
  durationMinutes: 45,
  restrictions: ''
})

const goalOptions = [
  { value: 'hypertrophy', label: t('quickGenerator.goalHypertrophy') || 'Muskelaufbau' },
  { value: 'strength', label: t('quickGenerator.goalStrength') || 'Kraft' }
]

const levelOptions = [
  { value: 'beginner', label: t('quickGenerator.levelBeginner') || 'Anfänger' },
  { value: 'intermediate', label: t('quickGenerator.levelIntermediate') || 'Fortgeschritten' },
  { value: 'advanced', label: t('quickGenerator.levelAdvanced') || 'Erfahren' }
]

const typeOptions = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'fullbody', label: 'Fullbody' }
]

const equipmentOptions = [
  { value: 'gym_only', label: t('quickGenerator.equipmentGym') || 'Nur Gym' },
  { value: 'gym_plus_bodyweight', label: t('quickGenerator.equipmentMixed') || 'Gym + Bodyweight' },
  { value: 'bodyweight_only', label: t('quickGenerator.equipmentBodyweight') || 'Nur Körpergewicht' }
]

const durationOptions = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' }
]

let catalogPromise = null
onMounted(() => {
  catalogPromise = loadDefaultExercises()
})

function findCatalogMatch(catalog, name) {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return null
  return catalog.find((entry) => String(entry?.name || '').trim().toLowerCase() === normalized) || null
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
      restrictions: form.restrictions || undefined
    }, token)

    const rawExercises = Array.isArray(response?.exercises) ? response.exercises : []
    if (rawExercises.length === 0) {
      error.value = t('quickGenerator.error') || 'Workout konnte nicht generiert werden. Versuch es noch einmal.'
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
        note: ex.note || '',
        setDetails
      }
    })

    saveWorkoutBuilderPrefill({
      workoutName: response.workoutName || 'KI-Workout',
      type: form.requestedType,
      notes: response.notes || '',
      exercises,
      favoriteSource: false
    })

    router.push(buildWorkoutBuilderRoute(form.requestedType, { quick: true }))
  } catch (err) {
    logger.error('[QuickWorkoutGenerator] generate failed', err?.message)
    error.value = t('quickGenerator.error') || 'Workout konnte nicht generiert werden. Versuch es noch einmal.'
  } finally {
    loading.value = false
  }
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
</style>
