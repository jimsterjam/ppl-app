<template>
  <div class="chart-container">
    <h3>Gewichtsprogression</h3>
    <div v-if="availableExercises.length > 0" class="exercise-selector">
      <select v-model="selectedExercise" @change="updateChart">
        <option value="">Übung wählen...</option>
        <option v-for="exercise in availableExercises" :key="exercise" :value="exercise">
          {{ exercise }}
        </option>
      </select>
    </div>
    <div v-if="selectedExercise" class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-else-if="availableExercises.length > 0" class="no-selection">
      <p>Wähle eine Übung um den Fortschritt zu sehen</p>
    </div>
    <div v-else class="no-data">
      <p>Noch keine Workout-Daten für Fortschritt verfügbar</p>
    </div>
    <div v-if="selectedExercise && progressStats" class="progress-stats">
      <div class="stat-item">
        <span class="stat-label">Steigerung:</span>
        <span class="stat-value" :class="{ positive: progressStats.improvement > 0, negative: progressStats.improvement < 0 }">
          {{ progressStats.improvement > 0 ? '+' : '' }}{{ progressStats.improvement.toFixed(1) }}kg
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Max Gewicht:</span>
        <span class="stat-value">{{ progressStats.maxWeight }}kg</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const chartCanvas = ref(null)
const selectedExercise = ref('')
const progressStats = ref(null)
let chartInstance = null

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
          exerciseData.push({
            date: workoutDate,
            weight: parseFloat(ex.weight),
            reps: ex.reps || 0,
            sets: ex.sets || 0
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
  
  // Gruppiere nach Wochen für bessere Übersicht
  const weeklyData = []
  let currentWeek = null
  let currentWeekData = []
  
  exerciseData.forEach(entry => {
    const weekStart = new Date(entry.date)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week
    const weekKey = weekStart.toISOString().split('T')[0]
    
    if (currentWeek !== weekKey) {
      if (currentWeekData.length > 0) {
        // Nehme das beste Gewicht der Woche
        const maxWeight = Math.max(...currentWeekData.map(d => d.weight))
        weeklyData.push({
          date: new Date(currentWeek),
          weight: maxWeight
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
    weeklyData.push({
      date: new Date(currentWeek),
      weight: maxWeight
    })
  }
  
  // Beschränke auf letzte 12 Wochen für mobile Ansicht
  const last12Weeks = weeklyData.slice(-12)
  
  const labels = last12Weeks.map(d => {
    const day = d.date.getDate()
    const month = d.date.getMonth() + 1
    return `${day}.${month}`
  })
  
  const data = last12Weeks.map(d => d.weight)
  
  // Berechne Statistiken
  const firstWeight = last12Weeks[0]?.weight || 0
  const lastWeight = last12Weeks[last12Weeks.length - 1]?.weight || 0
  const maxWeight = Math.max(...data)
  const improvement = lastWeight - firstWeight
  
  const stats = {
    improvement,
    maxWeight,
    totalSessions: exerciseData.length
  }
  
  return { labels, data, stats }
}

function updateChart() {
  if (!chartCanvas.value || !selectedExercise.value) return
  
  const { labels, data, stats } = processProgressData(selectedExercise.value)
  progressStats.value = stats
  
  if (data.length === 0) return
  
  const ctx = chartCanvas.value.getContext('2d')
  
  if (chartInstance) {
    chartInstance.destroy()
  }
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Gewicht (kg)',
        data,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#4ade80',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#4ade80',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return `${context.parsed.y}kg`
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            display: false
          },
          ticks: {
            color: '#999',
            maxTicksLimit: 8,
            font: {
              size: 12
            }
          }
        },
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#999',
            font: {
              size: 12
            },
            callback: function(value) {
              return value + 'kg'
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  })
}

watch(() => props.workouts, () => {
  if (selectedExercise.value) {
    updateChart()
  }
}, { deep: true })

watch(() => availableExercises.value, (newExercises) => {
  // Auto-select erste Übung wenn noch keine gewählt
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

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
.chart-container {
  background: #1c1c1e;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.chart-container h3 {
  margin: 0 0 16px 0;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
}

.exercise-selector {
  margin-bottom: 16px;
}

.exercise-selector select {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #333;
  background: #2a2a2d;
  color: #fff;
  font-size: 1rem;
}

.exercise-selector select:focus {
  outline: none;
  border-color: #4ade80;
}

.chart-wrapper {
  position: relative;
  height: 220px;
  margin-bottom: 16px;
}

.no-selection,
.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.progress-stats {
  display: flex;
  gap: 20px;
  justify-content: space-around;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  color: #999;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 1.2rem;
  font-weight: 600;
}

.stat-value.positive {
  color: #4ade80;
}

.stat-value.negative {
  color: #f87171;
}

.stat-value:not(.positive):not(.negative) {
  color: #fbbf24;
}

@media (max-width: 480px) {
  .chart-container {
    padding: 12px;
  }
  
  .chart-wrapper {
    height: 200px;
  }
  
  .progress-stats {
    gap: 16px;
  }
  
  .stat-label {
    font-size: 0.8rem;
  }
  
  .stat-value {
    font-size: 1.1rem;
  }
  
  .exercise-selector select {
    padding: 10px;
    font-size: 0.95rem;
  }
}
</style>