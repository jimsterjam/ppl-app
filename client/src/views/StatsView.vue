<template>
  <div class="stats-view">
    <HeaderBar title="Statistiken" />
    
    <div class="stats-content">
      <div v-if="loading" class="loading">
        Lade Statistiken...
      </div>
      
      <div v-else-if="workouts.length === 0" class="empty-state">
        <h3>Noch keine Workouts</h3>
        <p>Starte dein erstes Workout um Statistiken zu sehen!</p>
      </div>
      
      <div v-else class="charts-container">
        <WorkoutTypeChart :workouts="workouts" />
        <ProgressChart :workouts="workouts" />
        
        <!-- Zusätzliche Quick Stats -->
        <div class="quick-stats">
          <h3>Übersicht</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-number">{{ totalWorkouts }}</span>
              <span class="stat-label">Workouts</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">{{ uniqueExercises }}</span>
              <span class="stat-label">Übungen</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">{{ totalDuration }}</span>
              <span class="stat-label">Minuten</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">{{ thisWeekCount }}/{{ weeklyGoal }}</span>
              <span class="stat-label">Wochenziel</span>
              <div class="progress">
                <div class="progress-bar" :style="{ width: weekProgress + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuth, useClerk } from '@clerk/vue'
import { getAuthToken } from '@/utils/authToken'
import { useUserStore } from '@/stores/userStore'
import { useSettingsStore } from '@/stores/settingsStore'
import HeaderBar from '../components/HeaderBar.vue'
import BottomNav from '../components/BottomNav.vue'
import WorkoutTypeChart from '../components/WorkoutTypeChart.vue'
import ProgressChart from '../components/ProgressChart.vue'

const auth = useAuth()
const clerk = useClerk()
const store = useUserStore()

const loading = ref(true)
const workouts = ref([])

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


async function loadData() {
  try {
    loading.value = true
  const token = await getAuthToken({ clerk, auth }).catch(() => null)
    await store.loadWorkouts(token)
    workouts.value = store.workouts
  } catch (error) {
    console.error('Fehler beim Laden der Workout-Daten:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stats-view {
  min-height: 100vh;
  background: #000;
  color: #fff;
  padding-bottom: 80px;
}

.stats-content {
  padding: 20px;
}

.loading {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state h3 {
  color: #fff;
  margin-bottom: 12px;
}

.empty-state p {
  color: #999;
}

.charts-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.quick-stats {
  background: #1c1c1e;
  border-radius: 12px;
  padding: 16px;
}

.quick-stats h3 {
  margin: 0 0 16px 0;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  background: #2a2a2d;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  border: 1px solid #333;
}

.stat-number {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
  color: #ff4d4d;
  margin-bottom: 4px;
}

.progress { margin-top: 8px; height: 8px; background: #3a3a3d; border-radius: 999px; overflow: hidden; border: 1px solid #333; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #4dabf7, #74c0fc); width: 0%; transition: width 0.3s ease; }

.stat-label {
  display: block;
  color: #999;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 480px) {
  .stats-content {
    padding: 16px;
  }
  
  .charts-container {
    gap: 16px;
  }
  
  .quick-stats {
    padding: 12px;
  }
  
  .stats-grid {
    gap: 8px;
  }
  
  .stat-card {
    padding: 12px;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
  
  .stat-label {
    font-size: 0.8rem;
  }
}

@media (max-width: 380px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  
  .stat-card {
    padding: 10px;
  }
  
  .stat-number {
    font-size: 1.3rem;
  }
}
</style>
