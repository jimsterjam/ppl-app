<template>
  <div class="quick-overview">
    <h3>Deine Woche</h3>
    
    <!-- 7-Tage Mini Chart -->
    <div class="week-chart">
      <div class="chart-container">
        <div 
          v-for="(day, index) in weekData" 
          :key="index"
          class="day-bar"
          :class="{ 'has-workout': day.hasWorkout, 'is-today': day.isToday }"
          :title="`${day.label}: ${day.hasWorkout ? day.workoutType || 'Workout' : 'Kein Training'}`"
        >
          <div class="bar" :style="{ height: day.hasWorkout ? '100%' : '10%' }"></div>
          <span class="day-label">{{ day.shortLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card weekly-goal">
        <div class="stat-icon">🎯</div>
        <div class="stat-info">
          <span class="stat-number">{{ thisWeekCount }}/{{ weeklyGoal }}</span>
          <span class="stat-label">Wochenziel</span>
          <div class="progress">
            <div class="progress-bar" :style="{ width: weekProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <div v-if="daysSinceLastWorkout >= 0" class="stat-card next-workout">
        <div class="stat-icon">⏰</div>
        <div class="stat-info">
          <span class="stat-number">{{ lastWorkoutLabel }}</span>
          <span class="stat-label">Letztes Training</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

// 7-Tage Daten für Mini-Chart
const weekData = computed(() => {
  const today = new Date()
  const days = []
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    date.setHours(0, 0, 0, 0)
    
    const isToday = i === 0
    const dayStart = date.getTime()
    
    // Finde Workout für diesen Tag
    const dayWorkout = props.workouts.find(w => {
      const workoutDate = new Date(w.date)
      workoutDate.setHours(0, 0, 0, 0)
      return workoutDate.getTime() === dayStart
    })
    
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    
    days.push({
      date,
      label: isToday ? 'Heute' : dayNames[date.getDay()],
      shortLabel: isToday ? 'H' : dayNames[date.getDay()].charAt(0),
      hasWorkout: !!dayWorkout,
      workoutType: dayWorkout?.type,
      isToday
    })
  }
  
  return days
})

// Wochenziel aus Settings-Store (reaktiv, persistent)
const settings = useSettingsStore()
const weeklyGoal = computed(() => settings.weeklyGoal)

// Workouts diese Woche
const thisWeekCount = computed(() => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay()) // Sonntag
  startOfWeek.setHours(0, 0, 0, 0)
  
  return props.workouts.filter(w => {
    if (w.isDraft) return false
    const workoutDate = new Date(w.date)
    return workoutDate >= startOfWeek && workoutDate <= today
  }).length
})

// Fortschritt in %
const weekProgress = computed(() => {
  const goal = weeklyGoal.value
  if (!goal || goal <= 0) return 0
  const pct = (thisWeekCount.value / goal) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
})

// Tage seit letztem Workout
const daysSinceLastWorkout = computed(() => {
  const recentWorkouts = props.workouts.filter(w => !w.isDraft)
  if (recentWorkouts.length === 0) return -1
  
  const lastWorkout = recentWorkouts.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const lastDate = new Date(lastWorkout.date)
  lastDate.setHours(0, 0, 0, 0)
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return Math.floor((today - lastDate) / (1000 * 60 * 60 * 24))
})

// Menschlich lesbare Anzeige für das letzte Training
const lastWorkoutLabel = computed(() => {
  const d = daysSinceLastWorkout.value
  if (d === 0) return 'Heute'
  if (d === 1) return 'Gestern'
  return `vor ${d} Tagen`
})
</script>

<style scoped>
.quick-overview {
  background: #1c1c1e;
  border-radius: 12px;
  padding: 16px;
  margin: 16px;
  border: 1px solid #333;
}

.quick-overview h3 {
  margin: 0 0 16px 0;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
}

.week-chart {
  margin-bottom: 16px;
}

.chart-container {
  display: flex;
  justify-content: space-between;
  align-items: end;
  height: 60px;
  gap: 4px;
  padding: 8px 0;
}

.day-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  cursor: pointer;
}

.bar {
  width: 100%;
  max-width: 28px;
  background: #333;
  border-radius: 4px 4px 0 0;
  transition: all 0.3s ease;
  min-height: 4px;
}

.day-bar.has-workout .bar {
  background: linear-gradient(to top, #ff4d4d, #ff6b6b);
  box-shadow: 0 0 8px rgba(255, 77, 77, 0.3);
}

.day-bar.is-today .bar {
  border: 2px solid #fff;
}

.day-bar.is-today.has-workout .bar {
  background: linear-gradient(to top, #4dabf7, #74c0fc);
  box-shadow: 0 0 12px rgba(77, 171, 247, 0.4);
}

.day-label {
  font-size: 0.75rem;
  color: #999;
  margin-top: 4px;
  font-weight: 500;
}

.day-bar.is-today .day-label {
  color: #fff;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #2a2a2d;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #333;
  transition: all 0.2s ease;
}

.stat-card:hover {
  background: #323236;
  border-color: #444;
}

.stat-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1;
  margin-top: 2px;
}

.streak .stat-number {
  color: #ff6b47;
}

.this-week .stat-number {
  color: #4dabf7;
}

.next-workout .stat-number {
  color: #51cf66;
}

.weekly-goal .stat-number { color: #4dabf7; }
.progress { margin-top: 6px; height: 6px; background: #3a3a3d; border-radius: 999px; overflow: hidden; border: 1px solid #333; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #4dabf7, #74c0fc); width: 0%; transition: width 0.3s ease; }

@media (max-width: 480px) {
  .quick-overview {
    margin: 12px;
    padding: 12px;
  }
  
  .chart-container {
    height: 50px;
    gap: 2px;
  }
  
  .bar {
    max-width: 24px;
  }
  
  .day-label {
    font-size: 0.7rem;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .stat-card {
    padding: 10px;
    gap: 8px;
  }
  
  .stat-icon {
    font-size: 1rem;
  }
  
  .stat-number {
    font-size: 1rem;
  }
  
  .stat-label {
    font-size: 0.7rem;
  }
}

@media (max-width: 380px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .stat-card {
    justify-content: center;
  }
}
</style>