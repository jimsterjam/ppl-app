<template>
  <div class="chart-container glass">
    <div class="chart-header">
      <h3>Training Verlauf</h3>
      <div class="view-controls">
        <button 
          @click="viewMode = 'week'" 
          :class="{ active: viewMode === 'week' }"
          class="view-btn"
        >
          Woche
        </button>
        <button 
          @click="viewMode = 'month'" 
          :class="{ active: viewMode === 'month' }"
          class="view-btn"
        >
          Monat
        </button>
      </div>
    </div>
    
    <!-- Compact Bar Chart -->
    <div class="bar-chart-wrapper">
      <div class="chart-bars">
        <div v-for="(period, idx) in getChartData()" :key="idx" class="bar-group">
          <div class="period-bars" @click="viewMode === 'week' ? showDayOverlay(period) : null">
            <!-- Push Bar -->
            <div 
              class="workout-bar push" 
              :class="{ clickable: viewMode === 'week' && period.workout }"
              :style="{ height: (period.push / getMaxValue()) * 100 + '%' }"
              :title="getBarTooltip(period, 'push')"
            ></div>
            <!-- Pull Bar -->
            <div 
              class="workout-bar pull" 
              :class="{ clickable: viewMode === 'week' && period.workout }"
              :style="{ height: (period.pull / getMaxValue()) * 100 + '%' }"
              :title="getBarTooltip(period, 'pull')"
            ></div>
            <!-- Legs Bar -->
            <div 
              class="workout-bar legs" 
              :class="{ clickable: viewMode === 'week' && period.workout }"
              :style="{ height: (period.legs / getMaxValue()) * 100 + '%' }"
              :title="getBarTooltip(period, 'legs')"
            ></div>
          </div>
          <div class="period-label">{{ period.label }}</div>
        </div>
      </div>
    </div>
    
    <!-- Workout Overlay -->
    <div v-if="showOverlay" class="workout-overlay" @click="closeOverlay">
      <div class="overlay-content" @click.stop>
        <div class="overlay-header">
          <h4>{{ selectedDay?.fullDate }}</h4>
          <button @click="closeOverlay" class="close-btn">✕</button>
        </div>
        
        <div v-if="selectedDay?.workout" class="workout-details">
          <div class="workout-type" :class="selectedDay.workout.type?.toLowerCase()">
            <span class="type-icon">
              {{ selectedDay.workout.type === 'push' ? '💪' : 
                  selectedDay.workout.type === 'pull' ? '🏋️' : '🦵' }}
            </span>
            <span class="type-name">{{ selectedDay.workout.type }} Training</span>
          </div>
          
          <div v-if="selectedDay.workout.exercises?.length" class="exercises-list">
            <h5>Übungen</h5>
            <div v-for="(exercise, idx) in selectedDay.workout.exercises" :key="idx" class="exercise-item">
              <span class="exercise-name">{{ getTranslatedExerciseName(exercise.name) }}</span>
              <span class="exercise-details">
                {{ exercise.weight }}kg × {{ exercise.reps }} × {{ exercise.sets }}
              </span>
            </div>
          </div>
          
          <div class="workout-meta">
            <span class="workout-duration">🕐 {{ formatDuration(selectedDay.workout.duration) }}</span>
            <span class="workout-date">📅 {{ formatTime(selectedDay.workout.date) }}</span>
          </div>
        </div>
        
        <div v-else class="no-workout">
          <span class="rest-icon">😴</span>
          <p>Ruhetag</p>
        </div>
      </div>
    </div>
    <div class="workout-legend">
      <div class="legend-item">
        <span class="legend-dot push"></span>
        <span>Push</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot pull"></span>
        <span>Pull</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot legs"></span>
        <span>Legs</span>
      </div>
    </div>
    
    <div class="chart-stats">
      <div class="stat-item">
        <span class="stat-label">Push:</span>
        <span class="stat-value push">{{ typeStats.push }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pull:</span>
        <span class="stat-value pull">{{ typeStats.pull }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Legs:</span>
        <span class="stat-value legs">{{ typeStats.legs }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const typeStats = ref({ push: 0, pull: 0, legs: 0 })
const viewMode = ref('week') // 'week' oder 'month'
const showOverlay = ref(false)
const selectedDay = ref(null)
const { getTranslatedExerciseName } = useExerciseTranslation()

function processWorkoutData(workouts) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
  
  // Filtere Workouts der letzten 30 Tage
  const recentWorkouts = workouts.filter(w => {
    const workoutDate = new Date(w.date)
    return workoutDate >= thirtyDaysAgo && workoutDate <= now
  })
  
  const stats = { push: 0, pull: 0, legs: 0 }
  
  recentWorkouts.forEach(workout => {
    const type = workout.type?.toLowerCase()
    if (stats[type] !== undefined) {
      stats[type]++
    }
  })
  
  typeStats.value = stats
  return recentWorkouts
}

function getChartData() {
  const workouts = processWorkoutData(props.workouts)
  
  if (viewMode.value === 'week') {
    return getWeeklyDays(workouts)
  } else {
    return getMonthlyData(workouts)
  }
}

function getWeeklyDays(workouts) {
  const days = []
  const now = new Date()
  
  // Finde Montag der aktuellen Woche
  const dayOfWeek = now.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Sonntag = 0, also 6 Tage zurück
  const monday = new Date(now - daysFromMonday * 24 * 60 * 60 * 1000)
  
  // 7 Tage ab Montag
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]
    
    // Finde Workout für diesen Tag
    const dayWorkout = workouts.find(w => {
      const workoutDateStr = new Date(w.date).toISOString().split('T')[0]
      return workoutDateStr === dateStr
    })
    
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    
    let dayStats = { push: 0, pull: 0, legs: 0 }
    if (dayWorkout) {
      const type = dayWorkout.type?.toLowerCase()
      if (dayStats[type] !== undefined) {
        dayStats[type] = 1
      }
    }
    
    days.push({
      label: dayNames[i],
      fullDate: `${dayNames[i]}, ${date.getDate()}.${date.getMonth() + 1}`,
      date: date,
      workout: dayWorkout,
      ...dayStats
    })
  }
  
  return days
}

function getMonthlyData(workouts) {
  const months = []
  const now = new Date()
  
  // Letzte 6 Monate
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    
    const monthWorkouts = workouts.filter(w => {
      const workoutDate = new Date(w.date)
      return workoutDate >= monthDate && workoutDate <= monthEnd
    })
    
    const monthStats = { push: 0, pull: 0, legs: 0 }
    monthWorkouts.forEach(workout => {
      const type = workout.type?.toLowerCase()
      if (monthStats[type] !== undefined) {
        monthStats[type]++
      }
    })
    
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
    
    months.push({
      label: monthNames[monthDate.getMonth()],
      ...monthStats
    })
  }
  
  return months
}

function getMaxValue() {
  const data = getChartData()
  let max = 0
  
  data.forEach(period => {
    const total = Math.max(period.push, period.pull, period.legs)
    if (total > max) max = total
  })
  
  return Math.max(max, 1) // Mindestens 1 für Skalierung
}

function getBarTooltip(period, type) {
  if (viewMode.value === 'week') {
    return period.workout ? 
      `${period.workout.type} Training` : 
      'Kein Training'
  } else {
    return `${type}: ${period[type]} Workouts`
  }
}

function showDayOverlay(day) {
  selectedDay.value = day
  showOverlay.value = true
}

function closeOverlay() {
  showOverlay.value = false
  selectedDay.value = null
}

function formatDuration(duration) {
  if (!duration) return 'Unbekannt'
  const minutes = Math.round(duration)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours > 0) {
    return `${hours}h ${mins}min`
  }
  return `${mins}min`
}

function formatTime(date) {
  if (!date) return ''
  const workoutDate = new Date(date)
  return workoutDate.toLocaleTimeString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

watch(() => props.workouts, () => {
  // Trigger re-computation
  typeStats.value = { ...typeStats.value }
}, { deep: true })

onMounted(() => {
  processWorkoutData(props.workouts)
})
</script>

<style scoped>
.chart-container { 
  background: transparent; 
  border-radius: 12px; 
  padding: 16px; 
  margin-bottom: 20px; 
  border: 1px solid transparent; 
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h3 { 
  margin: 0; 
  color: var(--fg); 
  font-size: 1.1rem; 
  font-weight: 600; 
}

.view-controls {
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 2px;
}

.view-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  color: var(--fg);
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
}

.view-btn.active {
  background: var(--accent-color);
  color: white;
}

.bar-chart-wrapper {
  background: linear-gradient(135deg, 
    var(--surface) 0%, 
    color-mix(in srgb, var(--surface) 97%, var(--accent-color)) 100%);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--card-border);
  margin-bottom: 16px;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 120px;
  gap: 8px;
  padding: 0 8px;
}

.bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: none; /* Breitere Balken für Wochenansicht */
}

.period-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;  /* Etwas mehr Abstand zwischen den Balken */
  height: 80px;
  width: 100%;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 6px;  /* Mehr Padding für breitere Touch-Targets */
}

.period-bars:hover {
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
}

.workout-bar {
  border-radius: 4px 4px 0 0;
  transition: all 0.6s ease-out;
  position: relative;
}

/* Wochenansicht: Breitere Balken */
.view-btn.active:first-child ~ * .workout-bar {
  width: 16px;  /* Breiter: 16px statt 12px */
  min-height: 8px;
}

/* Monatsansicht: Schmalere Balken */
.view-btn.active:last-child ~ * .workout-bar {
  width: 8px;
  min-height: 4px;
}

.workout-bar.clickable {
  cursor: pointer;
}

.workout-bar.clickable:hover {
  transform: scale(1.1);
  filter: brightness(1.2);
}

.workout-bar.push {
  background: linear-gradient(180deg, #ff6b6b, #ff4d4d);
  box-shadow: 0 2px 8px color-mix(in srgb, #ff4d4d 30%, transparent);
}

.workout-bar.pull {
  background: linear-gradient(180deg, #74c0fc, #4dabf7);
  box-shadow: 0 2px 8px color-mix(in srgb, #4dabf7 30%, transparent);
}

.workout-bar.legs {
  background: linear-gradient(180deg, #8ce99a, #51cf66);
  box-shadow: 0 2px 8px color-mix(in srgb, #51cf66 30%, transparent);
}

.period-label {
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 500;
  text-align: center;
}

/* Workout Overlay */
.workout-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, black 70%, transparent);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { 
    opacity: 0;
    backdrop-filter: blur(0px);
  }
  to { 
    opacity: 1;
    backdrop-filter: blur(12px);
  }
}

.overlay-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 70vh;
  overflow-y: auto;
  animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 20px 40px color-mix(in srgb, black 30%, transparent);
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(30px) scale(0.9);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--card-border);
}

.overlay-header h4 {
  margin: 0;
  color: var(--fg);
  font-size: 1.2rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: color-mix(in srgb, var(--muted) 15%, transparent);
  color: var(--fg);
}

.workout-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workout-type {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.1rem;
}

.workout-type.push {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #ff4d4d 15%, var(--surface)),
    color-mix(in srgb, #ff4d4d 8%, var(--surface)));
  color: #ff4d4d;
  border: 1px solid color-mix(in srgb, #ff4d4d 25%, transparent);
}

.workout-type.pull {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #4dabf7 15%, var(--surface)),
    color-mix(in srgb, #4dabf7 8%, var(--surface)));
  color: #4dabf7;
  border: 1px solid color-mix(in srgb, #4dabf7 25%, transparent);
}

.workout-type.legs {
  background: linear-gradient(135deg, 
    color-mix(in srgb, #51cf66 15%, var(--surface)),
    color-mix(in srgb, #51cf66 8%, var(--surface)));
  color: #51cf66;
  border: 1px solid color-mix(in srgb, #51cf66 25%, transparent);
}

.type-icon {
  font-size: 1.5rem;
}

.exercises-list h5 {
  margin: 0 0 12px 0;
  color: var(--fg);
  font-size: 1rem;
  font-weight: 600;
}

.exercise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--muted) 5%, var(--surface));
  border-radius: 8px;
  margin-bottom: 8px;
}

.exercise-name {
  font-weight: 500;
  color: var(--fg);
}

.exercise-details {
  font-size: 0.9rem;
  color: var(--muted);
  font-weight: 500;
}

.workout-meta {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-top: 1px solid var(--card-border);
  font-size: 0.9rem;
  color: var(--muted);
}

.no-workout {
  text-align: center;
  padding: 20px;
  color: var(--muted);
}

.rest-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
}

.no-workout p {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
}

.workout-legend { 
  display: flex; 
  justify-content: center; 
  gap: 20px; 
  margin-bottom: 16px; 
  padding-bottom: 12px; 
  border-bottom: 1px solid var(--card-border); 
}

.legend-item { 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  font-size: 0.9rem; 
  color: var(--fg); 
}

.legend-dot { 
  width: 12px; 
  height: 12px; 
  border-radius: 50%; 
  border: 2px solid var(--surface); 
}

.legend-dot.push {
  background: linear-gradient(135deg, #ff4d4d, #ff6b6b);
}

.legend-dot.pull {
  background: linear-gradient(135deg, #4dabf7, #74c0fc);
}

.legend-dot.legs {
  background: linear-gradient(135deg, #51cf66, #8ce99a);
}

.chart-stats {
  display: flex;
  gap: 20px;
  justify-content: space-around;
  padding-top: 12px;
  border-top: 1px solid var(--card-border);
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  color: var(--muted);
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  color: var(--fg);
  font-size: 1.2rem;
  font-weight: 600;
}

.stat-value.push {
  color: #ff4d4d;
}

.stat-value.pull {
  color: #4dabf7;
}

.stat-value.legs {
  color: #51cf66;
}

@media (max-width: 480px) {
  .chart-container {
    padding: 12px;
  }
  
  .chart-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .view-controls {
    align-self: stretch;
  }
  
  .view-btn {
    flex: 1;
    text-align: center;
  }
  
  .bar-chart-wrapper {
    padding: 16px;
  }
  
  .chart-bars {
    height: 100px;
    gap: 6px;
    padding: 0 4px;
  }
  
  .period-bars {
    height: 70px;
    gap: 1px;
  }
  
  .workout-bar {
    width: 6px;
  }
  
  .period-label {
    font-size: 0.75rem;
  }
  
  .workout-legend {
    gap: 16px;
  }
  
  .legend-item {
    font-size: 0.85rem;
  }
  
  .legend-dot {
    width: 10px;
    height: 10px;
  }
  
  .chart-stats {
    gap: 16px;
  }
  
  .stat-label {
    font-size: 0.8rem;
  }
  
  .stat-value {
    font-size: 1.1rem;
  }
}
</style>