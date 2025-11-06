<template>
  <div class="chart-container glass">
    <h3>{{ t('charts.progressTitle') }}</h3>
    
    <!-- Controls -->
    <div v-if="availableExercises.length > 0" class="controls">
      <div class="exercise-selector">
        <select v-model="selectedExercise" @change="updateChart">
          <option value="">{{ t('charts.selectExercise') }}</option>
          <option v-for="exercise in availableExercises" :key="exercise" :value="exercise">
            {{ exercise }}
          </option>
        </select>
      </div>
      <div class="time-range-selector">
        <select v-model="selectedTimeRange" @change="updateChart">
          <option value="4weeks">{{ t('charts.last4Weeks') || 'Letzte 4 Wochen' }}</option>
          <option value="3months">{{ t('charts.last3Months') || 'Letzte 3 Monate' }}</option>
          <option value="all">{{ t('charts.allTime') || 'Gesamtverlauf' }}</option>
        </select>
      </div>
    </div>

    <!-- Stylish Chart -->
    <div v-if="selectedExercise && progressStats" class="chart-wrapper">
      <!-- Chart Header -->
      <div class="chart-header">
        <div class="chart-title">
          <span>📈 {{ selectedExercise }}</span>
        </div>
        <div class="chart-value">
          {{ progressStats.currentWeight }}kg
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div class="chart-progress-bar">
        <div class="progress-fill" :style="{ width: getProgressPercentage() + '%' }"></div>
      </div>
      
      <!-- Progress Markers -->
      <div class="progress-markers">
        <div v-for="marker in getProgressMarkers()" :key="marker.label" class="progress-marker">
          <div class="marker-dot" :class="{ active: marker.active }"></div>
          <span class="marker-label" :class="{ active: marker.active }">{{ marker.label }}</span>
        </div>
      </div>
      
      <!-- Chart Content -->
      <div class="chart-content">
        <!-- Grid Background -->
        <div class="chart-grid">
          <div v-for="i in 4" :key="'h-' + i" class="grid-line horizontal" :style="{ top: (i * 25) + '%' }"></div>
          <div v-for="i in 5" :key="'v-' + i" class="grid-line vertical" :style="{ left: (i * 20) + '%' }"></div>
        </div>
        
        <!-- Chart Points -->
        <div class="chart-points">
          <template v-for="(point, idx) in getChartPoints()" :key="idx">
            <!-- Connection Lines -->
            <div v-if="idx > 0" class="chart-line" :style="getLineStyle(idx)"></div>
            
            <!-- Data Points -->
            <div 
              class="chart-point" 
              :class="{ 
                peak: point.isPeak, 
                current: idx === getChartPoints().length - 1 
              }"
              :style="{ 
                left: point.x + '%', 
                bottom: point.y + '%',
                borderColor: point.color 
              }"
              :title="`${point.date}: ${point.weight}kg`">
            </div>
          </template>
        </div>
      </div>
      
      <!-- Achievement Badges -->
      <div v-if="getAchievements().length > 0" class="achievement-badges">
        <div v-for="achievement in getAchievements()" :key="achievement.type" class="achievement-badge">
          <span class="achievement-icon">{{ achievement.icon }}</span>
          <span>{{ achievement.text }}</span>
        </div>
      </div>
    </div>

    <!-- Empty States -->
    <div v-else-if="selectedExercise && !progressStats" class="empty-chart">
      <div class="empty-icon">📊</div>
      <p>Keine Daten für diese Übung verfügbar</p>
    </div>
    
    <div v-else-if="availableExercises.length > 0" class="no-selection">
      <p>{{ t('charts.pickToSee') }}</p>
    </div>
    
    <div v-else class="no-data">
      <p>{{ t('charts.noData') }}</p>
    </div>

    <!-- Stats Section -->
    <div v-if="selectedExercise && progressStats" class="progress-stats">
      <!-- Primary Stats -->
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-label">{{ t('charts.improvement') }}</span>
          <span class="stat-value" :class="{ positive: progressStats.improvement > 0, negative: progressStats.improvement < 0 }">
            {{ progressStats.improvement > 0 ? '+' : '' }}{{ progressStats.improvement.toFixed(1) }}kg
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ t('charts.maxWeight') }}</span>
          <span class="stat-value">{{ progressStats.maxWeight }}kg</span>
        </div>
      </div>
      
      <!-- Extended Stats -->
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-label">{{ t('charts.totalVolume') || 'Gesamtvolumen' }}</span>
          <span class="stat-value">{{ progressStats.totalVolume }}kg</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ t('charts.avgVolume') || 'Ø Volume' }}</span>
          <span class="stat-value">{{ progressStats.avgVolume }}kg</span>
        </div>
      </div>
      
      <!-- Insights -->
      <div v-if="progressStats.insights.length > 0" class="insights">
        <div v-for="(insight, idx) in progressStats.insights" :key="idx" class="insight-item" :class="insight.type">
          <span class="insight-icon">{{ insight.icon }}</span>
          <span class="insight-text">{{ insight.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const selectedExercise = ref('')
const selectedTimeRange = ref('3months')
const progressStats = ref(null)
const { t } = useI18n()

const availableExercises = computed(() => {
  const exercises = new Set()
  props.workouts.forEach(workout => {
    if (Array.isArray(workout.exercises)) {
      workout.exercises.forEach(ex => {
        if (ex.name && ex.weight && ex.weight > 0) {
          exercises.add(ex.name)
        }
      })
    }
  })
  return Array.from(exercises).sort()
})

function processProgressData(exerciseName) {
  if (!exerciseName) return { labels: [], data: [], stats: null }
  
  // Sammle alle Daten für diese Übung
  const exerciseData = []
  
  props.workouts.forEach(workout => {
    const workoutDate = new Date(workout.date)
    if (Array.isArray(workout.exercises)) {
      workout.exercises.forEach(ex => {
        if (ex.name === exerciseName && ex.weight && ex.weight > 0) {
          const volume = parseFloat(ex.weight) * (ex.reps || 1) * (ex.sets || 1)
          exerciseData.push({
            date: workoutDate,
            weight: parseFloat(ex.weight),
            reps: ex.reps || 0,
            sets: ex.sets || 0,
            volume: volume
          })
        }
      })
    }
  })
  
  // Sortiere nach Datum
  exerciseData.sort((a, b) => a.date - b.date)
  
  if (exerciseData.length === 0) {
    return { labels: [], data: [], stats: null }
  }
  
  // Bestimme Zeitraum basierend auf Auswahl
  let filteredData = exerciseData
  const now = new Date()
  
  if (selectedTimeRange.value === '4weeks') {
    const fourWeeksAgo = new Date(now.getTime() - (4 * 7 * 24 * 60 * 60 * 1000))
    filteredData = exerciseData.filter(d => d.date >= fourWeeksAgo)
  } else if (selectedTimeRange.value === '3months') {
    const threeMonthsAgo = new Date(now.getTime() - (3 * 30 * 24 * 60 * 60 * 1000))
    filteredData = exerciseData.filter(d => d.date >= threeMonthsAgo)
  }
  
  // Gruppiere nach Wochen
  const weeklyData = []
  let currentWeek = null
  let currentWeekData = []
  
  filteredData.forEach(entry => {
    const weekStart = new Date(entry.date)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]
    
    if (currentWeek !== weekKey) {
      if (currentWeekData.length > 0) {
        const maxWeight = Math.max(...currentWeekData.map(d => d.weight))
        const avgVolume = currentWeekData.reduce((sum, d) => sum + d.volume, 0) / currentWeekData.length
        weeklyData.push({
          date: new Date(currentWeek),
          weight: maxWeight,
          volume: avgVolume
        })
      }
      currentWeek = weekKey
      currentWeekData = [entry]
    } else {
      currentWeekData.push(entry)
    }
  })
  
  // Letzte Woche hinzufügen
  if (currentWeekData.length > 0) {
    const maxWeight = Math.max(...currentWeekData.map(d => d.weight))
    const avgVolume = currentWeekData.reduce((sum, d) => sum + d.volume, 0) / currentWeekData.length
    weeklyData.push({
      date: new Date(currentWeek),
      weight: maxWeight,
      volume: avgVolume
    })
  }
  
  const maxPoints = selectedTimeRange.value === '4weeks' ? 4 : 
                   selectedTimeRange.value === '3months' ? 12 : 20
  const displayData = weeklyData.slice(-maxPoints)
  
  const labels = displayData.map(d => {
    const day = d.date.getDate()
    const month = d.date.getMonth() + 1
    return `${day}.${month}`
  })
  
  const data = displayData.map(d => d.weight)
  
  // Statistiken berechnen
  const firstWeight = displayData[0]?.weight || 0
  const lastWeight = displayData[displayData.length - 1]?.weight || 0
  const maxWeight = Math.max(...data)
  const improvement = lastWeight - firstWeight
  
  const totalVolume = Math.round(exerciseData.reduce((sum, d) => sum + d.volume, 0))
  const avgVolume = Math.round(totalVolume / exerciseData.length)
  
  const insights = generateInsights(exerciseData, displayData, improvement)
  
  const stats = {
    improvement,
    maxWeight,
    startWeight: firstWeight,
    currentWeight: lastWeight,
    totalSessions: exerciseData.length,
    totalVolume,
    avgVolume,
    insights
  }
  
  return { labels, data, stats }
}

function generateInsights(allData, displayData, improvement) {
  const insights = []
  
  if (improvement > 5) {
    insights.push({
      type: 'positive',
      icon: '🚀',
      text: `Starke Steigerung von ${improvement.toFixed(1)}kg!`
    })
  } else if (improvement < -2) {
    insights.push({
      type: 'negative', 
      icon: '📉',
      text: 'Gewicht ist gesunken - Form überprüfen?'
    })
  } else if (Math.abs(improvement) < 1) {
    insights.push({
      type: 'neutral',
      icon: '⚡',
      text: 'Zeit für neue Trainingsreize!'
    })
  }
  
  const daysBetweenSessions = []
  for (let i = 1; i < allData.length; i++) {
    const diff = (allData[i].date - allData[i-1].date) / (1000 * 60 * 60 * 24)
    daysBetweenSessions.push(diff)
  }
  
  if (daysBetweenSessions.length > 0) {
    const avgDays = daysBetweenSessions.reduce((a, b) => a + b, 0) / daysBetweenSessions.length
    if (avgDays <= 4) {
      insights.push({
        type: 'positive',
        icon: '🔥',
        text: 'Super Trainingsfrequenz!'
      })
    } else if (avgDays > 10) {
      insights.push({
        type: 'warning',
        icon: '⏰',
        text: 'Mehr Regelmäßigkeit könnte helfen'
      })
    }
  }
  
  return insights.slice(0, 2)
}

function getProgressPercentage() {
  if (!progressStats.value) return 0
  const { startWeight, currentWeight, maxWeight } = progressStats.value
  if (startWeight === currentWeight) return 0
  const progress = ((currentWeight - startWeight) / (maxWeight - startWeight)) * 100
  return Math.min(Math.max(progress, 0), 100)
}

function getProgressMarkers() {
  if (!progressStats.value) return []
  const { startWeight, currentWeight, maxWeight } = progressStats.value
  const range = maxWeight - startWeight
  
  return [
    {
      position: 0,
      label: 'Start',
      active: false
    },
    {
      position: ((currentWeight - startWeight) / range) * 100,
      label: 'Aktuell',
      active: true
    },
    {
      position: 100,
      label: 'Rekord',
      active: currentWeight >= maxWeight
    }
  ]
}

function getChartPoints() {
  if (!selectedExercise.value) return []
  
  const { labels, data } = processProgressData(selectedExercise.value)
  if (!data.length) return []
  
  const minWeight = Math.min(...data)
  const maxWeight = Math.max(...data)
  const range = maxWeight - minWeight || 1
  
  return data.map((weight, idx) => {
    const x = (idx / (data.length - 1)) * 100
    const y = ((weight - minWeight) / range) * 60 + 10
    
    return {
      x,
      y,
      weight,
      date: labels[idx],
      isPeak: weight === maxWeight,
      color: weight === maxWeight ? 'var(--success-color)' : 
             idx === data.length - 1 ? 'var(--accent-color)' : 
             'var(--muted)'
    }
  })
}

function getLineStyle(idx) {
  const points = getChartPoints()
  if (idx === 0) return {}
  
  const prev = points[idx - 1]
  const curr = points[idx]
  
  const dx = curr.x - prev.x
  const dy = curr.y - prev.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  
  return {
    width: length + '%',
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 50%',
    left: `-${length}%`,
    bottom: `${dy > 0 ? 0 : Math.abs(dy)}%`
  }
}

function getAchievements() {
  if (!progressStats.value) return []
  
  const achievements = []
  const { improvement, totalSessions } = progressStats.value
  
  if (improvement > 10) {
    achievements.push({
      type: 'major-gain',
      icon: '🚀',
      text: `+${improvement.toFixed(1)}kg Steigerung!`
    })
  }
  
  if (totalSessions >= 10) {
    achievements.push({
      type: 'consistency',
      icon: '🔥',
      text: `${totalSessions} Sessions absolviert`
    })
  }
  
  if (improvement > 20) {
    achievements.push({
      type: 'beast-mode',
      icon: '💪',
      text: 'Beast Mode aktiviert!'
    })
  }
  
  return achievements.slice(0, 2)
}

function updateChart() {
  if (!selectedExercise.value) return
  
  const { stats } = processProgressData(selectedExercise.value)
  progressStats.value = stats
}

watch(() => props.workouts, () => {
  if (selectedExercise.value) {
    updateChart()
  }
}, { deep: true })

watch(() => availableExercises.value, (newExercises) => {
  if (newExercises.length > 0 && !selectedExercise.value) {
    selectedExercise.value = newExercises[0]
    updateChart()
  }
})

onMounted(() => {
  if (availableExercises.value.length > 0) {
    selectedExercise.value = availableExercises.value[0]
    updateChart()
  }
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

.chart-container h3 {
  margin: 0 0 16px 0; 
  color: var(--fg); 
  font-size: 1.1rem; 
  font-weight: 600;
}

.controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.exercise-selector,
.time-range-selector {
  flex: 1;
}

.exercise-selector select,
.time-range-selector select { 
  width: 100%; 
  padding: 10px 8px; 
  border-radius: 8px; 
  border: 1px solid var(--card-border); 
  background: var(--surface); 
  color: var(--fg); 
  font-size: 0.9rem; 
}

.exercise-selector select:focus,
.time-range-selector select:focus { 
  outline: none; 
  border-color: var(--success-color); 
}

.chart-wrapper {
  height: 300px;
  margin: 20px 0;
  background: linear-gradient(135deg, 
    var(--surface) 0%, 
    color-mix(in srgb, var(--surface) 95%, var(--accent-color)) 100%);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--card-border);
  position: relative;
  overflow: hidden;
}

.chart-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 80% 20%, 
    color-mix(in srgb, var(--accent-color) 10%, transparent) 0%,
    transparent 50%);
  pointer-events: none;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

.chart-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg);
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-color);
}

.chart-progress-bar {
  height: 6px;
  background: color-mix(in srgb, var(--muted) 20%, transparent);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 20px;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--success-color));
  border-radius: 3px;
  transition: width 1s ease-out;
  position: relative;
}

.progress-markers {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  font-size: 0.8rem;
}

.progress-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
}

.marker-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  transition: all 0.3s ease;
}

.marker-dot.active {
  background: var(--accent-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent-color) 50%, transparent);
}

.marker-label {
  color: var(--muted);
  font-weight: 500;
}

.marker-label.active {
  color: var(--accent-color);
}

.chart-content {
  position: relative;
  height: 150px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border-radius: 12px;
  margin: 20px 0;
  overflow: hidden;
}

.chart-grid {
  position: absolute;
  inset: 0;
  opacity: 0.1;
}

.grid-line {
  position: absolute;
  background: var(--fg);
}

.grid-line.horizontal {
  height: 1px;
  width: 100%;
}

.grid-line.vertical {
  width: 1px;
  height: 100%;
}

.chart-points {
  position: relative;
  height: 100%;
  width: 100%;
}

.chart-point {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
  background: var(--surface);
  transition: all 0.3s ease;
  cursor: pointer;
  z-index: 3;
}

.chart-point:hover {
  transform: scale(1.2);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-color) 30%, transparent);
}

.chart-point.peak {
  background: var(--success-color);
  border-color: var(--success-color);
  box-shadow: 0 0 15px color-mix(in srgb, var(--success-color) 40%, transparent);
}

.chart-point.current {
  background: var(--accent-color);
  border-color: var(--accent-color);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 8px color-mix(in srgb, var(--accent-color) 30%, transparent); }
  50% { box-shadow: 0 0 20px color-mix(in srgb, var(--accent-color) 60%, transparent); }
}

.chart-line {
  position: absolute;
  height: 2px;
  background: linear-gradient(90deg, 
    color-mix(in srgb, var(--accent-color) 60%, transparent),
    var(--accent-color));
  z-index: 2;
  top: 50%;
  transform-origin: 0 50%;
}

.achievement-badges {
  display: flex;
  gap: 12px;
  margin-top: 15px;
  flex-wrap: wrap;
}

.achievement-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, var(--success-color) 10%, var(--surface)),
    color-mix(in srgb, var(--success-color) 5%, var(--surface)));
  border: 1px solid color-mix(in srgb, var(--success-color) 20%, transparent);
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--success-color);
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.achievement-icon {
  font-size: 1rem;
}

.empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--muted);
  text-align: center;
  gap: 12px;
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.no-selection,
.no-data { 
  text-align: center; 
  padding: 40px 20px; 
  color: var(--muted); 
}

.progress-stats { 
  padding-top: 16px; 
  border-top: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex; 
  gap: 16px; 
  justify-content: space-around;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-label { 
  display: block; 
  color: var(--muted); 
  font-size: 0.8rem; 
  margin-bottom: 4px; 
}

.stat-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
}

.stat-value.positive { color: var(--success-color); }
.stat-value.negative { color: #f87171; }
.stat-value:not(.positive):not(.negative) { color: #fbbf24; }

.insights {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.insight-item.positive {
  background: color-mix(in oklab, var(--success-color) 10%, transparent);
  color: var(--success-color);
}

.insight-item.negative {
  background: color-mix(in oklab, #f87171 10%, transparent);
  color: #f87171;
}

.insight-item.warning {
  background: color-mix(in oklab, #fbbf24 10%, transparent);
  color: #fbbf24;
}

.insight-item.neutral {
  background: color-mix(in oklab, var(--muted) 10%, transparent);
  color: var(--muted);
}

.insight-icon {
  font-size: 1rem;
}

.insight-text {
  font-weight: 500;
}

@media (max-width: 768px) {
  .chart-wrapper {
    margin: 15px 0;
    padding: 15px;
    height: 280px;
  }
  
  .chart-content {
    height: 120px;
  }
  
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .achievement-badges {
    justify-content: center;
  }
  
  .achievement-badge {
    font-size: 0.8rem;
    padding: 5px 10px;
  }
}

@media (max-width: 480px) {
  .chart-container {
    padding: 12px;
  }
  
  .controls {
    flex-direction: column;
    gap: 8px;
  }
  
  .exercise-selector select,
  .time-range-selector select {
    padding: 10px;
    font-size: 0.9rem;
  }
  
  .stat-row {
    gap: 12px;
  }
  
  .stat-label {
    font-size: 0.75rem;
  }
  
  .stat-value {
    font-size: 1rem;
  }
  
  .insight-item {
    padding: 6px 10px;
    font-size: 0.8rem;
  }
}
</style>