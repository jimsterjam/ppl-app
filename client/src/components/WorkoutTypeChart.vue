<template>
  <div class="chart-container">
    <h3>Training Verlauf (30 Tage)</h3>
    <div class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
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
        <span class="stat-value">{{ typeStats.push }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pull:</span>
        <span class="stat-value">{{ typeStats.pull }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Legs:</span>
        <span class="stat-value">{{ typeStats.legs }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const chartCanvas = ref(null)
const typeStats = ref({ push: 0, pull: 0, legs: 0 })
let chartInstance = null

// Farben für die verschiedenen Trainingsarten
const typeColors = {
  push: '#ff4d4d',  // Rot
  pull: '#4dabf7',  // Blau
  legs: '#51cf66'   // Grün
}

function processWorkoutData(workouts) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
  
  // Filtere Workouts der letzten 30 Tage
  const recentWorkouts = workouts.filter(w => {
    const workoutDate = new Date(w.date)
    return workoutDate >= thirtyDaysAgo && workoutDate <= now
  })
  
  // Erstelle 30-Tage Array
  const dailyData = []
  const labels = []
  const stats = { push: 0, pull: 0, legs: 0 }
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]
    
    // Mobile: Kurze Labels (nur Tag)
    const label = date.getDate().toString()
    labels.push(label)
    
    // Finde Workout für diesen Tag
    const dayWorkout = recentWorkouts.find(w => {
      const workoutDateStr = new Date(w.date).toISOString().split('T')[0]
      return workoutDateStr === dateStr
    })
    
    if (dayWorkout) {
      const type = dayWorkout.type?.toLowerCase() || 'none'
      dailyData.push({ type, value: 1, date })
      if (stats[type] !== undefined) {
        stats[type]++
      }
    } else {
      dailyData.push({ type: 'none', value: 0, date })
    }
  }
  
  typeStats.value = stats
  
  return { labels, dailyData }
}

function createChart() {
  if (!chartCanvas.value) return
  
  const { labels, dailyData } = processWorkoutData(props.workouts)
  
  const ctx = chartCanvas.value.getContext('2d')
  
  if (chartInstance) {
    chartInstance.destroy()
  }
  
  // Bereite Daten für Chart vor
  const chartData = dailyData.map(day => {
    if (day.type === 'push') return 3
    if (day.type === 'pull') return 2
    if (day.type === 'legs') return 1
    return 0 // Kein Training
  })
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Training',
        data: chartData,
        borderColor: '#666',
        backgroundColor: 'transparent',
        tension: 0,
        fill: false,
        pointBackgroundColor: dailyData.map(day => {
          if (day.type === 'push') return typeColors.push
          if (day.type === 'pull') return typeColors.pull
          if (day.type === 'legs') return typeColors.legs
          return 'transparent'
        }),
        pointBorderColor: dailyData.map(day => {
          if (day.type !== 'none') return '#fff'
          return 'transparent'
        }),
        pointBorderWidth: 2,
        pointRadius: dailyData.map(day => day.type !== 'none' ? 8 : 0),
        pointHoverRadius: dailyData.map(day => day.type !== 'none' ? 10 : 0)
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
          borderColor: '#666',
          borderWidth: 1,
          filter: function(tooltipItem) {
            return tooltipItem.parsed.y > 0
          },
          callbacks: {
            title: function(context) {
              const dayIndex = context[0].dataIndex
              const day = dailyData[dayIndex]
              return `${day.date.getDate()}.${(day.date.getMonth() + 1).toString().padStart(2, '0')}`
            },
            label: function(context) {
              const dayIndex = context.dataIndex
              const day = dailyData[dayIndex]
              if (day.type === 'push') return 'Push Training'
              if (day.type === 'pull') return 'Pull Training'
              if (day.type === 'legs') return 'Legs Training'
              return ''
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
            maxTicksLimit: 10,
            font: {
              size: 12
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 4,
          grid: {
            display: false
          },
          ticks: {
            display: false,
            stepSize: 1
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'point'
      },
      elements: {
        point: {
          hoverRadius: 12
        }
      }
    }
  })
}

watch(() => props.workouts, () => {
  createChart()
}, { deep: true })

onMounted(() => {
  createChart()
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

.chart-wrapper {
  position: relative;
  height: 120px;
  margin-bottom: 16px;
}

.workout-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: #fff;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
}

.legend-dot.push {
  background-color: #ff4d4d;
}

.legend-dot.pull {
  background-color: #4dabf7;
}

.legend-dot.legs {
  background-color: #51cf66;
}

.chart-stats {
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
  color: #fff;
  font-size: 1.2rem;
  font-weight: 600;
}

@media (max-width: 480px) {
  .chart-container {
    padding: 12px;
  }
  
  .chart-wrapper {
    height: 100px;
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