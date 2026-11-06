<template>
  <div class="findings">
    <!-- Fortschritt und Stillstand -->
    <section class="block" data-testid="findings-progress">
      <h5>{{ t('monthlyReport.findings.sectionChanged') }}</h5>
      <p v-if="!progressItems.length" class="muted">{{ t('monthlyReport.findings.notEnoughData') }}</p>
      <article v-for="item in progressItems" :key="item.key + item.goal" class="finding">
        <span class="tag" :class="TAG_CLASS[item.type]">{{ t(`monthlyReport.findings.tag_${item.type}`) }}</span>
        <p>{{ progressText(item) }}</p>
        <small class="muted">{{ t(`monthlyReport.findings.confidence_${item.confidence}`) }}</small>
      </article>
      <p v-if="progressItems.length && insufficientCount" class="muted">{{ t('monthlyReport.findings.insufficientSome', { n: insufficientCount }) }}</p>
    </section>

    <!-- Wiederholungsbereich -->
    <section v-if="repItems.length" class="block" data-testid="findings-reps">
      <h5>{{ t('monthlyReport.findings.sectionReps') }}</h5>
      <article v-for="item in repItems" :key="item.key + item.goal" class="finding">
        <span class="tag info">{{ item.min }}–{{ item.max }}</span>
        <p>{{ repText(item) }}</p>
        <p v-if="item.hint" class="hint">{{ t('monthlyReport.findings.repHint', { goal: goalLabel(item.goal) }) }}</p>
      </article>
      <p class="muted">{{ t('monthlyReport.findings.repTransition') }}</p>
    </section>

    <!-- Übungswechsel -->
    <section v-if="swapItems.length" class="block" data-testid="findings-swaps">
      <h5>{{ t('monthlyReport.findings.sectionSwaps') }}</h5>
      <article v-for="(item, i) in swapItems" :key="i" class="finding">
        <span class="tag info" aria-hidden="true">{{ item.type === 'permanent' ? '↔' : '↻' }}</span>
        <p>{{ swapText(item) }}</p>
      </article>
    </section>

    <!-- Sätze pro Muskelgruppe (nur Zahl, keine Bewertung) -->
    <section v-if="muscleItems.length" class="block" data-testid="findings-muscles">
      <h5>{{ t('monthlyReport.findings.sectionMuscles') }}</h5>
      <div
        v-for="item in muscleItems"
        :key="item.muscle"
        class="muscle"
        role="img"
        :aria-label="t('monthlyReport.findings.muscleLine', { muscle: muscleLabel(item.muscle), sets: formatWeight(item.setsPerWeek, locale) })"
      >
        <span>{{ muscleLabel(item.muscle) }}</span>
        <span class="track" aria-hidden="true"><span class="fill" :style="{ width: barWidth(item.setsPerWeek) }"></span></span>
        <b>{{ formatWeight(item.setsPerWeek, locale) }}</b>
      </div>
      <p class="muted">{{ t('monthlyReport.findings.muscleNote') }}</p>
    </section>

    <!-- Zusammenfassung am Ende -->
    <section class="block summary" data-testid="findings-summary">
      <h5>{{ t('monthlyReport.findings.sectionSummary') }}</h5>
      <p v-if="findings.nothingToChange" class="finding-line">{{ t('monthlyReport.findings.nothingToChange') }}</p>
      <template v-else>
        <p class="muted">{{ t('monthlyReport.findings.summaryIntro') }}</p>
        <p class="muted">{{ t('monthlyReport.findings.recommendationsHead') }}</p>
        <ul>
          <li v-for="(rec, i) in recommendations" :key="i">{{ recommendationText(rec) }}</li>
        </ul>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { formatNumber, formatWeight } from '@/utils/monthlyReportView'

const props = defineProps({
  findings: { type: Object, required: true }
})

const { t, te, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const progressItems = computed(() => props.findings.progress?.items || [])
const insufficientCount = computed(() => props.findings.progress?.insufficientCount || 0)
const repItems = computed(() => props.findings.repRange?.items || [])
const swapItems = computed(() => props.findings.swaps?.items || [])
const muscleItems = computed(() => props.findings.muscles?.items || [])
const recommendations = computed(() => props.findings.recommendations || [])
const TAG_CLASS = { improved: 'good', unchanged: 'flat', worsened: 'down' }
const maxMuscleSets = computed(() => Math.max(1, ...muscleItems.value.map((item) => Number(item.setsPerWeek) || 0)))
const barWidth = (value) => `${Math.max(4, Math.round(((Number(value) || 0) / maxMuscleSets.value) * 100))}%`

const name = (value) => getTranslatedExerciseName(value) || value
const goalLabel = (goal) => t(`monthlyReport.findings.goal_${goal === 'strength' ? 'strength' : 'hypertrophy'}`)
const muscleLabel = (muscle) => (te(`monthlyReport.findings.muscle.${muscle}`) ? t(`monthlyReport.findings.muscle.${muscle}`) : muscle)

function setText(set) {
  const reps = formatNumber(set.reps, locale.value)
  return set.weight > 0
    ? t('monthlyReport.findings.setWeighted', { weight: formatWeight(set.weight, locale.value), reps })
    : t('monthlyReport.findings.setBodyweight', { reps })
}

function progressText(item) {
  const params = { exercise: name(item.exercise), from: setText(item.from), to: setText(item.to), weeks: item.weeks }
  return t(`monthlyReport.findings.progress_${item.type}`, params)
}

function repText(item) {
  return t('monthlyReport.findings.repShare', { exercise: name(item.exercise), percent: item.percentInRange, min: item.min, max: item.max })
}

function swapText(item) {
  return item.type === 'permanent'
    ? t('monthlyReport.findings.swapPermanent', { old: name(item.from), new: name(item.to) })
    : t('monthlyReport.findings.swapHopping', { count: item.count })
}

function recommendationText(rec) {
  const list = rec.section === 'progress' ? progressItems.value : rec.section === 'repRange' ? repItems.value : swapItems.value
  const item = list[rec.index]
  if (!item) return ''
  if (rec.section === 'progress') return progressText(item)
  if (rec.section === 'repRange') return t('monthlyReport.findings.repHint', { goal: goalLabel(item.goal) })
  return swapText(item)
}
</script>

<style scoped>
.findings { display: flex; flex-direction: column; gap: 18px; }
.block { display: flex; flex-direction: column; gap: 8px; }
h5 { margin: 0; font-size: 0.98rem; }
.finding { padding: 10px 12px; border: 1px solid var(--line-strong); background: var(--card-soft); border-radius: 12px; display: flex; flex-direction: column; gap: 6px; }
.finding p, .finding-line { margin: 0; font-size: 0.9rem; line-height: 1.4; }
.hint { color: var(--muted); font-size: 0.85rem; }
.muted { color: var(--muted); font-size: 0.8rem; margin: 0; line-height: 1.4; }
.tag { align-self: flex-start; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; }
.tag.good { background: var(--success-bg); color: var(--success-text); }
.tag.flat { background: var(--warning-bg); color: var(--warning-text); }
.tag.down { background: var(--danger-bg); color: var(--danger-text); }
.tag.info { background: var(--card); color: var(--muted); border: 1px solid var(--line-strong); }
.muscle { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr) 2.6rem; gap: 8px; align-items: center; font-size: 0.86rem; }
.muscle .track { height: 8px; border-radius: 6px; background: var(--card-soft); border: 1px solid var(--line-strong); overflow: hidden; }
.muscle .fill { display: block; height: 100%; background: var(--accent); }
.muscle b { text-align: right; font-variant-numeric: tabular-nums; }
.summary { border: 1px solid var(--accent); border-radius: 14px; padding: 12px 14px; }
.summary p { margin: 0; }
.summary ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; line-height: 1.4; }
</style>
