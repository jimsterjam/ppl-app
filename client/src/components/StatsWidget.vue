<template>
  <div class="stats-widget">
    <h3>Fortschritt</h3>
    <p>{{ completedCount }} / {{ total }} Workouts erledigt</p>
    <p v-if="total === 0 && workouts.length > 0" class="hint">Entwürfe werden nicht gezählt.</p>

    <div class="bar">
      <div class="progress" :style="{ width: progress + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  workouts: { type: Array, default: () => [] }
});

const visibleWorkouts = computed(() => props.workouts.filter(w => !w.isDraft));

function hasAnySets(w) {
  try {
    return (w?.exercises || []).some(ex => {
      const sets = ex?.setDetails?.length ?? ex?.sets ?? 0;
      return sets > 0;
    });
  } catch {
    return false;
  }
}

function isCompleted(w) {
  // Zähle als abgeschlossen, wenn Backend-Flag gesetzt ist ODER bereits Sätze erfasst wurden
  // (Fallback-Heuristik für ältere/inkompatible Daten)
  return !!w?.completed || hasAnySets(w);
}

const completedCount = computed(() => visibleWorkouts.value.filter(isCompleted).length);
const total = computed(() => visibleWorkouts.value.length);
const progress = computed(() => (total.value > 0 ? (completedCount.value / total.value) * 100 : 0));
</script>

<style scoped>
  .stats-widget { background: var(--card-bg); border-radius: 16px; padding: 20px; color: var(--fg); margin: 16px; border: 1px solid var(--card-border); }

  .stats-widget h3 { margin: 0 0 12px 0; font-size: 1.1rem; font-weight: 600; color: var(--fg); }

  .stats-widget p { margin: 0 0 12px 0; font-size: 0.9rem; color: var(--muted); font-weight: 500; }

  .hint { color: var(--warning-color); }

  .bar { background: var(--surface); height: 12px; border-radius: 6px; margin-top: 8px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2); }

  .progress { background: linear-gradient(90deg, var(--success-color) 0%, color-mix(in oklab, var(--success-color) 80%, var(--accent-color)) 100%); height: 100%; border-radius: 6px; transition: width 0.5s ease; box-shadow: 0 2px 4px color-mix(in oklab, var(--success-color) 40%, transparent); }

/* Tablet Styles */
@media (min-width: 768px) {
  .stats-widget {
    padding: 24px;
    margin: 20px auto;
    max-width: 600px;
  }
  
  .stats-widget h3 {
    font-size: 1.25rem;
    margin-bottom: 16px;
  }
  
  .stats-widget p {
    font-size: 1rem;
    margin-bottom: 16px;
  }
  
  .bar {
    height: 14px;
    border-radius: 7px;
  }
  .bar { height: 14px; border-radius: 7px; }
  .bar { height: 16px; border-radius: 8px; }
}

/* Desktop Styles */
@media (min-width: 1024px) {
  .stats-widget {
    padding: 28px;
    margin: 24px auto;
  }
  
  .bar {
    height: 16px;
    border-radius: 8px;
  }
}
</style>
