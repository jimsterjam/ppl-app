<template>
  <section class="progress-3m-section panel">
    <div class="section-head">
      <h3>Mein Fortschritt</h3>
      <span class="section-sub">Letzte 3 Monate (90 Tage)</span>
    </div>

    <div v-if="!hasData" class="empty-hint">
      Keine ausreichenden Workout-Daten für die letzten 90 Tage.
    </div>

    <div v-else class="cards-grid">
      <article class="metric-card">
        <p class="metric-label">Workouts gesamt</p>
        <p class="metric-value">{{ totalWorkouts }}</p>
      </article>

      <article class="metric-card">
        <p class="metric-label">Ø Workouts / Woche</p>
        <p class="metric-value">{{ workoutsPerWeekLabel }}</p>
      </article>

      <article class="metric-card">
        <p class="metric-label">Gesamtvolumen</p>
        <p class="metric-value">{{ totalVolumeLabel }}</p>
      </article>

      <article class="metric-card">
        <p class="metric-label">Ø Trainingsdauer</p>
        <p class="metric-value">{{ avgDurationLabel }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const MS_PER_DAY = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 90
const WEEK_DIVISOR = WINDOW_DAYS / 7

const now = new Date()
const endTime = now.getTime()
const windowStart = endTime - WINDOW_DAYS * MS_PER_DAY

const normalizedWorkouts = computed(() => {
  return (Array.isArray(props.workouts) ? props.workouts : [])
    .filter((workout) => workout && workout.completed === true)
    .map((workout) => {
      const ts = getWorkoutTimestamp(workout)
      return {
        raw: workout,
        timestamp: ts,
        duration: Number(workout?.duration) || 0,
        volume: calcWorkoutVolume(workout)
      }
    })
    .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp >= windowStart && entry.timestamp <= endTime)
    .sort((a, b) => a.timestamp - b.timestamp)
})

const hasData = computed(() => normalizedWorkouts.value.length > 0)

const totalWorkouts = computed(() => normalizedWorkouts.value.length)

const workoutsPerWeek = computed(() => {
  if (!totalWorkouts.value) return 0
  return totalWorkouts.value / WEEK_DIVISOR
})

const workoutsPerWeekLabel = computed(() => workoutsPerWeek.value.toFixed(1))

const totalVolume = computed(() => {
  return normalizedWorkouts.value.reduce((sum, item) => sum + item.volume, 0)
})

const totalVolumeLabel = computed(() => `${formatCompactNumber(totalVolume.value)} kg`)

// Nur Workouts mit tatsächlich erfasster Dauer berücksichtigen, damit alte
// Einträge ohne duration-Wert (0) den Durchschnitt nicht künstlich verzerren.
const workoutsWithDuration = computed(() => {
  return normalizedWorkouts.value.filter((item) => item.duration > 0)
})

const avgDurationMinutes = computed(() => {
  if (!workoutsWithDuration.value.length) return 0
  const total = workoutsWithDuration.value.reduce((sum, item) => sum + item.duration, 0)
  return total / workoutsWithDuration.value.length
})

const avgDurationLabel = computed(() => {
  if (!workoutsWithDuration.value.length) return '—'
  const minutes = Math.round(avgDurationMinutes.value)
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h} h ${m} min` : `${h} h`
  }
  return `${minutes} min`
})

function getWorkoutTimestamp(workout) {
  const candidates = [workout?.date, workout?.updatedAt, workout?.createdAt]
  for (const candidate of candidates) {
    const ts = new Date(candidate || 0).getTime()
    if (Number.isFinite(ts) && ts > 0) return ts
  }
  return NaN
}

function calcWorkoutVolume(workout) {
  if (!workout || !Array.isArray(workout.exercises)) return 0

  let total = 0
  for (const exercise of workout.exercises) {
    const setDetails = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
    if (setDetails.length) {
      for (const set of setDetails) {
        if (set?.isWarmup) continue
        const reps = Number(set?.reps) || 0
        const weight = Number(set?.weight) || 0
        total += reps * weight
      }
      continue
    }

    const sets = Number(exercise?.sets) || 0
    const reps = Number(exercise?.reps) || 0
    const weight = Number(exercise?.weight) || 0
    total += sets * reps * weight
  }

  return total
}

function formatCompactNumber(value) {
  const number = Number(value) || 0
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(number))
}
</script>

<style scoped>
.progress-3m-section {
  padding: 18px;
  border-radius: 18px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}

.section-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.section-sub {
  font-size: 0.8rem;
  opacity: 0.75;
}

.empty-hint {
  font-size: 0.95rem;
  opacity: 0.8;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  border: 1px solid var(--line-soft, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  padding: 12px;
  background: color-mix(in srgb, var(--bg-panel, #12151b) 85%, transparent);
}

.metric-label {
  margin: 0 0 6px;
  font-size: 0.78rem;
  opacity: 0.75;
}

.metric-value {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.1;
}

</style>