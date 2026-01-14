<template>
  <div class="stats-view">
    <HeaderBar :title="t('stats.overview')" />
    
    <div class="stats-content">
      <div v-if="loading" class="loading">
        {{ t('stats.loading') }}
      </div>
      
      <div v-else-if="workouts.length === 0" class="empty-state">
        <h3>{{ t('stats.emptyTitle') }}</h3>
        <p>{{ t('stats.emptyMsg') }}</p>
      </div>
      
      <div v-else class="charts-container">
        <!-- Enhanced Stats Overview -->
        <div class="enhanced-overview glass">
          <div class="overview-header">
            <h3>{{ t('stats.overview') }}</h3>
            <div class="time-period">
              <select v-model="selectedPeriod" @change="updatePeriodStats">
                <option value="week">Diese Woche</option>
                <option value="month">Dieser Monat</option>
                <option value="all">Gesamt</option>
              </select>
            </div>
          </div>
          
          <!-- Visual Progress Ring -->
          <div class="progress-ring-container">
            <div class="progress-ring">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" 
                        fill="none" 
                        :stroke="'var(--card-border)'" 
                        stroke-width="8"/>
                <circle cx="60" cy="60" r="50" 
                        fill="none" 
                        :stroke="getProgressColor()" 
                        stroke-width="8"
                        stroke-linecap="round"
                        :stroke-dasharray="circumference"
                        :stroke-dashoffset="progressOffset"
                        transform="rotate(-90 60 60)"
                        class="progress-circle"/>
              </svg>
              <div class="progress-center">
                <span class="progress-percentage">{{ weekProgress }}%</span>
                <span class="progress-label">Ziel</span>
              </div>
            </div>
            <div class="period-stats">
              <div class="big-stat">
                <span class="big-number">{{ getPeriodWorkouts() }}</span>
                <span class="big-label">{{ getPeriodLabel() }}</span>
              </div>
            </div>
          </div>
          
          <!-- Quick Stats Row -->
          <div class="quick-stats-row">
            <div class="mini-stat">
              <span class="mini-number">{{ getStreakDays() }}</span>
              <span class="mini-label">🔥 Streak</span>
            </div>
            <div class="mini-stat">
              <span class="mini-number">{{ getAvgPerWeek() }}</span>
              <span class="mini-label">📊 Ø/Woche</span>
            </div>
            <div class="mini-stat">
              <span class="mini-number">{{ getBestMonth() }}</span>
              <span class="mini-label">🏆 Bester</span>
            </div>
          </div>
        </div>
        
        <div v-if="statsLoading" class="ai-progress glass">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ t('stats.ai.cockpitLabel') }}</p>
              <h3>{{ t('stats.loading') }}</h3>
            </div>
            <span class="range-chip pulse"></span>
          </div>
          <p class="loading-copy">{{ t('stats.ai.loadingCopy') }}</p>
        </div>

        <div v-else-if="hasProgressStats" class="ai-progress glass">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ t('stats.ai.cockpitLabel') }}</p>
              <h3>{{ t('stats.ai.monthlyPulse') }}</h3>
            </div>
            <span class="range-chip">{{ progressRangeLabel }}</span>
          </div>

          <div class="kpi-grid">
            <div v-for="card in kpiCards" :key="card.label" class="kpi-card" :class="card.tone">
              <p class="kpi-label">{{ card.label }}</p>
              <p class="kpi-value">{{ card.value }}</p>
              <p class="kpi-hint">{{ card.hint }}</p>
            </div>
          </div>

          <div class="insights-grid">
            <div class="weekly-panel">
              <div class="panel-header">
                <h4>{{ t('stats.ai.weeklyRhythmTitle') }}</h4>
                <span class="panel-hint">{{ t('stats.ai.weeklyRhythmHint', { count: weeklyMomentum.length }) }}</span>
              </div>
              <div v-if="weeklyMomentum.length" class="week-list">
                <div v-for="week in weeklyMomentum" :key="week.weekStart" class="week-item">
                  <div>
                    <p class="week-label">{{ week.label }}</p>
                    <p class="week-intensity">{{ formatWeekIntensity(week.avgIntensity) }}</p>
                  </div>
                  <div class="week-badges">
                    <span class="badge" :class="getWeekBadgeClass(week.sessions)">{{ getWeekSessionsLabel(week.sessions) }}</span>
                    <span class="badge ghost">{{ getWeekVolumeLabel(week.volume) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="empty-panel">{{ t('stats.ai.weeklyEmpty') }}</div>
            </div>

            <div class="top-lifts-panel">
              <div class="panel-header">
                <h4>{{ t('stats.ai.topLiftsTitle') }}</h4>
                <span class="panel-hint">{{ t('stats.ai.topLiftsHint') }}</span>
              </div>
              <div v-if="topLiftList.length" class="lift-list">
                <div v-for="lift in topLiftList" :key="lift.name" class="lift-item">
                  <div>
                    <p class="lift-name">{{ lift.name }}</p>
                    <p class="lift-meta">{{ getLiftMeta(lift) }}</p>
                  </div>
                  <span class="lift-weight">{{ lift.weight }}kg</span>
                </div>
              </div>
              <div v-else class="empty-panel">{{ t('stats.ai.topLiftsEmpty') }}</div>
            </div>
          </div>

          <div class="muscle-panel">
            <div class="panel-header">
              <h4>{{ t('stats.ai.muscleFocusTitle') }}</h4>
              <span class="panel-hint">{{ t('stats.ai.muscleFocusHint') }}</span>
            </div>
            <div v-if="muscleDistribution.length" class="muscle-bars">
              <div v-for="muscle in muscleDistribution" :key="muscle.key" class="muscle-row">
                <span class="muscle-label">{{ muscle.label }}</span>
                <div class="muscle-bar-wrap">
                  <div class="muscle-bar" :style="{ width: getMuscleBarWidth(muscle.volume) }"></div>
                </div>
                <span class="muscle-value">{{ formatKgValue(muscle.volume) }}kg</span>
              </div>
            </div>
            <div v-else class="empty-panel">{{ t('stats.ai.muscleEmpty') }}</div>
          </div>
        </div>

        <WorkoutTypeChart :workouts="workouts" />
        <ProgressChart :workouts="workouts" />
      </div>
    </div>

    <BottomNav />
  </div>
</template>


<script setup>
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from '@/stores/userStore'
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import HeaderBar from '@/components/HeaderBar.vue'
import WorkoutTypeChart from '@/components/WorkoutTypeChart.vue'
import ProgressChart from '@/components/ProgressChart.vue'
import BottomNav from '@/components/BottomNav.vue'
import { logger } from '@/utils/logger'


const { getIdToken, onAuthStateChanged } = useFirebaseAuth()

const store = useUserStore()
const { t } = useI18n()

const loading = ref(true)
const workouts = ref([])
const selectedPeriod = ref('week')
const authToken = ref(null)

const compactNumber = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 })
const decimalNumber = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' })

const progressStats = computed(() => store.stats)
const statsLoading = computed(() => store.loadingStats)
const hasProgressStats = computed(() => !!(progressStats.value && progressStats.value.kpis))

const progressRangeLabel = computed(() => {
  if (!hasProgressStats.value) return '—'
  try {
    const start = new Date(progressStats.value.range.start)
    const end = new Date(progressStats.value.range.end)
    return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`
  } catch (e) {
    return '—'
  }
})

const consistencyTagline = computed(() => {
  const score = progressStats.value?.kpis?.consistencyScore ?? 0
  if (score >= 85) return t('stats.ai.consistencyTaglines.machine')
  if (score >= 70) return t('stats.ai.consistencyTaglines.steady')
  if (score >= 50) return t('stats.ai.consistencyTaglines.onTrack')
  return t('stats.ai.consistencyTaglines.routine')
})

const kpiCards = computed(() => {
  if (!hasProgressStats.value) return []
  const kpis = progressStats.value.kpis
  return [
    {
      label: t('stats.ai.kpis.sessions'),
      value: kpis.sessions ?? 0,
      hint: t('stats.ai.kpis.sessionsHint', { value: decimalNumber.format(kpis.avgSessionsPerWeek || 0) }),
      tone: 'sessions'
    },
    {
      label: t('stats.ai.kpis.avgSessions'),
      value: decimalNumber.format(kpis.avgSessionsPerWeek || 0),
      hint: t('stats.ai.kpis.avgSessionsHint'),
      tone: 'tempo'
    },
    {
      label: t('stats.ai.kpis.volume'),
      value: `${formatKgValue(kpis.totalVolume)}kg`,
      hint: t('stats.ai.kpis.volumeHint', { value: formatKgValue(kpis.avgWeeklyVolume || 0) }),
      tone: 'volume'
    },
    {
      label: t('stats.ai.kpis.consistency'),
      value: `${Math.round(kpis.consistencyScore || 0)}%`,
      hint: consistencyTagline.value,
      tone: kpis.consistencyScore >= 75 ? 'good' : kpis.consistencyScore >= 50 ? 'neutral' : 'alert'
    }
  ]
})

const weeklyMomentum = computed(() => {
  if (!hasProgressStats.value) return []
  const weeks = progressStats.value.weeks || []
  return weeks.slice(-5).reverse().map(week => ({
    weekStart: week.weekStart,
    label: dateFormatter.format(new Date(week.weekStart)),
    sessions: week.sessionCount,
    volume: week.totalVolume,
    avgIntensity: week.avgIntensity
  }))
})

const topLiftList = computed(() => (hasProgressStats.value ? progressStats.value.topLifts || [] : []))
const muscleDistribution = computed(() => (hasProgressStats.value ? progressStats.value.muscleBreakdown || [] : []))
const maxMuscleVolume = computed(() => {
  const volumes = muscleDistribution.value.map(item => Number(item.volume) || 0)
  return volumes.length ? Math.max(...volumes) : 1
})

// Circle progress calculation
const circumference = 2 * Math.PI * 50

const progressOffset = computed(() => {
  const progress = weekProgress.value / 100
  return circumference * (1 - progress)
})

// Computed Stats
const totalWorkouts = computed(() => workouts.value.length)

const uniqueExercises = computed(() => {
  const exercises = new Set()
  workouts.value.forEach(workout => {
    if (Array.isArray(workout.exercises)) {
      workout.exercises.forEach(ex => {
        if (ex.name) exercises.add(ex.name)
      })
    }
  })
  return exercises.size
})

const totalDuration = computed(() => {
  return workouts.value.reduce((sum, workout) => {
    return sum + (workout.duration || 0)
  }, 0)
})

// Wochenziel-Progress aus Settings-Store (reaktiv)
const settings = useSettingsStore()
const weeklyGoal = computed(() => settings.weeklyGoal)

const thisWeekCount = computed(() => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return workouts.value.filter(w => {
    if (w.isDraft) return false
    const d = new Date(w.date)
    return d >= startOfWeek && d <= today
  }).length
})

const weekProgress = computed(() => {
  const goal = weeklyGoal.value
  if (!goal || goal <= 0) return 0
  const pct = (thisWeekCount.value / goal) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
})

// Enhanced Stats Functions
function getRangeDays(period) {
  if (period === 'week') return 60
  if (period === 'month') return 120
  return 365
}

function updatePeriodStats() {
  if (!authToken.value) return
  store.loadStats(authToken.value, { rangeDays: getRangeDays(selectedPeriod.value) })
}

function getProgressColor() {
  if (weekProgress.value >= 100) return 'var(--success-color)'
  if (weekProgress.value >= 70) return 'var(--accent-color)' 
  return '#fbbf24'
}

function getPeriodWorkouts() {
  if (selectedPeriod.value === 'week') return thisWeekCount.value
  if (selectedPeriod.value === 'month') return getThisMonthCount()
  return totalWorkouts.value
}

function getPeriodLabel() {
  if (selectedPeriod.value === 'week') return 'Workouts'
  if (selectedPeriod.value === 'month') return 'im Monat'
  return 'Gesamt'
}

function getThisMonthCount() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return workouts.value.filter(w => {
    if (w.isDraft) return false
    const d = new Date(w.date)
    return d >= startOfMonth && d <= now
  }).length
}

function getStreakDays() {
  const recent = workouts.value
    .filter(w => !w.isDraft)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  
  if (recent.length === 0) return 0
  
  let streak = 0
  let checkDate = new Date()
  checkDate.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < recent.length; i++) {
    const workoutDate = new Date(recent[i].date)
    workoutDate.setHours(0, 0, 0, 0)
    
    const daysDiff = Math.floor((checkDate - workoutDate) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= 1) {
      streak++
      checkDate = new Date(workoutDate)
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }
  
  return streak
}

function getAvgPerWeek() {
  if (workouts.value.length === 0) return '0'
  
  const firstWorkout = workouts.value
    .filter(w => !w.isDraft)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
  
  if (!firstWorkout) return '0'
  
  const weeksSince = Math.max(1, Math.ceil((Date.now() - new Date(firstWorkout.date)) / (7 * 24 * 60 * 60 * 1000)))
  const avg = workouts.value.filter(w => !w.isDraft).length / weeksSince
  
  return avg.toFixed(1)
}

function getBestMonth() {
  const monthCounts = {}
  
  workouts.value.filter(w => !w.isDraft).forEach(w => {
    const date = new Date(w.date)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    monthCounts[key] = (monthCounts[key] || 0) + 1
  })
  
  const max = Math.max(...Object.values(monthCounts), 0)
  return max || 0
}

function formatKgValue(value) {
  const numeric = Number(value) || 0
  if (numeric >= 1000) {
    return compactNumber.format(numeric)
  }
  return Math.round(numeric).toString()
}

function formatWeekIntensity(value) {
  return t('stats.ai.weekAvgIntensity', { value: decimalNumber.format(value || 0) })
}

function getWeekSessionsLabel(count) {
  return t('stats.ai.badges.sessions', { count })
}

function getWeekVolumeLabel(volume) {
  return t('stats.ai.badges.volume', { value: formatKgValue(volume) })
}

function getLiftMeta(lift) {
  if (lift?.reps) {
    return t('stats.ai.badges.reps', { count: lift.reps })
  }
  return t('stats.ai.badges.pr')
}

function getWeekBadgeClass(count) {
  if (count >= 4) return 'badge-strong'
  if (count >= 2) return 'badge-solid'
  return 'badge-ghost'
}

function getMuscleBarWidth(volume) {
  const max = maxMuscleVolume.value || 1
  const pct = Math.round((Number(volume) / max) * 100)
  return `${Math.max(pct, 5)}%`
}


async function loadData() {
  try {
    loading.value = true
    const token = await getIdToken().catch(() => null)
    authToken.value = token
    await Promise.all([
      store.loadWorkouts(token),
      store.loadStats(token, { rangeDays: getRangeDays(selectedPeriod.value) })
    ])
    workouts.value = store.workouts
  } catch (error) {
    logger.error('Fehler beim Laden der Workout-Daten:', error)
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
</script>

<style scoped>
.stats-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }

.stats-content {
  padding: 20px;
}

.loading { text-align: center; padding: 60px 20px; color: var(--muted); }

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state h3 { color: var(--fg); margin-bottom: 12px; }

.empty-state p { color: var(--muted); }

.charts-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.enhanced-overview {
  background: transparent;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid transparent;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.overview-header h3 {
  margin: 0;
  color: var(--fg);
  font-size: 1.2rem;
  font-weight: 600;
}

.time-period select {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font-size: 0.9rem;
}

.progress-ring-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-bottom: 24px;
}

.progress-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-circle {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.progress-percentage {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--fg);
  line-height: 1;
}

.progress-label {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 4px;
}

.period-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.big-stat {
  text-align: center;
}

.big-number {
  display: block;
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--accent-color);
  line-height: 1;
}

.big-label {
  display: block;
  font-size: 0.9rem;
  color: var(--muted);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quick-stats-row {
  display: flex;
  justify-content: space-around;
  gap: 16px;
}

.mini-stat {
  text-align: center;
  flex: 1;
}

.mini-number {
  display: block;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--fg);
  line-height: 1;
}

.mini-label {
  display: block;
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 4px;
}

.stat-label { display: block; color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }

.ai-progress {
  background: var(--surface);
  border-radius: 18px;
  padding: 22px;
  border: 1px solid var(--card-border);
  box-shadow: 0 12px 32px rgba(0,0,0,0.18);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.7rem;
  color: var(--muted);
  margin: 0 0 4px 0;
}

.range-chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  font-size: 0.8rem;
  color: var(--muted);
}

.range-chip.pulse {
  min-width: 48px;
  min-height: 12px;
  background: var(--card-border);
  animation: shimmer 1.4s infinite;
}

.loading-copy {
  color: var(--muted);
  margin: 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.kpi-card {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--card-border);
  background: rgba(255,255,255,0.02);
}

.kpi-card.sessions { border-color: rgba(255,166,0,0.35); }
.kpi-card.tempo { border-color: rgba(59,130,246,0.35); }
.kpi-card.volume { border-color: rgba(16,185,129,0.35); }
.kpi-card.good { border-color: rgba(34,197,94,0.35); }
.kpi-card.neutral { border-color: rgba(148,163,184,0.35); }
.kpi-card.alert { border-color: rgba(248,113,113,0.45); }

.kpi-label {
  font-size: 0.75rem;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 6px 0;
}

.kpi-value {
  font-size: 1.8rem;
  margin: 0;
  font-weight: 700;
  color: var(--fg);
}

.kpi-hint {
  margin: 6px 0 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-hint {
  font-size: 0.8rem;
  color: var(--muted);
}

.week-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.week-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
}

.week-label { font-weight: 600; margin: 0; }
.week-intensity { margin: 4px 0 0 0; color: var(--muted); font-size: 0.85rem; }

.week-badges { display: flex; gap: 8px; }

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid transparent;
}

.badge-strong { border-color: rgba(34,197,94,0.4); color: #22c55e; }
.badge-solid { border-color: rgba(250,204,21,0.5); color: #facc15; }
.badge-ghost { border-color: rgba(148,163,184,0.4); color: var(--muted); }
.badge.ghost { border-color: rgba(148,163,184,0.2); color: var(--muted); }

.top-lifts-panel, .weekly-panel, .muscle-panel {
  padding: 16px;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background: rgba(255,255,255,0.01);
}

.lift-list { display: flex; flex-direction: column; gap: 10px; }

.lift-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.lift-item:last-child { border-bottom: none; }

.lift-name { margin: 0; font-weight: 600; }
.lift-meta { margin: 2px 0 0 0; color: var(--muted); font-size: 0.8rem; }
.lift-weight { font-weight: 700; color: var(--fg); }

.muscle-bars { display: flex; flex-direction: column; gap: 12px; }

.muscle-row {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  align-items: center;
  gap: 10px;
}

.muscle-label { font-size: 0.9rem; color: var(--muted); }

.muscle-bar-wrap {
  background: rgba(148,163,184,0.2);
  border-radius: 999px;
  overflow: hidden;
  height: 10px;
}

.muscle-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--success-color));
}

.muscle-value { font-weight: 600; color: var(--fg); }

.empty-panel {
  text-align: center;
  padding: 20px;
  border: 1px dashed var(--card-border);
  border-radius: 12px;
  color: var(--muted);
  font-size: 0.9rem;
}

@keyframes shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

@media (max-width: 480px) {
  .stats-content {
    padding: 16px;
  }
  
  .enhanced-overview {
    padding: 16px;
  }
  
  .overview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .progress-ring-container {
    flex-direction: column;
    gap: 20px;
  }
  
  .progress-ring svg {
    width: 100px;
    height: 100px;
  }
  
  .progress-percentage {
    font-size: 1.3rem;
  }
  
  .big-number {
    font-size: 2rem;
  }
  
  .quick-stats-row {
    gap: 12px;
  }
  
  .mini-number {
    font-size: 1.1rem;
  }
  
  .mini-label {
    font-size: 0.7rem;
  }
  
  .charts-container {
    gap: 16px;
  }

  .kpi-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
}

@media (max-width: 380px) {
  .mini-stat {
    font-size: 0.75rem;
  }
  
  .mini-number {
    font-size: 1rem;
  }
}
</style>
