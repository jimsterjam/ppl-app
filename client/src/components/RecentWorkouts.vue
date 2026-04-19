<template>
  <div class="recent-workouts glass">
    <div class="header">
      <h3>{{ t('recent.title') }}</h3>
      <router-link v-if="showViewAll" to="/stats" class="view-all">{{ t('recent.viewAll') }}</router-link>
    </div>
    
    <div v-if="recentWorkouts.length === 0" class="empty-state">
      <div class="empty-icon">💪</div>
      <p>{{ t('recent.emptyTitle') }}</p>
    </div>
    
    <div v-else class="workouts-list">
      <div 
        v-for="workout in recentWorkouts" 
        :key="workout._id"
        class="workout-item"
      >
        <div 
          class="workout-card glass"
          :class="{ 'expanded': expandedWorkout === workout._id }"
          @click="toggleWorkoutDetails(workout)"
        >
          <div class="workout-main">
            <div class="workout-info">
              <h4 class="workout-title">{{ getWorkoutTitle(workout) }}</h4>
              <p class="workout-meta">
                {{ formatDate(workout.date) }} • {{ formatDuration(workout.duration) }}
                <span v-if="workout.exercises?.length" class="exercise-count">
                  • {{ workout.exercises.length }} {{ t('recent.exercises') }}
                </span>
              </p>
            </div>
            
          </div>
          
          <div class="workout-actions">
            <button 
              class="action-btn repeat"
              :title="t('recent.repeatTitle')"
              @click.stop="repeatWorkout(workout)"
            >
              🔄
            </button>
            <button 
              class="action-btn edit"
              :title="t('recent.editTitle')"
              @click.stop="editWorkout(workout)"
            >
              ✏️
            </button>
            <button
              class="action-btn delete"
              :title="t('recent.deleteTitle')"
              @click.stop="deleteWorkoutItem(workout)"
            >
              🗑️
            </button>
            <button 
              class="action-btn expand"
              :class="{ 'expanded': expandedWorkout === workout._id }"
              :title="t('recent.detailsTitle')"
            >
              {{ expandedWorkout === workout._id ? '▲' : '▼' }}
            </button>
          </div>
        </div>
        
        <!-- Expandable Details -->
        <div 
          v-if="expandedWorkout === workout._id" 
          class="workout-details glass"
        >
          <div v-if="workout.exercises?.length" class="exercises-list">
            <h5>{{ t('recent.exercises') }}:</h5>
            <div class="exercises-detailed">
              <div 
                v-for="exercise in workout.exercises.slice(0, 4)" 
                :key="exercise._id || exercise.name"
                class="exercise-detailed glass"
              >
                <div class="exercise-header">
                  <span class="exercise-name">{{ getTranslatedExerciseName(exercise.name) }}</span>
                  <span class="exercise-summary">{{ getExerciseSummary(exercise) }}</span>
                </div>
                <div v-if="exercise.note" class="exercise-note" style="margin:2px 0 6px 0; color:var(--muted); font-size:0.92em;">
                  📝 {{ exercise.note }}
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
                        <span v-if="set.reps" class="reps">{{ set.reps }} {{ t('common.reps') }}</span>
                        <span v-if="set.weight" class="weight">{{ set.weight }}kg</span>
                        <span v-if="!set.reps && !set.weight" class="no-data">{{ t('recent.noData') }}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div v-else-if="!exercise.setDetails?.length && (exercise.sets || exercise.reps || exercise.weight)" class="sets-legacy">
                    <div class="legacy-info">
                      <span v-if="exercise.sets && exercise.sets > 1" class="legacy-sets">{{ exercise.sets }} {{ t('common.sets') }}</span>
                      <span v-else-if="exercise.sets === 1" class="legacy-sets">1 {{ t('recent.set') }}</span>
                      <span v-if="exercise.reps" class="legacy-reps">{{ exercise.reps }} {{ t('common.reps') }}</span>
                      <span v-if="exercise.weight" class="legacy-weight">{{ exercise.weight }}kg</span>
                    </div>
                    <div class="legacy-note">
                      {{ t('recent.legacyNote') }}
                    </div>
                  </div>
                  
                  <div v-else class="sets-placeholder">
                    {{ t('recent.noSetData') }}
                  </div>
                </div>
              </div>
              
              <div v-if="workout.exercises.length > 4" class="more-exercises-detailed">
                <span class="more-text">+{{ workout.exercises.length - 4 }} {{ t('recent.moreExercises') }}</span>
              </div>
              
              <!-- Show remaining exercises if expanded -->
              <div v-if="showAllExercises" class="additional-exercises">
                <div 
                  v-for="exercise in workout.exercises.slice(4)" 
                  :key="exercise._id || exercise.name"
                  class="exercise-detailed glass"
                >
                  <div class="exercise-header">
                    <span class="exercise-name">{{ getTranslatedExerciseName(exercise.name) }}</span>
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
                        <span v-if="set.reps" class="reps">{{ set.reps }} {{ t('common.reps') }}</span>
                        <span v-if="set.weight" class="weight">{{ set.weight }}kg</span>
                        <span v-if="!set.reps && !set.weight" class="no-data">{{ t('recent.noData') }}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div v-else-if="exercise.sets || exercise.reps || exercise.weight" class="sets-legacy">
                    <div class="legacy-info">
                      <span v-if="exercise.sets" class="legacy-sets">{{ exercise.sets }} {{ t('common.sets') }}</span>
                      <span v-if="exercise.reps" class="legacy-reps">{{ exercise.reps }} {{ t('common.reps') }}</span>
                      <span v-if="exercise.weight" class="legacy-weight">{{ exercise.weight }}kg</span>
                    </div>
                  </div>
                  
                  <div v-else class="sets-placeholder">
                    {{ t('recent.noSetData') }}
                  </div>
                </div>
              </div>

              <div v-if="workout.exercises.length > 4" class="show-all-wrap">
                <button
                  class="show-all-btn"
                  @click.stop="showAllExercises = !showAllExercises"
                >
                  {{ showAllExercises ? t('recent.showLess') : t('recent.showAll') }}
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="getWorkoutNotes(workout)" class="workout-notes">
            <h5>{{ t('recent.notes') }}:</h5>
            <p>{{ getWorkoutNotes(workout) }}</p>
          </div>
          
          <div class="workout-stats">
            <div class="stat-item">
              <span class="stat-label">{{ t('recent.created') }}:</span>
              <span class="stat-value">{{ formatDateTime(workout.createdAt) }}</span>
            </div>
            <div v-if="workout.completed" class="stat-item">
              <span class="stat-label">{{ t('recent.status') }}:</span>
              <span class="stat-value completed">✅ {{ t('recent.completed') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { logger } from '@/utils/logger'
import { resolveWorkoutNotes } from '@/utils/workoutNotes'
import { useUserStore } from '@/stores/userStore'
import { saveWorkoutOffline } from '@/utils/offlineStorage'
import { useFirebaseAuth } from '@/utils/firebaseAuth'

const props = defineProps({
  workouts: {
    type: Array,
    default: () => []
  },
  showViewAll: {
    type: Boolean,
    default: true
  }
})
const emit = defineEmits(['delete'])

const router = useRouter()
const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()
const store = useUserStore()
const { getCurrentUser } = useFirebaseAuth()
const expandedWorkout = ref(null)
const showAllExercises = ref(false)
const getWorkoutNotes = (workout) => resolveWorkoutNotes(workout, { maxItems: 8, maxLength: 600 })

// Die letzten 7 Workouts (keine Drafts)
const recentWorkouts = computed(() => {
  return props.workouts
    .filter(w => !(w?.isDraft || w?._isDraft))
    .map(w => ({
      ...w,
      notes: resolveWorkoutNotes(w, { maxItems: 8, maxLength: 600 })
    }))
    .sort((a, b) => new Date(b.date || b.updatedAt) - new Date(a.date || a.updatedAt))
    .slice(0, 5)
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

function formatDate(dateStr) {
  if (!dateStr) return t('common.unknown')
  
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  
  // Setze Zeit auf 0 für Vergleich
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return t('common.today')
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return t('common.yesterday')
  } else {
    // Standard: zeige lokales Datum (ohne Jahr) für kompakten Überblick
    const loc = String(locale.value).startsWith('de') ? 'de-DE' : 'en-US'
    return date.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })
  }
}

function formatDuration(duration) {
  if (!duration || duration === 0) return t('recent.unknownDuration')
  
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`
  } else {
    return `${minutes}min`
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return t('common.unknown')
  
  const date = new Date(dateStr)
  const loc = String(locale.value).startsWith('de') ? 'de-DE' : 'en-US'
  return date.toLocaleDateString(loc, { 
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
    
  let summary = `${totalSets} ${t('common.sets')}`
    
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
          summary += ` • ${minReps} ${t('common.reps')}`
        } else {
          summary += ` • ${minReps}-${maxReps} ${t('common.reps')}`
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
  summary.push(`${exercise.sets} ${t('common.sets')}`)
    }
    if (exercise.reps) {
  summary.push(`${exercise.reps} ${t('common.reps')}`)
    }
    if (exercise.weight) {
      summary.push(`${exercise.weight}kg`)
    }
    
    return summary.join(' • ')
  }
  return t('recent.noData')
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
  logger.debug('👀 Navigiere zur Workout-Ansicht:', workout._id);
  router.push(`/workouts/${workout._id}`);
}

async function repeatWorkout(sourceWorkout) {
  const draftId = `draft-repeat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const userId = String(getCurrentUser?.()?.uid || store.user?.uid || store.user?.id || 'guest')

  const exercises = (sourceWorkout.exercises || []).map((ex) => {
    const setDetails = Array.isArray(ex.setDetails) && ex.setDetails.length
      ? ex.setDetails.map(s => ({
          reps: Number(s?.reps) || 0,
          weight: Number(s?.weight) || 0,
          ...(s?.isWarmup ? { isWarmup: true } : {})
        }))
      : [{ reps: Number(ex.reps) || 10, weight: Number(ex.weight) || 0 }]
    return { ...ex, setDetails, reps: Number(setDetails[0]?.reps) || 0, weight: Number(setDetails[0]?.weight) || 0 }
  })

  const draft = {
    _id: draftId,
    userId,
    name: sourceWorkout.name || '',
    type: sourceWorkout.type || 'push',
    date: new Date().toISOString(),
    completed: false,
    _isDraft: true,
    isDraft: true,
    exercises
  }

  try {
    await saveWorkoutOffline(draft)
    store.workouts.unshift(draft)
  } catch (e) {
    logger.warn('[RecentWorkouts] repeatWorkout: Draft konnte nicht gespeichert werden', e)
  }

  router.push({ name: 'workout-detail', params: { id: draftId } })
}

function editWorkout(workout) {
  logger.debug('📝 Navigiere zur Workout-Bearbeitung:', workout._id);
  router.push(`/workouts/${workout._id}`);
}

function deleteWorkoutItem(workout) {
  emit('delete', workout)
}
</script>

<style scoped>
.recent-workouts {
  background: var(--card-bg);
  border-radius: var(--panel-radius);
  padding: clamp(18px, 3vw, 26px);
  margin: 0;
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-soft);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.header h3 { margin: 0; font-size: 1.1rem; }

.view-all {
  color: var(--accent-color);
  text-decoration: none;
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--muted);
  border: 1px dashed var(--card-border);
  border-radius: 18px;
}

.workouts-list { display: flex; flex-direction: column; gap: 12px; }

.workout-card {
  border-radius: 22px;
  padding: 16px;
  border: 1px solid var(--card-border);
  /* background: linear-gradient(135deg, rgba(16, 17, 24, 0.95), rgba(8, 9, 12, 0.95)); */
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.35);
}

.workout-card:hover { transform: translateY(-2px); border-color: rgba(223, 255, 83, 0.35); }
.workout-card.expanded { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }

.workout-main { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.workout-info { flex: 1; min-width: 0; }

.workout-title { margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.workout-meta { margin: 0; color: var(--muted); font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exercise-count { color: var(--accent-color); }

.workout-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  margin-left: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--fg);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.action-btn:hover { transform: translateY(-2px); border-color: rgba(223, 255, 83, 0.35); }
.action-btn.expand { font-size: 0.75rem; font-weight: 700; }
.action-btn.expand.expanded { background: var(--accent); color: var(--accent-contrast); border-color: transparent; }

/* Expandable Details */
.workout-details {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-top: none;
  border-radius: 0 0 22px 22px;
  padding: 18px;
  animation: slideDown 0.25s ease-out;
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

.workout-details h5 { margin: 0 0 8px 0; color: var(--accent-color); font-size: 0.9rem; font-weight: 600; }

.exercises-list {
  margin-bottom: 16px;
}

.exercises-detailed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exercise-detailed { background: rgba(255, 255, 255, 0.01); border-radius: 16px; padding: 14px; border: 1px solid var(--card-border); }

.exercise-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--divider); }

.exercise-name { font-size: 0.9rem; color: var(--fg); font-weight: 600; flex: 1; }

.exercise-summary { font-size: 0.8rem; color: color-mix(in oklab, var(--accent-color) 70%, #4dabf7); font-weight: 500; }

.sets-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 6px;
}

.set-item { background: var(--surface); border-radius: 8px; padding: 8px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--card-border); }

.set-number { font-size: 0.75rem; color: var(--muted); font-weight: 600; min-width: 16px; }

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

.no-data { color: var(--muted); font-style: italic; }

.sets-placeholder { color: var(--muted); font-size: 0.8rem; font-style: italic; padding: 8px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px dashed var(--card-border); }

.sets-legacy { background: var(--surface); border-radius: 8px; padding: 8px; border: 1px solid var(--card-border); }

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

.more-exercises-detailed { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; margin-top: 8px; border: 1px solid var(--card-border); }

.more-text { color: var(--muted); font-size: 0.85rem; font-style: italic; }

.show-all-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }

.show-all-btn { background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.show-all-btn:hover { transform: scale(1.05); }

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

.workout-notes p { margin: 0; color: var(--muted); font-size: 0.85rem; line-height: 1.4; background: rgba(255,255,255,0.02); border-radius: 12px; padding: 10px; border: 1px solid var(--card-border); }

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

.stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }

.stat-value { font-size: 0.85rem; color: var(--fg); font-weight: 500; }

.stat-value.completed {
  color: #51cf66;
}

@media (max-width: 480px) {
  .recent-workouts {
    margin: 0;
    padding: 16px;
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