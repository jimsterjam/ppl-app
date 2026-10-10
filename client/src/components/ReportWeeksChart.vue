<template>
  <section class="block">
    <h5>{{ t('monthlyReport.weeksTitle') }}</h5>
    <ul class="weeks" role="list">
      <li v-for="week in bars" :key="week.start" class="week" :aria-label="week.aria">
        <span class="count">{{ week.sessions }}</span>
        <span class="track"><span class="bar" :style="{ height: `${week.percent}%` }"></span></span>
        <span class="label">{{ week.label }}</span>
      </li>
    </ul>
    <p class="hint">{{ t('monthlyReport.weeksHint') }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { barPercent } from '@/utils/reportChart'
import { formatReportPeriod } from '@/utils/monthlyReportView'

const props = defineProps({
  weeks: { type: Array, default: () => [] }
})

const { t, locale } = useI18n()

const bars = computed(() => {
  const max = Math.max(0, ...props.weeks.map((w) => Number(w.sessions) || 0))
  return props.weeks.map((week) => {
    const label = formatReportPeriod(week.start, week.start, locale.value).split(' – ')[0]
    return {
      start: week.start,
      sessions: Number(week.sessions) || 0,
      percent: barPercent(week.sessions, max),
      label,
      aria: t('monthlyReport.weekAria', { date: label, sessions: Number(week.sessions) || 0, sets: Number(week.sets) || 0 })
    }
  })
})
</script>

<style scoped>
.block { display: grid; gap: 8px; }
.block h5 { margin: 0; font-size: 0.95rem; }
.weeks { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.week { display: grid; justify-items: center; gap: 4px; }
.count { font-weight: 700; font-variant-numeric: tabular-nums; }
.track {
  position: relative;
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 64px;
  border-radius: 8px;
  background: var(--card-soft);
  overflow: hidden;
}
.bar { display: block; width: 100%; border-radius: 8px 8px 0 0; background: var(--accent); }
.label { color: var(--muted); font-size: 0.72rem; text-align: center; }
.hint { margin: 0; color: var(--muted); font-size: 0.78rem; line-height: 1.4; }
</style>
