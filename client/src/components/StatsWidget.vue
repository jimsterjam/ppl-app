<template>
  <div class="stats-widget">
    <template v-if="loadingStats">
      <h3>{{ t('stats.widget.title') }}</h3>
      <div class="widget-skeleton">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </template>

    <template v-else-if="hasBackendStats">
      <h3>{{ t('stats.widget.title') }}</h3>
      <div class="kpi-grid">
        <div class="kpi-cell">
          <span class="label">{{ t('stats.ai.kpis.volume') }}</span>
          <span class="value">{{ totalVolumeLabel }}kg</span>
        </div>
        <div class="kpi-cell">
          <span class="label">{{ t('stats.ai.kpis.sessions') }}</span>
          <span class="value">{{ backendSessions }}</span>
        </div>
        <div class="kpi-cell">
          <span class="label">{{ t('stats.ai.kpis.avgSessions') }}</span>
          <span class="value">{{ avgSessionsDisplay }}</span>
        </div>
        <div class="kpi-cell">
          <span class="label">{{ t('stats.ai.kpis.avgWeeklyVolume') }}</span>
          <span class="value">{{ avgVolumeLabel }}kg</span>
        </div>
      </div>
      <div class="consistency-row">
        <span>{{ t('stats.ai.kpis.consistency') }}</span>
        <span>{{ consistencyPercent }}%</span>
      </div>
      <div class="bar">
        <div class="progress" :style="{ width: consistencyPercent + '%' }"></div>
      </div>
      <p class="hint">{{ consistencyTagline }}</p>
    </template>

    <template v-else>
      <h3>{{ t('stats.widget.offlineTitle') }}</h3>
      <p>{{ t('stats.widget.fallbackCopy', { completed: completedCount, total: total }) }}</p>
      <p v-if="total === 0 && workouts.length > 0" class="hint">{{ t('stats.widget.draftsHint') }}</p>
      <div class="bar">
        <div class="progress" :style="{ width: progress + '%' }"></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  workouts: { type: Array, default: () => [] },
  stats: { type: Object, default: null },
  loadingStats: { type: Boolean, default: false }
});

const { t } = useI18n()

const compactNumber = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 })
const statsKpis = computed(() => (props.stats && props.stats.kpis) ? props.stats.kpis : null)
const hasBackendStats = computed(() => !!statsKpis.value)
const backendSessions = computed(() => statsKpis.value?.sessions ?? 0)
const avgSessionsDisplay = computed(() => hasBackendStats.value ? Number(statsKpis.value?.avgSessionsPerWeek || 0).toFixed(1) : '—')
const avgVolumeLabel = computed(() => hasBackendStats.value ? formatKgValue(statsKpis.value?.avgWeeklyVolume || 0) : '0')
const totalVolumeLabel = computed(() => hasBackendStats.value ? formatKgValue(statsKpis.value?.totalVolume || 0) : '0')
const consistencyPercent = computed(() => hasBackendStats.value ? Math.round(statsKpis.value?.consistencyScore || 0) : 0)
const consistencyTagline = computed(() => {
  const score = statsKpis.value?.consistencyScore ?? 0
  if (score >= 85) return t('stats.ai.consistencyTaglines.machine')
  if (score >= 70) return t('stats.ai.consistencyTaglines.steady')
  if (score >= 50) return t('stats.ai.consistencyTaglines.onTrack')
  return t('stats.ai.consistencyTaglines.routine')
})

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
  return !!w?.completed || hasAnySets(w);
}

const completedCount = computed(() => visibleWorkouts.value.filter(isCompleted).length);
const total = computed(() => visibleWorkouts.value.length);
const progress = computed(() => (total.value > 0 ? (completedCount.value / total.value) * 100 : 0));

function formatKgValue(value) {
  const numeric = Number(value) || 0
  if (numeric >= 1000) {
    return compactNumber.format(numeric)
  }
  return Math.round(numeric).toString()
}
</script>

<style scoped>
  .stats-widget { background: var(--card-bg); border-radius: 16px; padding: 20px; color: var(--fg); margin: 16px; border: 1px solid var(--card-border); }

  .stats-widget h3 { margin: 0 0 12px 0; font-size: 1.1rem; font-weight: 600; color: var(--fg); }

  .stats-widget p { margin: 0 0 12px 0; font-size: 0.9rem; color: var(--muted); font-weight: 500; }

  .hint { color: var(--muted); }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 12px 0 16px; }

  .kpi-cell { border: 1px solid var(--card-border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 4px; background: color-mix(in oklab, var(--surface) 80%, transparent); }

  .kpi-cell .label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi-cell .value { font-size: 1.25rem; font-weight: 600; color: var(--fg); }

  .consistency-row { display: flex; justify-content: space-between; align-items: center; font-weight: 600; margin-bottom: 8px; color: var(--fg); }

  .bar { background: var(--surface); height: 12px; border-radius: 6px; margin-top: 8px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2); }

  .progress { background: linear-gradient(90deg, var(--success) 0%, color-mix(in oklab, var(--success) 80%, var(--accent-color)) 100%); height: 100%; border-radius: 6px; transition: width 0.5s ease; box-shadow: 0 2px 4px color-mix(in oklab, var(--success) 40%, transparent); }

  .widget-skeleton { display: flex; flex-direction: column; gap: 10px; margin: 12px 0 4px; }
  .skeleton-line { height: 12px; width: 100%; border-radius: 999px; background: var(--card-border); animation: shimmer 1.2s ease-in-out infinite; }
  .skeleton-line.short { width: 60%; }

@keyframes shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

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
