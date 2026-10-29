<template>
  <section class="week-strip" :aria-label="caption">
    <div class="week-days">
      <div v-for="day in days" :key="day.key" class="week-day" :class="{ done: day.done, today: day.isToday }" :aria-current="day.isToday ? 'date' : undefined">
        <span class="week-dot" aria-hidden="true">{{ day.done ? '✓' : (day.isToday ? '●' : '') }}</span>
        <span class="week-label">{{ day.label }}</span>
      </div>
    </div>
    <p class="week-caption">{{ caption }}</p>
    <p v-if="streak > 0" class="week-streak">{{ t('dashboard.weekStreak', { count: streak }, streak) }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildWeekDays } from '@/utils/weekStrip'

// Die Woche (Montag bis Sonntag) auf einen Blick: Haken an Tagen, an denen trainiert wurde, heute hervorgehoben.
const props = defineProps({
  workouts: { type: Array, default: () => [] },
  caption: { type: String, default: '' },
  // Wochen in Folge mit erreichtem Wochenziel (0 = nichts anzeigen)
  streak: { type: Number, default: 0 }
})

const { t, locale } = useI18n()
const days = computed(() => buildWeekDays({ workouts: props.workouts, locale: String(locale.value || 'de') }))
</script>

<style scoped>
.week-strip {
  flex-shrink: 0;
  display: grid;
  gap: 8px;
  padding: 10px 10px 8px;
  border-radius: var(--card-radius);
  border: 1px solid var(--card-border);
  background: var(--card-bg);
}
.week-days { display: flex; justify-content: space-between; }
.week-day { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 14%; color: var(--muted); font-size: 0.7rem; }
.week-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid var(--line-strong, var(--card-border));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--accent-contrast, #060606);
}
.week-day.done .week-dot { background: var(--accent); border-color: var(--accent); }
.week-day.today { color: var(--fg); }
.week-day.today .week-dot { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
.week-day.today.done .week-dot { color: var(--accent-contrast, #060606); }
.week-caption { margin: 0; text-align: center; color: var(--muted); font-size: 0.8rem; }
.week-streak { margin: -4px 0 0; text-align: center; color: var(--accent); font-size: 0.8rem; font-weight: 700; }
</style>
