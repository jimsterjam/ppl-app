<template>
  <div class="workout-card" :class="normalizedType">
    <div class="header">
      <h2>{{ heading }}</h2>
      <span>{{ formattedDate }}</span>
    </div>

    <ul class="exercise-list">
      <li v-for="(ex, i) in (workout.exercises || [])" :key="i">
        <strong>{{ ex.name }}</strong>
        <span>{{ (ex.sets ?? (ex.setDetails?.length || 0)) }}×{{ (ex.reps ?? ex.setDetails?.[0]?.reps ?? 0) }}</span>
      </li>
    </ul>

  <button @click="$emit('start', workout)">Start</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  workout: { type: Object, required: true }
});

// Declare emitted events for linting/auto-complete
defineEmits(['start'])

const normalizedType = computed(() => {
  const t = (props.workout?.type ?? '').toString().trim().toLowerCase();
  if (["push", "pull", "legs", "leg"].includes(t)) return t === 'leg' ? 'legs' : t;
  return 'unknown';
});

const workoutTitle = computed(() => {
  const name = (props.workout?.name || '').toString().trim();
  if (name) return name; // Bevorzugt den expliziten Namen, falls gesetzt
  const t = normalizedType.value;
  if (t === 'push') return 'Push Day';
  if (t === 'pull') return 'Pull Day';
  if (t === 'legs') return 'Leg Day';
  return 'Workout';
});

const formattedDate = computed(() => {
  const d = props.workout?.updatedAt || props.workout?.date
  if (!d) return ''
  try {
    return new Date(d).toLocaleString('de-DE')
  } catch {
    return String(d)
  }
});

const heading = computed(() => {
  const dateStr = (props.workout?.date || '').toString()
  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = dateStr.startsWith(todayStr)
  return isToday ? `Heute: "${workoutTitle.value}"` : `Letztes Workout: "${workoutTitle.value}"`
})
</script>

<style scoped>
.workout-card { background: var(--card-bg); border-radius: 16px; padding: 20px; color: var(--fg); margin-bottom: 16px; border: 1px solid var(--card-border); }
.workout-card.push,
.workout-card.pull,
.workout-card.legs,
.workout-card.unknown { border-left: 4px solid var(--accent-color); }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.header span { font-size: 0.9rem; color: var(--muted); font-weight: 500; }

.exercise-list {
  list-style: none;
  margin: 0 0 16px 0;
  padding: 0;
}

.exercise-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--card-border); font-size: 0.9rem; }

.exercise-list li:last-child {
  border-bottom: none;
}

.exercise-list strong { font-weight: 600; color: var(--fg); }

.exercise-list span { color: var(--muted); font-size: 0.85rem; font-weight: 500; }

button { background: var(--accent); color: var(--accent-contrast); border: none; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; transition: all 0.2s ease; -webkit-tap-highlight-color: transparent; }
button:hover { filter: brightness(1.02); }
button:active { transform: scale(0.98); }

/* Tablet Styles */
@media (min-width: 768px) {
  .workout-card {
    padding: 24px;
    border-radius: 20px;
  }
  
  .header h2 {
    font-size: 1.5rem;
  }
  
  .exercise-list li {
    font-size: 1rem;
    padding: 10px 0;
  }
  
  button {
    width: auto; min-width: 120px; padding: 14px 24px;
  }
}
</style>
