<template>
  <section v-if="comparisonEntries.length" class="workout-compare panel">
    <div class="section-head">
      <h3>Workout-Vergleich</h3>
    </div>

    <div class="type-grid">
      <details
        v-for="entry in comparisonEntries"
        :key="entry.key"
        class="type-card"
      >
        <summary class="card-summary">
          <h4>{{ entry.label }}</h4>
          <p class="date-line">{{ formatDate(entry.comparison.currentDate) }} vs. {{ formatDate(entry.comparison.previousDate) }}</p>
        </summary>

        <div class="exercise-list">
          <article
            v-for="exercise in entry.comparison.exercises"
            :key="`${entry.key}-${exercise.name}`"
            class="exercise-row"
          >
            <h5>{{ getTranslatedExerciseName(exercise.name) }}</h5>
            <p class="line">
              <span class="label">Gewicht:</span>
              <span class="value">{{ formatKg(exercise.previous.bestWeight) }} → {{ formatKg(exercise.current.bestWeight) }}</span>
            </p>
            <p class="line">
              <span class="label">Wiederholungen:</span>
              <span class="value">{{ formatCount(exercise.previous.totalReps) }} → {{ formatCount(exercise.current.totalReps) }}</span>
            </p>
            <p class="line">
              <span class="label">Geschätztes 1RM:</span>
              <span class="value">{{ formatOneRepMax(exercise.previous.estimated1RM) }} → {{ formatOneRepMax(exercise.current.estimated1RM) }} {{ directionArrow(exercise.direction) }}</span>
            </p>
          </article>
        </div>
      </details>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTypeComparison } from '@/utils/workoutComparison'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const { locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const baseEntries = [
  { key: 'push', type: 'push', labelDe: 'Push Day', labelEn: 'Push Day' },
  { key: 'pull', type: 'pull', labelDe: 'Pull Day', labelEn: 'Pull Day' },
  { key: 'fullbody', type: 'fullbody', labelDe: 'Full Body', labelEn: 'Full Body' },
  { key: 'legs-speed', type: 'legs', legsSubtype: 'speed', labelDe: 'Leg Day Speed', labelEn: 'Leg Day Speed' },
  { key: 'legs-deadlift', type: 'legs', legsSubtype: 'deadlift', labelDe: 'Leg Day Deadlift', labelEn: 'Leg Day Deadlift' },
  { key: 'legs-squats', type: 'legs', legsSubtype: 'squats', labelDe: 'Leg Day Squats', labelEn: 'Leg Day Squats' }
]

const comparisonEntries = computed(() => {
  return baseEntries
    .map((entry) => {
      const sourceWorkouts = entry.legsSubtype
        ? filterLegSubtypeWorkouts(props.workouts, entry.legsSubtype)
        : props.workouts

      const comparison = getTypeComparison(entry.type, sourceWorkouts)
      const label = isGerman() ? entry.labelDe : entry.labelEn

      return {
        key: entry.key,
        label,
        comparison
      }
    })
    .filter((entry) => entry.comparison !== null)
})

function isGerman() {
  return String(locale.value || 'de').toLowerCase().startsWith('de')
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function isLegWorkout(workout) {
  return normalizeText(workout?.type).includes('leg') || normalizeText(workout?.type).includes('bein')
}

function collectWorkoutText(workout) {
  const name = normalizeText(workout?.name)
  const exerciseNames = Array.isArray(workout?.exercises)
    ? workout.exercises.map((exercise) => normalizeText(exercise?.name)).join(' ')
    : ''
  return `${name} ${exerciseNames}`.trim()
}

function detectLegSubtype(workout) {
  const nameText = normalizeText(workout?.name)
  const exerciseTexts = Array.isArray(workout?.exercises)
    ? workout.exercises.map((exercise) => normalizeText(exercise?.name)).filter(Boolean)
    : []
  const fullText = collectWorkoutText(workout)

  const speedTerms = ['speed', 'sprint', 'explosive', 'explosiv', 'plyo', 'jump', 'power', 'tempo']
  const deadliftTerms = ['deadlift', 'dead lift', 'kreuzheben', 'rdl', 'romanian deadlift', 'sumo', 'hinge']
  const squatTerms = ['squat', 'squats', 'kniebeuge', 'kniebeugen', 'front squat', 'back squat', 'hack squat', 'leg press', 'beinpresse']

  // Workout-Name soll explizite Split-Namen zuerst steuern.
  if (speedTerms.some((term) => nameText.includes(term))) return 'speed'
  if (deadliftTerms.some((term) => nameText.includes(term))) return 'deadlift'
  if (squatTerms.some((term) => nameText.includes(term))) return 'squats'

  const scoreBySubtype = {
    speed: 0,
    deadlift: 0,
    squats: 0
  }

  exerciseTexts.forEach((exerciseText) => {
    if (speedTerms.some((term) => exerciseText.includes(term))) scoreBySubtype.speed += 1
    if (deadliftTerms.some((term) => exerciseText.includes(term))) scoreBySubtype.deadlift += 1
    if (squatTerms.some((term) => exerciseText.includes(term))) scoreBySubtype.squats += 1
  })

  const scored = Object.entries(scoreBySubtype).sort((a, b) => b[1] - a[1])
  if (scored[0][1] > 0) return scored[0][0]

  if (deadliftTerms.some((term) => fullText.includes(term))) return 'deadlift'
  if (speedTerms.some((term) => fullText.includes(term))) return 'speed'
  if (squatTerms.some((term) => fullText.includes(term))) return 'squats'

  return 'squats'
}

function filterLegSubtypeWorkouts(workouts, legsSubtype) {
  return (Array.isArray(workouts) ? workouts : []).filter((workout) => {
    if (!isLegWorkout(workout)) return false
    return detectLegSubtype(workout) === legsSubtype
  })
}

function formatDate(value) {
  const date = new Date(value || 0)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleDateString(isGerman() ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit'
  })
}

function formatKg(value) {
  const n = Number(value) || 0
  return `${n.toFixed(1)} kg`
}

function formatCount(value) {
  return String(Math.round(Number(value) || 0))
}

function formatOneRepMax(value) {
  return String(Math.round(Number(value) || 0))
}

function directionArrow(direction) {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return '–'
}
</script>

<style scoped>
.workout-compare {
  padding: 18px;
  border-radius: 18px;
}

.section-head {
  display: flex;
  align-items: baseline;
  margin-bottom: 14px;
}

.section-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.type-grid {
  display: grid;
  gap: 12px;
}

.type-card {
  border: 1px solid var(--line-soft, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  padding: 12px;
}

.card-summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.card-summary::-webkit-details-marker {
  display: none;
}

.type-card h4 {
  margin: 0;
  font-size: 1rem;
}

.date-line {
  margin: 6px 0 0;
  font-size: 0.86rem;
  opacity: 0.78;
}

.exercise-list {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.exercise-row {
  border: 1px solid var(--line-soft, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 10px;
}

.exercise-row h5 {
  margin: 0 0 8px;
}

.line {
  margin: 4px 0;
  font-size: 0.9rem;
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 8px;
}

.label {
  opacity: 0.85;
}

.value {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .line {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
