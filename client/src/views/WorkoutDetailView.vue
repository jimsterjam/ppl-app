<template>
    <div class="workout-detail">
      <HeaderBar title="Workout" />

    <div class="content" :class="{ 'timer-offset': hasTimerOverlay }">
      <div v-if="loading" class="loading">{{ t('workoutDetail.loading') }}</div>

      <div v-else-if="error" class="error">
        <p>{{ t('workoutDetail.loadError') }}</p>
        <small>{{ error }}</small>
      </div>

      <div v-else-if="!workout" class="empty">
        <p>{{ t('workoutDetail.notFound') }}</p>
      </div>

      <div v-else class="workout">
        <div class="workout-header">
        <h2>{{ workout.name }}</h2>
        <div class="meta">
            <span class="badge">{{ workout.type?.toUpperCase() }}</span>
            <span>{{ formatDate(workout.date) }}</span>
            <span v-if="workout.completed" class="completed">✓</span>
          </div>
        </div>

          <div id="exercises" ref="exListRef" class="ex-list glass" :class="{ reordering: isReordering }">

          <div class="ex-list-header">
            <div class="ex-list-actions">
              <button class="primary add-exercise-btn" type="button" @click="showAddExerciseModal = true">
                + {{ t('workoutDetail.addExercise') }}
              </button>
              <button v-if="!isFavoriteAdjustMode" class="primary timer-config-btn" type="button" @click="showTimerConfig = true">
                ⏱ Timer einstellen
              </button>
              <button class="primary reorder-toggle" type="button" :aria-pressed="isReordering" @click="toggleReorder">
                {{ isReordering ? t('workoutDetail.done') : t('workoutDetail.editOrder') }}
              </button>
              <SessionStopwatch @session-time="onSessionTime" />
            </div>
          </div>
    <!-- Modal für Übungsauswahl -->
    <AppModal
      v-model="showAddExerciseModal"
      :title="t('workoutDetail.addExercise')"
      :show-cancel="true"
      :confirm-text="t('common.add')"
      :cancel-text="t('common.cancel')"
      type="info"
      @confirm="onAddExerciseConfirm"
    >
      <div class="picker-container">
        <div v-if="exercisesLoading" class="loading">{{ t('exercises.loading') }}</div>
        <ExerciseList
          v-else
          :show-title="false"
          :show-controls="true"
          :items="allExercises"
          :selectable="true"
          :selected-ids="selectedModalExerciseIds"
          :user-id="resolveActiveWorkoutUserId()"
          @toggle="handleAddExerciseToggle"
          @custom-added="loadAllExercises"
        />
      </div>
    </AppModal>

          <div v-if="isDirty" class="banner dirty">{{ t('workoutDetail.unsaved') }}</div>
          <p v-if="isReordering" class="reorder-hint">{{ t('workoutDetail.reorderHint') }}</p>

          <div
            v-for="(ex, i) in workout.exercises || []"
            :key="ex.exerciseId || i"
            :data-ex-index="i"
            class="ex-item"
                  :class="{ reordering: isReordering, dragging: draggingIndex === i, 'drop-target': dropTargetIndex === i }"
                  :draggable="isReordering && !isMobile"
                    @pointerdown="onPointerDown($event, i)"
                @dragstart="onDragStart(i)"
                @dragover.prevent="onDragOver(i)"
                @dragleave.prevent="onDragLeave(i)"
                @drop.prevent="onDrop(i)"
                @dragend="stopDrag()"
          >
              <button
                v-if="isReordering"
                class="drag-handle"
                :title="t('workoutDetail.dragToReorder')"
                @touchstart.prevent="onTouchStart($event, i)"
                @pointerdown="onPointerDown($event, i)"
              >⋮⋮</button>
            <div class="ex-info" :class="{ minimal: isReordering }">
              <template v-if="isReordering">
                <strong class="ex-name-only">{{ getTranslatedExerciseName(ex.name) }}</strong>
              </template>
              <template v-else>
                <img
                  :src="getExerciseImage(ex)"
                  :alt="getTranslatedExerciseName(ex.name)"
                  class="ex-thumb"
                  @error="onImgError"
                  @click="openExerciseMedia(ex)"
                />
                <div class="ex-text">
                  <div class="ex-title-row">
                    <strong>{{ getTranslatedExerciseName(ex.name) }}</strong>
                    <button
                      class="remove-exercise-btn"
                      type="button"
                      :title="t('common.remove')"
                      @click="askRemoveExercise(i)"
                    >
                      🗑️
                    </button>
                  </div>
                  <small>{{ getTranslatedMuscleGroup ? getTranslatedMuscleGroup(ex.muscleGroup) : ex.muscleGroup }}</small>
                  <p v-if="ex.description" class="ex-description">{{ ex.description }}</p>
                  <!-- <p v-if="favoriteLastPerformanceByIndex[i]" class="last-performance-hint">
                    Letztes Mal: {{ favoriteLastPerformanceByIndex[i].sets }} Sets · {{ favoriteLastPerformanceByIndex[i].reps }} Wdh · {{ favoriteLastPerformanceByIndex[i].weight }} kg
                  </p> -->
                  <!-- Notiz-Button und Feld -->
                  <div style="margin-top: 6px;">
                    <button class="link" @click="toggleNote(i)">
                      📝
                      {{ getNote(i)
                        ? (showNote[i] ? 'ändern' : 'anzeigen')
                        : 'Notiz hinzufügen' }}
                    </button>

                    <button
                      class="link danger"
                      v-if="getNote(i)"
                      @click="askDeleteNote(i)"
                      style="margin-left:8px;"
                    >
                      🗑️ löschen
                    </button>
                  </div>

                  <div v-if="showNote && showNote[i]" style="margin-top: 4px;">
                    <textarea :value="getNote(i)" @input="setNote(i, $event.target.value)" rows="2" style="width:100%;resize:vertical" placeholder="Notiz zu dieser Übung..."></textarea>
                  </div>
                  <div v-if="mediaExercise" class="media-overlay" @click.self="closeExerciseMedia">
                    <div class="media-content">
                      <video
                        v-if="isVideoUrl(mediaUrl)"
                        :src="mediaUrl"
                        class="media-image"
                        autoplay
                        muted
                        loop
                        playsinline
                      ></video>
                      <img
                        v-else
                        :src="mediaUrl || getExerciseLargeImage(mediaExercise)"
                        :alt="mediaExercise.name"
                        class="media-image"
                      />
                      <p class="media-disclaimer">Visualisierung dient nur zur Orientierung. Keine Garantie für technisch korrekte Ausführung.</p>
                      <button class="close-btn" @click="closeExerciseMedia">OK</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div class="ex-sets" v-if="!isReordering">

              <!-- Aufwärmsätze -->
              <div class="sets-section-label warmup-label">{{ t('workoutDetail.warmupSetsLabel') }}</div>
              <div class="set-row header">
                <span class="col set">{{ t('workoutDetail.set') }}</span>
                <span class="col reps">{{ t('workoutDetail.reps') }}</span>
                <span class="col weight">{{ t('workoutDetail.weight') }}</span>
                <span class="col actions"></span>
              </div>
              <template
                v-for="(row, rIdx) in (ex.setDetails || [])"
                :key="`${ex.exerciseId || i}-row-${rIdx}`"
              >
                <div v-if="row.isWarmup" class="set-row warmup-row" :data-set-index="rIdx">
                  <span class="col set">{{ getSetLabel(ex.setDetails, rIdx) }}</span>
                  <span class="col reps">
                    <div class="number-with-spinner">
                        <input
                          v-model.number="row.reps"
                          data-field="reps"
                          type="number"
                          min="1"
                          max="500"
                          step="1"
                          inputmode="numeric"
                          :readonly="isMobile"
                          @focus="trackFieldAnchor(i, rIdx, 'reps')"
                          @click="trackFieldAnchor(i, rIdx, 'reps')"
                          @input="() => { clampRowValue(row, 'reps', 1, 500, 1); triggerAutoSave() }"
                          @wheel.prevent="onNumberWheel($event, row, 'reps', 1, 1, 500)"
                          @keydown="onNumberKeyDown($event, false)"
                          @focus.prevent="openPicker(row, 'reps', 1, 1, 500)"
                          @click.prevent="openPicker(row, 'reps', 1, 1, 500)"
                        />
                        <div v-if="!isMobile" class="spinner-vertical">
                        <button
                          type="button"
                          class="spin-btn up"
                          aria-label="increment reps"
                          @click="adjustRowField(row, 'reps', 1, 1, 1, 500)"
                          @mousedown="startSpin(row, 'reps', 1, 1, 1, 500)"
                          @mouseup="stopSpin(row, 'reps')"
                          @mouseleave="stopSpin(row, 'reps')"
                          @touchstart.prevent="startSpin(row, 'reps', 1, 1, 1, 500)"
                          @touchend.prevent="stopSpin(row, 'reps')"
                          @touchcancel.prevent="stopSpin(row, 'reps')"
                        >▲</button>
                        <button
                          type="button"
                          class="spin-btn down"
                          aria-label="decrement reps"
                          @click="adjustRowField(row, 'reps', -1, 1, 1, 500)"
                          @mousedown="startSpin(row, 'reps', -1, 1, 1, 500)"
                          @mouseup="stopSpin(row, 'reps')"
                          @mouseleave="stopSpin(row, 'reps')"
                          @touchstart.prevent="startSpin(row, 'reps', -1, 1, 1, 500)"
                          @touchend.prevent="stopSpin(row, 'reps')"
                          @touchcancel.prevent="stopSpin(row, 'reps')"
                        >▼</button>
                      </div>
                    </div>
                  </span>
                  <span class="col weight">
                    <div class="weight-input">
                      <div class="number-with-spinner">
                        <input
                          v-model.number="row.weight"
                          data-field="weight"
                          type="number"
                          min="0"
                          max="1000"
                          step="0.25"
                          inputmode="decimal"
                          :readonly="isMobile"
                          @focus="trackFieldAnchor(i, rIdx, 'weight')"
                          @click="trackFieldAnchor(i, rIdx, 'weight')"
                          @input="() => { clampRowValue(row, 'weight', 0, 1000, 0.25); triggerAutoSave() }"
                          @wheel.prevent="onNumberWheel($event, row, 'weight', 0.25, 0, 1000)"
                          @keydown="onNumberKeyDown($event, true)"
                          @focus.prevent="openPicker(row, 'weight', 0.25, 0, 1000)"
                          @click.prevent="openPicker(row, 'weight', 0.25, 0, 1000)"
                        />
                        <div v-if="!isMobile" class="spinner-vertical">
                          <button
                            type="button"
                            class="spin-btn up"
                            aria-label="increment weight"
                            @click="adjustRowField(row, 'weight', 1, 0.25, 0, 1000)"
                            @mousedown="startSpin(row, 'weight', 1, 0.25, 0, 1000)"
                            @mouseup="stopSpin(row, 'weight')"
                            @mouseleave="stopSpin(row, 'weight')"
                            @touchstart.prevent="startSpin(row, 'weight', 1, 0.25, 0, 1000)"
                            @touchend.prevent="stopSpin(row, 'weight')"
                            @touchcancel.prevent="stopSpin(row, 'weight')"
                          >▲</button>
                          <button
                            type="button"
                            class="spin-btn down"
                            aria-label="decrement weight"
                            @click="adjustRowField(row, 'weight', -1, 0.25, 0, 1000)"
                            @mousedown="startSpin(row, 'weight', -1, 0.25, 0, 1000)"
                            @mouseup="stopSpin(row, 'weight')"
                            @mouseleave="stopSpin(row, 'weight')"
                            @touchstart.prevent="startSpin(row, 'weight', -1, 0.25, 0, 1000)"
                            @touchend.prevent="stopSpin(row, 'weight')"
                            @touchcancel.prevent="stopSpin(row, 'weight')"
                          >▼</button>
                        </div>
                      </div>
                      <span class="unit">kg</span>
                    </div>
                  </span>
                  <span class="col actions">
                    <button class="remove-row-btn" :title="t('workoutDetail.removeWarmupSet')" @click="removeSetRow(i, rIdx)">−</button>
                  </span>
                </div>
              </template>
              <div class="row-actions warmup-actions">
                <button class="add-warmup-btn" @click="addWarmupSetRow(i, $event)">＋ {{ t('workoutDetail.addWarmupSet') }}</button>
              </div>

              <!-- Arbeitssätze -->
              <div class="sets-section-divider"></div>
              <div class="sets-section-label working-label">{{ t('workoutDetail.workingSetsLabel') }}</div>
              <template
                v-for="(row, rIdx) in (ex.setDetails || [])"
                :key="`${ex.exerciseId || i}-working-row-${rIdx}`"
              >
                <div v-if="!row.isWarmup" class="set-row" :class="{ 'set-row-empty': isRowEmpty(row) }" :data-set-index="rIdx">
                  <span class="col set">
                    {{ getSetLabel(ex.setDetails, rIdx) }}
                    <span v-if="Number(row.reps) >= 6" class="weight-progress-hint" :title="t('workoutDetail.progressionHint')">&#8593;</span>
                  </span>
                  <span class="col reps">
                    <div class="number-with-spinner">
                        <input
                          v-model.number="row.reps"
                          data-field="reps"
                          type="number"
                          min="0"
                          max="500"
                          step="1"
                          inputmode="numeric"
                          :readonly="isMobile"
                          @focus="trackFieldAnchor(i, rIdx, 'reps')"
                          @click="trackFieldAnchor(i, rIdx, 'reps')"
                          @input="() => { clampRowValueNullable(row, 'reps', 0, 500, 1); triggerAutoSave() }"
                          @wheel.prevent="onNumberWheel($event, row, 'reps', 1, 0, 500)"
                          @keydown="onNumberKeyDown($event, false)"
                          @focus.prevent="openPicker(row, 'reps', 1, 0, 500)"
                          @click.prevent="openPicker(row, 'reps', 1, 0, 500)"
                        />
                        <div v-if="!isMobile" class="spinner-vertical">
                        <button
                          type="button"
                          class="spin-btn up"
                          aria-label="increment reps"
                          @click="adjustRowField(row, 'reps', 1, 1, 0, 500)"
                          @mousedown="startSpin(row, 'reps', 1, 1, 0, 500)"
                          @mouseup="stopSpin(row, 'reps')"
                          @mouseleave="stopSpin(row, 'reps')"
                          @touchstart.prevent="startSpin(row, 'reps', 1, 1, 0, 500)"
                          @touchend.prevent="stopSpin(row, 'reps')"
                          @touchcancel.prevent="stopSpin(row, 'reps')"
                        >▲</button>
                        <button
                          type="button"
                          class="spin-btn down"
                          aria-label="decrement reps"
                          @click="adjustRowField(row, 'reps', -1, 1, 0, 500)"
                          @mousedown="startSpin(row, 'reps', -1, 1, 0, 500)"
                          @mouseup="stopSpin(row, 'reps')"
                          @mouseleave="stopSpin(row, 'reps')"
                          @touchstart.prevent="startSpin(row, 'reps', -1, 1, 0, 500)"
                          @touchend.prevent="stopSpin(row, 'reps')"
                          @touchcancel.prevent="stopSpin(row, 'reps')"
                        >▼</button>
                      </div>
                    </div>
                  </span>
                  <span class="col weight">
                    <div class="weight-input">
                      <div class="number-with-spinner">
                        <input
                          v-model.number="row.weight"
                          data-field="weight"
                          type="number"
                          min="0"
                          max="1000"
                          step="0.25"
                          inputmode="decimal"
                          :readonly="isMobile"
                          @focus="trackFieldAnchor(i, rIdx, 'weight')"
                          @click="trackFieldAnchor(i, rIdx, 'weight')"
                          @input="() => { clampRowValue(row, 'weight', 0, 1000, 0.25); triggerAutoSave() }"
                          @wheel.prevent="onNumberWheel($event, row, 'weight', 0.25, 0, 1000)"
                          @keydown="onNumberKeyDown($event, true)"
                          @focus.prevent="openPicker(row, 'weight', 0.25, 0, 1000)"
                          @click.prevent="openPicker(row, 'weight', 0.25, 0, 1000)"
                        />
                        <div v-if="!isMobile" class="spinner-vertical">
                          <button
                            type="button"
                            class="spin-btn up"
                            aria-label="increment weight"
                            @click="adjustRowField(row, 'weight', 1, 0.25, 0, 1000)"
                            @mousedown="startSpin(row, 'weight', 1, 0.25, 0, 1000)"
                            @mouseup="stopSpin(row, 'weight')"
                            @mouseleave="stopSpin(row, 'weight')"
                            @touchstart.prevent="startSpin(row, 'weight', 1, 0.25, 0, 1000)"
                            @touchend.prevent="stopSpin(row, 'weight')"
                            @touchcancel.prevent="stopSpin(row, 'weight')"
                          >▲</button>
                          <button
                            type="button"
                            class="spin-btn down"
                            aria-label="decrement weight"
                            @click="adjustRowField(row, 'weight', -1, 0.25, 0, 1000)"
                            @mousedown="startSpin(row, 'weight', -1, 0.25, 0, 1000)"
                            @mouseup="stopSpin(row, 'weight')"
                            @mouseleave="stopSpin(row, 'weight')"
                            @touchstart.prevent="startSpin(row, 'weight', -1, 0.25, 0, 1000)"
                            @touchend.prevent="stopSpin(row, 'weight')"
                            @touchcancel.prevent="stopSpin(row, 'weight')"
                          >▼</button>
                        </div>
                      </div>
                      <span class="unit">kg</span>
                    </div>
                  </span>
                  <span class="col actions">
                    <button class="remove-row-btn" :title="t('workoutDetail.removeSet')" @click="removeSetRow(i, rIdx)">−</button>
                  </span>
                </div>
              </template>

              <div class="row-actions">
                <button class="add-row-btn" :title="t('workoutDetail.addSet')" @click="addSetRow(i, $event)">＋ {{ t('workoutDetail.addSet') }}</button>
              </div>
            </div>
          </div>

          <div class="actions">
            <button
              v-if="isReordering"
              class="primary"
              type="button"
              @click="toggleReorder"
            >
              {{ t('workoutDetail.done') }}
            </button>
            <button v-else class="primary save-btn" :disabled="saving" @click="saveWorkout">
              {{ saving ? t('workoutDetail.saving') : (isFavoriteAdjustMode ? t('workoutDetail.adjustSave') : t('workoutDetail.save')) }}
            </button>
            <!-- <button
              v-if="!isReordering && !isFavoriteAdjustMode"
              class="secondary favorite-save"
              type="button"
              :disabled="favoriteSaving"
              @click="openFavoriteNameModal"
            >
              {{ favoriteSaving ? t('workoutDetail.saving') : t('workoutDetail.saveAsFavorite') }}
            </button> -->
            <small v-if="saveMsg && !isReordering" class="save-msg" :class="{ error: saveError }">{{ saveMsg }}</small>
          </div>
        </div>

        <div class="actions">
          <button class="primary cancel-btn" @click="goDashboard">{{ t('workoutDetail.cancel') }}</button>
        </div>
      </div>
    </div>


    <NumberPicker
      :visible="pickerVisible"
      :value="pickerValue"
      :min="pickerConfig.min"
      :max="pickerConfig.max"
      :step="pickerConfig.step"
      :split-decimals="pickerConfig.splitDecimals"
      :decimal-options="pickerConfig.decimalOptions"
      :title="pickerConfig.title"
      :confirm-text="pickerConfig.confirmText"
      :cancel-text="pickerConfig.cancelText"
      @update:value="val => pickerValue = val"
      @confirm="onPickerConfirm"
      @cancel="onPickerCancel"
    />

    <!-- Bestätigungsmodal bei ungespeicherten Änderungen -->
    <AppModal
      v-model="showLeaveModal"
      :title="t('workoutDetail.cancel')"
      :message="t('workoutDetail.leaveConfirm')"
      :confirm-text="t('workoutDetail.leaveConfirmBack')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="confirmLeave"
    />

    <!-- Ursprünglich ein Modal das erscheint wenn man ein favorite speichern will. -->
    <!-- <AppModal
      v-model="showFavoriteNameModal"
      :title="t('workoutDetail.favoriteNameTitle')"
      :confirm-text="favoriteSaving ? t('workoutDetail.saving') : t('common.save')"
      :cancel-text="t('common.cancel')"
      :close-on-confirm="false"
      :persistent="favoriteSaving"
      type="info"
      @confirm="confirmFavoriteSave"
    >
      <label class="favorite-modal-field">
        <span>{{ t('workoutDetail.favoriteNamePlaceholder') }}</span>
        <input
          v-model="favoriteName"
          class="favorite-modal-input"
          type="text"
          maxlength="40"
          :placeholder="t('workoutDetail.favoriteNamePlaceholder')"
        />
      </label>
    </AppModal> -->

    <AppModal
      v-model="showTimerActionModal"
      title="Aktiver Timer"
      confirm-text="Weiterlaufen"
      cancel-text="Pausieren"
      type="warning"
      @confirm="onTimerDecision('continue')"
      @cancel="onTimerDecision('pause')"
    >
      <div class="timer-decision-body">
        <p>Der Timer ist noch aktiv. Wie soll fortgefahren werden?</p>
        <button class="timer-stop-btn" type="button" @click="onTimerDecision('stop')">
          Timer stoppen
        </button>
      </div>
    </AppModal>

    <AppModal
      v-model="showRemoveExerciseModal"
      :title="t('workoutDetail.removeExerciseConfirmTitle')"
      :message="t('workoutDetail.removeExerciseConfirmMsg')"
      :confirm-text="t('common.remove')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="confirmRemoveExercise"
    />

    <AppModal
      v-model="showDeleteNoteModal"
      :title="t('workoutDetail.deleteNoteConfirmTitle')"
      :message="t('workoutDetail.deleteNoteConfirmMsg')"
      :confirm-text="t('common.remove')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="confirmDeleteNote"
    />

    <WorkoutTimerConfig v-if="showTimerConfig" @close="showTimerConfig = false" />

    <!-- Speichern-Overlay -->
    <Transition name="save-fade">
      <div v-if="saving" class="saving-overlay" role="status" aria-live="assertive" aria-busy="true">
        <div class="saving-card">
          <div class="saving-spinner" aria-hidden="true"></div>
          <span class="saving-label">{{ t('workoutDetail.saving') }}…</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
// State für Übung hinzufügen
const showAddExerciseModal = ref(false)
const allExercises = ref([])
const exercisesLoading = ref(false)
const selectedExerciseToAdd = ref(null)
const authToken = ref(null)
function getExerciseIdentifier(ex) {
  const value = ex?._id || ex?.exerciseId || ex?.id || ex?.mediaId || null
  return value == null ? '' : String(value)
}
const selectedModalExerciseIds = computed(() => {
  const id = getExerciseIdentifier(selectedExerciseToAdd.value)
  return id ? [id] : []
})
// Übungen für Modal laden
import { getMergedSortedExercises } from '@/utils/exerciseList'
async function loadAllExercises() {
  exercisesLoading.value = true
  try {
    const list = await getMergedSortedExercises({
      locale: String(locale?.value || ''),
      includeRemote: false,
      userId: resolveActiveWorkoutUserId()
    })
    allExercises.value = list
  } catch (e) {
    allExercises.value = []
  } finally {
    exercisesLoading.value = false
  }
}

watch(showAddExerciseModal, async (val) => {
  if (val) {
    loadAllExercises()
    authToken.value = await getIdToken().catch(() => null)
  }
  if (!val) selectedExerciseToAdd.value = null
})

function handleAddExerciseToggle(ex) {
  if (!ex) return
  const nextId = getExerciseIdentifier(ex)
  const selectedId = getExerciseIdentifier(selectedExerciseToAdd.value)
  if (selectedId && selectedId === nextId) {
    selectedExerciseToAdd.value = null
    return
  }
  selectedExerciseToAdd.value = ex
}

function onAddExerciseConfirm() {
  if (!selectedExerciseToAdd.value) return
  const selectedId = getExerciseIdentifier(selectedExerciseToAdd.value)
  if (!selectedId) return
  // Füge die Übung ans Workout an (mit Default-Sets)
  if (!workout.value.exercises) workout.value.exercises = []
  // Verhindere Duplikate (optional)
  if (workout.value.exercises.some(e => String(e.exerciseId || e._id || e.id || '') === selectedId)) {
    toast.show('Übung bereits hinzugefügt', { type: 'warning', duration: 2000 })
    showAddExerciseModal.value = false
    selectedExerciseToAdd.value = null
    return
  }
  workout.value.exercises.push({
    exerciseId: selectedId,
    name: selectedExerciseToAdd.value.name,
    muscleGroup: selectedExerciseToAdd.value.muscleGroup,
    imageUrl: selectedExerciseToAdd.value.imageUrl || '',
    thumbnailUrl: selectedExerciseToAdd.value.thumbnailUrl || '',
    thumbnailStaticUrl: selectedExerciseToAdd.value.thumbnailStaticUrl || '',
    setDetails: [{ reps: 10, weight: 0 }],
    note: ''
  })
  showAddExerciseModal.value = false
  selectedExerciseToAdd.value = null
  ensureSetDetailsStructure()
  try { triggerAutoSave() } catch {}
  toast.show('Übung hinzugefügt', { type: 'success', duration: 1500 })
}
import { ref, onMounted, onBeforeUnmount, watch, nextTick, reactive, computed } from 'vue'
import { getCurrentInstance } from 'vue'
import NumberPicker from '@/components/NumberPicker.vue'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { resolveExerciseMedia, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { getWorkoutOffline, getExerciseOffline, getAllExercisesOffline, getAllWorkoutsOffline, saveWorkoutOffline, db, deleteMetadata } from '@/utils/offlineStorage'
import { fetchWorkout, deleteWorkout as deleteWorkoutApi } from '@/api/workouts'
// import { fetchExercise, fetchExercises } from '@/api/exercises'
import { useUserStore } from '@/stores/userStore'
import { useAuthStore } from '@/stores/authStore'
import HeaderBar from '@/components/HeaderBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import AppModal from '@/components/AppModal.vue'
import ExerciseList from '@/components/ExerciseList.vue'
import WorkoutTimerConfig from '@/components/timer/WorkoutTimerConfig.vue'
import SessionStopwatch from '@/components/SessionStopwatch.vue'
import { useToastStore } from '@/stores/toastStore'
import { useTimerStore } from '@/stores/timerStore'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { buildWorkoutNotesSummary } from '@/utils/workoutNotes'
import { resolveRealIdFromDraftId as _resolveRealIdFromDraftId, snapshotCore } from '@/utils/workoutHelpers'
import { saveWorkoutService } from '@/utils/SaveWorkoutService'
import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'
import { resolveServerMediaUrl } from '@/api/http'
import { purgePendingCreateQueueForWorkoutId } from '@/utils/offlineStorage'
import {
  saveFavoriteWorkout,
  updateFavoriteWorkout,
  getFavoriteNameValidationError,
  normalizeFavoriteName,
  normalizeWorkoutType
} from '@/utils/workoutFavorites'
import { clearActiveDraft, getActiveDraft, setActiveDraft, updateActiveDraft, findActiveDraftByWorkoutId } from '@/utils/activeWorkoutDraft'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'

const userStore = useUserStore()
const authStore = useAuthStore()
function clearAllDetailDraftSnapshots() {
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach((key) => {
      if (key === 'workout_detail_draft' || key.startsWith('workout_detail_draft_')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch {}
}

function handleSessionTime({ totalMs, formattedTime }) {
  console.log('Session-Zeit:', formattedTime, totalMs)
  // später: Wert an SaveWorkoutService übergeben
}

function clearAllWorkoutMapKeys() {
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach((key) => {
      if (key.startsWith('workout_map_')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch {}
}



async function postSaveCleanup() {
  clearActiveDraftForCurrentUser('post-save')
  try { await db.workouts.delete('draft') } catch {}
  clearAllDetailDraftSnapshots()
  clearAllWorkoutMapKeys()
  // IndexedDB-Mappings bereinigen (workout_map_<tempId> → realId)
  try {
    const routeId = String(route.params.id || '')
    if (routeId.startsWith('draft-')) {
      await deleteMetadata(`workout_map_${routeId}`)
    }
  } catch {}
}

const route = useRoute()
const router = useRouter()
const { getIdToken, getCurrentUser } = useFirebaseAuth()

const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()
const defaultExerciseByName = ref(new Map())
async function loadDefaultExerciseMap() {
  try {
    const defaultExercisesNormalized = await loadDefaultExercises()
    defaultExerciseByName.value = new Map(
      defaultExercisesNormalized.flatMap(ex => {
        const entries = []
        if (ex.name) entries.push([String(ex.name).trim().toLowerCase(), ex])
        if (ex.name_en) entries.push([String(ex.name_en).trim().toLowerCase(), ex])
        return entries
      })
    )
  } catch {
    defaultExerciseByName.value = new Map()
  }
}
// Optional: eigene Übersetzungsfunktion für Muskelgruppen
const getTranslatedMuscleGroup = (mg) => mg

const store = userStore
const toast = useToastStore()
const timerStore = useTimerStore()
const hasTimerOverlay = computed(() => Boolean(timerStore?.miniVisible && timerStore?.isActive))
const isFavoriteAdjustMode = computed(() => String(route.query?.favoriteAdjust || '') === '1')
const workout = ref(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveMsg = ref('')
const saveError = ref(false)
const WORKOUT_DETAIL_VIEW_STATE_KEY = 'workout_detail_view_state_v1'
const lastFieldAnchor = ref(null)
let viewStatePersistTimer = null
const favoriteName = ref('')
const favoriteSaving = ref(false)
const showFavoriteNameModal = ref(false)
const showTimerActionModal = ref(false)
const pendingTimerAction = ref(null)
const bypassTimerLeaveGuard = ref(false)
const showRemoveExerciseModal = ref(false)
const pendingRemoveExerciseIndex = ref(-1)
const showDeleteNoteModal = ref(false)
const pendingDeleteNoteIndex = ref(-1)
const suppressDraftPersistence = ref(false)
const favoritePrefillApplied = ref(false)
const favoriteLastPerformanceByIndex = ref({})
const mediaExercise = ref(null)
const REAL_ID_RESOLVE_RETRIES = Number.parseInt(import.meta.env.VITE_REAL_ID_RESOLVE_RETRIES || '', 10) || 12
const REAL_ID_RESOLVE_DELAY_MS = Number.parseInt(import.meta.env.VITE_REAL_ID_RESOLVE_DELAY_MS || '', 10) || 500
const mediaUrl = ref('')
const mediaRequestId = ref(0)
const isVideoUrl = (url) => typeof url === 'string' && /\.mp4($|[?#])/i.test(url)
const isReordering = ref(false)
const draggingIndex = ref(null)
const dropTargetIndex = ref(null)
const activeTouchPointerId = ref(null)
let pointerMoveListener = null
let pointerUpListener = null
let pointerCancelListener = null
const touchPointerTypes = new Set(['touch', 'pen'])
const supportsPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined'
const activeFallbackTouchId = ref(null)
let fallbackTouchMoveListener = null
let fallbackTouchEndListener = null
let fallbackTouchCancelListener = null
let suppressNextPickerOpen = false
const isDirty = ref(false)
const exListRef = ref(null)
const didAutoScroll = ref(false)
let initialSnapshot = ''
const showLeaveModal = ref(false)
const showTimerConfig = ref(false)
const sessionStopwatchStore = useSessionStopwatchStore()

// Notiz-Logik
const showNote = ref([])
const exerciseNotes = ref([])
// Mobile detection (treat app as mobile-only if touch available or narrow)
const isMobile = ref(typeof window !== 'undefined' && ('ontouchstart' in window || window.innerWidth <= 768))

// Picker state
const pickerVisible = ref(false)
const pickerValue = ref(0)
const pickerConfig = reactive({
  min: 0,
  max: 1000,
  step: 1,
  splitDecimals: false,
  decimalOptions: [0, 0.25, 0.5, 0.75],
  title: '',
  confirmText: 'OK',
  cancelText: 'Abbrechen'
})
let pickerTarget = null // { row, field }

// HYPOTHESE (spontane Set-Duplikate / "Daten werden zurückgesetzt"), NOCH NICHT BEWIESEN:
// NumberPicker.vue ist ein position:fixed Vollbild-Overlay (z-index 2000), das per v-if
// sofort aus dem DOM verschwindet, sobald der User im Header auf "OK" tippt. Auf iOS/
// WKWebView KANN das Antippen eines Elements, das sich genau in diesem Moment aus dem DOM
// entfernt, einen "Ghost Click" erzeugen: das echte Touch-Event schließt den Picker, ein
// nachgelagertes synthetisches click-Event trifft dann das Element, das an derselben
// Bildschirmposition jetzt sichtbar ist - z.B. den "+ Satz hinzufügen"-Button darunter.
// Bisher wurde ein Aufruf von addSetRow() gar nicht geloggt, weder bei echtem Tap noch bei
// Ghost-Click - die Log-Historie konnte diese Hypothese also NICHT bestätigen, nur ein
// zeitliches/inhaltliches Muster nahelegen (Duplikat mit identischen Werten kurz nach einer
// Picker-Bestätigung). lastPickerCloseAt + logSetRowTrigger() unten liefern jetzt beim
// nächsten Auftreten harte Daten: Zeitabstand zum Picker-Schluss und Klick-Koordinaten.
// Der Klick-Schluck-Fix unten ist eine sichere Absicherung gegen dieses bekannte
// Browser-Verhalten, unabhängig davon, ob er hier tatsächlich die Ursache war.
let pickerGhostClickGuardUntil = 0
let lastPickerCloseAt = 0
const PICKER_GHOST_CLICK_GUARD_MS = 400

function armPickerGhostClickGuard() {
  pickerGhostClickGuardUntil = Date.now() + PICKER_GHOST_CLICK_GUARD_MS
  lastPickerCloseAt = Date.now()
}

function swallowPickerGhostClick(event) {
  if (Date.now() >= pickerGhostClickGuardUntil) return
  pickerGhostClickGuardUntil = 0
  try {
    event.preventDefault()
    event.stopPropagation()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
  } catch {}
  logDiagnostic('ghost-click-swallowed', {
    target: event?.target?.tagName || null,
    className: event?.target?.className || null
  })
}

function shouldKeepAsDraft(workoutLike) {
  if (!workoutLike) return false
  const routeId = String(route.params.id || '')
  if (routeId === 'draft' || routeId.startsWith('draft-')) return true
  if (String(route.query?.created || '') === '1') return true
  // Favoriten-Start: Workout gilt immer als Draft-in-Progress bis der User explizit speichert.
  // Der Resume-Snapshot enthält favoriteStart=1 (BuilderFlow setzt es immer mit),
  // daher greift das auch nach App-Kill + Route-Restore ohne created=1.
  if (isFavoriteSourceRoute() && workoutLike.completed !== true) return true
  return workoutLike._isDraft === true || workoutLike.isDraft === true
}

function resolveRealIdFromDraftId(id) {
  return _resolveRealIdFromDraftId(id, route)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRealIdFromDraftId(id) {
  const idStr = String(id || '')
  if (!idStr.startsWith('draft-') && !idStr.startsWith('offline_')) return ''
  const realId = await resolveRealIdFromDraftId(id)
  if (realId) {
    logger.debug('[WorkoutDetail] realId gefunden', { draftId: id, realId })
  }
  return realId || ''
}

// function resolveActiveWorkoutUserId() {
//   return String(
//     workout.value?.userId
//     || getCurrentUser?.()?.uid
//     || store.user?.uid
//     || store.user?.id
//     || ''
//   ).trim()
// }

function resolveActiveWorkoutUserId() {
  const result = String(
    workout.value?.userId
    || getCurrentUser?.()?.uid
    || store.user?.uid
    || store.user?.id
    || ''
  ).trim()
  console.log('[DEBUG-UID] workout.value?.userId:', workout.value?.userId, 'getCurrentUser?.()?.uid:', getCurrentUser?.()?.uid, 'result:', result)
  return result
}

function clearActiveDraftForCurrentUser(reason = 'unknown') {
  const uid = resolveActiveWorkoutUserId()
  if (!uid) return false
  const cleared = clearActiveDraft(uid)
  if (cleared) {
    logger.debug('[WorkoutDetail] active draft cleared', { reason, uid })
  }
  return cleared
}

function parseUidFromToken(token = null) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  const parts = raw.split('.')
  if (parts.length < 2) return ''
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    const json = JSON.parse(decoded)
    return String(json?.user_id || json?.uid || json?.sub || '').trim()
  } catch {
    return ''
  }
}

async function resolveActiveWorkoutUserIdForSave() {
  const localUid = resolveActiveWorkoutUserId()
  if (localUid) return localUid
  const token = await getIdToken().catch(() => null)
  return parseUidFromToken(token)
}

function isFavoriteSourceRoute() {
  return String(route.query?.favoriteSource || '') === '1' || String(route.query?.favoriteStart || '') === '1'
}

function getFavoriteSourceMeta() {
  const favoriteId = String(route.query?.favoriteId || '').trim()
  if (!favoriteId) return null
  return {
    favoriteId,
    favoriteName: String(route.query?.favoriteName || '').trim(),
    favoriteType: normalizeWorkoutType(route.query?.favoriteType || workout.value?.type || route.query?.type || 'push')
  }
}

function getLastSetFromExercise(exercise = {}) {
  const sets = Array.isArray(exercise?.setDetails) ? exercise.setDetails : []
  if (sets.length) {
    const last = sets[sets.length - 1] || {}
    return {
      reps: Number(last?.reps) || 0,
      weight: Number(last?.weight) || 0,
      sets: sets.length,
      setDetails: sets.map((set) => ({ reps: Number(set?.reps) || 0, weight: Number(set?.weight) || 0, ...(set?.isWarmup ? { isWarmup: true } : {}) }))
    }
  }
  return {
    reps: Number(exercise?.reps) || 0,
    weight: Number(exercise?.weight) || 0,
    sets: Math.max(1, Number(exercise?.sets) || 1),
    setDetails: [{ reps: Number(exercise?.reps) || 0, weight: Number(exercise?.weight) || 0 }]
  }
}

function buildExerciseMatchKey(exercise = {}) {
  const byId = String(exercise?.exerciseId || exercise?._id || '').trim()
  if (byId) return `id:${byId}`
  const name = String(exercise?.name || '').trim().toLowerCase()
  const muscle = String(exercise?.muscleGroup || '').trim().toLowerCase()
  return `name:${name}|muscle:${muscle}`
}

function extractHistoryMatchKey(exercise = {}) {
  const byId = String(exercise?.exerciseId || exercise?._id || '').trim()
  const name = String(exercise?.name || '').trim().toLowerCase()
  const muscle = String(exercise?.muscleGroup || '').trim().toLowerCase()
  return {
    idKey: byId ? `id:${byId}` : '',
    nameKey: `name:${name}|muscle:${muscle}`,
    looseNameKey: `name:${name}`
  }
}

function applyFavoritePrefillFromHistory(targetExercise = {}, historyExercise = {}) {
  const perf = getLastSetFromExercise(historyExercise)
  const sourceSetDetails = Array.isArray(perf.setDetails) && perf.setDetails.length
    ? perf.setDetails
    : [{ reps: Math.max(1, perf.reps || 10), weight: Math.max(0, perf.weight || 0) }]

  const normalizedDetails = sourceSetDetails.map((set) => ({
    reps: Math.max(1, Number(set?.reps) || 10),
    weight: Math.max(0, Number(set?.weight) || 0),
    ...(set?.isWarmup ? { isWarmup: true } : {})
  }))

  targetExercise.setDetails = normalizedDetails
  targetExercise.sets = normalizedDetails.length
  targetExercise.reps = normalizedDetails[0]?.reps || targetExercise.reps || 10
  targetExercise.weight = normalizedDetails[0]?.weight || targetExercise.weight || 0

  return {
    reps: perf.reps,
    weight: perf.weight,
    sets: normalizedDetails.length
  }
}

async function maybePrefillFromLastFavoritePerformance() {
  if (!workout.value || favoritePrefillApplied.value) return
  if (!isFavoriteSourceRoute()) return
  // Beim Anpassen eines Favoriten (nur Template bearbeiten, kein echtes Workout starten)
  // darf kein History-Prefill laufen: der User will den gespeicherten Favorit-Stand sehen,
  // nicht die letzte gelebte Performance. Da favoriteAdjust-Saves kein Workout in die
  // History schreiben, würde der Prefill bei jedem erneuten Öffnen die Änderungen verdecken.
  if (String(route.query?.favoriteAdjust || '') === '1') {
    favoritePrefillApplied.value = true
    return
  }

  // Wenn das Template direkt vor diesem Start angepasst wurde, soll der erste Start
  // die Template-Daten verwenden – nicht die alte Performance-History.
  // Das Flag wird von performSaveWorkout (Favorit-Anpassen) einmalig gesetzt und hier konsumiert.
  const favoriteIdForFreshFlag = String(route.query?.favoriteId || '').trim()
  if (favoriteIdForFreshFlag) {
    const freshFlagKey = `fav_template_freshly_adjusted_${favoriteIdForFreshFlag}`
    try {
      if (localStorage.getItem(freshFlagKey) === '1') {
        localStorage.removeItem(freshFlagKey)
        favoritePrefillApplied.value = true
        return
      }
    } catch {}
  }

  // currentWorkoutId früh ermitteln, damit der localStorage-Key geprüft werden kann, bevor
  // wir die teuren History-Queries starten.
  const currentWorkoutId = String(workout.value?._id || route.params.id || '').trim()
  if (!currentWorkoutId) return
  // Überlebt einen iOS-Prozess-Kill: Flag wurde beim ersten Durchlauf in localStorage gesetzt.
  // Beim Wiederherstellen der Route durch tryRestoreLastRoute würde der Prefill sonst Änderungen
  // des Users (aus IndexedDB) mit alten Historienwerten überschreiben.
  const prefillStorageKey = `fav_prefill_applied_v1_${currentWorkoutId}`
  try {
    if (localStorage.getItem(prefillStorageKey) === '1') {
      favoritePrefillApplied.value = true
      return
    }
  } catch {}

  const activeUserId = resolveActiveWorkoutUserId()
  if (!activeUserId) return

  const history = await getAllWorkoutsOffline({ userId: activeUserId }).catch(() => [])
  if (!Array.isArray(history) || !history.length) {
    favoritePrefillApplied.value = true
    try { localStorage.setItem(prefillStorageKey, '1') } catch {}
    return
  }

  const dedupedHistory = new Map()
  history.forEach((entry) => {
    const idKey = String(entry?._id || '').trim()
    const fallbackKey = `${String(entry?.date || '').trim()}|${String(entry?.name || '').trim().toLowerCase()}|${String(entry?.type || '').trim().toLowerCase()}`
    const key = idKey || fallbackKey
    if (!key) return
    const existing = dedupedHistory.get(key)
    if (!existing) {
      dedupedHistory.set(key, entry)
      return
    }
    const existingTs = new Date(existing?.updatedAt || existing?.date || existing?.createdAt || 0).getTime()
    const nextTs = new Date(entry?.updatedAt || entry?.date || entry?.createdAt || 0).getTime()
    if (nextTs >= existingTs) dedupedHistory.set(key, entry)
  })

  const candidates = Array.from(dedupedHistory.values())
    .filter((w) => w && String(w?._id || '').trim() !== currentWorkoutId)
    .filter((w) => w?._isDraft !== true && w?.isDraft !== true)
    .filter((w) => w?.completed === true || w?.completed === undefined)
    .sort((a, b) => new Date(b?.updatedAt || b?.date || b?.createdAt || 0) - new Date(a?.updatedAt || a?.date || a?.createdAt || 0))

  if (!candidates.length || !Array.isArray(workout.value?.exercises)) return

  const hintMap = {}

  for (let i = 0; i < workout.value.exercises.length; i++) {
    const current = workout.value.exercises[i]
    const targetKey = buildExerciseMatchKey(current)
    const currentName = String(current?.name || '').trim().toLowerCase()
    if (!targetKey && !currentName) continue

    let matchedExercise = null
    for (const prevWorkout of candidates) {
      const prevExercises = Array.isArray(prevWorkout?.exercises) ? prevWorkout.exercises : []
      for (const prevExercise of prevExercises) {
        const keys = extractHistoryMatchKey(prevExercise)
        const strictNameKey = `name:${currentName}|muscle:${String(current?.muscleGroup || '').trim().toLowerCase()}`
        const isMatch =
          (targetKey && keys.idKey && targetKey === keys.idKey) ||
          (targetKey && targetKey.startsWith('name:') && targetKey === keys.nameKey) ||
          (currentName && keys.looseNameKey === `name:${currentName}`) ||
          (currentName && keys.nameKey === strictNameKey)
        if (!isMatch) continue
        const perf = getLastSetFromExercise(prevExercise)
        if ((Number(perf?.reps) || 0) <= 0 && (Number(perf?.weight) || 0) <= 0) continue
        matchedExercise = prevExercise
        break
      }
      if (matchedExercise) break
    }

    if (!matchedExercise) continue
    const applied = applyFavoritePrefillFromHistory(current, matchedExercise)
    hintMap[i] = applied
  }

  if (!Object.keys(hintMap).length) {
    favoritePrefillApplied.value = true
    try { localStorage.setItem(prefillStorageKey, '1') } catch {}
    return
  }

  favoriteLastPerformanceByIndex.value = hintMap
  ensureSetDetailsStructure()
  favoritePrefillApplied.value = true
  try { localStorage.setItem(prefillStorageKey, '1') } catch {}
  // KEIN triggerAutoSave() hier: die Prefill-Funktion schreibt historische Performance-Werte
  // als Hinweis ins Workout. Ein Auto-Save an dieser Stelle würde diese alten Werte in den
  // Server schreiben und mit einem kurz darauf folgenden manuellen Save racen – der letzte
  // Netzwerk-Request gewinnt, was zu falschen Stats führt.
  // Der User-gesteuerte Auto-Save (Input-Events) übernimmt die Persistenz wenn der User tippt.
}

async function syncStartedFavoriteFromWorkout(workoutLike = null) {
  if (!isFavoriteSourceRoute()) return
  const favoriteMeta = getFavoriteSourceMeta()
  if (!favoriteMeta?.favoriteId) return

  const source = workoutLike && typeof workoutLike === 'object' ? workoutLike : workout.value
  if (!source) return

  const payloadWorkout = {
    name: source.name,
    type: source.type,
    notes: buildWorkoutNotesSummary(source.exercises || []),
    exercises: (source.exercises || []).map((exercise) => ({
      _id: exercise._id || exercise.exerciseId || null,
      exerciseId: exercise.exerciseId || exercise._id || null,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      category: exercise.category || source.type,
      sets: Number(exercise.sets) || Number(exercise.setDetails?.length) || 3,
      reps: Number(exercise.reps) || Number(exercise.setDetails?.[0]?.reps) || 10,
      weight: Number(exercise.weight) || Number(exercise.setDetails?.[0]?.weight) || 0,
      rest: Number(exercise.rest) || 90,
      setDetails: Array.isArray(exercise.setDetails) && exercise.setDetails.length
        ? exercise.setDetails
        : [{
            reps: Number(exercise.reps) || 10,
            weight: Number(exercise.weight) || 0
          }]
    }))
  }

  updateFavoriteWorkout({
    userId: getFavoriteUserId(),
    type: favoriteMeta.favoriteType,
    id: favoriteMeta.favoriteId,
    name: favoriteMeta.favoriteName || '',
    workout: payloadWorkout
  })
}

const AUTO_SAVE_DEBOUNCE_MS = Number.parseInt(import.meta.env.VITE_WORKOUT_AUTOSAVE_DEBOUNCE_MS || '', 10) || 350
let autoSaveTimer = null
let autoSaveWaiters = []

function flushAutoSaveWaiters(result = false) {
  const waiters = [...autoSaveWaiters]
  autoSaveWaiters = []
  waiters.forEach((resolve) => {
    try { resolve(result) } catch {}
  })
}

function cancelPendingAutoSave(reason = 'unknown') {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
    logger.debug('[WorkoutDetail] pending auto-save abgebrochen', { reason })
  }
  flushAutoSaveWaiters(false)
}

function triggerAutoSave() {
  cancelPendingAutoSave('debounce-restart')
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    runAutoSaveNow().then((result) => {
      flushAutoSaveWaiters(result !== false)
    }).catch(() => {
      flushAutoSaveWaiters(false)
    })
  }, AUTO_SAVE_DEBOUNCE_MS)
}

async function runAutoSaveNow() {
  if (saving.value || suppressDraftPersistence.value) return
  if (isFavoriteAdjustMode.value) return
  const w = workout.value || {}
  const exercises = Array.isArray(w.exercises) && Array.isArray(exerciseNotes.value)
    ? w.exercises.map((ex, idx) => ({
        ...ex,
        note: typeof exerciseNotes.value[idx] === 'string' ? exerciseNotes.value[idx] : ex.note || ''
      }))
    : (w.exercises || [])
  const notes = buildWorkoutNotesSummary(exercises)

  const uid = resolveActiveWorkoutUserId()
  if (!uid) return

  // setActiveDraft() statt updateActiveDraft() nutzen: updateActiveDraft() ist ein
  // stiller No-Op, wenn noch kein Active-Draft-Eintrag existiert (z.B. ganz am Anfang
  // einer Session, bevor ein Lifecycle-Event wie App-Hintergrund den Eintrag erzeugt
  // hätte). Damit liefen normale Tipp-Autosaves bisher oft ins Leere.
  const existingActive = getActiveDraft(uid)
  let preservedEditingWorkoutId = existingActive?.editingWorkoutId ?? null
  if (!preservedEditingWorkoutId) {
    const routeId = String(route.params.id || '').trim()
    if (routeId && routeId !== 'draft' && !routeId.startsWith('draft-') && !routeId.startsWith('offline_')) {
      preservedEditingWorkoutId = routeId
    }
  }
  logDiagnostic('autosave', {
    exercises: exercises?.map(ex => ({ name: ex.name, setDetails: ex.setDetails })) || []
  })
  const ok = setActiveDraft(uid, {
    ...w,
    _id: w._id || String(route.params.id || ''),
    exercises,
    notes
  }, preservedEditingWorkoutId)

  if (ok) {
    saveMsg.value = ''
    saveError.value = false
    initialSnapshot = snapshotCore({ ...w, exercises, notes })
    logger.debug('[WorkoutDetail] Auto-Save active draft aktualisiert (setActiveDraft)')
  } else {
    logger.debug('[WorkoutDetail] Auto-Save fehlgeschlagen')
  }
}

function getViewStateWorkoutId() {
  const routeId = String(route.params.id || '').trim()
  const workoutId = String(workout.value?._id || '').trim()
  return workoutId || routeId
}

function readDetailViewState() {
  try {
    const raw = localStorage.getItem(WORKOUT_DETAIL_VIEW_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function writeDetailViewState(reason = 'unknown') {
  try {
    const workoutId = getViewStateWorkoutId()
    if (!workoutId) return
    const scrollY = typeof window !== 'undefined' ? Math.max(0, Math.round(window.scrollY || 0)) : 0
    const anchor = lastFieldAnchor.value && typeof lastFieldAnchor.value === 'object'
      ? {
          exIndex: Number(lastFieldAnchor.value.exIndex) || 0,
          setIndex: Number(lastFieldAnchor.value.setIndex) || 0,
          field: String(lastFieldAnchor.value.field || '')
        }
      : null

    localStorage.setItem(WORKOUT_DETAIL_VIEW_STATE_KEY, JSON.stringify({
      workoutId,
      scrollY,
      anchor,
      reason,
      timestamp: Date.now()
    }))
  } catch {}
}

function scheduleViewStatePersist(reason = 'unknown') {
  if (viewStatePersistTimer) clearTimeout(viewStatePersistTimer)
  viewStatePersistTimer = setTimeout(() => {
    writeDetailViewState(reason)
    viewStatePersistTimer = null
  }, 120)
}

function trackFieldAnchor(exIndex, setIndex, field) {
  lastFieldAnchor.value = {
    exIndex: Number(exIndex) || 0,
    setIndex: Number(setIndex) || 0,
    field: String(field || '')
  }
  scheduleViewStatePersist('field-anchor')
}

function restoreDetailViewState() {
  try {
    const state = readDetailViewState()
    if (!state) return
    const workoutId = getViewStateWorkoutId()
    if (!workoutId || String(state.workoutId || '') !== workoutId) return

    const scrollY = Number(state.scrollY || 0)
    if (typeof window !== 'undefined' && Number.isFinite(scrollY) && scrollY > 0) {
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' })
    }

    const anchor = state.anchor
    const field = String(anchor?.field || '')
    if (!anchor || (field !== 'reps' && field !== 'weight')) return

    const exIndex = Number(anchor.exIndex)
    const setIndex = Number(anchor.setIndex)
    if (!Number.isFinite(exIndex) || !Number.isFinite(setIndex)) return

    nextTick(() => {
      try {
        const selector = `[data-ex-index="${exIndex}"] [data-set-index="${setIndex}"] input[data-field="${field}"]`
        const input = typeof document !== 'undefined' ? document.querySelector(selector) : null
        if (!input || typeof input.focus !== 'function') return
        suppressNextPickerOpen = true
        input.focus({ preventScroll: true })
        // Flag nach kurzer Verzögerung zurücksetzen, falls der Fokus aus irgendeinem
        // Grund keinen Picker-Trigger auslöst (z.B. Desktop, kein Mobile-Picker aktiv)
        setTimeout(() => { suppressNextPickerOpen = false }, 300)
      } catch {}
    })
  } catch {}
}
// Initialisiere Notiz-Arrays, wenn Workout geladen wird
watch(workout, (w) => {
  if (w && Array.isArray(w.exercises)) {
    showNote.value = w.exercises.map(ex => !!ex.note)
    exerciseNotes.value = w.exercises.map(ex => typeof ex.note === 'string' ? ex.note : '')
  }
})

// Auto-Save wird in vielen Funktionen aufgerufen (Inputs, Notizen, Reihenfolge)

const toggleNote = (idx) => {
  showNote.value[idx] = !showNote.value[idx]
}
const getNote = (idx) => {
  return (exerciseNotes.value && typeof exerciseNotes.value[idx] !== 'undefined') ? exerciseNotes.value[idx] : ''
}
const setNote = (idx, val) => {
  if (exerciseNotes.value) exerciseNotes.value[idx] = val
  try { triggerAutoSave() } catch {}
}

function deleteNote(idx) {
  if (exerciseNotes.value) exerciseNotes.value[idx] = ''
  if (showNote.value) showNote.value[idx] = false
  try { triggerAutoSave() } catch {}
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
    return d.toLocaleString(loc)
  } catch {
    return String(dateStr)
  }
}

function getWorkoutTimestamp(workoutLike) {
  if (!workoutLike || typeof workoutLike !== 'object') return 0
  const updatedAt = new Date(workoutLike.updatedAt || 0).getTime()
  if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt
  const date = new Date(workoutLike.date || 0).getTime()
  if (Number.isFinite(date) && date > 0) return date
  const createdAt = new Date(workoutLike.createdAt || 0).getTime()
  if (Number.isFinite(createdAt) && createdAt > 0) return createdAt
  return 0
}

function pickPreferredLocalWorkout(storeWorkout, offlineWorkout) {
  if (!storeWorkout) return offlineWorkout || null
  if (!offlineWorkout) return storeWorkout || null

  const storeIsDraft = storeWorkout?._isDraft === true || storeWorkout?.isDraft === true
  const offlineIsDraft = offlineWorkout?._isDraft === true || offlineWorkout?.isDraft === true

  // If one side is explicitly draft and the other isn't, keep the draft to avoid data loss.
  if (offlineIsDraft !== storeIsDraft) {
    return offlineIsDraft ? offlineWorkout : storeWorkout
  }

  const storeTs = getWorkoutTimestamp(storeWorkout)
  const offlineTs = getWorkoutTimestamp(offlineWorkout)
  return offlineTs >= storeTs ? offlineWorkout : storeWorkout
}

async function loadNewDraftWorkout() {
  let draft = null
  let editingWorkoutId = null

  const uid = resolveActiveWorkoutUserId()
  const active = uid ? getActiveDraft(uid) : null
  if (active?.workout) {
    draft = active.workout
    editingWorkoutId = active.editingWorkoutId || null
  }

  if (!draft) {
    draft = await getWorkoutOffline('draft')
  }

  logger.debug('[WorkoutDetail] new draft lookup', {
    uid: uid || null,
    source: active?.workout ? 'active-workout-draft' : (draft ? 'offline-fallback' : 'none'),
    found: !!draft,
    hasExercises: Array.isArray(draft && draft.exercises)
  })

  let loadedWorkout = null
  if (draft && draft.exercises && (draft.type || route.query.type)) {
    const allExercises = await getAllExercisesOffline({})
    const merged = draft.exercises.map(draftEx => {
      let dbEx = allExercises.find(e => e._id === draftEx._id)
      if (!dbEx) {
        const name = String(draftEx.name || '').trim().toLowerCase()
        const mg = String(draftEx.muscleGroup || '').trim().toLowerCase()
        dbEx = allExercises.find(e =>
          String(e.name || '').trim().toLowerCase() === name &&
          String(e.muscleGroup || '').trim().toLowerCase() === mg
        )
      }
      if (!dbEx) {
        const name = String(draftEx.name || '').trim().toLowerCase()
        dbEx = allExercises.find(e => String(e.name || '').trim().toLowerCase() === name)
      }
      return {
        ...(dbEx || {}),
        ...draftEx,
        setDetails: Array.isArray(draftEx.setDetails)
          ? draftEx.setDetails.map(s => ({
              reps: s.reps,
              weight: s.weight,
              ...(s.isWarmup ? { isWarmup: true } : {})
            }))
          : []
      }
    })
    const type = draft.type || route.query.type || null
    loadedWorkout = { ...draft, type, exercises: merged }
  } else {
    const type = (draft && draft.type) || route.query.type || null
    loadedWorkout = draft ? { ...draft, type } : { _id: 'draft', type, exercises: [] }
  }

  return { workout: loadedWorkout, editingWorkoutId }
}

async function loadLocalWorkout(id) {
  let loadedWorkout = null
  let editingWorkoutId = null

  const activeUid = resolveActiveWorkoutUserId()

  if (activeUid) {
    const active = getActiveDraft(activeUid)
    const activeWorkoutId = String(active?.workout?._id || active?.editingWorkoutId || '').trim()
    if (active?.workout && (activeWorkoutId === String(id) || active?.editingWorkoutId === id)) {
      logger.debug('[WorkoutDetail] gefunden im Active-Draft-Speicher', { id })
      return { workout: active.workout, editingWorkoutId: active.editingWorkoutId || null, source: 'active-draft-by-uid' }
    }
  }

  // Fallback ohne uid-Abhängigkeit: siehe Kommentar bei findActiveDraftByWorkoutId(). Schützt
  // gegen einen App-Kaltstart, bei dem resolveActiveWorkoutUserId() (Firebase-Auth/User-Store
  // noch nicht hydriert) kurzzeitig leer ist und der obige uid-Check dadurch übersprungen wird.
  const byIdMatch = findActiveDraftByWorkoutId(id)
  if (byIdMatch?.draft?.workout) {
    logger.debug('[WorkoutDetail] gefunden im Active-Draft-Speicher (id-fallback, uid war leer/anders)', { id, uid: byIdMatch.uid, activeUid })
    logDiagnostic('active-draft-id-fallback-hit', { id, uid: byIdMatch.uid, activeUidAtLookup: activeUid || null })
    return { workout: byIdMatch.draft.workout, editingWorkoutId: byIdMatch.draft.editingWorkoutId || null, source: 'active-draft-by-id-fallback' }
  }

  const fromStore = store.workouts.find(w => w._id === id) || null
  const fromOffline = await getWorkoutOffline(id).catch(() => null)
  loadedWorkout = pickPreferredLocalWorkout(fromStore, fromOffline)

  logger.debug('[WorkoutDetail] local lookup', {
    id,
    fromStore: !!fromStore,
    fromOffline: !!fromOffline,
    found: !!loadedWorkout
  })

  if (!loadedWorkout) {
    logger.warn('[WorkoutDetail] local workout unresolved', {
      id,
      query: { ...route.query },
      storeCount: Array.isArray(store.workouts) ? store.workouts.length : 0
    })
  }

  return { workout: loadedWorkout, editingWorkoutId, source: fromStore || fromOffline ? 'store-or-offline-fallback' : 'not-found' }
}

async function loadServerWorkout(id) {

  // Active-Draft-Speicher zuerst prüfen: hier landet der aktuellste Stand aus
  // laufenden Auto-Saves (triggerAutoSave/persistActiveDraft), der noch nicht
  // zwingend in Store/IndexedDB durchgeschrieben wurde. Ohne diesen Check als
  // ERSTE Prüfung verliert der User Fortschritt, wenn die App neu startet
  // (iOS-Prozess-Kill) und loadWorkout() den alten Server-/Cache-Stand lädt.
  const activeUid = resolveActiveWorkoutUserId()
  if (activeUid) {
    const active = getActiveDraft(activeUid)
    const activeWorkoutId = String(active?.workout?._id || active?.editingWorkoutId || '').trim()
    if (active?.workout && (activeWorkoutId === String(id) || active?.editingWorkoutId === id)) {
      logger.debug('[WorkoutDetail] gefunden im Active-Draft-Speicher (server-path)', { id })
      return { workout: active.workout, editingWorkoutId: active.editingWorkoutId || null, source: 'active-draft-by-uid' }
    }
  }

  // Fallback ohne uid-Abhängigkeit (siehe findActiveDraftByWorkoutId): fängt den Fall ab, dass
  // resolveActiveWorkoutUserId() bei einem App-Kaltstart kurzzeitig leer ist, weil Firebase-Auth
  // /User-Store noch nicht hydriert sind.
  const byIdMatchServer = findActiveDraftByWorkoutId(id)
  if (byIdMatchServer?.draft?.workout) {
    logger.debug('[WorkoutDetail] gefunden im Active-Draft-Speicher (server-path, id-fallback)', { id, uid: byIdMatchServer.uid, activeUid })
    logDiagnostic('active-draft-id-fallback-hit', { id, uid: byIdMatchServer.uid, activeUidAtLookup: activeUid || null, path: 'server' })
    return { workout: byIdMatchServer.draft.workout, editingWorkoutId: byIdMatchServer.draft.editingWorkoutId || null, source: 'active-draft-by-id-fallback' }
  }

  const normalFromStore = store.workouts.find(w => w._id === id) || null
  const normalFromOffline = await getWorkoutOffline(id).catch(() => null)
  let loadedWorkout = pickPreferredLocalWorkout(normalFromStore, normalFromOffline)

  logger.debug('[WorkoutDetail] server lookup', {
    id,
    fromStore: !!normalFromStore,
    fromOffline: !!normalFromOffline,
    found: !!loadedWorkout
  })

  if (!loadedWorkout) {
    const token = await getIdToken().catch(() => null)
    loadedWorkout = await fetchWorkout(id, token).catch(() => null)
    logger.debug('[WorkoutDetail] server api fallback', {
      id,
      hasToken: !!token,
      found: !!loadedWorkout
    })
  }

  if (!loadedWorkout) {
    logger.warn('[WorkoutDetail] server workout unresolved after all fallbacks', {
      id,
      query: { ...route.query },
      storeCount: Array.isArray(store.workouts) ? store.workouts.length : 0
    })
  }

  if (loadedWorkout && shouldKeepAsDraft(loadedWorkout) && loadedWorkout.completed !== true) {
    loadedWorkout._isDraft = true
    loadedWorkout.isDraft = true
    try {
      await saveWorkoutOffline({
        ...loadedWorkout,
        _id: loadedWorkout._id || id,
        userId: resolveActiveWorkoutUserId(),
        _isDraft: true,
        isDraft: true,
        updatedAt: Date.now()
      })
    } catch {}
    try {
      const idx = store.workouts.findIndex(
        w => String(w && w._id || '') === String(loadedWorkout && loadedWorkout._id || id)
      )
      if (idx !== -1) {
        store.workouts[idx] = {
          ...store.workouts[idx],
          _isDraft: true,
          isDraft: true,
          completed: false
        }
      }
    } catch {}
  }

  return { workout: loadedWorkout, editingWorkoutId: id }
}

async function loadWorkout() {
  loading.value = true
  error.value = ''
  const requestedId = String(route.params.id || '')
  logDiagnostic('load-start', {
    requestedId,
    fullPath: route.fullPath,
    query: { ...route.query },
    componentUid: getCurrentInstance()?.uid
  })
  // const requestedId = String(route.params.id || '')
  try {
    const id = requestedId
    logger.debug('[WorkoutDetail] loadWorkout start', {
      id,
      routeName: route.name,
      query: { ...route.query }
    })

    if (route.query.created === '1') {
      toast.show(t('dashboard.successCreated'), { type: 'success', duration: 3000 })
    }

    let result
    if (id === 'draft') {
      result = await loadNewDraftWorkout()
    } else if (String(id).startsWith('draft-') || String(id).startsWith('offline_')) {
      result = await loadLocalWorkout(id)
    } else {
      result = await loadServerWorkout(id)
    }

    // Guard gegen veraltete, spät ankommende Ladevorgänge: Falls sich route.params.id
    // während des asynchronen Ladens geändert hat (z.B. User hat währenddessen zu einem
    // anderen Workout navigiert, oder ein zweiter loadWorkout()-Aufruf lief parallel),
    // diesen Ladevorgang verwerfen statt workout.value mit falschen Daten zu überschreiben.
    const currentRouteId = String(route.params.id || '')
    if (currentRouteId !== requestedId) {
      logger.warn('[WorkoutDetail] loadWorkout verworfen – route.params.id hat sich während des Ladens geändert', {
        requestedId,
        currentRouteId
      })
      return
    }

    const loadedWorkout = result.workout
    const editingWorkoutId = result.editingWorkoutId

    // Zusätzliche Absicherung: Falls das geladene Workout selbst eine _id trägt, die
    // weder der angeforderten Route-ID noch der aufgelösten editingWorkoutId entspricht,
    // ebenfalls verwerfen – schützt vor falsch zugeordneten Datensätzen aus Store/Cache.
    const loadedId = String(loadedWorkout?._id || '').trim()
    if (loadedWorkout && loadedId && loadedId !== requestedId && loadedId !== String(editingWorkoutId || '')) {
      logger.warn('[WorkoutDetail] loadWorkout verworfen – geladenes Workout hat unerwartete ID', {
        requestedId,
        loadedId,
        editingWorkoutId
      })
      return
    }

    logDiagnostic('load-before-assign', {
      requestedId,
      currentRouteId: String(route.params.id || ''),
      loadedWorkoutId: loadedWorkout?._id || null,
      source: result.source || null,
      activeUidAtLoad: resolveActiveWorkoutUserId() || null,
      loadedExercises: loadedWorkout?.exercises?.map(ex => ({ name: ex.name, setDetails: ex.setDetails })) || []
    })

    // HÄRTUNG gegen stille Fremd-Mutation: loadLocalWorkout()/loadServerWorkout() können
    // eine Objekt-REFERENZ aus store.workouts (Pinia) oder dem Active-Draft direkt
    // zurückgeben statt einer Kopie. Wird dieselbe Referenz später von anderem Code
    // in-place mutiert (z.B. Sync-Reconciliation nach Offline->Online-Wechsel, oder ein
    // paralleler loadWorkout()-Aufruf), würde sich workout.value MITÄNDERN, ohne dass
    // hier irgendein Code das ausgelöst hätte - für den User sieht das wie ein
    // spontaner Datenverlust/-reset aus. Deep-Clone entkoppelt den reaktiven Formular-
    // State zuverlässig von allen anderen Referenzen auf dasselbe Objekt.
    workout.value = loadedWorkout && typeof structuredClone === 'function'
      ? structuredClone(loadedWorkout)
      : loadedWorkout
        ? JSON.parse(JSON.stringify(loadedWorkout))
        : loadedWorkout

    if (workout.value) {
      ensureSetDetailsStructure()
      await enrichExerciseImages()

      if (shouldKeepAsDraft(workout.value) && workout.value.completed !== true) {
        const uid = resolveActiveWorkoutUserId()
        if (uid) {
          // Bisher unprotokollierter Schreibpfad: schreibt den GERADE GELADENEN Stand direkt in
          // den Active-Draft zurück. Kam der Ladevorgang über den store/offline-Fallback statt
          // aus dem Active-Draft selbst (source !== 'active-draft-by-*'), überschreibt dieser aus
          // Versehen einen ggf. neueren Draft mit einem veralteten Stand - das ist der Schreib-
          // vorgang, der bisher unsichtbar im Log war. draft-write-source macht ihn sichtbar.
          logDiagnostic('draft-write-source', {
            source: result.source || null,
            exercises: workout.value.exercises?.map(ex => ({ name: ex.name, setDetails: ex.setDetails })) || []
          })
          setActiveDraft(uid, workout.value, editingWorkoutId)
        }
      }

      initialSnapshot = snapshotCore(workout.value)
    }
  } catch (e) {
    logger.error('Workout laden fehlgeschlagen:', e)
    error.value = (e && e.message) || 'Unbekannter Fehler'
  } finally {
    loading.value = false
  }
}

async function enrichExerciseImages() {
  try {
    const list = workout.value?.exercises || []
    for (let idx = 0; idx < list.length; idx++) {
      const ex = list[idx]
      if (!ex.exerciseId) continue
      try {
        const full = await getExerciseOffline(ex.exerciseId)
        if (full?.imageUrl || full?.thumbnailUrl || full?.thumbnailStaticUrl) {
          ex.imageUrl = full.imageUrl
          ex.thumbnailUrl = full.thumbnailUrl
          ex.thumbnailStaticUrl = full.thumbnailStaticUrl
        }
      } catch {}
    }
  } catch {}
}

function getExerciseImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? resolveServerMediaUrl(ex.imageUrl) : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '' : imageUrl
  const direct = ex?.thumbnailStaticUrl || ex?.thumbnailUrl || safeImage
  if (direct) return direct
  const nameKey = String(ex?.name || '').trim().toLowerCase()
  const mapped = nameKey ? defaultExerciseByName.value.get(nameKey) : null
  const mappedImage = typeof mapped?.imageUrl === 'string' && /\.gif($|[?#])/i.test(mapped.imageUrl) ? '' : mapped?.imageUrl
  return mapped?.thumbnailStaticUrl || mapped?.thumbnailUrl || mappedImage || '/exercises/play.svg'
}

function getExerciseLargeImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? resolveServerMediaUrl(ex.imageUrl) : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '': imageUrl
  const direct = safeImage || ex?.thumbnailUrl
  if (direct) return direct
  const nameKey = String(ex?.name || '').trim().toLowerCase()
  const mapped = nameKey ? defaultExerciseByName.value.get(nameKey) : null
  const mappedImage = typeof mapped?.imageUrl === 'string' && /\.gif($|[?#])/i.test(mapped.imageUrl) ? '' : mapped?.imageUrl
  return mappedImage || mapped?.thumbnailUrl || '/exercises/play.svg'
}

function openExerciseMedia(exercise) {
  if (!exercise || isReordering.value) return
  const requestId = ++mediaRequestId.value
  const nameKey = String(exercise?.name || '').trim().toLowerCase()
  const mapped = nameKey ? defaultExerciseByName.value.get(nameKey) : null
  const source = mapped ? Object.fromEntries(
    Object.entries({ ...mapped, ...exercise }).filter(([, value]) => value != null && value !== '')
  ) : exercise
  mediaExercise.value = source
  const fallbackMp4 = buildExerciseMediaUrl(source, 360, 'mp4')
  mediaUrl.value = fallbackMp4 || getExerciseLargeImage(source)
  resolveExerciseMedia(source, {
    size: 360,
    fallbackUrl: mediaUrl.value,
    onResolved: (url) => {
      if (mediaExercise.value && mediaRequestId.value === requestId) {
        mediaUrl.value = url
      }
    }
  }).catch(() => {})
}

function closeExerciseMedia() {
  mediaExercise.value = null
  mediaUrl.value = ''
}

function onImgError(evt) {
  const img = evt?.target
  if (!img) return
  if (img.src.includes('play.svg')) {
    img.onerror = null
    return
  }
  img.onerror = null
  img.src = '/exercises/play.svg'
}

function scrollToExercises() {
  const el = exListRef.value || document.getElementById('exercises')
  if (!el) return
  const headerOffset = 72
  try {
    const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  } catch {}
}

function openPicker(row, field, step = 1, min = 0, max = 1000, title = '') {
  logDiagnostic('picker-open', { field, currentValue: row?.[field], suppressed: suppressNextPickerOpen })
  if (suppressNextPickerOpen) {
    suppressNextPickerOpen = false
    return
  }
  // Only show the picker on mobile
  if (!isMobile.value) return
  pickerTarget = { row, field }
  pickerConfig.step = step
  pickerConfig.min = min
  pickerConfig.max = max
  pickerConfig.splitDecimals = field === 'weight'
  pickerConfig.decimalOptions = pickerConfig.splitDecimals ? [0, 0.25, 0.5, 0.75] : [0]
  pickerConfig.title = title || (field === 'weight' ? 'Gewicht (kg)' : 'Wiederholungen')
  pickerValue.value = Number(row[field]) || 0
  pickerVisible.value = true
}

function onPickerConfirm(val) {
  armPickerGhostClickGuard()
  if (!pickerTarget) { pickerVisible.value = false; return }
  const { row, field } = pickerTarget
  row[field] = val
  try { triggerAutoSave() } catch {}
  pickerVisible.value = false
  pickerTarget = null
}

function onPickerCancel() {
  armPickerGhostClickGuard()
  pickerVisible.value = false
  pickerTarget = null
}

function goToPostWorkoutSummary(workoutId) {
  const id = String(workoutId || '').trim()
  logger.info('[WorkoutDetail] goToPostWorkoutSummary called', { workoutId, id })
  if (!id) {
    logger.warn('[WorkoutDetail] No workoutId, redirecting to dashboard')
    router.push('/dashboard')
    return
  }
  logger.info('[WorkoutDetail] Navigating to stats with postWorkout=1', { id })
  router.push({
    name: 'stats',
    query: {
      postWorkout: '1',
      workoutId: id
    }
  })
}

function shouldAutoScroll() {
  return route.query.created === '1' || route.query.focus === 'exercises' || route.hash === '#exercises'
}

async function discardDraftAndLeave() {
  // Suppress MUSS ganz oben stehen, BEVOR router.push und onBeforeRouteLeave feuert!
  // Sonst ruft onBeforeRouteLeave persistInProgressDraft() auf und speichert das Workout
  // als Draft, obwohl der Benutzer "Abbrechen" geklickt hat (BUG: Cancel speichert statt zu canceln)
  suppressDraftPersistence.value = true

  // Sicherheitsnetz: Falls die Navigation aus irgendeinem Grund nicht durchläuft
  // (z.B. Router-Guard bricht ab, Promise wird nie aufgelöst), Suppress nach
  // kurzer Zeit automatisch zurücksetzen, statt die App für den Rest der
  // Session lautlos vom Speichern zu blockieren.
  const safetyResetTimer = setTimeout(() => {
    suppressDraftPersistence.value = false
    logDiagnostic('suppress-safety-reset', { reason: 'discardDraftAndLeave-timeout' })
  }, 3000)

  clearActiveDraftForCurrentUser('discard-draft-leave')
  clearAllDetailDraftSnapshots()
  clearAllWorkoutMapKeys()
  const routeId = String(route.params.id || '')
  if (routeId.startsWith('draft-') || routeId.startsWith('offline_')) {
    await purgePendingCreateQueueForWorkoutId(routeId)
    try { await db.workouts.delete(routeId) } catch {}
    try {
      const idx = store.workouts.findIndex(w => String(w?._id || '') === routeId)
      if (idx !== -1) store.workouts.splice(idx, 1)
    } catch {}
    // Wenn ein draft-* bereits eine echte Server-ID hat, diese ebenfalls löschen
    try {
      const mappedReal = await resolveRealIdFromDraftId(routeId)
      if (mappedReal) {
        const tk = await getIdToken().catch(() => null)
        deleteWorkoutApi(mappedReal, tk).catch(() => null)
        try {
          const midx = store.workouts.findIndex(w => String(w?._id || '') === mappedReal)
          if (midx !== -1) store.workouts.splice(midx, 1)
        } catch {}
      }
    } catch {}
  } else if (routeId && !isFavoriteAdjustMode.value) {
    // Echte MongoDB-ID nur löschen wenn es ein frisch erstelltes, noch nicht abgeschlossenes Workout
    // ist (z. B. Background-Create aus WorkoutBuilder lief durch, User cancelt danach).
    // Ein bereits abgeschlossenes Workout (completed=true) wird NICHT gelöscht – der User hat
    // lediglich Änderungen verworfen, der ursprüngliche Datensatz auf dem Server bleibt erhalten.
    const isOrphanNewWorkout =
      workout.value?.completed !== true &&
      (String(route.query?.created || '') === '1' ||
        workout.value?._isDraft === true ||
        workout.value?.isDraft === true)
    if (isOrphanNewWorkout) {
      try {
        const tk = await getIdToken().catch(() => null)
        deleteWorkoutApi(routeId, tk).catch(() => null)
      } catch {}
      try {
        const idx = store.workouts.findIndex(w => String(w?._id || '') === routeId)
        if (idx !== -1) store.workouts.splice(idx, 1)
      } catch {}
      try { await db.workouts.delete(routeId) } catch {}
    }
  }
  timerStore.reset()
  bypassTimerLeaveGuard.value = true
  await router.push('/dashboard')
  clearTimeout(safetyResetTimer)
}

function goDashboard() {
  // Im Adjust-Modus: Timer-Guard entfällt, aber bei ungespeicherten Änderungen
  // Bestätigungsdialog zeigen. bypassTimerLeaveGuard NICHT setzen,
  // damit onBeforeRouteLeave den Draft-Cleanup übernimmt.
  if (isFavoriteAdjustMode.value) {
    if (isDirty.value) {
      showLeaveModal.value = true
      return
    }
    router.push('/dashboard')
    return
  }
  if (isDirty.value) {
    showLeaveModal.value = true
    return
  }
  // if (timerStore.isRunningLike) {
  //   pendingTimerAction.value = { kind: 'dashboard' }
  //   showTimerActionModal.value = true
  //   return
  // }
  discardDraftAndLeave()
}

function confirmLeave() {
  // Im Adjust-Modus: bypassTimerLeaveGuard NICHT setzen, sonst überspringt
  // onBeforeRouteLeave den Draft-Cleanup. Nur suppress setzen und navigieren.
  if (isFavoriteAdjustMode.value) {
    suppressDraftPersistence.value = true
    router.push('/dashboard')
    return
  }
  // if (timerStore.isRunningLike) {
  //   pendingTimerAction.value = { kind: 'dashboard' }
  //   showTimerActionModal.value = true
  //   return
  // }
  discardDraftAndLeave()
}

async function applyPendingTimerAction() {
  const action = pendingTimerAction.value
  pendingTimerAction.value = null
  if (!action) return

  if (action.kind === 'save') {
    await performSaveWorkout()
    return
  }

  if (action.kind === 'dashboard') {
    await discardDraftAndLeave()
    return
  }

  if (action.kind === 'route-leave' && action.targetPath) {
    bypassTimerLeaveGuard.value = true
    router.push(action.targetPath)
  }
}

async function onTimerDecision(mode) {
  if (mode === 'continue') {
    // "Weiterlaufen": Aktion abbrechen, Training fortsetzen
    pendingTimerAction.value = null
    showTimerActionModal.value = false
    return
  }
  if (mode === 'pause' && timerStore.isRunning) {
    timerStore.pause()
  } else if (mode === 'stop') {
    timerStore.reset()
  }

  showTimerActionModal.value = false
  await applyPendingTimerAction()
}


function toggleReorder() { isReordering.value = !isReordering.value }

function askRemoveExercise(exIndex) {
  pendingRemoveExerciseIndex.value = exIndex
  showRemoveExerciseModal.value = true
}

function confirmRemoveExercise() {
  removeExercise(pendingRemoveExerciseIndex.value)
  pendingRemoveExerciseIndex.value = -1
}

function askDeleteNote(idx) {
  pendingDeleteNoteIndex.value = idx
  showDeleteNoteModal.value = true
}

function confirmDeleteNote() {
  deleteNote(pendingDeleteNoteIndex.value)
  pendingDeleteNoteIndex.value = -1
}

function removeExercise(exIndex) {
  if (!workout.value?.exercises || !Array.isArray(workout.value.exercises)) return
  if (exIndex < 0 || exIndex >= workout.value.exercises.length) return

  workout.value.exercises.splice(exIndex, 1)
  if (Array.isArray(showNote.value)) showNote.value.splice(exIndex, 1)
  if (Array.isArray(exerciseNotes.value)) exerciseNotes.value.splice(exIndex, 1)

  try { triggerAutoSave() } catch {}
  toast.show('Übung entfernt', { type: 'success', duration: 1500 })
}

function ensureSetDetailsStructure() {
  if (!workout.value || !Array.isArray(workout.value.exercises)) return
  workout.value.exercises = workout.value.exercises.map(ex => {
    const sets = Array.isArray(ex.setDetails) && ex.setDetails.length > 0
      ? ex.setDetails
      : []
    return { ...ex, setDetails: sets }
  })
}

// Returns display label for a set row, e.g. "W1", "W2", "1", "2"
function getSetLabel(setDetails, rIdx) {
  let warmupCount = 0
  let workingCount = 0
  for (let i = 0; i <= rIdx; i++) {
    if (setDetails[i]?.isWarmup) warmupCount++
    else workingCount++
  }
  return setDetails[rIdx]?.isWarmup ? `W${warmupCount}` : `${workingCount}`
}

// Protokolliert JEDEN Aufruf von addSetRow/addWarmupSetRow mit Beweis-Metadaten (statt wie
// bisher gar nicht), damit sich beim nächsten Auftreten des Duplikat-Bugs eindeutig klären
// lässt, WER/WAS den Aufruf ausgelöst hat: msSincePickerClose zeigt, wie kurz nach einem
// Picker-Schließen der Klick kam (Ghost-Click-Verdacht bei sehr kleinen Werten); x/y sind die
// Klick-Koordinaten (zusammen mit der Button-Position im DOM überprüfbar, ob sie zur vorherigen
// Picker-Position passen); isTrusted ist bei echten Nutzer-Klicks immer true (unterscheidet
// also NICHT zwischen "echter Tap" und "Ghost-Click", da beide vom Browser als trusted gelten -
// aber schließt zumindest synthetische/programmatische Auslöser aus).
function logSetRowTrigger(kind, exIndex, event) {
  logDiagnostic('set-row-add-trigger', {
    kind,
    exIndex,
    msSincePickerClose: lastPickerCloseAt ? Date.now() - lastPickerCloseAt : null,
    x: event?.clientX ?? null,
    y: event?.clientY ?? null,
    isTrusted: event?.isTrusted ?? null
  })
}

function addSetRow(exIndex, event = null) {
  logSetRowTrigger('working', exIndex, event)
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex) return
  if (!Array.isArray(ex.setDetails)) ex.setDetails = []
  const lastWorking = [...ex.setDetails].reverse().find(s => !s.isWarmup)
  ex.setDetails.push({ reps: lastWorking?.reps || 10, weight: lastWorking?.weight || 0, isWarmup: false })
  try { triggerAutoSave() } catch {}
}

function addWarmupSetRow(exIndex, event = null) {
  logSetRowTrigger('warmup', exIndex, event)
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex) return
  if (!Array.isArray(ex.setDetails)) ex.setDetails = []
  // Insert after last existing warmup set
  const lastWarmupIdx = ex.setDetails.map((s, i) => s.isWarmup ? i : -1).filter(i => i >= 0).at(-1) ?? -1
  const prevWarmup = lastWarmupIdx >= 0 ? ex.setDetails[lastWarmupIdx] : null
  ex.setDetails.splice(lastWarmupIdx + 1, 0, { reps: prevWarmup?.reps || 10, weight: prevWarmup?.weight || 0, isWarmup: true })
  try { triggerAutoSave() } catch {}
}

function removeSetRow(exIndex, rowIndex) {
  const ex = workout.value?.exercises?.[exIndex]
  if (!ex || !Array.isArray(ex.setDetails)) return
  const row = ex.setDetails[rowIndex]
  if (row?.isWarmup) {
    const warmupCount = ex.setDetails.filter(s => s.isWarmup).length
    if (warmupCount <= 1) return // keep minimum 1 warmup
  } else {
    const workingCount = ex.setDetails.filter(s => !s.isWarmup).length
    if (workingCount <= 1) return // keep minimum 1 working set
  }
  ex.setDetails.splice(rowIndex, 1)
  logger.debug('removeSetRow', 'exIndex:', exIndex, 'rowIndex:', rowIndex, 'remaining:', ex.setDetails.length)
  try { triggerAutoSave() } catch {}
}

// Wheel / Keyboard support and clamping for numeric inputs
function onNumberWheel(e, row, field, step = 1, min = -Infinity, max = Infinity) {
  try {
    // deltaY < 0 means wheel up (increase)
    const dir = e.deltaY < 0 ? 1 : -1
    const cur = Number(row[field]) || 0
    let next = cur + dir * step
    // snap to step
    next = Math.round(next / step) * step
    // clamp
    next = Math.min(max, Math.max(min, next))
    // fix float precision for fractional steps
    if (step < 1) next = Number(next.toFixed(3))
    row[field] = next
    try { triggerAutoSave() } catch {}
  } catch (err) {
    logger.warn('onNumberWheel error', err)
  }
}

function onNumberKeyDown(e, allowDecimal = false) {
  // allow navigation and control keys
  const allowed = ['Backspace','Tab','Enter','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Home','End']
  if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return

  // allow decimal separator if permitted
  if ((e.key === '.' || e.key === ',') && allowDecimal) {
    // translate comma to dot
    if (e.key === ',') {
      e.preventDefault()
      const el = e.target
      const pos = el.selectionStart || 0
      const val = el.value || ''
      el.value = val.slice(0, pos) + '.' + val.slice(pos)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return
  }

  // arrow up/down: increment/decrement by step
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const el = e.target
    const step = Number(el.step) || 1
    const min = Number(el.min) || -Infinity
    const max = Number(el.max) || Infinity
    const current = Number(el.value) || 0
    const dir = e.key === 'ArrowUp' ? 1 : -1
    let next = current + dir * step
    if (step < 1) next = Number((Math.round(next / step) * step).toFixed(3))
    next = Math.min(max, Math.max(min, next))
    el.value = next
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  // allow digits only otherwise
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault()
  }
}

function clampRowValue(row, field, min = -Infinity, max = Infinity, step = 1) {
  try {
    let val = Number(row[field])
    if (!Number.isFinite(val)) val = min
    if (val < min) val = min
    if (val > max) val = max
    if (step && step > 0) {
      val = Math.round(val / step) * step
      if (step < 1) {
        const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
        val = Number(val.toFixed(decimals + 1))
      }
    }
    row[field] = val
  } catch (err) {
    logger.warn('clampRowValue error', err)
  }
}

// Wie clampRowValue, aber leeres Feld ('' / NaN) wird als null gespeichert statt auf min geclampt.
// Für Reps-Felder in Arbeitssätzen, die bewusst leer gelassen werden können.
function clampRowValueNullable(row, field, min = 0, max = Infinity, step = 1) {
  try {
    const raw = row[field]
    if (raw === '' || raw == null || !Number.isFinite(Number(raw))) {
      row[field] = null
      return
    }
    clampRowValue(row, field, min, max, step)
  } catch (err) {
    logger.warn('clampRowValueNullable error', err)
  }
}

// Eine Satz-Zeile gilt als leer, wenn Reps nicht gesetzt UND Gewicht 0 ist.
// Leere Zeilen werden ausgegraut und gehen nicht in Stats ein.
function isRowEmpty(row) {
  return (row.reps == null || row.reps === '') && (row.weight == null || Number(row.weight) === 0)
}

function adjustRowField(row, field, direction = 1, step = 1, min = -Infinity, max = Infinity) {
  try {
    const cur = Number(row[field]) || 0
    const delta = direction * step
    let next = cur + delta
    // snap to step
    next = Math.round(next / step) * step
    // clamp
    next = Math.min(max, Math.max(min, next))
    // fix float precision
    if (step < 1) next = Number(next.toFixed(3))
    row[field] = next
    try { triggerAutoSave() } catch {}
  } catch (err) {
    logger.warn('adjustRowField error', err)
  }
}

// Spin (press-and-hold) support with acceleration
// Stores per-row timers and state
const _spinMap = new WeakMap()

function startSpin(row, field, direction = 1, step = 1, min = -Infinity, max = Infinity) {
  try {
    stopSpin(row, field)

    const fn = () => adjustRowField(row, field, direction, step, min, max)
    // immediate feedback
    fn()

    // acceleration settings
    let currentInterval = 80 // initial repeat interval (ms)
    const minInterval = 20 // fastest allowed interval
    const accelFactor = 0.6 // interval multiplier when accelerating
    const accelPeriod = 500 // how often to accelerate (ms)

    // main repeating interval
    let intervalId = setInterval(fn, currentInterval)

    // acceleration timer: periodically shorten the interval to speed up repeats
    const accelId = setInterval(() => {
      try {
        if (currentInterval <= minInterval) return
        const nextInterval = Math.max(minInterval, Math.round(currentInterval * accelFactor))
        if (nextInterval >= currentInterval) return
        currentInterval = nextInterval
        clearInterval(intervalId)
        intervalId = setInterval(fn, currentInterval)
        // store updated interval id
        const obj = _spinMap.get(row) || {}
        const info = obj[field] || {}
        info.intervalId = intervalId
        info.accelId = accelId
        info.currentInterval = currentInterval
        _spinMap.set(row, { ...obj, [field]: info })
      } catch (err) {
        logger.warn('spin accel error', err)
      }
    }, accelPeriod)

    // save ids
    const obj = _spinMap.get(row) || {}
    obj[field] = { intervalId, accelId, currentInterval }
    _spinMap.set(row, obj)
  } catch (err) {
    logger.warn('startSpin error', err)
  }
}

function stopSpin(row, field) {
  try {
    const obj = _spinMap.get(row)
    if (!obj || !obj[field]) return
    const info = obj[field]
    try { if (info.intervalId) clearInterval(info.intervalId) } catch {}
    try { if (info.accelId) clearInterval(info.accelId) } catch {}
    delete obj[field]
    _spinMap.set(row, obj)
  } catch (err) {
    logger.warn('stopSpin error', err)
  }
}

function onSessionTime({ totalMs, formattedTime }) {
  if (workout.value && totalMs > 0) {
    workout.value.sessionTotalMs = totalMs
    workout.value.sessionFormattedTime = formattedTime
  }
}

// Voraussetzung (oben im <script setup>, bei den anderen Store-Imports):
// import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'
// const sessionStopwatchStore = useSessionStopwatchStore()

async function performSaveWorkout() {
  if (saving.value) return // Guard gegen Doppel-Aufruf
  // Sofort setzen – schliesst das Race-Window zwischen Guard-Check und erstem await.
  // triggerAutoSave() und runAutoSaveNow() prüfen saving.value als primären Guard,
  // daher muss es vor cancelPendingAutoSave() und vor dem ersten await stehen.
  saving.value = true
  suppressDraftPersistence.value = true

  // Bildschirm bleibt an, bis Speichern + anschließende KI-Analyse abgeschlossen sind (User-
  // Wunsch: Standby darf diese Vorgänge nicht abbrechen). Bei Erfolg übernimmt
  // PostWorkoutSummary.vue die Freigabe (siehe dort); bei Fehlern/Abbrüchen hier in diesem
  // Funktionsdurchlauf wird unten explizit wieder freigegeben. Sicherheitsnetz: falls aus
  // irgendeinem Grund weder das eine noch das andere greift, spätestens nach 90s freigeben,
  // damit der Bildschirm nicht dauerhaft an bleibt.
  acquireKeepAwake('workout-save')
  const keepAwakeSafetyTimer = setTimeout(() => {
    releaseKeepAwake('workout-save')
  }, 90000)
  // Für alle Ausstiegspunkte, die NICHT zu PostWorkoutSummary führen (Fehler, Favorit-
  // Anpassen-Modus): Keep-Awake sofort wieder freigeben statt bis zum 90s-Sicherheitsnetz zu warten.
  const releaseSaveKeepAwake = () => {
    clearTimeout(keepAwakeSafetyTimer)
    releaseKeepAwake('workout-save')
  }
  // Race-Fix: Warte auf ausstehende Auto-Save-Promises bevor wir weitermachen (Race 2),
  // um zu verhindern dass parallele saveDraft() + updateWorkout() um die gleiche ID konkurrieren
  if (autoSaveWaiters.length > 0) {
    logger.debug('[WorkoutDetail] performSaveWorkout: waiting for pending auto-save promises', { pending: autoSaveWaiters.length })
    await Promise.all(autoSaveWaiters.map(w => new Promise(r => w(false))))
  }
  try {
    cancelPendingAutoSave('final-save')
    suppressDraftPersistence.value = true
    saveMsg.value = ''
    saveError.value = false
    const id = route.params.id
    const w = workout.value || {}
    // Gesamttrainingsdauer kommt aus der Session-Stoppuhr (SessionStopwatch/Pinia-Store),
    // nicht mehr aus dem Pausen-Timer (timerStore) – der lief nur stückweise pro Satz.
    const timerElapsedSeconds = Math.max(0, Math.round((Number(sessionStopwatchStore.elapsedMs) || 0) / 1000))
    const timerDurationMinutes = timerElapsedSeconds > 0 ? Math.max(1, Math.round(timerElapsedSeconds / 60)) : 0
    const existingDuration = Number(w.duration) || 0
    const finalDurationMinutes = timerDurationMinutes > 0 ? timerDurationMinutes : existingDuration
    const resolvedUserId = await resolveActiveWorkoutUserIdForSave()
    const normalized = {
      name: w.name,
      type: w.type,
      date: w.date,
      userId: resolvedUserId || undefined,
      duration: finalDurationMinutes,
      completed: true,
      _isDraft: false,
      isDraft: false,
      exercises: (w.exercises || []).map((ex, idx) => {
        // Ersten Arbeitssatz (kein Warmup) als Referenzwert für reps/weight verwenden,
        // damit Exercise-Level-Felder nicht die Warmup-Werte widerspiegeln.
        const firstWorkingSet = (ex.setDetails || []).find(s => !s.isWarmup)
        return {
          exerciseId: ex.exerciseId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          reps: firstWorkingSet?.reps ?? ex.reps ?? 10,
          weight: firstWorkingSet?.weight ?? ex.weight ?? 0,
          setDetails: ex.setDetails || [],
          note: (exerciseNotes.value && typeof exerciseNotes.value[idx] !== 'undefined') ? exerciseNotes.value[idx] : ''
        }
      })
    }
    normalized.notes = buildWorkoutNotesSummary(normalized.exercises)

    // Favorit-Anpassen: Nur Favorit aktualisieren, kein Stats-Eintrag
    if (String(route.query?.favoriteAdjust || '') === '1') {
      const favId = String(route.query?.favoriteId || '').trim()
      const favName = String(route.query?.favoriteName || normalized.name || '').trim()
      const favType = normalizeWorkoutType(route.query?.favoriteType || normalized.type || 'push')
      const favUserId = getFavoriteUserId()
      logger.debug('[WorkoutDetail] Favorit-Anpassen: Start', { favId, favName, favType, favUserId, exerciseCount: normalized.exercises?.length })
      if (favId) {
        let updateResult
        try {
          updateResult = updateFavoriteWorkout({
            userId: favUserId,
            type: favType,
            id: favId,
            name: favName,
            workout: {
              name: normalized.name,
              type: normalized.type || favType,
              exercises: normalized.exercises
            }
          })
        } catch (updateErr) {
          logger.warn('[WorkoutDetail] Favorit-Anpassen: updateFavoriteWorkout Ausnahme', updateErr)
          toast.show('Fehler beim Aktualisieren des Favoriten', { type: 'error', duration: 4000 })
          saving.value = false
          suppressDraftPersistence.value = false
          releaseSaveKeepAwake()
          return
        }
        if (!updateResult?.success) {
          logger.warn('[WorkoutDetail] Favorit-Anpassen: Update fehlgeschlagen', updateResult?.code, updateResult?.message)
          if (updateResult?.code === 'NOT_FOUND') {
            toast.show(t('workoutDetail.favoriteNotFound') || 'Favorit wurde nicht gefunden – wurde er gelöscht?', { type: 'error', duration: 4000 })
            saving.value = false
            suppressDraftPersistence.value = false
            releaseSaveKeepAwake()
            return
          }
          if (updateResult?.code === 'INVALID_NAME') {
            toast.show(t('workoutDetail.favoriteNameInvalid') || 'Ungültiger Favoritenname', { type: 'error', duration: 4000 })
            saving.value = false
            suppressDraftPersistence.value = false
            releaseSaveKeepAwake()
            return
          }
          // Unbekannter Fehlercode: Nutzer informieren, nicht still verlieren
          toast.show(`Favorit konnte nicht aktualisiert werden (${updateResult?.code || 'unbekannt'})`, { type: 'error', duration: 4000 })
          saving.value = false
          suppressDraftPersistence.value = false
          releaseSaveKeepAwake()
          return
        } else {
          logger.debug('[WorkoutDetail] Favorit erfolgreich aktualisiert', favId)
          // Flag setzen: nächster Start soll die angepassten Template-Daten verwenden,
          // nicht die alte Performance-History (maybePrefillFromLastFavoritePerformance
          // würde sonst die geänderten setDetails sofort wieder überschreiben).
          try { localStorage.setItem(`fav_template_freshly_adjusted_${favId}`, '1') } catch {}
        }
      } else {
        logger.warn('[WorkoutDetail] Favorit-Anpassen: Keine favoriteId in Route – Update übersprungen')
        toast.show('Favorit konnte nicht gespeichert werden: fehlende ID', { type: 'error', duration: 4000 })
        saving.value = false
        suppressDraftPersistence.value = false
        releaseSaveKeepAwake()
        return
      }
      // Draft-Workout aus IndexedDB, Store UND sessionStorage entfernen.
      // sessionStorage muss zwingend geleert werden, sonst zeigt Dashboard diesen
      // Draft als "in Bearbeitung" an (readDetailDraft liest workout_detail_draft).
      clearAllDetailDraftSnapshots()
      const adjustId = String(id)
      // Wichtig: offline_-IDs (vom schnellen createWorkout()-Race in userStore.js) genauso
      // behandeln wie draft-*-IDs. Vorher wurde hier nur auf 'draft-' geprüft, wodurch eine
      // offline_-ID in den else-Zweig fiel und ungeprüft als echte ID an deleteWorkoutApi
      // (DELETE /api/workouts/:id) übergeben wurde - der Server lehnt das mit
      // "Ungültige Workout-ID" ab, da offline_... kein gültiges ObjectId-Format ist.
      if (adjustId.startsWith('draft-') || adjustId.startsWith('offline_')) {
        const realId = await resolveRealIdFromDraftId(adjustId)
        if (realId) {
          const tk = await getIdToken().catch(() => null)
          deleteWorkoutApi(realId, tk).catch(() => null)
        }
        try { await db.workouts.delete(adjustId) } catch {}
        try {
          const idx = store.workouts.findIndex(w => String(w?._id || '') === adjustId)
          if (idx !== -1) store.workouts.splice(idx, 1)
        } catch {}
      } else {
        const tk = await getIdToken().catch(() => null)
        deleteWorkoutApi(adjustId, tk).catch(() => null)
      }
      toast.show(t('workoutDetail.adjustSaved') || 'Favorit aktualisiert', { type: 'success', duration: 2000 })
      bypassTimerLeaveGuard.value = true
      releaseSaveKeepAwake()
      router.push('/dashboard')
      return
    }

    // Lokalen State sofort auf final setzen, damit kein spät ankommender Auto-Save
    // das Workout erneut als Draft markiert.
    if (workout.value) {
      workout.value = {
        ...workout.value,
        ...normalized,
        completed: true,
        _isDraft: false,
        isDraft: false
      }
    }

    // offline_-IDs (vom schnellen createWorkout()-Race in userStore.js, siehe dort) müssen
    // hier genauso wie draft-*-IDs behandelt werden - sonst fällt die Ausführung in den
    // generischen store.updateWorkout(id, ...)-Zweig weiter unten, der zwar selbst sicher mit
    // offline_-IDs umgeht (kein direkter Server-Call), aber goToPostWorkoutSummary() danach
    // ohne aufgelöste echte ID aufruft.
    if (String(id).startsWith('draft-') || String(id).startsWith('offline_')) {
      const token = await getIdToken().catch(() => null)
      const realId = await waitForRealIdFromDraftId(id)

      if (realId) {
        await store.updateWorkout(realId, normalized, token)
        syncStartedFavoriteFromWorkout({ ...normalized, _id: realId })
        saveMsg.value = finalDurationMinutes > 0 ? `Gespeichert. Dauer: ${finalDurationMinutes} min` : 'Gespeichert.'
        if (String(route.query?.favoriteStart || '') === '1') {
          saveMsg.value += ' · Favorit aktualisiert'
          try { localStorage.removeItem(`fav_prefill_applied_v1_${realId}`) } catch {}
        }
        saveError.value = false
        initialSnapshot = snapshotCore({ ...normalized, _id: realId })
        try { await db.workouts.delete(id) } catch {}
        try {
          const idx = store.workouts.findIndex(wi => String(wi?._id || '') === String(id))
          if (idx !== -1) store.workouts.splice(idx, 1)
        } catch {}
        store.invalidateStatsCache()
        await postSaveCleanup()
        timerStore.reset()
        sessionStopwatchStore.reset()
        bypassTimerLeaveGuard.value = true
        goToPostWorkoutSummary(realId)
        return
      }

      // realId nicht gefunden: Create-Pfad als Fallback (Background-Create hat evtl. versagt).
      const createPayload = {
        ...normalized,
        userId: normalized.userId || resolveActiveWorkoutUserId() || undefined,
        _isDraft: false,
        isDraft: false,
        completed: true
      }

      let savedWorkout = null
      try {
        savedWorkout = await store.createWorkout(createPayload, token)
      } catch (createError) {
        const status = Number(createError?.statusCode || createError?.response?.status || 0)
        const code = String(createError?.code || '').toUpperCase()
        const transient = !status || [408, 425, 429, 500, 502, 503, 504].includes(status) || code === 'ERR_NETWORK' || code === 'ECONNABORTED'
        if (transient) {
          logger.warn('[WorkoutDetail] createWorkout transient fehlgeschlagen, nutze optimistischen Fallback', createError)
          savedWorkout = await store.createWorkoutOptimistic(createPayload, token).catch(() => null)
          if (!savedWorkout) throw createError
        } else {
          logger.warn('[WorkoutDetail] createWorkout nicht-retrybar fehlgeschlagen, bewahre Workout lokal auf', createError)
          savedWorkout = await store.createWorkoutOptimistic({
            ...createPayload,
            _syncPendingAuth: status === 401 || status === 403
          }, token).catch(() => null)
          if (!savedWorkout) throw createError
          saveMsg.value = status === 401 || status === 403
            ? 'Lokal gespeichert. Sync startet nach erneuter Anmeldung.'
            : 'Lokal gespeichert. Sync wird erneut versucht.'
          saveError.value = false
        }
      }

      try { await db.workouts.delete(id) } catch {}
      try {
        const idx = store.workouts.findIndex(wi => String(wi?._id || '') === String(id))
        if (idx !== -1) store.workouts.splice(idx, 1)
      } catch {}

      store.invalidateStatsCache()
      syncStartedFavoriteFromWorkout({ ...createPayload, _id: savedWorkout?._id || id })
      if (!saveMsg.value) {
        saveMsg.value = finalDurationMinutes > 0 ? `Gespeichert. Dauer: ${finalDurationMinutes} min` : 'Gespeichert.'
        saveError.value = false
      }
      if (String(route.query?.favoriteStart || '') === '1') {
        saveMsg.value += ' · Favorit aktualisiert'
        try { localStorage.removeItem(`fav_prefill_applied_v1_${savedWorkout?._id || id}`) } catch {}
      }
      initialSnapshot = snapshotCore({ ...createPayload, _id: savedWorkout?._id || id })
      await postSaveCleanup()
      timerStore.reset()
      sessionStopwatchStore.reset()
      bypassTimerLeaveGuard.value = true
      goToPostWorkoutSummary(savedWorkout?._id || id)
      return
    }

    let token = await getIdToken().catch(() => null)
    await store.updateWorkout(id, normalized, token)
    syncStartedFavoriteFromWorkout({ ...normalized, _id: id })
    saveMsg.value = finalDurationMinutes > 0 ? `Gespeichert. Dauer: ${finalDurationMinutes} min` : 'Gespeichert.'
    if (String(route.query?.favoriteStart || '') === '1') {
      saveMsg.value += ' · Favorit aktualisiert'
      try { localStorage.removeItem(`fav_prefill_applied_v1_${id}`) } catch {}
    }
    saveError.value = false
    initialSnapshot = snapshotCore({ ...w, ...normalized })
    await postSaveCleanup()
    timerStore.reset()
    sessionStopwatchStore.reset()
    bypassTimerLeaveGuard.value = true
    goToPostWorkoutSummary(id)
  } catch (e) {
    // workout.value.completed wurde vor dem ersten await auf true gesetzt.
    // Bei Fehler zurücksetzen, damit persistInProgressDraft() den Draft noch retten kann.
    if (workout.value) {
      workout.value = { ...workout.value, completed: false, _isDraft: true, isDraft: true }
    }
    suppressDraftPersistence.value = false
    error.value = e?.message || 'Speichern fehlgeschlagen'
    saveMsg.value = 'Speichern fehlgeschlagen.'
    saveError.value = true
    releaseSaveKeepAwake()
  } finally {
    saving.value = false
  }
}

async function saveWorkout() {
  // Im Adjust-Modus läuft kein Workout, Timer-Guard nicht anwenden
  if (!isFavoriteAdjustMode.value && timerStore.isRunningLike) {
    pendingTimerAction.value = { kind: 'save' }
    showTimerActionModal.value = true
    return
  }
  await performSaveWorkout()
}

function getFavoriteUserId() {
  // Primär: favoriteUserId aus Route-Query — vom Dashboard genau dann gesetzt,
  // wenn die Favoriten geladen wurden (eliminiert userId-Ableitungsfehler)
  const fromQuery = String(route.query?.favoriteUserId || '').trim()
  if (fromQuery && fromQuery !== 'guest') return fromQuery
  // Fallback: Firebase Auth / AuthStore
  return String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || 'guest')
}

function buildFavoriteSourceWorkout() {
  const source = workout.value || {}
  return {
    name: source.name,
    type: source.type,
    notes: buildWorkoutNotesSummary(source.exercises || []),
    exercises: (source.exercises || []).map((exercise) => ({
      _id: exercise._id || exercise.exerciseId || null,
      exerciseId: exercise.exerciseId || exercise._id || null,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      category: exercise.category || source.type,
      sets: Number(exercise.sets) || Number(exercise.setDetails?.length) || 3,
      reps: Number(exercise.reps) || Number(exercise.setDetails?.[0]?.reps) || 10,
      weight: Number(exercise.weight) || Number(exercise.setDetails?.[0]?.weight) || 0,
      rest: Number(exercise.rest) || 90,
      setDetails: Array.isArray(exercise.setDetails) && exercise.setDetails.length
        ? exercise.setDetails
        : [{
            reps: Number(exercise.reps) || 10,
            weight: Number(exercise.weight) || 0
          }]
    }))
  }
}

function saveAsFavorite() {
  const nameCandidate = normalizeFavoriteName(favoriteName.value || workout.value?.name || '')
  const validationError = getFavoriteNameValidationError(nameCandidate)
  if (validationError) {
    saveMsg.value = validationError
    saveError.value = true
    return false
  }

  favoriteSaving.value = true
  try {
    const sourceWorkout = buildFavoriteSourceWorkout()
    const type = normalizeWorkoutType(sourceWorkout.type || route.query.type || 'push')
    const result = saveFavoriteWorkout({
      userId: getFavoriteUserId(),
      type,
      name: nameCandidate,
      workout: sourceWorkout
    })

    if (!result.success) {
      saveMsg.value = result.message || t('workoutDetail.favoriteSaveFailed')
      saveError.value = true
      return false
    }

    favoriteName.value = ''
    saveMsg.value = t('workoutDetail.favoriteSaved')
    saveError.value = false
    return true
  } catch {
    saveMsg.value = t('workoutDetail.favoriteSaveFailed')
    saveError.value = true
    return false
  } finally {
    favoriteSaving.value = false
  }
}

function openFavoriteNameModal() {
  favoriteName.value = normalizeFavoriteName(favoriteName.value || workout.value?.name || '')
  showFavoriteNameModal.value = true
}

function confirmFavoriteSave() {
  const ok = saveAsFavorite()
  if (ok) {
    showFavoriteNameModal.value = false
  }
}

function onDragStart(index) { if (!isReordering.value) return; draggingIndex.value = index }
function onDragOver(index) { if (!isReordering.value) return; dropTargetIndex.value = index }
function onDragLeave(index) { if (!isReordering.value) return; if (dropTargetIndex.value === index) dropTargetIndex.value = null }
function onDrop(index) {
  if (!isReordering.value) return
  const from = draggingIndex.value
  const to = index
  if (from === null || to === null || from === to) return
  const list = workout.value?.exercises
  if (!Array.isArray(list)) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  stopDrag()
}

function onPointerDown(event, index) {
  if (!isReordering.value || !touchPointerTypes.has(event.pointerType)) return
  if (activeFallbackTouchId.value !== null) return
  event.preventDefault()
  draggingIndex.value = index
  dropTargetIndex.value = index
  activeTouchPointerId.value = event.pointerId
  attachPointerDragListeners()
}

function attachPointerDragListeners() {
  if (typeof window === 'undefined' || pointerMoveListener) return
  pointerMoveListener = handlePointerMove
  pointerUpListener = handlePointerUp
  pointerCancelListener = handlePointerCancel
  window.addEventListener('pointermove', pointerMoveListener, { passive: false })
  window.addEventListener('pointerup', pointerUpListener)
  window.addEventListener('pointercancel', pointerCancelListener)
}

function cleanupPointerDragListeners() {
  if (typeof window === 'undefined') return
  if (pointerMoveListener) {
    window.removeEventListener('pointermove', pointerMoveListener)
    pointerMoveListener = null
  }
  if (pointerUpListener) {
    window.removeEventListener('pointerup', pointerUpListener)
    pointerUpListener = null
  }
  if (pointerCancelListener) {
    window.removeEventListener('pointercancel', pointerCancelListener)
    pointerCancelListener = null
  }
  activeTouchPointerId.value = null
}

function handlePointerMove(event) {
  if (event.pointerId !== activeTouchPointerId.value) return
  event.preventDefault()
  const nextIndex = findExerciseIndexAtPoint(event.clientX, event.clientY)
  if (nextIndex !== null) {
    dropTargetIndex.value = nextIndex
  }
}

function handlePointerUp(event) {
  if (event.pointerId !== activeTouchPointerId.value) return
  const targetIndex = dropTargetIndex.value ?? draggingIndex.value
  if (targetIndex !== null) {
    onDrop(targetIndex)
  }
  stopDrag()
}

function handlePointerCancel(event) {
  if (event.pointerId !== activeTouchPointerId.value) return
  stopDrag()
}

function onTouchStart(event, index) {
  if (!isReordering.value) return
  if (activeTouchPointerId.value !== null || activeFallbackTouchId.value !== null) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  draggingIndex.value = index
  dropTargetIndex.value = index
  activeFallbackTouchId.value = touch.identifier
  attachTouchDragListeners()
}

function attachTouchDragListeners() {
  if (typeof window === 'undefined' || fallbackTouchMoveListener) return
  fallbackTouchMoveListener = handleTouchMove
  fallbackTouchEndListener = handleTouchEnd
  fallbackTouchCancelListener = handleTouchCancel
  window.addEventListener('touchmove', fallbackTouchMoveListener, { passive: false })
  window.addEventListener('touchend', fallbackTouchEndListener)
  window.addEventListener('touchcancel', fallbackTouchCancelListener)
}

function cleanupTouchDragListeners() {
  if (typeof window === 'undefined') return
  if (fallbackTouchMoveListener) {
    window.removeEventListener('touchmove', fallbackTouchMoveListener)
    fallbackTouchMoveListener = null
  }
  if (fallbackTouchEndListener) {
    window.removeEventListener('touchend', fallbackTouchEndListener)
    fallbackTouchEndListener = null
  }
  if (fallbackTouchCancelListener) {
    window.removeEventListener('touchcancel', fallbackTouchCancelListener)
    fallbackTouchCancelListener = null
  }
  activeFallbackTouchId.value = null
}

function handleTouchMove(event) {
  if (!activeFallbackTouchId.value) return
  const touches = event.touches || []
  let touch = null
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === activeFallbackTouchId.value) {
      touch = touches[i]
      break
    }
  }
  if (!touch) return
  event.preventDefault()
  const nextIndex = findExerciseIndexAtPoint(touch.clientX, touch.clientY)
  if (nextIndex !== null) {
    dropTargetIndex.value = nextIndex
  }
}

function logDiagnostic(event, data = {}) {
  try {
    const key = 'bro_split_load_diagnostics_v1'
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.push({
      event,
      ...data,
      timestamp: new Date().toISOString()
    })
    const trimmed = existing.slice(-100)
    localStorage.setItem(key, JSON.stringify(trimmed))
  } catch {}
}

function handleTouchEnd(event) {
  if (!activeFallbackTouchId.value) return
  const changed = event.changedTouches || []
  let touch = null
  for (let i = 0; i < changed.length; i++) {
    if (changed[i].identifier === activeFallbackTouchId.value) {
      touch = changed[i]
      break
    }
  }
  if (!touch) return
  const targetIndex = dropTargetIndex.value ?? draggingIndex.value
  if (targetIndex !== null) {
    onDrop(targetIndex)
  }
  stopDrag()
}

function handleTouchCancel(event) {
  if (!activeFallbackTouchId.value) return
  const changed = event.changedTouches || []
  let touch = null
  for (let i = 0; i < changed.length; i++) {
    if (changed[i].identifier === activeFallbackTouchId.value) {
      touch = changed[i]
      break
    }
  }
  if (!touch) return
  stopDrag()
}

function stopDrag() {
  draggingIndex.value = null
  dropTargetIndex.value = null
  cleanupPointerDragListeners()
  cleanupTouchDragListeners()
}

function findExerciseIndexAtPoint(x, y) {
  if (typeof document === 'undefined') return null
  const element = document.elementFromPoint(x, y)
  if (!element || typeof element.closest !== 'function') return null
  const target = element.closest('[data-ex-index]')
  if (!target || !exListRef.value || !exListRef.value.contains(target)) return null
  const raw = target.dataset?.exIndex
  if (!raw) return null
  const idx = Number(raw)
  return Number.isNaN(idx) ? null : idx
}

/**
 * Core-Funktion zum Speichern des Active Draft
 * Extrahiert aus persistActiveDraft() um Code-Duplikation zu vermeiden
 * und das isDirty Race Condition Problem zu lösen.
 *
 * @param {string} reason - Grund des Saves (für Logging)
 * @param {boolean} forceIgnoreDirty - true = speichern ohne isDirty zu prüfen (für Lifecycle-Events)
 * @returns {boolean} true wenn erfolgreich gespeichert
 */
function saveActiveDraftDirect(reason = 'unknown', forceIgnoreDirty = false) {
  if (suppressDraftPersistence.value) return false
  if (isFavoriteAdjustMode.value) return false

  const w = workout.value
  if (!w || w.completed === true) return false

  // Guard: Workout muss als Draft behalten werden
  if (!shouldKeepAsDraft(w)) return false

  // Normale Saves brauchen isDirty = true; Lifecycle-Saves ignorieren das
  if (!forceIgnoreDirty && !isDirty.value) return false

  const uid = resolveActiveWorkoutUserId()
  if (!uid) return false

  // Baue exercises mit notes zusammen
  const exercises = Array.isArray(w.exercises) && Array.isArray(exerciseNotes.value)
    ? w.exercises.map((ex, idx) => ({
        ...ex,
        note: typeof exerciseNotes.value[idx] === 'string' ? exerciseNotes.value[idx] : ex.note || ''
      }))
    : (w.exercises || [])

  const notes = buildWorkoutNotesSummary(exercises)

  // Resolve editingWorkoutId: nutze bestehenden oder ermittle aus Route
  const existing = getActiveDraft(uid)
  let editingWorkoutId = existing?.editingWorkoutId ?? null

  if (!editingWorkoutId) {
    const routeId = String(route.params.id || '').trim()
    if (routeId && routeId !== 'draft' && !routeId.startsWith('draft-') && !routeId.startsWith('offline_')) {
      editingWorkoutId = routeId
    }
  }

  // Speichere
  const ok = setActiveDraft(uid, {
    ...w,
    _id: String(w._id || route.params.id || ''),
    exercises,
    notes
  }, editingWorkoutId || null)

  if (ok) {
    logger.debug('[WorkoutDetail] active draft saved', {
      reason,
      forceIgnoreDirty,
      editingWorkoutId: editingWorkoutId || null,
      exerciseCount: exercises.length
    })
    // Voller Exercise-Dump (nicht nur Zähler) bei JEDEM Schreibpfad auf den Active-Draft,
    // damit sich der exakte Moment eines Set-Verlusts im Diagnose-Log nachvollziehen lässt
    // (vorher loggten lifecycle-persist-Events nur den "reason", ohne Dateninhalt, sodass
    // ein Datenverlust zwischen zwei "load-before-assign"-Events nicht mehr rekonstruierbar war).
    logDiagnostic('draft-write', {
      reason,
      forceIgnoreDirty,
      exercises: exercises.map(ex => ({ name: ex.name, setDetails: ex.setDetails }))
    })
  }
  return ok
}

async function persistActiveDraft(reason = '') {
  // Nutze die extrahierte Funktion mit normalem isDirty-Check
  return saveActiveDraftDirect(reason, false)
}

function persistActiveDraftFromLifecycle(reason = 'unknown') {
  logDiagnostic('lifecycle-persist', { reason })
  writeDetailViewState(reason)
  // 🔧 BUGFIX: Speichere direkt ohne auf isDirty-Watch zu warten
  // Das verhindert das Race Condition Problem wenn die App schnell in den
  // Hintergrund geht bevor der Watch seinen Callback gefeuert hat.
  // forceIgnoreDirty=true bedeutet: speichere den aktuellen workout.value sofort
  // (aber prüfe immer noch shouldKeepAsDraft um leere Drafts zu vermeiden)
  saveActiveDraftDirect(reason, true)
}

function onVisibilityChange() {
try {
if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
persistActiveDraftFromLifecycle('visibility-hidden')
}
} catch {}
}

function onPageHide() {
persistActiveDraftFromLifecycle('pagehide')
}

function onWindowScroll() {
  scheduleViewStatePersist('scroll')
}

// Capacitor-Listener Handle (wird in onMounted gesetzt, in onBeforeUnmount entfernt)
let _capAppStateListener = null

// Watchers for auto-scroll and dirty tracking
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
    // Capture-Phase, damit der Ghost-Click abgefangen wird, BEVOR er Button-Handler
    // wie addSetRow() im "+ Satz hinzufügen"-Button erreicht (siehe Kommentar bei
    // pickerGhostClickGuardUntil weiter oben).
    document.addEventListener('click', swallowPickerGhostClick, true)
  }
  // Capacitor App-Lifecycle: appStateChange führt frühzeitig einen Draft-Save durch,
  // bevor iOS den WebView-Prozess beenden kann (pagehide kommt zu spät oder gar nicht).
  try {
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      const { App: CapApp } = await import('@capacitor/app')
      _capAppStateListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
        logDiagnostic('app-state-change', { isActive })
        if (!isActive) {
          persistActiveDraftFromLifecycle('app-background')
        }
      })
    }
  } catch {}
  loadDefaultExerciseMap().catch(() => {})
  await loadWorkout()
  // Typ aus Query übernehmen, falls Draft geladen wird und Typ fehlt
  if (route.params.id === 'draft' && workout.value && !workout.value.type && route.query.type) {
    workout.value.type = route.query.type
  }
  await nextTick()
  if (shouldAutoScroll()) {
    setTimeout(scrollToExercises, 50)
    didAutoScroll.value = true
  }
  restoreDetailViewState()
})

watch(() => workout.value?.exercises?.length || 0, async (len) => {
  if (didAutoScroll.value) return
  if (!len) return
  if (!shouldAutoScroll()) return
  await nextTick()
  setTimeout(() => {
    scrollToExercises()
    didAutoScroll.value = true
  }, 0)
})

// Wenn router.replace die Route von der Temp-ID auf die echte MongoDB-ID wechselt (WorkoutBuilder
// erstellt das Workout im Hintergrund), den localStorage-Prefill-Key migrieren und workout._id
// synchronisieren, damit Auto-Save nicht mehr die Draft-ID in den PUT-Body einschleust.
//
// BUGFIX (Daten-Reset bei App-Resume): Der Active-Draft in localStorage wurde bisher NICHT
// synchron mit dieser ID-Migration aktualisiert, sondern erst über den separaten deep-watch auf
// workout.value (siehe unten), der asynchron über Vues Reaktivitäts-Flush läuft. Ging die App
// GENAU in diesem schmalen Zeitfenster (Route wechselt von temp-ID auf echte Mongo-ID, aber der
// deep-watch hat noch nicht gefeuert) in den Hintergrund oder wurde der Prozess von iOS beendet,
// stand im localStorage-Draft weiterhin die ALTE temp-ID (workout._id UND editingWorkoutId). Beim
// Zurückkehren/Neustart sucht loadServerWorkout(id) mit der NEUEN echten ID nach einem Active-
// Draft-Treffer (strikter ID-Vergleich) — der schlug wegen der veralteten temp-ID im Draft
// fehl, der Lookup fiel auf Store/Offline/Server zurück und lieferte den alten Stand OHNE die
// zuletzt eingegebenen Daten zurück. Das sah für den User wie ein "Reset" aus.
// Fix: Active-Draft sofort (synchron, im selben Tick wie die ID-Änderung) unter der neuen ID
// umschreiben, statt auf den asynchronen deep-watch zu warten.
watch(() => String(route.params.id || ''), (newId, oldId) => {
  if (!newId || !oldId || newId === oldId) return
  // workout.value._id auf die neue (echte) ID aktualisieren, wenn wir von einer Draft-ID gewechselt haben
  const wasTempId = workout.value && (
    String(workout.value._id || '') === oldId || String(workout.value._id || '').startsWith('draft-')
  )
  if (
    workout.value &&
    !newId.startsWith('draft-') &&
    !newId.startsWith('offline_') &&
    wasTempId
  ) {
    workout.value = { ...workout.value, _id: newId }

    // Sofort-Migration des Active-Drafts, um die Race Condition oben zu schließen.
    try {
      const uid = resolveActiveWorkoutUserId()
      const active = uid ? getActiveDraft(uid) : null
      const activeMatchesOld = active?.workout && (
        String(active.workout._id || '') === oldId || active.editingWorkoutId === oldId
      )
      if (uid && activeMatchesOld) {
        setActiveDraft(uid, { ...active.workout, _id: newId }, newId)
        logDiagnostic('active-draft-id-migrated', { oldId, newId })
      }
    } catch (err) {
      logger.warn('[WorkoutDetail] Active-Draft ID-Migration fehlgeschlagen:', err?.message)
    }
  }
  try {
    const oldKey = `fav_prefill_applied_v1_${oldId}`
    if (localStorage.getItem(oldKey) === '1') {
      localStorage.setItem(`fav_prefill_applied_v1_${newId}`, '1')
      localStorage.removeItem(oldKey)
    }
  } catch {}
})

// Dirty-Tracking gegen initialen Snapshot & sofortiges Draft-Speichern
watch(() => workout.value, (w) => {
  const current = snapshotCore(w || {})
  isDirty.value = !!initialSnapshot && current !== initialSnapshot
  try {
    if (!w || w.completed === true) return
    if (!(shouldKeepAsDraft(w) || isDirty.value)) return
    // 🔧 Nutze extrahierte Funktion mit normalem isDirty-Check (forceIgnoreDirty=false)
    saveActiveDraftDirect('watch-dirty', false)
  } catch {}
}, { deep: true })

// Warnung beim Schließen/Reload
function beforeUnloadHandler(e) {
  if (isFavoriteAdjustMode.value) return // Adjust-Modus: kein Reload-Warndialog
  if (!workout.value || workout.value.completed === true) return
  if (!(shouldKeepAsDraft(workout.value) || isDirty.value)) return
  try {
    persistActiveDraftFromLifecycle('beforeunload')
    logger.debug('beforeunload snapshot saved to sessionStorage (detail)')
  } catch (err) {
    logger.warn('⚠️ WorkoutDetail - beforeunload snapshot failed:', err)
  }
  e.preventDefault()
  e.returnValue = ''
}

onBeforeRouteLeave(async (to) => {
  writeDetailViewState('route-leave')

  // Adjust-Modus: Draft wird NIEMALS als Workout-in-Progress behandelt.
  // Bei bypassTimerLeaveGuard (= nach performSaveWorkout) sind Cleanup-Schritte
  // bereits in performSaveWorkout erledigt worden. Beim Verlassen ohne Speichern
  // Draft explizit aus IndexedDB und Store entfernen.
  if (isFavoriteAdjustMode.value) {
    if (bypassTimerLeaveGuard.value) {
      bypassTimerLeaveGuard.value = false
      suppressDraftPersistence.value = true
      return true
    }
    // Verlassen ohne Speichern: Adjust-Draft verwerfen.
    // suppressDraftPersistence MUSS vor return gesetzt werden, weil onBeforeUnmount
    // danach mit der bereits geänderten Route feuert (isFavoriteAdjustMode wäre dann false)
    // und persistInProgressDraft den Draft sonst zurückschreiben würde.
    suppressDraftPersistence.value = true
    // Sicherheitsnetz: Falls im Cleanup unten ein unerwarteter Fehler auftritt,
    // Suppress nach kurzer Zeit automatisch zurücksetzen, statt die Session
    // dauerhaft vom Speichern zu blockieren.
    const safetyResetTimer = setTimeout(() => {
      suppressDraftPersistence.value = false
      logDiagnostic('suppress-safety-reset', { reason: 'onBeforeRouteLeave-adjust-timeout' })
    }, 3000)

    try {
      const adjustId = String(route.params.id || '')
      if (adjustId) {
        await purgePendingCreateQueueForWorkoutId(adjustId)
        try { await db.workouts.delete(adjustId) } catch {}
        try {
          const idx = store.workouts.findIndex(w => String(w?._id || '') === adjustId)
          if (idx !== -1) store.workouts.splice(idx, 1)
        } catch {}
      }
      clearActiveDraftForCurrentUser('adjust-route-leave')
      clearAllDetailDraftSnapshots()
      clearTimeout(safetyResetTimer)
      return true
    } catch (e) {
      clearTimeout(safetyResetTimer)
      suppressDraftPersistence.value = false
      logDiagnostic('suppress-safety-reset', { reason: 'onBeforeRouteLeave-adjust-error', message: e?.message })
      return true
    }
  }

  // Race-Fix (Cancel-Bug): Überprüfen ob gerade discardDraftAndLeave() läuft (bypassTimerLeaveGuard=true)
  // BEVOR persistInProgressDraft() aufgerufen wird. Sonst speichern wir Drafts, die der Benutzer
  // mit Cancel-Button gerade verwerfen wollte. (BUG: "Abbrechen speichert das Workout")
  if (!bypassTimerLeaveGuard.value) {
    await persistActiveDraft('route-leave')
  }

  if (bypassTimerLeaveGuard.value) {
    bypassTimerLeaveGuard.value = false
    return true
  }

  // if (timerStore.isRunningLike) {
  //   pendingTimerAction.value = { kind: 'route-leave', targetPath: to?.fullPath || '/dashboard' }
  //   showTimerActionModal.value = true
  //   return false
  // }

  return true
})

onBeforeUnmount(() => {
  cancelPendingAutoSave('before-unmount')
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('scroll', onWindowScroll)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    document.removeEventListener('click', swallowPickerGhostClick, true)
  }
  // Capacitor-Listener entfernen
  try { if (_capAppStateListener) { _capAppStateListener.remove(); _capAppStateListener = null } } catch {}
  writeDetailViewState('before-unmount')
  if (viewStatePersistTimer) {
    clearTimeout(viewStatePersistTimer)
    viewStatePersistTimer = null
  }
  if (!suppressDraftPersistence.value) {
    persistActiveDraft('before-unmount').catch(() => {})
  }
  cleanupPointerDragListeners()
})
</script>

<style scoped>
.picker-container {
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: var(--surface);
}
.picker-container :deep(.exercise-list-root),
.picker-container :deep(.vue-recycle-scroller),
.picker-container :deep(.vue-recycle-scroller__item-wrapper) {
  overflow: visible !important;
}
.picker-list { padding: 12px 16px; }
.search-row.in-sheet { margin: 12px 16px; }
.exercises-list { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.exercise-item { background: var(--card-bg, #fff); border-radius: 12px; padding: 16px; border: 1px solid var(--card-border, #e5e7eb); box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px; }
.timer-decision-body { display: flex; flex-direction: column; gap: 12px; }
.timer-decision-body p { margin: 0; }
.timer-stop-btn {
  align-self: flex-end;
  border: 1px solid color-mix(in srgb, var(--danger-color) 65%, black 35%);
  background: var(--danger-color, #dc2626);
  color: #fff;
  border-radius: 10px;
  padding: 9px 12px;
  font-weight: 700;
  cursor: pointer;
}
.timer-stop-btn:hover { opacity: 0.92; }
.ex-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.exercise-item .title { font-weight: 700; color: var(--accent-color); font-size: 1.05rem; }
.exercise-item .sub { color: var(--muted); font-size: 0.9rem; }
.exercise-item .sub.small { font-size: 0.85rem; margin-left: auto; }
.exercises-list {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-bottom: 12px;
}
.exercise-item {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--card-border, #e5e7eb);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.exercise-item .title { font-weight: 700; color: var(--accent-color); font-size: 1.05rem; }
.exercise-item .sub { color: var(--muted); font-size: 0.9rem; }
.exercise-item .sub.small { font-size: 0.85rem; margin-left: auto; }
.picker-list { padding: 8px 4px; }
.picker-loading { text-align: center; padding: 16px; color: var(--muted); }
/* styles unchanged (same as provided) */
.workout-detail {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: calc(104px + env(safe-area-inset-bottom, 0px));
}
.content { padding: 0 clamp(14px, 3.5vw, 24px); }
.content.timer-offset {
  padding-top: clamp(68px, 10vh, 112px);
}

.loading, .empty, .error { text-align: center; color: var(--muted); padding: 40px 0; }
.workout-header { margin-bottom: 16px; }
.workout-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
.meta { display: flex; gap: 8px; color: var(--muted); align-items: center; font-size: 0.9rem; }
.badge { background: var(--surface); padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; border: 1px solid var(--card-border); }
.completed { color: var(--success-color); }
.ex-list { background: transparent; border: 1px solid transparent; border-radius: 12px; padding: 12px; }
.ex-list input,
.ex-list button,
.ex-list textarea {
  font-size: 16px;
  color: var(--fg);
}
.ex-description {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 4px 0 0;
  line-height: 1.4;
}
.ex-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ex-list-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; width: 100%; }
.ex-list-header h3 { margin: 0; font-size: 1.1rem; }
.reorder-toggle { background: color-mix(in srgb, var(--accent) 16%, var(--bg-panel)) !important;
  color: var(--fg-strong);
  border: 2px solid color-mix(in srgb, var(--accent) 65%, var(--line-strong)) !important;
  font-weight: 700; }
.reorder-hint { color: var(--muted); margin: 0 0 8px; font-size: 0.85rem; }
.ex-item { padding: 10px 0; border-bottom: 1px solid var(--card-border); }
.ex-item:last-child { border-bottom: none; }
.ex-list.reordering { touch-action: pan-y; }
.ex-item.reordering { cursor: move; }
.ex-item.dragging { touch-action: none; }
.ex-item.dragging { opacity: 0.6; transform: scale(0.98); background: color-mix(in oklab, var(--accent) 10%, transparent); border-radius: 8px; }
.ex-item.drop-target { outline: 2px dashed color-mix(in oklab, var(--accent) 60%, transparent); outline-offset: 4px; background: color-mix(in oklab, var(--accent) 14%, transparent); border-radius: 8px; }
.media-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 22, 0.72);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 16px;
  max-width: min(90vw, 520px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.media-image {
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--card-border);
}
.media-disclaimer {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
  text-align: center;
}
.drag-handle { background: transparent; border: none; color: var(--muted); cursor: grab; font-size: 16px; margin-right: 4px; padding: 0; }
.ex-sets { margin-top: 6px; }
.set-row { display: grid; grid-template-columns: 50px 1fr 1fr 60px; gap: 8px; align-items: center; padding: 4px 0; }
.set-row.header { color: var(--muted); font-size: 0.75rem; padding-top: 0; }
.set-row .col input { width: 100%; padding: 5px 6px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); text-align: center; font-size: 1rem; }
.weight-input { position: relative; }
.weight-input .unit { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.75rem; pointer-events: none; }
.row-actions { padding: 4px 0; }
.add-row-btn {
  background: transparent;
  color: var(--accent-contrast, #ffffff);
  border: 2px solid color-mix(in srgb,var(--accent) 65%,var(--line-strong));
  border-radius: 8px;
  padding: 7px 12px;
  cursor: pointer;
  /* font-size: 0.9rem; */
  /* font-weight: 700; */
  /* text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35); */
}
.remove-row-btn { background: var(--danger-color); color: var(--accent-contrast); border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; font-size: 1rem; }
.number-with-spinner { display: flex; align-items: center; gap: 6px; }
.spinner-vertical { display: flex; flex-direction: column; gap: 2px; }
.spin-btn { background: transparent; border: 1px solid var(--card-border); padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; line-height: 1; cursor: pointer; }
.spin-btn.up { transform-origin: center; }
.spin-btn.down { transform-origin: center; }
.spin-btn:active { transform: scale(0.98); }
.actions { margin-top: 12px; display: flex; gap: 8px; }
.primary {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 72%, black 28%);
  cursor: pointer;
  background: color-mix(in srgb, var(--accent) 92%, white 8%);
  color: var(--accent-contrast, #ffffff);
  font-weight: 700;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
}
.secondary { padding: 12px; border-radius: 10px; border: 1px solid var(--line-strong); cursor: pointer; background: var(--bg-panel); color: var(--fg-strong); font-weight: 600; }
.cancel-btn {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: #dc2626 !important;
  color: #ffffff !important;
  border-color: #dc2626 !important;
}
.cancel-btn:hover,
.cancel-btn:active {
  background: #b91c1c;
  border-color: #b91c1c;
}
.favorite-save {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--line-strong));
  color: var(--accent);
}
.favorite-save:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-panel));
}
.favorite-modal-field { display: flex; flex-direction: column; gap: 6px; color: var(--fg-strong); font-size: 0.85rem; }
.favorite-modal-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line-soft); background: var(--bg-panel); color: var(--fg); }
.add-exercise-btn {
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-panel));
  color: var(--fg-strong);
  border: 2px solid color-mix(in srgb, var(--accent) 65%, var(--line-strong));
  font-weight: 700;
}
.add-exercise-btn:hover {
  background: color-mix(in srgb, var(--accent) 24%, var(--bg-panel));
}
.timer-config-btn {
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-panel));
  color: var(--fg-strong);
  border: 2px solid color-mix(in srgb, var(--accent) 65%, var(--line-strong));
  font-weight: 700;
}
.timer-config-btn:hover {
  background: color-mix(in srgb, var(--accent) 24%, var(--bg-panel));
}
.link.danger {
  color: var(--danger-color);
  border: 1px solid color-mix(in srgb, var(--danger-color) 45%, transparent);
  border-radius: 8px;
  padding: 4px 8px;
}

.save-btn{
  background: #dc2626;
  color: #000000;
}
.remove-row-btn {
  background: var(--danger-color);
  border: 1px solid color-mix(in srgb, var(--danger-color) 68%, black 32%);
}
.banner { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.85rem; }
.banner.warning { background: color-mix(in oklab, var(--warning-color) 20%, transparent); border: 1px solid color-mix(in oklab, var(--warning-color) 50%, transparent); color: var(--fg); }
.banner.dirty { background: color-mix(in oklab, var(--warning-color) 16%, transparent); border: 1px solid color-mix(in oklab, var(--warning-color) 40%, transparent); color: var(--fg); margin-bottom: 6px; }
.banner .dismiss { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 0.9rem; padding: 0; }
.save-msg { display: block; margin-top: 6px; color: var(--success-color); font-size: 0.85rem; }
.save-msg.error { color: var(--danger-color); }
.ex-info { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.ex-info.minimal { align-items: center; gap: 12px; min-height: 48px; }
.ex-name-only { font-size: 1rem; font-weight: 600; }
.ex-thumb { width: 56px; height: 56px; flex-shrink: 0; object-fit: contain; background: var(--surface); border: 1px solid var(--card-border); border-radius: 8px; padding: 4px; cursor: pointer; }
.ex-text { flex: 1; min-width: 0; }
.ex-title-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ex-text strong { display: block; color: var(--fg); font-size: 0.95rem; }
.ex-text small { display: block; color: var(--muted); font-size: 0.8rem; margin-top: 2px; }
.last-performance-hint {
  margin: 6px 0 0;
  color: var(--fg-soft, #9fb0c2);
  font-size: 0.78rem;
}
.weight-progress-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 50%;
  flex-shrink: 0;
  user-select: none;
  cursor: default;
  vertical-align: middle;
}
.col.set {
  display: flex;
  align-items: center;
  gap: 3px;
}
.sets-section-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 6px 0 2px;
  color: var(--muted);
}
.warmup-label {
  color: color-mix(in srgb, #f59e0b 65%, var(--muted));
}
.working-label {
  padding-top: 2px;
}
.sets-section-divider {
  height: 1px;
  background: var(--line-soft, rgba(255,255,255,0.08));
  margin: 8px 0 4px;
}
.set-row.warmup-row {
  opacity: 0.7;
}
.set-row.set-row-empty {
  opacity: 0.35;
}
.set-row.set-row-empty .col input {
  border-color: var(--line-soft, rgba(255,255,255,0.1));
  color: var(--muted);
}
.row-actions.warmup-actions {
  margin-bottom: 4px;
}
.add-warmup-btn {
  background: transparent;
  color: color-mix(in srgb, #f59e0b 70%, var(--muted));
  border: 2px solid #6B7280;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 0.82rem;
}
.add-warmup-btn:active {
  opacity: 0.7;
}
.add-row-btn:hover,
.add-warmup-btn:hover {
  filter: brightness(1.08);
}
.remove-exercise-btn {
  border: 1px solid color-mix(in srgb, var(--danger-color) 50%, transparent);
  background: color-mix(in srgb, var(--danger-color) 14%, transparent);
  color: var(--danger-color);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 0.85rem;
  cursor: pointer;
}
.remove-exercise-btn:hover {
  background: color-mix(in srgb, var(--danger-color) 20%, transparent);
}

.actions .primary,
.workout > .primary{
  background: color-mix(in srgb, var(--accent) 92%, black 8%);
  color: var(--accent-contrast, #ffffff);
  border: 1px solid color-mix(in srgb, var(--accent) 72%, black 28%);
  font-weight: 800;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
}

/* === Speichern-Overlay === */
.saving-overlay {
  position: fixed; inset: 0; z-index: 9900;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
}
.saving-card {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  background: var(--bg-panel, #1c2330);
  border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  border-radius: 16px; padding: 28px 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
.saving-spinner {
  width: 38px; height: 38px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: var(--accent, #6c9eff);
  border-radius: 50%;
  animation: workoutSpin 0.65s linear infinite;
}
@keyframes workoutSpin { to { transform: rotate(360deg); } }
.saving-label {
  color: var(--fg-strong, #fff); font-size: 0.95rem; font-weight: 600; opacity: 0.9;
}
.save-fade-enter-active, .save-fade-leave-active { transition: opacity 0.12s ease; }
.save-fade-enter-from, .save-fade-leave-to { opacity: 0; }
</style>