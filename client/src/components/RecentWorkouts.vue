<template>
  <div class="recent-workouts">
    <div class="header">
      <h3>Letzte Workouts</h3>
      <router-link to="/stats" class="view-all">Alle anzeigen</router-link>
    </div>
    
    <div v-if="recentWorkouts.length === 0" class="empty-state">
      <div class="empty-icon">💪</div>
      <p>Noch keine Workouts vorhanden</p>
    </div>
    
    <div v-else class="workouts-list">
      <div 
        v-for="workout in recentWorkouts" 
        :key="workout._id"
        class="workout-item"
      >
        <div 
          class="workout-card"
          :class="{ 'expanded': expandedWorkout === workout._id }"
          @click="toggleWorkoutDetails(workout)"
        >
          <div class="workout-main">
            <div class="workout-info">
              <h4 class="workout-title">{{ getWorkoutTitle(workout) }}</h4>
              <p class="workout-meta">
                {{ formatDate(workout.date) }} • {{ formatDuration(workout.duration) }}
                <span v-if="workout.exercises?.length" class="exercise-count">
                  • {{ workout.exercises.length }} Übungen
                </span>
              </p>
            </div>
            
            <div class="workout-type">
              <span class="type-badge" :class="workout.type?.toLowerCase()">
                {{ getTypeIcon(workout.type) }}
              </span>
            </div>
          </div>
          
          <div class="workout-actions">
            <button 
              class="action-btn repeat"
              title="Workout wiederholen"
              @click.stop="repeatWorkout(workout)"
            >
              🔄
            </button>
            <button 
              class="action-btn view"
              title="Workout öffnen"
              @click.stop="viewWorkout(workout)"
            >
              👁️
            </button>
            <button 
              class="action-btn edit"
              title="Workout bearbeiten"
              @click.stop="editWorkout(workout)"
            >
              ✏️
            </button>
            <button 
              class="action-btn expand"
              :class="{ 'expanded': expandedWorkout === workout._id }"
              title="Details anzeigen"
            >
              {{ expandedWorkout === workout._id ? '▲' : '▼' }}
            </button>
          </div>
        </div>
        
        <!-- Expandable Details -->
        <div 
          v-if="expandedWorkout === workout._id" 
          class="workout-details"
        >
          <div v-if="workout.exercises?.length" class="exercises-list">
            <h5>Übungen:</h5>
            <div class="exercises-detailed">
              <div 
                v-for="exercise in workout.exercises.slice(0, 4)" 
                :key="exercise._id || exercise.name"
                class="exercise-detailed"
              >
                <div class="exercise-header">
                  <span class="exercise-name">{{ exercise.name }}</span>
                  <span class="exercise-summary">{{ getExerciseSummary(exercise) }}</span>
                </div>
                
                <!-- Sets Display -->
                <div class="sets-display">
                  <div v-if="exercise.setDetails?.length" class="sets-list">
                    <div 
                      v-for="(set, setIndex) in exercise.setDetails" 
                      :key="setIndex"
                      class="set-item"
                    >
                      <span class="set-number">{{ setIndex + 1 }}.</span>
                      <span class="set-details">
                        <span v-if="set.reps" class="reps">{{ set.reps }} Wdh</span>
                        <span v-if="set.weight" class="weight">{{ set.weight }}kg</span>
                        <span v-if="!set.reps && !set.weight" class="no-data">Keine Daten</span>
                      </span>
                    </div>
                  </div>
                  
                  <div v-else-if="!exercise.setDetails?.length && (exercise.sets || exercise.reps || exercise.weight)" class="sets-legacy">
                    <div class="legacy-info">
                      <span v-if="exercise.sets && exercise.sets > 1" class="legacy-sets">{{ exercise.sets }} Sätze</span>
                      <span v-else-if="exercise.sets === 1" class="legacy-sets">1 Satz</span>
                      <span v-if="exercise.reps" class="legacy-reps">{{ exercise.reps }} Wdh</span>
                      <span v-if="exercise.weight" class="legacy-weight">{{ exercise.weight }}kg</span>
                    </div>
                    <div class="legacy-note">
                      Älteres Format - Editiere das Workout für Details pro Satz
                    </div>
                  </div>
                  
                  <div v-else class="sets-placeholder">
                    Keine Set-Daten verfügbar
                  </div>
                </div>
              </div>
              
              <div v-if="workout.exercises.length > 4" class="more-exercises-detailed">
                <span class="more-text">+{{ workout.exercises.length - 4 }} weitere Übungen</span>
                <button 
                  class="show-all-btn"
                  @click.stop="showAllExercises = !showAllExercises"
                >
                  {{ showAllExercises ? 'Weniger' : 'Alle anzeigen' }}
                </button>
              </div>
              
              <!-- Show remaining exercises if expanded -->
              <div v-if="showAllExercises" class="additional-exercises">
                <div 
                  v-for="exercise in workout.exercises.slice(4)" 
                  :key="exercise._id || exercise.name"
                  class="exercise-detailed"
                >
                  <div class="exercise-header">
                    <span class="exercise-name">{{ exercise.name }}</span>
                    <span class="exercise-summary">{{ getExerciseSummary(exercise) }}</span>
                  </div>
                  
                  <div v-if="exercise.setDetails?.length" class="sets-list">
                    <div 
                      v-for="(set, setIndex) in exercise.setDetails" 
                      :key="setIndex"
                      class="set-item"
                    >
                      <span class="set-number">{{ setIndex + 1 }}.</span>
                      <span class="set-details">
                        <span v-if="set.reps" class="reps">{{ set.reps }} Wdh</span>
                        <span v-if="set.weight" class="weight">{{ set.weight }}kg</span>
                        <span v-if="!set.reps && !set.weight" class="no-data">Keine Daten</span>
                      </span>
                    </div>
                  </div>
                  
                  <div v-else-if="exercise.sets || exercise.reps || exercise.weight" class="sets-legacy">
                    <div class="legacy-info">
                      <span v-if="exercise.sets" class="legacy-sets">{{ exercise.sets }} Sätze</span>
                      <span v-if="exercise.reps" class="legacy-reps">{{ exercise.reps }} Wdh</span>
                      <span v-if="exercise.weight" class="legacy-weight">{{ exercise.weight }}kg</span>
                    </div>
                  </div>
                  
                  <div v-else class="sets-placeholder">
                    Keine Set-Daten verfügbar
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="workout.notes" class="workout-notes">
            <h5>Notizen:</h5>
            <p>{{ workout.notes }}</p>
          </div>
          
          <div class="workout-stats">
            <div class="stat-item">
              <span class="stat-label">Erstellt:</span>
              <span class="stat-value">{{ formatDateTime(workout.createdAt) }}</span>
            </div>
            <div v-if="workout.completed" class="stat-item">
              <span class="stat-label">Status:</span>
              <span class="stat-value completed">✅ Abgeschlossen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  }
})

const router = useRouter()
const expandedWorkout = ref(null)
const showAllExercises = ref(false)

// Die letzten 3 Workouts (keine Drafts)
const recentWorkouts = computed(() => {
  return props.workouts
    .filter(w => !w.isDraft)
    .sort((a, b) => new Date(b.date || b.updatedAt) - new Date(a.date || a.updatedAt))
    .slice(0, 3)
})

function getWorkoutTitle(workout) {
  if (workout.name) return workout.name
  
  const type = workout.type?.toLowerCase()
  switch (type) {
    case 'push': return 'Push Day'
    case 'pull': return 'Pull Day'
    case 'legs': return 'Leg Day'
    default: return 'Workout'
  }
}

function getTypeIcon(type) {
  const t = type?.toLowerCase()
  switch (t) {
    case 'push': return '💪'
    case 'pull': return '🎯'
    case 'legs': return '🦵'
    default: return '🏋️'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unbekannt'
  
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  
  // Setze Zeit auf 0 für Vergleich
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Heute'
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Gestern'
  } else {
    const diffTime = todayOnly - dateOnly
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 7) {
      return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit' 
      })
    }
  }
}

function formatDuration(duration) {
  if (!duration || duration === 0) return 'Dauer unbekannt'
  
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`
  } else {
    return `${minutes}min`
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'Unbekannt'
  
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-DE', { 
    day: '2-digit', 
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getExerciseSummary(exercise) {
  if (exercise.setDetails?.length) {
    const totalSets = exercise.setDetails.length
    const hasWeights = exercise.setDetails.some(set => set.weight)
    const hasReps = exercise.setDetails.some(set => set.reps)
    
    let summary = `${totalSets} Sätze`
    
    if (hasWeights && hasReps) {
      // Zeige Gewichts- und Rep-Range
      const weights = exercise.setDetails.filter(set => set.weight).map(set => parseFloat(set.weight))
      const reps = exercise.setDetails.filter(set => set.reps).map(set => parseInt(set.reps))
      
      if (weights.length > 0) {
        const minWeight = Math.min(...weights)
        const maxWeight = Math.max(...weights)
        if (minWeight === maxWeight) {
          summary += ` • ${minWeight}kg`
        } else {
          summary += ` • ${minWeight}-${maxWeight}kg`
        }
      }
      
      if (reps.length > 0) {
        const minReps = Math.min(...reps)
        const maxReps = Math.max(...reps)
        if (minReps === maxReps) {
          summary += ` • ${minReps} Wdh`
        } else {
          summary += ` • ${minReps}-${maxReps} Wdh`
        }
      }
    } else if (hasWeights) {
      const weights = exercise.setDetails.filter(set => set.weight).map(set => parseFloat(set.weight))
      const minWeight = Math.min(...weights)
      const maxWeight = Math.max(...weights)
      if (minWeight === maxWeight) {
        summary += ` • ${minWeight}kg`
      } else {
        summary += ` • ${minWeight}-${maxWeight}kg`
      }
    } else if (hasReps) {
      const reps = exercise.setDetails.filter(set => set.reps).map(set => parseInt(set.reps))
      const minReps = Math.min(...reps)
      const maxReps = Math.max(...reps)
      if (minReps === maxReps) {
        summary += ` • ${minReps} Wdh`
      } else {
        summary += ` • ${minReps}-${maxReps} Wdh`
      }
    }
    
    return summary
  } else if (exercise.sets || exercise.reps || exercise.weight) {
    // Legacy-Format: Nutze die alten Felder
    let summary = []
    
    if (exercise.sets) {
      summary.push(`${exercise.sets} Sätze`)
    }
    if (exercise.reps) {
      summary.push(`${exercise.reps} Wdh`)
    }
    if (exercise.weight) {
      summary.push(`${exercise.weight}kg`)
    }
    
    return summary.join(' • ')
  }
  return 'Keine Daten'
}

function toggleWorkoutDetails(workout) {
  if (expandedWorkout.value === workout._id) {
    expandedWorkout.value = null
    showAllExercises.value = false
  } else {
    expandedWorkout.value = workout._id
    showAllExercises.value = false
  }
}

function viewWorkout(workout) {
  console.log('👀 Navigiere zur Workout-Ansicht:', workout._id);
  router.push(`/workouts/${workout._id}`);
}

function repeatWorkout(workout) {
  // Navigiere zum WorkoutBuilder mit den Daten des letzten Workouts
  router.push({
    path: '/workout-builder',
    query: {
      type: workout.type,
      repeat: workout._id
    }
  })
}

function editWorkout(workout) {
  console.log('📝 Navigiere zur Workout-Bearbeitung:', workout._id);
  router.push(`/workouts/${workout._id}`);
}
</script>

<style scoped>
.recent-workouts {
  background: #1c1c1e;
  border-radius: 12px;
  padding: 16px;
  margin: 16px;
  border: 1px solid #333;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
}

.view-all {
  color: #4dabf7;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
}

.view-all:hover {
  color: #74c0fc;
}

.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: #999;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 8px;
}

.workouts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workout-item {
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.workout-card {
  background: #2a2a2d;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #333;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.workout-card:hover {
  background: #323236;
  border-color: #444;
  transform: translateY(-1px);
}

.workout-card.expanded {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: #323236;
  border-color: #4dabf7;
}

.workout-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.workout-info {
  flex: 1;
  min-width: 0;
}

.workout-title {
  margin: 0 0 4px 0;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workout-meta {
  margin: 0;
  color: #999;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.exercise-count {
  color: #4dabf7;
}

.workout-type {
  flex-shrink: 0;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 1rem;
  background: #333;
  border: 1px solid #444;
}

.type-badge.push {
  background: rgba(255, 77, 77, 0.2);
  border-color: rgba(255, 77, 77, 0.3);
}

.type-badge.pull {
  background: rgba(77, 171, 247, 0.2);
  border-color: rgba(77, 171, 247, 0.3);
}

.type-badge.legs {
  background: rgba(81, 207, 102, 0.2);
  border-color: rgba(81, 207, 102, 0.3);
}

.workout-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: #333;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.action-btn:hover {
  background: #444;
  transform: scale(1.05);
}

.action-btn.repeat:hover {
  background: rgba(77, 171, 247, 0.3);
}

.action-btn.view:hover {
  background: rgba(129, 140, 248, 0.3);
}

.action-btn.edit:hover {
  background: rgba(255, 193, 7, 0.3);
}

.action-btn.expand {
  font-size: 0.8rem;
  font-weight: bold;
}

.action-btn.expand:hover {
  background: rgba(81, 207, 102, 0.3);
}

.action-btn.expand.expanded {
  background: #4dabf7;
  color: #000;
}

/* Expandable Details */
.workout-details {
  background: #1c1c1e;
  border: 1px solid #4dabf7;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 16px;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
    padding-top: 16px;
    padding-bottom: 16px;
  }
}

.workout-details h5 {
  margin: 0 0 8px 0;
  color: #4dabf7;
  font-size: 0.9rem;
  font-weight: 600;
}

.exercises-list {
  margin-bottom: 16px;
}

.exercises-detailed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exercise-detailed {
  background: #2a2a2d;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #333;
}

.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.exercise-name {
  font-size: 0.9rem;
  color: #fff;
  font-weight: 600;
  flex: 1;
}

.exercise-summary {
  font-size: 0.8rem;
  color: #4dabf7;
  font-weight: 500;
}

.sets-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 6px;
}

.set-item {
  background: #1c1c1e;
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #333;
}

.set-number {
  font-size: 0.75rem;
  color: #999;
  font-weight: 600;
  min-width: 16px;
}

.set-details {
  display: flex;
  gap: 6px;
  font-size: 0.8rem;
  flex: 1;
}

.reps {
  color: #51cf66;
  font-weight: 500;
}

.weight {
  color: #ff6b47;
  font-weight: 500;
}

.no-data {
  color: #666;
  font-style: italic;
}

.sets-placeholder {
  color: #999;
  font-size: 0.8rem;
  font-style: italic;
  padding: 8px;
  text-align: center;
  background: #1c1c1e;
  border-radius: 6px;
  border: 1px solid #333;
}

.sets-legacy {
  background: #1c1c1e;
  border-radius: 6px;
  padding: 8px;
  border: 1px solid #333;
}

.legacy-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.legacy-note {
  font-size: 0.75rem;
  color: #888;
  font-style: italic;
  margin-top: 4px;
}

.legacy-sets {
  color: #4dabf7;
  font-weight: 500;
  font-size: 0.85rem;
}

.legacy-reps {
  color: #51cf66;
  font-weight: 500;
  font-size: 0.85rem;
}

.legacy-weight {
  color: #ff6b47;
  font-weight: 500;
  font-size: 0.85rem;
}

.more-exercises-detailed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #333;
  border-radius: 8px;
  margin-top: 8px;
}

.more-text {
  color: #999;
  font-size: 0.85rem;
  font-style: italic;
}

.show-all-btn {
  background: #4dabf7;
  color: #000;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.show-all-btn:hover {
  background: #74c0fc;
  transform: scale(1.05);
}

.additional-exercises {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.workout-notes {
  margin-bottom: 16px;
}

.workout-notes p {
  margin: 0;
  color: #ccc;
  font-size: 0.85rem;
  line-height: 1.4;
  background: #2a2a2d;
  border-radius: 6px;
  padding: 8px;
}

.workout-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 0.75rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 0.85rem;
  color: #fff;
  font-weight: 500;
}

.stat-value.completed {
  color: #51cf66;
}

@media (max-width: 480px) {
  .recent-workouts {
    margin: 12px;
    padding: 12px;
  }
  
  .workout-card {
    padding: 10px;
  }
  
  .workout-main {
    gap: 10px;
  }
  
  .workout-title {
    font-size: 0.9rem;
  }
  
  .workout-meta {
    font-size: 0.75rem;
  }
  
  .type-badge {
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
  }
  
  .action-btn {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }
  
  .workout-actions {
    gap: 6px;
    margin-left: 8px;
  }
  
  .workout-details {
    padding: 12px;
  }
  
  .exercises-detailed {
    gap: 10px;
  }
  
  .exercise-detailed {
    padding: 10px;
  }
  
  .exercise-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .exercise-summary {
    font-size: 0.75rem;
  }
  
  .sets-list {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 4px;
  }
  
  .set-item {
    padding: 6px;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .set-details {
    gap: 4px;
    font-size: 0.75rem;
  }
  
  .more-exercises-detailed {
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }
  
  .show-all-btn {
    width: 100%;
    padding: 8px;
  }
  
  .workout-stats {
    gap: 12px;
  }
}

@media (max-width: 380px) {
  .workout-meta {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .exercise-count {
    display: none;
  }
  
  .workout-actions {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-btn {
    width: 24px;
    height: 24px;
    font-size: 0.7rem;
  }
  
  .sets-list {
    grid-template-columns: 1fr;
  }
  
  .set-item {
    flex-direction: row;
    justify-content: space-between;
  }
  
  .exercise-header {
    gap: 2px;
  }
  
  .exercise-name {
    font-size: 0.85rem;
  }
  
  .exercise-summary {
    font-size: 0.7rem;
  }
}
</style>