<template>
  <div class="stats-view">
    <HeaderBar :title="t('stats.overview')" />

    <main class="stats-content">

      <div v-if="loading || statsLoading" class="loading-section">
        <div class="spinner"></div>
        <p>{{ t('stats.loading') }}</p>
      </div>

      <EmptyState
        v-else-if="!hasCoreData"
        icon="📈"
        :title="t('stats.emptyTitle')"
        :message="t('stats.emptyMsg')"
      />

      <template v-else>
        <section class="panel status-panel">
          <p class="eyebrow">{{ t('stats.diagnostics.statusLabel') }}</p>
          <p class="status-line">{{ statusSummary }}</p>
        </section>

        <section v-if="primaryIssue" class="panel issue-panel">
          <p class="eyebrow">{{ t('stats.diagnostics.biggestIssueLabel') }}</p>
          <p class="issue-line">{{ primaryIssue }}</p>
        </section>

        <ul class="metric-list">
          <li v-for="metric in metricList" :key="metric.key" class="panel metric-item" :class="metric.status">
            <div class="metric-head">
              <p class="metric-label">{{ metric.label }}</p>
              <span class="metric-status">{{ metric.statusText }}</span>
            </div>
            <div class="metric-body">
              <p class="metric-value">{{ metric.value }}</p>
              <p class="metric-trend">{{ metric.trend }}</p>
            </div>
            <p class="metric-note">{{ metric.interpretation }}</p>
          </li>
        </ul>
      </template>

    </main>

    <BottomNav />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from '@/stores/userStore'
import { useSettingsStore } from '@/stores/settingsStore'
import HeaderBar from '@/components/HeaderBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import EmptyState from '@/components/EmptyState.vue'
import { logger } from '@/utils/logger'

const { t, locale } = useI18n()
const store = useUserStore()
const settings = useSettingsStore()
const { getIdToken, onAuthStateChanged } = useFirebaseAuth()

const loading = ref(true)
const workouts = ref([])
const authToken = ref(null)

const isDe = computed(() => (locale.value || 'de').toLowerCase().startsWith('de'))

const statsLoading = computed(() => store.loadingStats)
const progressStats = computed(() => store.stats)
const weeklyGoal = computed(() => Number(settings.weeklyGoal) || 0)

const statusLabels = computed(() => ({
  good: t('stats.diagnostics.status.good'),
  caution: t('stats.diagnostics.status.caution'),
  risk: t('stats.diagnostics.status.risk')
}))
const severityScore = { good: 0, caution: 1, risk: 2 }

const diagnosticsWindowSize = 4
const MS_PER_DAY = 24 * 60 * 60 * 1000

const hasStatsWindow = computed(() => Array.isArray(progressStats.value?.weeks) && progressStats.value.weeks.length > 0)
const hasCoreData = computed(() => hasStatsWindow.value || workouts.value.length > 0)

const sortedWeeks = computed(() => {
  if (!hasStatsWindow.value) return []
  return [...progressStats.value.weeks].sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
})

const recentWeeks = computed(() => sliceWeeks(sortedWeeks.value, diagnosticsWindowSize, 0))
const previousWeeks = computed(() => sliceWeeks(sortedWeeks.value, diagnosticsWindowSize, diagnosticsWindowSize))

const avgSessionsRecent = computed(() => averageSessions(recentWeeks.value))
const avgSessionsPrev = computed(() => averageSessions(previousWeeks.value))
const avgVolumeRecent = computed(() => averageVolume(recentWeeks.value))
const avgVolumePrev = computed(() => averageVolume(previousWeeks.value))

const muscleSets = computed(() => collectMuscleSets(workouts.value))
const pushPull = computed(() => ({
  push: muscleSets.value.push?.sets || 0,
  pull: muscleSets.value.pull?.sets || 0
}))

const metricList = computed(() => {
  if (!hasCoreData.value) return []
  return [
    buildFrequencyMetric(),
    buildMuscleVolumeMetric(),
    buildPushPullMetric(),
    buildProgressionMetric(),
    buildRecoveryMetric()
  ].filter(Boolean)
})

const statusSummary = computed(() => {
  if (!metricList.value.length) return ''
  return metricList.value
    .map(metric => metric.summary)
    .filter(Boolean)
    .join(', ')
})

const primaryIssue = computed(() => {
  const ranked = metricList.value
    .filter(metric => metric.issue && metric.status !== 'good')
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))

  return ranked[0]?.issue || null
})

async function loadData() {
  try {
    loading.value = true
    const token = await getIdToken().catch(() => null)
    authToken.value = token
    await Promise.all([
      store.loadWorkouts(token),
      store.loadStats(token, { rangeDays: 120 })
    ])
    workouts.value = store.workouts
  } catch (error) {
    logger.error('Fehler beim Laden der Stats', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(async (user) => {
    if (user) {
      await loadData()
    } else {
      workouts.value = []
    }
  })
})

function buildFrequencyMetric() {
  if (!Number.isFinite(avgSessionsRecent.value)) return null
  const value = avgSessionsRecent.value
  const prev = avgSessionsPrev.value
  const target = weeklyGoal.value || 4
  const diff = value - target
  const status = interpretDiff(diff, 0.25)
  const severity = severityScore[status]
  const valueText = `${formatNumber(value, 1)} ${isDe.value ? 'Sessions/Woche' : 'sessions/week'}`
  const trendText = buildTrendText(value - prev, 'sessions')
  const interpretation = diff >= 0
    ? (isDe.value ? 'im Zielbereich (≥ Ziel)' : 'on target (≥ goal)')
    : (isDe.value
        ? `−${formatNumber(Math.abs(diff), 1)} unter Ziel`
        : `-${formatNumber(Math.abs(diff), 1)} under goal`)
  const issue = status !== 'good'
    ? (isDe.value
        ? `Frequenz ${formatNumber(Math.abs(diff), 1)} unter Ziel`
        : `Frequency ${formatNumber(Math.abs(diff), 1)} below target`)
    : null
  return {
    key: 'frequency',
    label: t('stats.diagnostics.metrics.frequency'),
    value: valueText,
    trend: trendText,
    interpretation,
    summary: diff >= 0
      ? (isDe.value ? 'Frequenz gut' : 'Frequency good')
      : (isDe.value ? 'Frequenz niedrig' : 'Frequency low'),
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildMuscleVolumeMetric() {
  const groups = ['push', 'pull', 'legs']
  const totals = groups.map(key => ({
    key,
    sets: Math.round(muscleSets.value[key]?.sets || 0),
    reps: Math.round(muscleSets.value[key]?.reps || 0)
  }))
  const totalSets = totals.reduce((sum, item) => sum + item.sets, 0)
  if (!totalSets) return null

  const minGroup = totals.reduce((lowest, current) => {
    if (!lowest || current.sets < lowest.sets) return current
    return lowest
  }, null)
  const maxGroup = totals.reduce((top, current) => {
    if (!top || current.sets > top.sets) return current
    return top
  }, null)

  const ratio = maxGroup && minGroup && maxGroup.sets ? minGroup.sets / maxGroup.sets : 1
  const status = ratio >= 0.8 ? 'good' : ratio >= 0.6 ? 'caution' : 'risk'
  const severity = severityScore[status]

  const labels = {
    push: isDe.value ? 'Push' : 'Push',
    pull: isDe.value ? 'Pull' : 'Pull',
    legs: isDe.value ? 'Beine' : 'Legs'
  }
  const valueText = isDe.value
    ? totals.map(item => `${labels[item.key]} ${item.sets} Sätze`).join(' · ')
    : totals.map(item => `${labels[item.key]} ${item.sets} sets`).join(' · ')

  const trend = isDe.value ? 'Verteilung (letzte 4 Wochen)' : 'Distribution (last 4 weeks)'
  const interpretation = status === 'good'
    ? (isDe.value ? 'Push/Pull/Beine ausgewogen' : 'Push/Pull/Legs balanced')
    : (isDe.value
        ? `${labels[minGroup.key]} ${Math.round((1 - ratio) * 100)} % unter ${labels[maxGroup.key]}`
        : `${labels[minGroup.key]} ${Math.round((1 - ratio) * 100)} % below ${labels[maxGroup.key]}`)

  const issue = status !== 'good'
    ? (isDe.value ? `${labels[minGroup.key]} zu wenig Volumen` : `${labels[minGroup.key]} volume too low`)
    : null

  return {
    key: 'muscle-volume',
    label: t('stats.diagnostics.metrics.muscleVolume'),
    value: valueText,
    trend,
    interpretation,
    summary: status === 'good'
      ? (isDe.value ? 'Volumen verteilt' : 'Volume balanced')
      : (isDe.value ? 'Volumen unausgeglichen' : 'Volume unbalanced'),
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildPushPullMetric() {
  const { push, pull } = pushPull.value
  if (!push && !pull) return null
  if (!pull) {
    return {
      key: 'push-pull',
      label: t('stats.diagnostics.metrics.pushPull'),
      value: isDe.value ? 'Nur Push' : 'Push only',
      trend: isDe.value ? 'keine Pull-Daten' : 'no pull data',
      interpretation: isDe.value ? 'Pull fehlt komplett' : 'Pull sessions missing',
      summary: isDe.value ? 'Pull fehlt' : 'Pull missing',
      status: 'risk',
      statusText: statusLabels.value.risk,
      issue: isDe.value ? 'Kein Pull-Volumen erfasst' : 'No pull volume logged',
      severity: severityScore.risk
    }
  }

  const ratio = push / pull
  const status = ratio >= 0.85 && ratio <= 1.2 ? 'good' : ratio >= 0.7 && ratio <= 1.4 ? 'caution' : 'risk'
  const severity = severityScore[status]
  const valueText = `${formatNumber(ratio, 2)} ${isDe.value ? 'Verhältnis Push/Pull' : 'push/pull ratio'}`
  const interpretation = status === 'good'
    ? (isDe.value ? 'Balance stimmt' : 'balance on point')
    : (isDe.value
        ? (ratio > 1 ? 'Push überwiegt' : 'Pull überwiegt')
        : (ratio > 1 ? 'Push dominates' : 'Pull dominates'))
  const issue = status !== 'good'
    ? (isDe.value
        ? (ratio > 1 ? 'Pull-Volumen aufholen' : 'Push-Volumen nachziehen')
        : (ratio > 1 ? 'Increase pull work' : 'Increase push work'))
    : null

  return {
    key: 'push-pull',
    label: t('stats.diagnostics.metrics.pushPull'),
    value: valueText,
    trend: isDe.value ? 'letzte 4 Wochen' : 'last 4 weeks',
    interpretation,
    summary: status === 'good'
      ? (isDe.value ? 'Push/Pull in Balance' : 'Push/Pull balanced')
      : (isDe.value ? 'Push/Pull verschoben' : 'Push/Pull skewed'),
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildProgressionMetric() {
  if (!Number.isFinite(avgVolumeRecent.value) || !Number.isFinite(avgVolumePrev.value)) return null
  const prev = avgVolumePrev.value
  const current = avgVolumeRecent.value
  if (prev === 0 && current === 0) return null
  const deltaPercent = prev ? ((current - prev) / prev) * 100 : 0
  const status = deltaPercent >= 5 ? 'good' : deltaPercent >= -5 ? 'caution' : 'risk'
  const severity = severityScore[status]
  const valueText = `${formatNumber(current, 0)} ${isDe.value ? 'Volumen/Woche' : 'volume/week'}`
  const trend = `${deltaPercent >= 0 ? '+' : ''}${formatNumber(deltaPercent, 1)}% ${isDe.value ? 'vs vorher' : 'vs prior'}`
  const interpretation = status === 'good'
    ? (isDe.value ? 'Progress steigt' : 'progress increasing')
    : status === 'caution'
      ? (isDe.value ? 'Progress stagniert' : 'progress flat')
      : (isDe.value ? 'Progress fällt' : 'progress dropping')
  const issue = status === 'risk'
    ? (isDe.value ? 'Progress stagniert, Volumen sinkt' : 'Progress stalled, volume down')
    : null

  return {
    key: 'progression',
    label: t('stats.diagnostics.metrics.progression'),
    value: valueText,
    trend,
    interpretation,
    summary: interpretation,
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildRecoveryMetric() {
  if (!Number.isFinite(avgSessionsRecent.value)) return null
  const freqDiff = avgSessionsRecent.value - (weeklyGoal.value || 4)
  const volumeDelta = avgVolumePrev.value ? ((avgVolumeRecent.value - avgVolumePrev.value) / avgVolumePrev.value) * 100 : 0
  const stressScore = (freqDiff > 0 ? 1 : 0) + (volumeDelta > 10 ? 1 : 0)
  const status = stressScore >= 2 ? 'high' : stressScore === 1 ? 'medium' : 'low'
  const statusMap = {
    low: { status: 'good', text: isDe.value ? 'niedrig' : 'low' },
    medium: { status: 'caution', text: isDe.value ? 'mittel' : 'medium' },
    high: { status: 'risk', text: isDe.value ? 'hoch' : 'high' }
  }
  const mapped = statusMap[status]
  const severity = severityScore[mapped.status]
  const reason = status === 'high'
    ? (isDe.value ? 'Hohe Belastung, Regeneration beachten' : 'High load, monitor recovery')
    : status === 'medium'
      ? (isDe.value ? 'Belastung im Rahmen' : 'Load acceptable')
      : (isDe.value ? 'Erholung ausreichend' : 'Recovery adequate')
  const issue = mapped.status === 'risk'
    ? (isDe.value ? 'Stress zu hoch, Deload erwägen' : 'Stress high, consider deload')
    : null

  return {
    key: 'recovery',
    label: t('stats.diagnostics.metrics.recovery'),
    value: `${isDe.value ? 'Status' : 'Status'}: ${reason}`,
    trend: isDe.value
      ? `Frequenz Δ ${formatNumber(freqDiff, 1)}, Volumen Δ ${formatNumber(volumeDelta, 1)} %`
      : `Frequency Δ ${formatNumber(freqDiff, 1)}, Volume Δ ${formatNumber(volumeDelta, 1)} %`,
    interpretation: reason,
    summary: reason,
    status: mapped.status,
    statusText: statusLabels.value[mapped.status],
    issue,
    severity
  }
}

function sliceWeeks(weeks, size, offset = 0) {
  if (!Array.isArray(weeks) || !weeks.length || size <= 0) return []
  const end = Math.max(weeks.length - offset, 0)
  const start = Math.max(0, end - size)
  return weeks.slice(start, end)
}

function averageSessions(weeks) {
  if (!weeks.length) return 0
  const total = weeks.reduce((sum, week) => sum + (Number(week.sessionCount) || 0), 0)
  return Number((total / weeks.length).toFixed(2))
}

function averageVolume(weeks) {
  if (!weeks.length) return 0
  const total = weeks.reduce((sum, week) => sum + (Number(week.totalVolume) || 0), 0)
  return total / weeks.length
}

function collectMuscleSets(list) {
  const cutoff = Date.now() - 28 * MS_PER_DAY
  const base = {
    push: { sets: 0, reps: 0 },
    pull: { sets: 0, reps: 0 },
    legs: { sets: 0, reps: 0 }
  }

  list.forEach(workout => {
    if (!workout || workout.isDraft) return
    const workoutDate = new Date(workout.date)
    if (Number.isNaN(workoutDate.getTime()) || workoutDate.getTime() < cutoff) return

    ;(workout.exercises || []).forEach(exercise => {
      const bucketKey = normalizeCategory(exercise?.category, workout?.type)
      if (!base[bucketKey]) base[bucketKey] = { sets: 0, reps: 0 }
      if (Array.isArray(exercise.setDetails) && exercise.setDetails.length) {
        exercise.setDetails.forEach(set => {
          base[bucketKey].sets += 1
          base[bucketKey].reps += Number(set?.reps) || 0
        })
      } else {
        const sets = Number(exercise?.sets) || 1
        const reps = Number(exercise?.reps) || 0
        base[bucketKey].sets += Math.max(0, sets)
        base[bucketKey].reps += Math.max(0, sets * reps)
      }
    })
  })

  return base
}

function normalizeCategory(category, workoutType) {
  const source = (category || workoutType || 'push').toString().toLowerCase()
  if (source.includes('pull') || source.includes('ruck') || source.includes('back')) return 'pull'
  if (source.includes('leg') || source.includes('bein')) return 'legs'
  return 'push'
}

function interpretDiff(diff, tolerance) {
  if (Math.abs(diff) <= tolerance) return 'good'
  return Math.abs(diff) <= tolerance * 2 ? 'caution' : 'risk'
}

function buildTrendText(delta, unit) {
  if (!Number.isFinite(delta)) return isDe.value ? 'keine Veränderung' : 'no change'
  if (Math.abs(delta) < 0.01) return isDe.value ? 'stabil' : 'steady'
  if (unit === 'sessions') {
    return `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)} ${isDe.value ? 'Sessions' : 'sessions'}`
  }
  return `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)}`
}

function formatNumber(value, digits = 0) {
  const formatter = new Intl.NumberFormat(isDe.value ? 'de-DE' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
  return formatter.format(Number(value) || 0)
}
</script>

<style scoped>
.stats-view {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 70px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px clamp(16px, 4vw, 48px);
}

.panel {
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  padding: clamp(18px, 3vw, 24px);
}

.loading-section {
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  padding: 2.25rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: rgba(215, 255, 31, 0.9);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 0.72rem;
  color: var(--muted);
  margin: 0 0 10px;
}

.status-line,
.issue-line {
  margin: 0;
  color: var(--fg-strong);
  line-height: 1.55;
}

.issue-panel {
  border-color: rgba(255, 137, 137, 0.5);
  background: rgba(255, 137, 137, 0.08);
}

.metric-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.metric-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.metric-label {
  margin: 0;
  font-weight: 600;
  color: var(--fg-strong);
}

.metric-status {
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}

.metric-body {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
}

.metric-value {
  margin: 0;
  font-weight: 600;
}

.metric-trend,
.metric-note {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.metric-item.good { border-color: rgba(121, 255, 180, 0.3); }
.metric-item.caution { border-color: rgba(255, 210, 133, 0.35); }
.metric-item.risk { border-color: rgba(255, 137, 137, 0.5); }

@media (max-width: 540px) {
  .metric-body { flex-direction: column; }
}

[data-theme="light"] .panel,
[data-theme="light"] .loading-section {
  background: rgba(255, 255, 255, 0.65);
  border-color: rgba(12, 16, 30, 0.12);
}

[data-theme="light"] .issue-panel {
  background: rgba(255, 137, 137, 0.12);
}
</style>

