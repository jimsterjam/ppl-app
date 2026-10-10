<template>
  <AppModal
    :model-value="modelValue"
    :title="t('monthlyReport.modalTitle')"
    :confirm-text="t('common.close')"
    :show-cancel="false"
    :extra-text="showUpgradeButton ? t('monthlyReport.upgrade') : ''"
    type="info"
    modal-class="monthly-report-modal"
    @update:model-value="$emit('update:modelValue', $event)"
    @extra="$emit('upgrade')"
  >
    <div class="report">
      <p v-if="state === 'loading'" class="muted">{{ t('monthlyReport.loading') }}</p>
      <p v-else-if="state === 'error'" class="muted">{{ t('monthlyReport.error') }}</p>
      <template v-else-if="report">
        <p v-if="report.isExample" class="example-banner" role="note">
          {{ isPro ? t('monthlyReport.exampleBannerPro') : t('monthlyReport.exampleBannerFree') }}
        </p>

        <h4 class="period">{{ period }}</h4>

        <!-- Zahlen mit Vergleich zum Vormonat -->
        <div class="stats">
          <div v-for="stat in stats" :key="stat.key" class="stat">
            <span class="stat-label">{{ stat.label }}</span>
            <strong class="stat-value">{{ stat.value }}</strong>
            <small v-if="stat.compare" class="stat-compare" :class="stat.compare.key">{{ stat.compare.text }}</small>
          </div>
        </div>

        <p v-if="conclusion" class="conclusion">{{ t(`monthlyReport.conclusion_${conclusion}`) }}</p>

        <!-- Einheiten je Woche und Gewicht je Übung (Diagramme, inline SVG) -->
        <ReportWeeksChart v-if="facts.weeks?.length" :weeks="facts.weeks" />
        <ReportWeightChart
          v-if="facts.exercises?.length"
          :key="report.id"
          :curves="facts.exercises"
          :period-start="report.periodStart"
          :period-end="report.periodEnd"
        />

        <!-- Stillstand (bisherige Diagnose, ohne "Geplant"-Knöpfe) -->
        <section class="block">
          <h5>{{ t('monthlyReport.stagnationTitle') }}</h5>
          <p v-if="!stagnation.length" class="muted">{{ t('monthlyReport.stagnationNone') }}</p>
          <article v-for="entry in stagnation" :key="entry.key" class="stall">
            <header>
              <strong>{{ entry.name }}</strong>
              <small v-if="entry.weeksText">{{ entry.weeksText }}</small>
            </header>
            <p><span class="label">{{ t('coachDiagnosis.causeLabel') }}</span> {{ entry.cause }}</p>
            <p><span class="label">{{ t('coachDiagnosis.nextLabel') }}</span> {{ entry.next }}</p>
          </article>
        </section>

        <p class="muted basis">{{ t('monthlyReport.basis') }}</p>
      </template>
    </div>
  </AppModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/AppModal.vue'
import ReportWeeksChart from '@/components/ReportWeeksChart.vue'
import ReportWeightChart from '@/components/ReportWeightChart.vue'
import { fetchMonthlyReport } from '@/api/reports'
import { getAuthToken } from '@/utils/authToken'
import { buildSampleReport } from '@/utils/sampleMonthlyReport'
import { diagnosisTextKeys } from '@/utils/coachDiagnosisText'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { compareWithPrevious, conclusionKey, formatNumber, formatReportPeriod } from '@/utils/monthlyReportView'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // ID eines echten Berichts; leer + example = Beispielbericht
  reportId: { type: String, default: '' },
  example: { type: Boolean, default: false },
  isPro: { type: Boolean, default: false }
})
defineEmits(['update:modelValue', 'upgrade'])

const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const state = ref('idle') // idle | loading | ok | error
const report = ref(null)

const showUpgradeButton = computed(() => !!report.value?.isExample && !props.isPro)
const facts = computed(() => report.value?.facts || {})
const period = computed(() => (report.value ? formatReportPeriod(report.value.periodStart, report.value.periodEnd, locale.value) : ''))
const conclusion = computed(() => conclusionKey(facts.value.conclusion))

function compareText(current, previous, format = (n) => String(n)) {
  const cmp = compareWithPrevious(current, previous)
  if (!cmp) return null
  if (cmp.key === 'same') return { key: 'same', text: t('monthlyReport.compareSame') }
  return { key: cmp.key, text: t(cmp.key === 'more' ? 'monthlyReport.compareMore' : 'monthlyReport.compareFewer', { n: format(cmp.diff) }) }
}

const stats = computed(() => {
  const totals = facts.value.totals || {}
  const previous = facts.value.previous || null
  const kg = (n) => `${formatNumber(n, locale.value)} kg`
  return [
    { key: 'sessions', label: t('monthlyReport.statSessions'), value: formatNumber(totals.sessions, locale.value), compare: compareText(totals.sessions, previous?.sessions) },
    { key: 'sets', label: t('monthlyReport.statSets'), value: formatNumber(totals.sets, locale.value), compare: compareText(totals.sets, previous?.sets) },
    { key: 'volume', label: t('monthlyReport.statVolume'), value: kg(totals.volumeKg), compare: compareText(totals.volumeKg, previous?.volumeKg, kg) },
    { key: 'bests', label: t('monthlyReport.statBests'), value: formatNumber(totals.personalBests, locale.value), compare: null }
  ]
})

const stagnation = computed(() => (facts.value.stagnation?.items || [])
  .map((item, index) => {
    const keys = diagnosisTextKeys(item, locale.value)
    if (!keys) return null
    return {
      key: `${item.key || item.name}-${index}`,
      name: getTranslatedExerciseName(item.name) || item.name,
      weeksText: keys.showWeeks ? t('coachDiagnosis.stalledFor', { weeks: item.weeks }) : '',
      cause: t(keys.causeKey, keys.params),
      next: t(keys.nextKey, keys.params)
    }
  })
  .filter(Boolean))

async function load() {
  if (props.example || !props.reportId) {
    report.value = buildSampleReport()
    state.value = 'ok'
    return
  }
  state.value = 'loading'
  report.value = null
  const token = await getAuthToken().catch(() => null)
  const res = await fetchMonthlyReport(token, props.reportId)
  if (res.status === 'ok') {
    report.value = res.data
    state.value = 'ok'
  } else {
    state.value = 'error'
  }
}

watch(() => props.modelValue, (open) => { if (open) load() }, { immediate: true })
</script>

<style scoped>
.report { display: grid; gap: 12px; text-align: left; }
.muted { color: var(--muted); font-size: 0.85rem; margin: 0; line-height: 1.4; }
.example-banner {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--accent) 60%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  font-size: 0.82rem;
  line-height: 1.4;
}
.period { margin: 0; font-size: 1.05rem; }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.stat {
  display: grid;
  gap: 2px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
  background: var(--card-soft);
  min-width: 0;
}
.stat-label { color: var(--muted); font-size: 0.78rem; }
.stat-value { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.stat-compare { font-size: 0.74rem; color: var(--muted); line-height: 1.3; }
.stat-compare.more { color: var(--accent); }
.conclusion { margin: 0; font-weight: 600; line-height: 1.45; }
.block { display: grid; gap: 8px; }
.block h5 { margin: 0; font-size: 0.95rem; }
.stall {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
  background: var(--card-soft);
}
.stall header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; }
.stall header small { color: var(--muted); }
.stall p { margin: 0; line-height: 1.45; font-size: 0.9rem; }
.label { font-weight: 700; }
.basis { font-size: 0.78rem; }
</style>
