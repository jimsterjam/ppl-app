<template>
  <section class="block">
    <h5>{{ metric === 'reps' ? t('monthlyReport.repsChartTitle') : t('monthlyReport.weightChartTitle') }}</h5>

    <!-- Übung wählen (die am häufigsten trainierten, wie vom Server geliefert) -->
    <div class="chips" role="group" :aria-label="t('monthlyReport.chooseExercise')">
      <button
        v-for="curve in curves"
        :key="curve.key"
        type="button"
        class="chip"
        :class="{ active: curve.key === selectedKey }"
        :aria-pressed="curve.key === selectedKey"
        @click="selectedKey = curve.key"
      >{{ displayName(curve) }}</button>
    </div>

    <svg
      v-if="chart.dots.length"
      class="chart"
      viewBox="0 0 320 160"
      role="img"
      :aria-label="ariaLabel"
    >
      <g class="grid">
        <template v-for="tick in chart.yTicks" :key="tick.value">
          <line :x1="chart.bounds.left" :x2="chart.bounds.right" :y1="tick.y" :y2="tick.y" />
          <text :x="chart.bounds.left - 6" :y="tick.y + 3.5" text-anchor="end">{{ tickLabel(tick.value) }}</text>
        </template>
      </g>
      <path class="line" :d="chart.path" />
      <circle v-for="dot in chart.dots" :key="dot.date" class="dot" :cx="dot.x" :cy="dot.y" r="3.5" />
      <text class="axis" :x="chart.bounds.left" y="154" text-anchor="start">{{ startLabel }}</text>
      <text class="axis" :x="chart.bounds.right" y="154" text-anchor="end">{{ endLabel }}</text>
    </svg>

    <p v-if="summaryText" class="summary">{{ summaryText }}</p>
    <p class="hint">{{ metric === 'reps' ? t('monthlyReport.repsChartHint') : t('monthlyReport.weightChartHint') }}</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { buildLineChart, summarizeCurve } from '@/utils/reportChart'
import { formatReportPeriod } from '@/utils/monthlyReportView'

const props = defineProps({
  curves: { type: Array, default: () => [] },
  periodStart: { type: String, required: true },
  periodEnd: { type: String, required: true }
})

const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const selectedKey = ref('')
// Neuer Bericht (oder anderes Beispiel): wieder die erste Übung.
watch(() => props.curves, (curves) => {
  if (!curves.some((c) => c.key === selectedKey.value)) selectedKey.value = curves[0]?.key || ''
}, { immediate: true })

const selected = computed(() => props.curves.find((c) => c.key === selectedKey.value) || props.curves[0] || null)
const metric = computed(() => selected.value?.metric === 'reps' ? 'reps' : 'weight')
const chart = computed(() => buildLineChart(selected.value?.points || [], { periodStart: props.periodStart, periodEnd: props.periodEnd }))

const displayName = (curve) => getTranslatedExerciseName(curve.name) || curve.name
const numberFormat = computed(() => new Intl.NumberFormat(String(locale.value).startsWith('de') ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }))
const tickLabel = (value) => numberFormat.value.format(value)
const unit = computed(() => (metric.value === 'reps' ? t('monthlyReport.repsUnit') : 'kg'))
const withUnit = (value) => `${numberFormat.value.format(value)} ${unit.value}`

const startLabel = computed(() => formatReportPeriod(props.periodStart, props.periodStart, locale.value).split(' – ')[0])
const endLabel = computed(() => formatReportPeriod(props.periodEnd, props.periodEnd, locale.value).split(' – ')[0])

const summaryText = computed(() => {
  const s = summarizeCurve(selected.value?.points)
  if (!s) return ''
  if (s.diff === 0) return t('monthlyReport.chartUnchanged', { to: withUnit(s.to) })
  const sign = s.diff > 0 ? '+' : '−'
  return t('monthlyReport.chartChange', { from: withUnit(s.from), to: withUnit(s.to), diff: `${sign}${numberFormat.value.format(Math.abs(s.diff))}` })
})

const ariaLabel = computed(() => `${selected.value ? displayName(selected.value) : ''}: ${summaryText.value}`)
</script>

<style scoped>
.block { display: grid; gap: 8px; }
.block h5 { margin: 0; font-size: 0.95rem; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  min-height: 0;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--fg);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}
.chip.active {
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.chart { width: 100%; height: auto; display: block; }
.grid line { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 3 3; }
.grid text, .axis { fill: var(--muted); font-size: 9px; }
.line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.dot { fill: var(--accent); stroke: var(--bg-panel); stroke-width: 1.5; }
.summary { margin: 0; font-weight: 600; font-size: 0.88rem; line-height: 1.4; }
.hint { margin: 0; color: var(--muted); font-size: 0.78rem; line-height: 1.4; }
</style>
