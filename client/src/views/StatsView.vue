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


const { getIdToken, onAuthStateChanged } = useFirebaseAuth()

const store = useUserStore()
const { t } = useI18n()

const loading = ref(true)
const workouts = ref([])
const selectedPeriod = ref('week')

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
function updatePeriodStats() {
  // Trigger reactivity for period-based calculations
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


async function loadData() {
  try {
    loading.value = true
    const token = await getIdToken().catch(() => null)
    await store.loadWorkouts(token)
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
