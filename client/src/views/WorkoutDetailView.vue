<template>
    <div class="workout-detail">
      <HeaderBar title="Workout">
        <!-- Gesamtzeit (SessionStopwatch) hier statt weiter unten in der Übungsliste (siehe
             ex-list-header) platziert - Header ist sticky (siehe HeaderBar.vue), bleibt also
             beim Scrollen durch eine lange Übungsliste immer im Sichtfeld. Eigener #center-Slot
             (statt #actions), damit sie wirklich mittig zwischen Titel und "Abmelden"-Button
             sitzt. Nur sichtbar, wenn ein Workout tatsächlich geladen ist (kein Timer während
             Lade-/Fehlerzustand). -->
        <template #center>
          <SessionStopwatch v-if="workout" compact @session-time="onSessionTime" />
        </template>
      </HeaderBar>

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
        <!-- Kompakte Titelzeile (Wunsch Paul: Name, Typ und Datum standen doppelt da - der Name
             enthielt schon das Datum, darunter nochmal Typ-Plakette + Datum mit Uhrzeit). Jetzt:
             Name ohne angehängtes Datum, rechts "Heute" bzw. das Datum ohne Uhrzeit. Der
             gespeicherte Name bleibt unverändert (nur Anzeige, siehe displayWorkoutName). -->
        <div class="workout-header">
          <h2>{{ displayWorkoutName }}</h2>
          <span class="workout-header-date">
            <span v-if="workout.completed" class="completed" aria-hidden="true">✓</span>
            {{ workoutDateLabel }}
          </span>
        </div>

        <!-- Hinweis für den Sonderfall "abgeschlossenes Workout innerhalb des nachträglichen
             Bearbeitungsfensters geöffnet" - siehe editWindowDeadline in loadWorkout(). Ohne
             diesen Hinweis wäre für den Nutzer nicht ersichtlich, dass Änderungen hier nur
             noch begrenzte Zeit möglich sind. -->
        <div v-if="editWindowDeadline" class="banner warning">
          <span>{{ t('workoutDetail.editWindowHint', { time: editWindowDeadlineLabel }) }}</span>
        </div>

        <!-- Favorit anpassen: hier lässt sich das Ziel des Favoriten ändern (wird mit dem
             Favoriten gespeichert, siehe buildFavoriteSourceWorkout). In einem laufenden
             Workout ist das Ziel dagegen fest. -->
        <WorkoutGoalPicker
          v-if="isFavoriteAdjustMode && !isReordering"
          v-model="favoriteAdjustGoal"
          class="adjust-goal-picker"
        />

        <OneTimeHint
          hint-id="first-workout-open"
          :title="t('onboarding.hintFirstWorkoutTitle')"
          :text="t('onboarding.hintFirstWorkoutText')"
        />

        <!-- Körpergewicht (optional) - bewusst ganz oben, direkt sichtbar beim Öffnen des
             Workouts statt erst nach dem Durchscrollen der gesamten Übungsliste (User-Feedback).
             Infotext hinter einem Info-Button versteckt (toggle statt IMMER sichtbar), damit das
             Feld hier oben möglichst wenig Platz einnimmt. -->
        <!-- Einzeilig (Wunsch Paul: Feld war zu groß): Symbol, Label, "(optional)", Info-Button,
             Eingabe, kg. Der Infotext klappt bei Bedarf darunter auf. Platzhalter = zuletzt
             eingetragenes Körpergewicht aus einem früheren Workout - nur als Anzeige, gespeichert
             wird ausschließlich, was der Nutzer selbst einträgt (keine geschätzten Werte). -->
        <div
          v-if="!isReordering && !isFavoriteAdjustMode"
          class="bodyweight-field"
        >
          <div class="bodyweight-row">
            <Weight class="bodyweight-icon" aria-hidden="true" />
            <label for="athlete-bodyweight-input" class="bodyweight-label">{{ t('workoutDetail.bodyweightShort') }}</label>
            <span class="bodyweight-optional">{{ t('workoutDetail.optionalHint') }}</span>
            <button
              type="button"
              class="bodyweight-info-btn"
              :aria-pressed="showBodyweightHint"
              :aria-label="t('workoutDetail.bodyweightHint')"
              @click="showBodyweightHint = !showBodyweightHint"
            >
              <Info class="btn-icon btn-icon--inline" aria-hidden="true" />
            </button>
            <span class="bodyweight-spacer"></span>
            <input
              id="athlete-bodyweight-input"
              v-model="athleteBodyweightKg"
              type="number"
              min="0"
              max="400"
              step="0.1"
              inputmode="decimal"
              :placeholder="bodyweightPlaceholder"
              :aria-label="t('workoutDetail.bodyweightLabel')"
            />
            <span class="unit">kg</span>
          </div>
          <small v-if="showBodyweightHint" class="bodyweight-hint">{{ t('workoutDetail.bodyweightHint') }}</small>
        </div>

          <div id="exercises" ref="exListRef" class="ex-list glass" :class="{ reordering: isReordering }">

          <div class="ex-list-header">
            <div class="ex-list-actions">
              <button class="primary add-exercise-btn" type="button" @click="showAddExerciseModal = true">
                <Plus class="btn-icon" aria-hidden="true" /> {{ t('workoutDetail.addExercise') }}
              </button>
              <div class="ex-list-actions-row">
                <button v-if="!isFavoriteAdjustMode" class="secondary timer-config-btn" type="button" @click="showTimerConfig = true">
                  <Clock class="btn-icon" aria-hidden="true" /> Timer
                </button>
                <button class="secondary reorder-toggle" type="button" :aria-pressed="isReordering" @click="toggleReorder">
                  {{ isReordering ? t('workoutDetail.done') : t('workoutDetail.editOrder') }}
                </button>
              </div>
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
              ><GripVertical class="btn-icon" aria-hidden="true" /></button>
            <div class="ex-info" :class="{ minimal: isReordering }">
              <template v-if="isReordering">
                <strong class="ex-name-only">{{ getTranslatedExerciseName(ex.name) }}</strong>
              </template>
              <template v-else>
                <!-- Übungskopf (UI-Überarbeitung): Name, Trainingsart-Chip und "⋮"-Menü. Bild, 1RM
                     und Entfernen liegen im Menü (openExerciseMenu), "Dein Feedback" unten neben
                     "+ Satz" (wird meist nach der Übung ausgefüllt). Das Vorschaubild bleibt
                     (Wunsch Paul: gerade für Einsteiger hilfreich), Tippen öffnet Bild/Video. -->
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
                    <div class="ex-title-actions">
                      <button
                        v-if="showTrainingTypeControl"
                        type="button"
                        class="training-type-chip"
                        :aria-label="t('workoutDetail.trainingTypeAria', { name: getTranslatedExerciseName(ex.name) })"
                        @click="openTrainingTypeModal(i)"
                      >{{ trainingTypeChipText(i) }}</button>
                      <button
                        type="button"
                        class="ex-more-btn"
                        :aria-label="t('workoutDetail.exerciseMenuAria', { name: getTranslatedExerciseName(ex.name) })"
                        @click="openExerciseMenu(i)"
                      >⋮</button>
                    </div>
                  </div>
                  <small>{{ getTranslatedMuscleGroup ? getTranslatedMuscleGroup(ex.muscleGroup) : ex.muscleGroup }}</small>
                  <p v-if="ex.description" class="ex-description">{{ ex.description }}</p>

                  <div v-if="showOneRepMax && showOneRepMax[i]" class="one-rep-max-field" style="margin-top: 4px;">
                    <label :for="`one-rep-max-${i}`">
                      {{ isOneRepMaxAddedWeightExercise(ex)
                        ? t('workoutDetail.oneRepMaxLabelAddedWeight')
                        : t('workoutDetail.oneRepMaxLabel') }}
                    </label>
                    <div class="one-rep-max-input-row">
                      <input
                        :id="`one-rep-max-${i}`"
                        type="number"
                        min="0"
                        max="500"
                        step="0.5"
                        inputmode="decimal"
                        :placeholder="t('workoutDetail.oneRepMaxPlaceholder')"
                        :value="getOneRepMaxInput(i)"
                        :disabled="oneRepMaxSaving[i]"
                        @input="setOneRepMaxInput(i, $event.target.value)"
                        @blur="saveOneRepMaxForExercise(i)"
                        @keydown.enter="$event.target.blur()"
                      />
                      <span class="unit">kg</span>
                    </div>
                    <small v-if="isOneRepMaxAddedWeightExercise(ex)" class="one-rep-max-hint">{{ t('workoutDetail.oneRepMaxHintAddedWeight') }}</small>
                    <small v-else class="one-rep-max-hint">{{ t('workoutDetail.oneRepMaxHint') }}</small>
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
                      <p class="media-disclaimer">{{ t('workoutDetail.mediaDisclaimer') }}</p>
                      <button class="close-btn" @click="closeExerciseMedia">OK</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div v-if="!isReordering" class="ex-sets">

              <!-- Hinweis vor dem Eintragen (UI-Überarbeitung): Steigern / Knapp dran / Halten /
                   Explosiv / Ziel als farbiger Kasten oben statt einer Zeile unter den Sätzen. -->
              <div
                v-if="showProgressionHints && (repTargetsByIndex[i] || goalByIndex[i] === 'explosive')"
                class="progression-callout"
                :class="`progression-callout--${progressionStateFor(i)}`"
              >
                <span>{{ progressionHintText(i) }}</span>
                <!-- Erklärung (FAQ-Text) als Fenster direkt im Workout: kein Seitenwechsel, laufende
                     Stoppuhr/Timer bleiben unberührt. -->
                <button
                  type="button"
                  class="progression-info-btn"
                  :aria-label="t('workoutDetail.weightSuggestionInfo')"
                  @click="showWeightSuggestionInfo = true"
                >
                  <Info class="btn-icon btn-icon--inline" aria-hidden="true" />
                </button>
              </div>

              <!-- Spaltenkopf immer sichtbar; "kg" steht nur hier, nicht mehr in jedem Feld. -->
              <div v-if="(ex.setDetails || []).length" class="set-row header">
                <span class="col set">{{ t('workoutDetail.set') }}</span>
                <span class="col reps">{{ t('workoutDetail.reps') }}</span>
                <span class="col weight">{{ t('workoutDetail.weightKgShort') }}</span>
                <span class="col actions"></span>
              </div>

              <!-- Aufwärmsätze einklappbar: offen, bis der erste Arbeitssatz abgehakt ist. -->
              <button
                v-if="hasWarmupSets(ex)"
                type="button"
                class="warmup-toggle"
                :aria-expanded="isWarmupOpen(i)"
                @click="toggleWarmups(i)"
              >{{ isWarmupOpen(i) ? '▾' : '▸' }} {{ t('workoutDetail.warmupSetsLabel') }} ({{ warmupCount(ex) }})</button>
              <template
                v-for="(row, rIdx) in (ex.setDetails || [])"
                :key="`${ex.exerciseId || i}-row-${rIdx}`"
              >
                <!-- Aufwärmsätze werden nicht abgehakt (zählen nie für Vorschlag/Prüfung). -->
                <div v-if="row.isWarmup && isWarmupOpen(i)" class="set-row warmup-row" :data-set-index="rIdx">
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
                          :aria-label="t('workoutDetail.incrementReps')"
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
                          :aria-label="t('workoutDetail.decrementReps')"
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
                          :placeholder="t('workoutDetail.weightKgShort')"
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
                            :aria-label="t('workoutDetail.incrementWeight')"
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
                            :aria-label="t('workoutDetail.decrementWeight')"
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
                    </div>
                  </span>
                  <span class="col actions">
                    <button class="remove-row-btn" :title="t('workoutDetail.removeWarmupSet')" @click="removeSetRow(i, rIdx)"><Minus class="btn-icon" aria-hidden="true" /></button>
                  </span>
                </div>
              </template>
              <div v-if="!hasWarmupSets(ex) || isWarmupOpen(i)" class="row-actions warmup-actions" :class="{ 'warmup-actions--empty': !hasWarmupSets(ex) }">
                <button class="add-warmup-btn" @click="addWarmupSetRow(i, $event)"><Plus class="btn-icon btn-icon--inline" aria-hidden="true" /> {{ t('workoutDetail.addWarmupSet') }}</button>
              </div>

              <!-- Arbeitssätze -->
              <div v-if="hasWarmupSets(ex)" class="sets-section-divider"></div>
              <div class="sets-section-label working-label">{{ t('workoutDetail.workingSetsLabel') }}</div>
              <template
                v-for="(row, rIdx) in (ex.setDetails || [])"
                :key="`${ex.exerciseId || i}-working-row-${rIdx}`"
              >
                <div v-if="!row.isWarmup" class="set-row" :class="{ 'set-row-empty': !setTrackingActive && isRowEmpty(row), 'set-row--open': !isRowDone(row), 'set-row--done': setTrackingActive && isRowDone(row), 'set-row--next': nextSetHighlight.exIndex === i && nextSetHighlight.rowIndex === rIdx }" :data-set-index="rIdx">
                  <span class="col set">
                    <!-- Abhaken (laufendes Workout): Nummer antippen = Satz gemacht, nochmal = zurück.
                         Nicht abgehakte Sätze erscheinen grau (übernommene Werte vom letzten Mal). -->
                    <button
                      v-if="setTrackingActive"
                      type="button"
                      class="set-done-btn"
                      :class="{ done: isRowDone(row) }"
                      :aria-pressed="isRowDone(row)"
                      :aria-label="t(isRowDone(row) ? 'workoutDetail.setUndoneAria' : 'workoutDetail.setDoneAria', { set: getSetLabel(ex.setDetails, rIdx) })"
                      @click="toggleRowDone(row, i, rIdx)"
                    >{{ isRowDone(row) ? '✓' : getSetLabel(ex.setDetails, rIdx) }}</button>
                    <template v-else>{{ getSetLabel(ex.setDetails, rIdx) }}</template>
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
                          :placeholder="repsPlaceholderFor(i)"
                          @focus="trackFieldAnchor(i, rIdx, 'reps')"
                          @click="trackFieldAnchor(i, rIdx, 'reps')"
                          @input="() => { clampRowValueNullable(row, 'reps', 0, 500, 1); triggerAutoSave() }"
                          @wheel.prevent="onNumberWheel($event, row, 'reps', 1, 0, 500)"
                          @keydown="onNumberKeyDown($event, false)"
                          @focus.prevent="openPicker(row, 'reps', 1, 0, 500, '', repTargetsByIndex[i]?.min || 0)"
                          @click.prevent="openPicker(row, 'reps', 1, 0, 500, '', repTargetsByIndex[i]?.min || 0)"
                        />
                        <div v-if="!isMobile" class="spinner-vertical">
                        <button
                          type="button"
                          class="spin-btn up"
                          :aria-label="t('workoutDetail.incrementReps')"
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
                          :aria-label="t('workoutDetail.decrementReps')"
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
                          :placeholder="t('workoutDetail.weightKgShort')"
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
                            :aria-label="t('workoutDetail.incrementWeight')"
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
                            :aria-label="t('workoutDetail.decrementWeight')"
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
                    </div>
                  </span>
                  <span class="col actions">
                    <button class="remove-row-btn" :title="t('workoutDetail.removeSet')" @click="removeSetRow(i, rIdx)"><Minus class="btn-icon" aria-hidden="true" /></button>
                  </span>
                </div>
              </template>

              <!-- Unten: "+ Satz" und "Dein Feedback" (wird meist nach der Übung ausgefüllt). -->
              <div class="row-actions ex-bottom-actions">
                <button class="add-row-btn" :title="t('workoutDetail.addSet')" @click="addSetRow(i, $event)"><Plus class="btn-icon btn-icon--inline" aria-hidden="true" /> {{ t('workoutDetail.addSet') }}</button>
                <span class="ex-note-actions">
                  <button class="link" :class="{ 'has-note': !!getNote(i) }" :aria-expanded="!!(showNote && showNote[i])" @click="toggleNote(i)">
                    <StickyNote class="btn-icon btn-icon--inline" aria-hidden="true" />
                    {{ t('workoutDetail.noteAdd') }}<span v-if="getNote(i)" class="note-check" aria-hidden="true"> ✓</span>
                  </button>
                  <button
                    v-if="getNote(i)"
                    class="link danger"
                    :aria-label="t('workoutDetail.deleteNoteConfirmTitle')"
                    @click="askDeleteNote(i)"
                  >
                    <Trash2 class="btn-icon btn-icon--inline" aria-hidden="true" />
                  </button>
                </span>
              </div>
              <div v-if="showNote && showNote[i]" class="ex-note-field">
                <OneTimeHint
                  hint-id="first-exercise-note"
                  :title="t('onboarding.hintFirstNoteTitle')"
                  :text="t('onboarding.hintFirstNoteText')"
                />
                <textarea :value="getNote(i)" rows="2" style="width:100%;resize:vertical" :placeholder="t('workoutDetail.notePlaceholder')" @input="setNote(i, $event.target.value)"></textarea>
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
            <button v-else class="primary save-btn" :disabled="saving" @click="saveWorkout(false)">
              {{ saving ? t('workoutDetail.saving') : (isFavoriteAdjustMode ? t('workoutDetail.adjustSave') : (showFavoriteUpdateOption ? t('workoutDetail.saveOnly') : t('workoutDetail.save'))) }}
            </button>
            <button
              v-if="!isReordering && showFavoriteUpdateOption"
              class="secondary favorite-save"
              type="button"
              :disabled="saving"
              @click="saveWorkout(true)"
            >
              {{ saving ? t('workoutDetail.saving') : t('workoutDetail.saveAndUpdateFavorite') }}
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

    <!-- "Kurz prüfen" vor dem finalen Speichern (utils/saveReview.js): vergessene Sätze,
         auffällige Werte, fehlendes Feedback in EINEM Fenster. Blockiert nie. Tipp auf einen
         Eintrag schließt das Fenster und springt zur Übung (nichts wird gespeichert). -->
    <AppModal
      v-model="showSaveReviewModal"
      :title="t('workoutDetail.reviewTitle')"
      :confirm-text="saveReview.hasOpenSets ? t('workoutDetail.reviewRemoveOpen') : t('workoutDetail.reviewSaveAnyway')"
      :cancel-text="t('workoutDetail.reviewBack')"
      :extra-text="saveReview.hasOpenSets ? t('workoutDetail.reviewMarkAllDone') : ''"
      type="warning"
      @confirm="onReviewConfirm"
      @extra="onReviewMarkAllDone"
    >
      <div v-if="saveReview.forgotten.length" class="review-group">
        <div class="review-group-title">{{ t('workoutDetail.reviewForgotten') }}</div>
        <button
          v-for="(item, k) in saveReview.forgotten"
          :key="`f-${k}`"
          type="button"
          class="review-item"
          @click="jumpToExerciseFromReview(item.exIndex)"
        >
          <span>{{ reviewItemText(item) }}</span>
          <span class="review-item-chevron" aria-hidden="true">›</span>
        </button>
      </div>
      <div v-if="saveReview.check.length" class="review-group">
        <div class="review-group-title">{{ t('workoutDetail.reviewCheck') }}</div>
        <button
          v-for="(item, k) in saveReview.check"
          :key="`c-${k}`"
          type="button"
          class="review-item"
          @click="jumpToExerciseFromReview(item.exIndex)"
        >
          <span>{{ reviewItemText(item) }}</span>
          <span class="review-item-chevron" aria-hidden="true">›</span>
        </button>
      </div>
      <!-- Früher eigener Button "Später bewerten" im Feedback-Fenster - jetzt als Häkchen,
           damit alles in einem Fenster bleibt. Nur sichtbar, wenn Feedback fehlt. -->
      <label v-if="saveReview.check.some((c) => c.kind === 'missingFeedback')" class="review-defer">
        <input v-model="reviewDeferAi" type="checkbox" />
        <span>
          {{ t('workoutDetail.reviewDeferAi') }}
          <small>{{ t('workoutDetail.missingNotesDeferHint') }}</small>
        </span>
      </label>
    </AppModal>

    <AppModal
      v-model="showTimerActionModal"
      :title="t('workoutDetail.timerActiveTitle')"
      :confirm-text="t('workoutDetail.timerKeepRunning')"
      :cancel-text="t('workoutDetail.timerPause')"
      type="warning"
      @confirm="onTimerDecision('continue')"
      @cancel="onTimerDecision('pause')"
    >
      <div class="timer-decision-body">
        <p>{{ t('workoutDetail.timerActiveQuestion') }}</p>
        <button class="timer-stop-btn" type="button" @click="onTimerDecision('stop')">
          {{ t('workoutDetail.timerStop') }}
        </button>
      </div>
    </AppModal>

    <AppModal
      v-model="showWeightSuggestionInfo"
      :title="t('faqs.weightSuggestion')"
      :confirm-text="t('common.close')"
      :show-cancel="false"
      type="info"
    >
      <p
        v-for="(paragraph, pi) in t('faqs.weightSuggestionText').split('\n\n')"
        :key="pi"
        class="weight-suggestion-info-text"
      >{{ paragraph }}</p>
    </AppModal>

    <!-- "⋮"-Menü einer Übung: Nebenaktionen (Bild/Video, 1RM, Übung entfernen). -->
    <AppModal
      v-model="showExerciseMenu"
      :title="exerciseMenuName"
      :confirm-text="t('common.close')"
      :show-cancel="false"
      type="info"
    >
      <div v-if="exerciseMenuExercise" class="exercise-menu-actions">
        <button type="button" class="exercise-menu-btn" @click="exerciseMenuShowMedia">
          {{ t('workoutDetail.exerciseMenuMedia') }}
        </button>
        <button
          v-if="isOneRepMaxRelevant(exerciseMenuExercise, exerciseMenuIndex)"
          type="button"
          class="exercise-menu-btn"
          @click="exerciseMenuOneRepMax"
        >
          {{ getOneRepMaxDisplay(exerciseMenuIndex) != null
            ? t('workoutDetail.oneRepMaxValue', { value: getOneRepMaxDisplay(exerciseMenuIndex) })
            : t('workoutDetail.oneRepMaxAdd') }}
        </button>
        <!-- Eigene Übungen: 1RM-Verfolgung per Opt-in (siehe oneRepMaxExercises.js). -->
        <label v-if="isCustomExercise(exerciseMenuExercise)" class="exercise-menu-toggle">
          <input
            type="checkbox"
            :checked="getIsCustomOneRepMaxTrackingEnabled(exerciseMenuIndex)"
            @change="toggleTrackOneRepMax(exerciseMenuIndex)"
          />
          {{ t('workoutDetail.trackOneRepMax') }}
        </label>
        <button type="button" class="exercise-menu-btn danger" @click="exerciseMenuRemove">
          {{ t('workoutDetail.exerciseMenuRemove') }}
        </button>
      </div>
    </AppModal>

    <!-- Trainingsart einer Übung (Kraft / Muskelaufbau / Explosiv). -->
    <AppModal
      v-model="showTrainingTypeModal"
      :title="t('workoutDetail.trainingTypeTitle')"
      :confirm-text="t('workoutDetail.trainingTypeApply')"
      :cancel-text="t('common.cancel')"
      type="info"
      @confirm="applyTrainingType"
    >
      <p class="training-type-exercise">{{ trainingTypeModalName }}</p>
      <div class="training-type-options" role="radiogroup" :aria-label="t('workoutDetail.trainingTypeTitle')">
        <button
          v-for="opt in trainingTypeOptions"
          :key="opt.value"
          type="button"
          role="radio"
          class="training-type-option"
          :class="{ active: trainingTypeChoice === opt.value }"
          :aria-checked="trainingTypeChoice === opt.value"
          @click="trainingTypeChoice = opt.value"
        >
          <strong>{{ opt.label }}</strong>
          <span>{{ opt.description }}</span>
        </button>
      </div>
      <p class="training-type-default">{{ t('workoutDetail.trainingTypeDefault', { type: t(`workoutDetail.trainingType_${trainingTypeModalDefault}`) }) }}</p>
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
    <!-- Pausentimer zwischen Sätzen (startet beim Abhaken, siehe toggleRowDone). -->
    <RestTimerBar :next-set="restNextSet" @remember="rememberRestForExercise" />

    <!-- Speichern-Overlay -->
    <Transition name="save-fade">
      <div v-if="saving" class="saving-overlay" role="status" aria-live="assertive" aria-busy="true">
        <div class="saving-card">
          <div class="saving-spinner spin-indicator" aria-hidden="true"></div>
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
    toast.show(t('workoutDetail.exerciseAlreadyAdded'), { type: 'warning', duration: 2000 })
    showAddExerciseModal.value = false
    selectedExerciseToAdd.value = null
    return
  }
  workout.value.exercises.push({
    exerciseId: selectedId,
    // Immer den englischen Namen speichern, auch bei deutscher App-Sprache (User-Feedback:
    // deutsche Namen klingen z.T. sehr merkwürdig, z.B. "Hebel-Wadenpresse"). Siehe
    // getEnglishExerciseName() in exerciseTranslation.js.
    name: getEnglishExerciseName(selectedExerciseToAdd.value),
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
  // Lädt ein evtl. bereits für diese Übung hinterlegtes 1RM nach (z.B. wenn dieselbe Übung
  // schon früher in einem anderen Workout trainiert und dort ein 1RM eingetragen wurde) -
  // die neue Übung selbst wird durch den watch(workout, ...) oben nicht automatisch erfasst,
  // da hier direkt ins bestehende Array gepusht wird (keine Neuzuweisung von workout.value).
  loadOneRepMaxData()
  toast.show(t('workoutDetail.exerciseAdded'), { type: 'success', duration: 1500 })
}
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { getCurrentInstance } from 'vue'
import NumberPicker from '@/components/NumberPicker.vue'
import { useExerciseTranslation, getEnglishExerciseName } from '@/utils/exerciseTranslation'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { getRepTarget, getProgressionStatus, isNoLoadExercise, resolveExerciseGoal, sanitizeExerciseTrainingType, classifyExercise, compatibleSessions, splitMainAndBackoffSets, getWorkingSets } from '@/utils/weightSuggestion'
import { prepareHistoryCandidates, findRecentSessionExercises } from '@/utils/lastSessionLookup'
import { sanitizeWorkoutGoal } from '@/utils/workoutGoal'
import WorkoutGoalPicker from '@/components/WorkoutGoalPicker.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { resolveExerciseMedia, buildExerciseMediaUrl } from '@/utils/assetResolver'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { getWorkoutOffline, getExerciseOffline, getAllExercisesOffline, getAllWorkoutsOffline, saveWorkoutOffline, db, deleteMetadata } from '@/utils/offlineStorage'
import { fetchWorkout, deleteWorkout as deleteWorkoutApi, fetchOneRepMaxForExercises, saveOneRepMax as saveOneRepMaxApi, saveTrackOneRepMax as saveTrackOneRepMaxApi } from '@/api/workouts'
import { isDefaultExerciseOneRepMaxEligible, isAddedWeightOneRepMaxExercise } from '@/utils/oneRepMaxExercises'
// import { fetchExercise, fetchExercises } from '@/api/exercises'
import { useUserStore } from '@/stores/userStore'
import { useAuthStore } from '@/stores/authStore'
import HeaderBar from '@/components/HeaderBar.vue'
import OneTimeHint from '@/components/OneTimeHint.vue'
import AppModal from '@/components/AppModal.vue'
import ExerciseList from '@/components/ExerciseList.vue'
import WorkoutTimerConfig from '@/components/timer/WorkoutTimerConfig.vue'
import SessionStopwatch from '@/components/SessionStopwatch.vue'
// Einheitliches Icon-Set statt Emoji/ASCII-Mix (🗑️/📝/⋮⋮/▲▼/＋/−) - wie im Rest der App
// (siehe z.B. BottomNav.vue, AiFeedbackRatingWidget.vue) bereits lucide-vue-next genutzt.
import { Clock, Trash2, StickyNote, GripVertical, Plus, Minus, Info, Weight } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toastStore'
import { useTimerStore } from '@/stores/timerStore'
import { useI18n } from 'vue-i18n'
import { stripWorkoutNameDate } from '@/utils/workoutName'
import { logger } from '@/utils/logger'
import { buildWorkoutNotesSummary } from '@/utils/workoutNotes'
import { resolveRealIdFromDraftId as _resolveRealIdFromDraftId, snapshotCore } from '@/utils/workoutHelpers'
import { logDiagnostic } from '@/utils/diagnosticsLog'
import { useWorkoutPicker } from '@/composables/useWorkoutPicker'
import { useWorkoutExerciseOrdering } from '@/composables/useWorkoutExerciseOrdering'
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
import { getActiveDraft, setActiveDraft, findActiveDraftByWorkoutId } from '@/utils/activeWorkoutDraft'
import {
  clearAllDetailDraftSnapshots as clearAllDetailDraftSnapshotsUtil,
  clearAllWorkoutMapKeys as clearAllWorkoutMapKeysUtil,
  getViewStateWorkoutId as getViewStateWorkoutIdUtil,
  readDetailViewState as readDetailViewStateUtil,
  writeDetailViewState as writeDetailViewStateUtil
} from '@/utils/workoutDetailPersistState'
import { normalizeWorkoutForSave } from '@/utils/workoutDetailSaveFlow'
import { startAiWarmup } from '@/utils/aiWarmup'
import { buildCatalogIndex, findCatalogEntry } from '@/utils/exerciseMatch'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { restSecondsFor, sanitizeCustomRest } from '@/utils/restTimerRules'
import RestTimerBar from '@/components/timer/RestTimerBar.vue'
import { buildSaveReview, removeOpenSets, markAllSetsDone } from '@/utils/saveReview'
import {
  shouldKeepAsDraft as shouldKeepAsDraftUtil,
  clearActiveDraftForCurrentUser as clearActiveDraftForCurrentUserUtil,
  saveActiveDraftDirect as saveActiveDraftDirectUtil,
  persistActiveDraftFromLifecycle as persistActiveDraftFromLifecycleUtil
} from '@/utils/workoutDetailLifecycle'
import { discardDraftAndLeaveFlow } from '@/utils/workoutDetailDiscardFlow'
import {
  goDashboard as goDashboardFlow,
  confirmLeave as confirmLeaveFlow,
  applyPendingTimerAction as applyPendingTimerActionFlow,
  onTimerDecision as onTimerDecisionFlow
} from '@/utils/workoutDetailNavigationFlow'
import {
  sleep as sleepUtil,
  resolveActiveWorkoutUserId as resolveActiveWorkoutUserIdUtil,
  parseUidFromToken as parseUidFromTokenUtil,
  resolveActiveWorkoutUserIdForSave as resolveActiveWorkoutUserIdForSaveUtil,
  isFavoriteSourceRoute as isFavoriteSourceRouteUtil,
  getFavoriteSourceMeta as getFavoriteSourceMetaUtil,
  getLastSetFromExercise as getLastSetFromExerciseUtil,
  waitForRealIdFromDraftId as waitForRealIdFromDraftIdUtil
} from '@/utils/workoutDetailIdentityHelpers'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'

const userStore = useUserStore()
const authStore = useAuthStore()

function handleSessionTime({ totalMs, formattedTime }) {
  console.log('Session-Zeit:', formattedTime, totalMs)
  // später: Wert an SaveWorkoutService übergeben
}

async function postSaveCleanup() {
  clearActiveDraftForCurrentUser('post-save')
  try { await db.workouts.delete('draft') } catch {}
  clearAllDetailDraftSnapshotsUtil()
  clearAllWorkoutMapKeysUtil()
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
// Katalog-Index (utils/exerciseMatch.js): Zuordnung über ID, Namen, frühere Namen (aliases) und
// unabhängig von der Wortreihenfolge - z.B. "Barbell Bench Press" (vom Generator) findet
// "bench press barbell" (Katalog 0025) samt Video. Vorher nur exakter Namensvergleich.
const defaultExerciseIndex = ref(buildCatalogIndex([]))
async function loadDefaultExerciseMap() {
  try {
    defaultExerciseIndex.value = buildCatalogIndex(await loadDefaultExercises())
  } catch {
    defaultExerciseIndex.value = buildCatalogIndex([])
  }
}

function lookupDefaultExercise(ex) {
  return ex ? findCatalogEntry(defaultExerciseIndex.value, ex) : null
}
// Optional: eigene Übersetzungsfunktion für Muskelgruppen
const getTranslatedMuscleGroup = (mg) => mg

const store = userStore
const toast = useToastStore()
const timerStore = useTimerStore()
const hasTimerOverlay = computed(() => Boolean(timerStore?.miniVisible && timerStore?.isActive))
const isFavoriteAdjustMode = computed(() => String(route.query?.favoriteAdjust || '') === '1')
// Workout wurde über "Favorit starten" o.ä. mit einem verknüpften Favoriten begonnen (nicht
// zu verwechseln mit isFavoriteAdjustMode, wo gar keine echte Session läuft, sondern nur das
// Favoriten-Template bearbeitet wird). In diesem Fall bietet der Abschluss-Dialog zwei
// Optionen an: nur speichern, oder zusätzlich den verknüpften Favoriten mit den Werten
// dieser Session aktualisieren (siehe performSaveWorkout(updateFavorite)).
const showFavoriteUpdateOption = computed(() => isFavoriteSourceRoute() && !isFavoriteAdjustMode.value)
// Client-seitiger Näherungswert für das nachträgliche Bearbeitungsfenster abgeschlossener
// Workouts (siehe loadWorkout()). Rein für UX/Vorabschätzung - maßgeblich ist immer der
// Server (WORKOUT_EDIT_WINDOW_HOURS Env-Var in server/routes/workouts.js), der bei
// abweichender Konfiguration das letzte Wort hat.
const WORKOUT_EDIT_WINDOW_HOURS_CLIENT = 24
const workout = ref(null)
const loading = ref(false)
const error = ref('')
// Körpergewicht heute (optional, pro Workout) - Feld existiert im Backend bereits seit längerem
// (Workout.athleteBodyweightKg), hatte aber bisher kein Client-UI zum Erfassen. Bewusst als
// eigenständiger, reiner Zahlenwert erfasst statt als Teil eines Profils (siehe Rückbau der
// früheren "persönliche Angaben"-Funktion) - erlaubt eine echte Zeitreihe pro Session statt
// eines einzelnen, selten aktualisierten Profilwerts. Null-Annahmen-Prinzip: leer/ungültig -> null,
// niemals ein Platzhalter- oder geschätzter Wert.
const athleteBodyweightKg = computed({
  get() {
    const v = workout.value?.athleteBodyweightKg
    return (typeof v === 'number' && Number.isFinite(v)) ? v : null
  },
  set(val) {
    if (!workout.value) return
    const num = Number(val)
    const clean = (val === null || val === '' || !Number.isFinite(num)) ? null : Math.max(0, Math.min(400, num))
    workout.value = { ...workout.value, athleteBodyweightKg: clean }
    triggerAutoSave()
  }
})
// Gesetzt, wenn ein bereits abgeschlossenes Workout innerhalb des nachträglichen
// Bearbeitungsfensters geöffnet wurde (siehe loadWorkout()) - hält die Deadline (ms seit
// Epoch) für den Hinweisbanner im Template. null = kein abgeschlossenes Workout bzw. kein
// bekanntes Fenster (z.B. sehr alte Workouts ohne completedAt).
const editWindowDeadline = ref(null)
// Steuert, ob der Infotext zum Körpergewichtsfeld sichtbar ist (siehe .bodyweight-field im
// Template) - standardmäßig eingeklappt, damit das Feld oben in der Ansicht weniger Platz
// einnimmt (User-Feedback: Feld soll ganz oben stehen, Infotext hinter einem Info-Button).
const showBodyweightHint = ref(false)
const saving = ref(false)
const saveMsg = ref('')
const saveError = ref(false)
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
const supportsPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined'
const isDirty = ref(false)
const didAutoScroll = ref(false)
let initialSnapshot = ''
const showLeaveModal = ref(false)
const showTimerConfig = ref(false)
const sessionStopwatchStore = useSessionStopwatchStore()

// Notiz-Logik
const showNote = ref([])
const exerciseNotes = ref([])

// 1RM (geschätztes Maximalgewicht für 1 Wiederholung) pro Übung - siehe
// UserExerciseNote.estimatedOneRepMaxKg im Backend, Regel 19 in OpenAIProvider.js. Bewusst
// getrennt vom Notiz-State oben: 1RM ist übungsgebunden UND nutzerweit (nicht pro Workout-
// Session), wird also nicht über den normalen Workout-Speicherfluss, sondern direkt bei
// Änderung per eigenem API-Call persistiert (siehe saveOneRepMaxForExercise()).
const showOneRepMax = ref([])
// lowercased exerciseName -> { estimatedOneRepMaxKg, oneRepMaxUpdatedAt } (nur vorhanden, wenn
// tatsächlich ein Wert hinterlegt ist - Null-Annahmen-Prinzip)
const oneRepMaxByExerciseName = ref({})
// Rohwert des Eingabefelds pro Übungsindex, während der Nutzer tippt (String, damit z.B. "82,5"
// beim Tippen nicht sofort zu einer geparsten Zahl gezwungen wird)
const oneRepMaxInputs = ref([])
const oneRepMaxSaving = ref([])

// "Kurz prüfen" vor dem finalen Speichern (utils/saveReview.js, ersetzt das frühere reine
// Notizen-Fenster): vergessene Sätze, auffällige Werte, fehlendes Feedback. Der User kann
// zurück zur Übung springen oder trotzdem speichern.
const showSaveReviewModal = ref(false)
const saveReview = ref({ forgotten: [], check: [], hasOpenSets: false, isEmpty: true })
const reviewDeferAi = ref(false)
let notesCheckAcknowledged = false
// Merkt sich die gewählte Speicher-Option ("nur speichern" vs. "speichern + Favorit
// aktualisieren"), während der Prüf-/Timer-Guard-Dialog dazwischenkommt, damit die
// ursprüngliche Nutzerwahl beim tatsächlichen Speichern (performSaveWorkout) erhalten bleibt.
let pendingUpdateFavoriteOnSave = false
// Mobile detection (treat app as mobile-only if touch available or narrow)
const isMobile = ref(typeof window !== 'undefined' && ('ontouchstart' in window || window.innerWidth <= 768))

// Picker- und Reorder-Interaktionslogik ausgelagert (Auslagerungsplan "Schritt 1:
// UI-Interaction-Composables") - reine 1:1-Extraktion ohne Verhaltensänderung, siehe
// composables/useWorkoutPicker.js und composables/useWorkoutExerciseOrdering.js.
const {
  pickerVisible,
  pickerValue,
  pickerConfig,
  openPicker,
  onPickerConfirm,
  onPickerCancel,
  swallowPickerGhostClick,
  suppressNextOpen,
  getLastPickerCloseAt
} = useWorkoutPicker({ isMobile, onValueChanged: () => { try { triggerAutoSave() } catch {} } })

const {
  isReordering,
  draggingIndex,
  dropTargetIndex,
  exListRef,
  toggleReorder,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onPointerDown,
  onTouchStart,
  stopDrag,
  cleanupPointerDragListeners
} = useWorkoutExerciseOrdering(workout)

function shouldKeepAsDraft(workoutLike) {
  return shouldKeepAsDraftUtil({ route, workoutLike, isFavoriteSourceRoute })
}

function resolveRealIdFromDraftId(id) {
  return _resolveRealIdFromDraftId(id, route)
}

function sleep(ms) {
  return sleepUtil(ms)
}

async function waitForRealIdFromDraftId(id) {
  const realId = await waitForRealIdFromDraftIdUtil({
    id,
    resolveRealIdFromDraftId,
    route
  })
  if (realId) {
    logger.debug('[WorkoutDetail] realId gefunden', { draftId: id, realId })
  }
  return realId || ''
}

function resolveActiveWorkoutUserId() {
  return resolveActiveWorkoutUserIdUtil({
    workout: workout.value,
    getCurrentUser,
    store,
    authStore
  })
}

function clearActiveDraftForCurrentUser(reason = 'unknown') {
  const uid = resolveActiveWorkoutUserId()
  return clearActiveDraftForCurrentUserUtil({ uid, reason, loggerInstance: logger })
}

function parseUidFromToken(token = null) {
  return parseUidFromTokenUtil(token)
}

async function resolveActiveWorkoutUserIdForSave() {
  return resolveActiveWorkoutUserIdForSaveUtil({
    workout: workout.value,
    getCurrentUser,
    store,
    authStore,
    getIdToken
  })
}

// Fallback für den Fall, dass die Route-Query (favoriteSource/favoriteId/...) beim App-Resume
// verloren gegangen ist (siehe activeWorkoutDraft.js) - sucht den zu diesem Workout gehörenden
// persistenten Draft und liest favoriteSource von dort. Gleiches Nachschlage-Muster wie an
// anderen Stellen dieser Datei (siehe findActiveDraftByWorkoutId-Kommentar).
function getDraftFavoriteSourceForCurrentWorkout() {
  const id = String(workout.value?._id || route.params.id || '').trim()
  if (!id) return null
  const match = findActiveDraftByWorkoutId(id)
  return match?.draft?.favoriteSource || null
}

function isFavoriteSourceRoute() {
  return isFavoriteSourceRouteUtil(route, getDraftFavoriteSourceForCurrentWorkout())
}

function getFavoriteSourceMeta() {
  return getFavoriteSourceMetaUtil({
    route,
    workout: workout.value,
    normalizeWorkoutType,
    draftFavoriteSource: getDraftFavoriteSourceForCurrentWorkout()
  })
}

function getLastSetFromExercise(exercise = {}) {
  return getLastSetFromExerciseUtil(exercise)
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
      ...(sanitizeExerciseTrainingType(exercise.trainingType) ? { trainingType: exercise.trainingType } : {}),
      ...(sanitizeCustomRest(exercise.restSeconds) ? { restSeconds: exercise.restSeconds } : {}),
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
  // DIAGNOSE (Temp-ID/Real-ID-Race-Verdacht): Zeitpunkt + IDs beim Scheduling festhalten,
  // damit sich im Log nachvollziehen lässt, ob zwischen Scheduling und Feuern des Timers
  // eine ID-Migration (route.params.id-Watcher weiter unten) oder ein loadWorkout()-Reload
  // dazwischenfunkt. Rein lesend, ändert kein Verhalten.
  const scheduledAtMs = Date.now()
  const scheduledRouteId = String(route.params.id || '')
  const scheduledWorkoutId = String(workout.value?._id || '')
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    logDiagnostic('autosave-fired', {
      scheduledRouteId,
      scheduledWorkoutId,
      currentRouteId: String(route.params.id || ''),
      currentWorkoutId: String(workout.value?._id || ''),
      idsDriftedSinceSchedule: scheduledRouteId !== String(route.params.id || '') || scheduledWorkoutId !== String(workout.value?._id || ''),
      delayMs: Date.now() - scheduledAtMs
    })
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
  return getViewStateWorkoutIdUtil({ route, workout: workout.value })
}

function readDetailViewState() {
  return readDetailViewStateUtil()
}

function writeDetailViewState(reason = 'unknown') {
  const anchor = lastFieldAnchor.value
  return writeDetailViewStateUtil({
    route,
    workout: workout.value,
    lastFieldAnchor: anchor,
    storage: localStorage,
    reason
  })
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
        // Flag nach kurzer Verzögerung zurücksetzen, falls der Fokus aus irgendeinem
        // Grund keinen Picker-Trigger auslöst (z.B. Desktop, kein Mobile-Picker aktiv)
        suppressNextOpen(300)
        input.focus({ preventScroll: true })
      } catch {}
    })
  } catch {}
}
// Initialisiere Notiz-Arrays, wenn Workout geladen wird
watch(workout, (w) => {
  if (w && Array.isArray(w.exercises)) {
    showNote.value = w.exercises.map(ex => !!ex.note)
    exerciseNotes.value = w.exercises.map(ex => typeof ex.note === 'string' ? ex.note : '')
    showOneRepMax.value = w.exercises.map(() => false)
    oneRepMaxInputs.value = w.exercises.map(() => undefined)
    loadOneRepMaxData()
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

// --- 1RM (geschätztes Maximalgewicht für 1 Wiederholung) pro Übung -----------------------

function oneRepMaxKeyFor(idx) {
  return String(workout.value?.exercises?.[idx]?.name || '').trim().toLowerCase()
}

// Nur wo fachlich sinnvoll anzeigen (Absprache mit dem Nutzer nach Live-Test: die ursprüngliche
// equipment-basierte Heuristik ("equipment != Körpergewicht") war zu ungenau - z.B. Bizeps-Curls
// oder Seitheben mit Kurzhantel hätten das Feld gezeigt). Jetzt zwei Fälle:
// 1) Übung ist in den Default-Übungsdaten bekannt -> exakte ID-Whitelist entscheidet
//    (siehe oneRepMaxExercises.js: Back/Front Squat, Bench, Deadlift, Overhead Press,
//    gewichtete Klimmzüge/Dips, Power Clean/Clean/Snatch/Clean and Jerk).
// 2) Übung ist eigen/unbekannt (kein Treffer in den Default-Daten) -> standardmäßig AUS, nur
//    wenn der Nutzer explizit "Maximalkraft für diese Übung verfolgen" aktiviert hat
//    (UserExerciseNote.overrides.trackOneRepMax) - bewusstes Opt-in statt "im Zweifel
//    anzeigen", siehe getIsCustomOneRepMaxTrackingEnabled().
function isOneRepMaxRelevant(ex, idx) {
  const mapped = lookupDefaultExercise(ex)
  if (mapped) {
    return isDefaultExerciseOneRepMaxEligible(mapped.id || mapped._id)
  }
  return getIsCustomOneRepMaxTrackingEnabled(idx)
}

// Zeigt bei gewichteten Klimmzügen/Dips einen klärenden Hinweis, dass der Wert das
// Zusatzgewicht (nicht das Gesamtgewicht inkl. Körpergewicht) meint (Absprache mit dem
// Nutzer: "bei dips ist das gewicht immer als zusatzgewicht gemeint zu körpergewicht").
function isOneRepMaxAddedWeightExercise(ex) {
  const mapped = lookupDefaultExercise(ex)
  return mapped ? isAddedWeightOneRepMaxExercise(mapped.id || mapped._id) : false
}

function isCustomExercise(ex) {
  return !lookupDefaultExercise(ex)
}

function getIsCustomOneRepMaxTrackingEnabled(idx) {
  const key = oneRepMaxKeyFor(idx)
  const stored = key ? oneRepMaxByExerciseName.value[key] : null
  return stored?.trackOneRepMax === true
}

// Toggle im UI für Custom-/unbekannte Übungen ("Maximalkraft für diese Übung verfolgen") -
// speichert sofort (analog zu saveOneRepMaxForExercise()), unabhängig vom Workout-Speicherfluss.
async function toggleTrackOneRepMax(idx) {
  const exerciseName = String(workout.value?.exercises?.[idx]?.name || '').trim()
  if (!exerciseName) return
  const next = !getIsCustomOneRepMaxTrackingEnabled(idx)
  try {
    const token = await getIdToken().catch(() => null)
    await saveTrackOneRepMaxApi(exerciseName, next, token)
    const key = exerciseName.toLowerCase()
    const existing = oneRepMaxByExerciseName.value[key] || {}
    oneRepMaxByExerciseName.value = {
      ...oneRepMaxByExerciseName.value,
      [key]: { ...existing, trackOneRepMax: next }
    }
    if (!next) {
      // Ausschalten klappt auch das Eingabefeld direkt wieder zu, statt es leer offen zu lassen.
      showOneRepMax.value[idx] = false
    }
  } catch (e) {
    logger.warn('⚠️ 1RM-Tracking-Einstellung konnte nicht gespeichert werden', e?.message)
    toast.show(t('workoutDetail.settingSaveFailed'), { type: 'error', duration: 2500 })
  }
}

function toggleOneRepMax(idx) {
  showOneRepMax.value[idx] = !showOneRepMax.value[idx]
}

function getOneRepMaxDisplay(idx) {
  const key = oneRepMaxKeyFor(idx)
  const stored = key ? oneRepMaxByExerciseName.value[key] : null
  return (typeof stored?.estimatedOneRepMaxKg === 'number') ? stored.estimatedOneRepMaxKg : null
}

function getOneRepMaxInput(idx) {
  if (typeof oneRepMaxInputs.value[idx] !== 'undefined') return oneRepMaxInputs.value[idx]
  const stored = getOneRepMaxDisplay(idx)
  return stored != null ? String(stored) : ''
}

function setOneRepMaxInput(idx, val) {
  oneRepMaxInputs.value[idx] = val
}

// Lädt die hinterlegten 1RM-Werte für alle Übungen des aktuell geöffneten Workouts auf einmal -
// aufgerufen, sobald das Workout (oder eine neu hinzugefügte Übung) vorliegt.
async function loadOneRepMaxData() {
  const names = (workout.value?.exercises || []).map(ex => String(ex?.name || '').trim()).filter(Boolean)
  if (!names.length) return
  try {
    const token = await getIdToken().catch(() => null)
    const result = await fetchOneRepMaxForExercises(names, token)
    const byName = {}
    for (const [name, data] of Object.entries(result?.oneRepMaxByExercise || {})) {
      byName[String(name || '').trim().toLowerCase()] = data
    }
    oneRepMaxByExerciseName.value = byName
  } catch (e) {
    logger.warn('⚠️ 1RM-Daten konnten nicht geladen werden', e?.message)
  }
}

// Speichert das 1RM sofort bei Verlassen des Eingabefelds (nicht Teil von triggerAutoSave() -
// siehe Kommentar am State oben, eigener, übungsgebundener/nutzerweiter Datensatz).
async function saveOneRepMaxForExercise(idx) {
  const exerciseName = String(workout.value?.exercises?.[idx]?.name || '').trim()
  if (!exerciseName) return
  const raw = getOneRepMaxInput(idx)
  const trimmed = String(raw ?? '').trim()
  const clearing = trimmed === ''
  const num = clearing ? null : Number(trimmed.replace(',', '.'))
  if (!clearing && (!Number.isFinite(num) || num <= 0 || num > 500)) {
    toast.show(t('workoutDetail.oneRepMaxInvalid'), { type: 'warning', duration: 2500 })
    return
  }
  oneRepMaxSaving.value[idx] = true
  try {
    const token = await getIdToken().catch(() => null)
    const result = await saveOneRepMaxApi(exerciseName, num, token)
    const key = exerciseName.toLowerCase()
    const next = { ...oneRepMaxByExerciseName.value }
    // trackOneRepMax (Custom-Übungs-Toggle) bleibt erhalten, unabhängig davon, ob gerade ein
    // Wert gesetzt oder gelöscht wird - beides sind unabhängige Felder auf derselben Notiz.
    const existingTrackFlag = next[key]?.trackOneRepMax
    if (clearing && !existingTrackFlag) {
      delete next[key]
    } else {
      next[key] = {
        estimatedOneRepMaxKg: result.estimatedOneRepMaxKg,
        oneRepMaxUpdatedAt: result.oneRepMaxUpdatedAt,
        ...(existingTrackFlag ? { trackOneRepMax: true } : {})
      }
    }
    oneRepMaxByExerciseName.value = next
    oneRepMaxInputs.value[idx] = clearing ? '' : String(result.estimatedOneRepMaxKg)
    toast.show(clearing ? '1RM entfernt' : '1RM gespeichert', { type: 'success', duration: 1500 })
  } catch (e) {
    logger.warn('⚠️ 1RM speichern fehlgeschlagen', e?.message)
    toast.show(t('workoutDetail.oneRepMaxSaveFailed'), { type: 'error', duration: 2500 })
  } finally {
    oneRepMaxSaving.value[idx] = false
  }
}

// --- "Kurz prüfen" vor dem Speichern (utils/saveReview.js) -------------------------------
function computeSaveReview() {
  return buildSaveReview({
    exercises: workout.value?.exercises || [],
    trackingActive: setTrackingActive.value,
    getNote,
    lastSessions: lastSessionByIndex.value,
    repTargets: repTargetsByIndex.value,
    noLoad: progressionInfoByIndex.value.map((info) => isNoLoadExercise(info))
  })
}

function reviewItemText(item) {
  const params = {
    name: getTranslatedExerciseName(item.name),
    sets: item.sets,
    set: item.set,
    weight: formatKg(item.weight),
    lastWeight: formatKg(item.lastWeight),
    reps: item.reps,
    target: item.target
  }
  const keys = {
    openSets: item.count === 1 ? 'reviewOpenSet' : 'reviewOpenSets',
    noSets: 'reviewNoSets',
    weightOutlier: 'reviewWeightOutlier',
    zeroWeight: 'reviewZeroWeight',
    zeroReps: 'reviewZeroReps',
    repsOutlier: 'reviewRepsOutlier',
    missingFeedback: 'reviewMissingFeedback'
  }
  return t(`workoutDetail.${keys[item.kind] || 'reviewMissingFeedback'}`, params)
}

function proceedAfterReview() {
  notesCheckAcknowledged = true
  saveWorkout(pendingUpdateFavoriteOnSave, { deferAiFeedback: reviewDeferAi.value })
}

// Hervorgehobener Button: mit offenen Sätzen "Nicht abgehakte entfernen", sonst "Trotzdem speichern".
function onReviewConfirm() {
  if (saveReview.value.hasOpenSets && workout.value) {
    workout.value.exercises = removeOpenSets(workout.value.exercises)
  }
  proceedAfterReview()
}

function onReviewMarkAllDone() {
  if (workout.value) workout.value.exercises = markAllSetsDone(workout.value.exercises)
  proceedAfterReview()
}

// Tipp auf einen Eintrag: Fenster zu, zur Übung scrollen - es wird nichts gespeichert, Stoppuhr
// und Timer laufen weiter.
function jumpToExerciseFromReview(exIndex) {
  showSaveReviewModal.value = false
  nextTick(() => {
    try {
      document.querySelector(`[data-ex-index="${exIndex}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {}
  })
}

// --- Kompakte Titelzeile ------------------------------------------------------
// Neue Workouts heißen z.B. "Leg Day - 23.9.2026" (siehe WorkoutBuilder.vue). Das Datum steht
// rechts separat, deshalb hier nur für die Anzeige abschneiden (de- und en-Datumsformat).
const displayWorkoutName = computed(() => stripWorkoutNameDate(workout.value?.name))

const workoutDateLabel = computed(() => {
  const raw = workout.value?.date
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return t('common.today')
  const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
  const opts = { weekday: 'short', day: '2-digit', month: '2-digit' }
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString(loc, opts)
})

// Zuletzt eingetragenes Körpergewicht aus einem anderen (früheren) Workout - nur Platzhalter.
const bodyweightPlaceholder = computed(() => {
  const currentId = String(workout.value?._id || workout.value?.id || '')
  const candidates = (userStore.workouts || [])
    .filter((w) => w && String(w._id || w.id || '') !== currentId)
    .filter((w) => typeof w.athleteBodyweightKg === 'number' && Number.isFinite(w.athleteBodyweightKg) && w.athleteBodyweightKg > 0)
    .sort((a, b) => new Date(b.date || b.updatedAt || 0) - new Date(a.date || a.updatedAt || 0))
  const last = candidates[0]?.athleteBodyweightKg
  if (!last) return '—'
  const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(last)
})

// --- Gewichtsvorschlag (doppelte Progression, siehe utils/weightSuggestion.js) -------------
// Nur während eines laufenden Workouts: nicht beim nachträglichen Bearbeiten abgeschlossener
// Workouts und nicht im Favoriten-Anpassen-Modus. Reiner Hinweis - es wird nichts eingetragen,
// kein Auto-Save ausgelöst und der bestehende Eingabe-Flow bleibt unverändert.
const progressionSettings = useSettingsStore()
const progressionHistory = ref([])
const progressionCatalog = ref([])

// Ziel des laufenden Workouts (beim Erstellen abgefragt, danach fest). Workouts von vor dieser
// Änderung haben kein Ziel -> zuletzt gewähltes Ziel, sonst Muskelaufbau.
const progressionGoal = computed(() =>
  sanitizeWorkoutGoal(workout.value?.goal) || progressionSettings.lastWorkoutGoal || 'hypertrophy'
)

// Nur im Favoriten-Anpassen-Modus änderbar (siehe Template).
const favoriteAdjustGoal = computed({
  get: () => sanitizeWorkoutGoal(workout.value?.goal) || '',
  set: (value) => {
    const goal = sanitizeWorkoutGoal(value)
    if (!workout.value || !goal || !isFavoriteAdjustMode.value) return
    workout.value = { ...workout.value, goal }
  }
})

const showProgressionHints = computed(() =>
  !!workout.value && workout.value.completed !== true && !isFavoriteAdjustMode.value
)

// --- Sätze abhaken ------------------------------------------------------------------------
// Nur im laufenden Workout (gleiche Bedingung wie die Progressions-Hinweise). Beim Bearbeiten
// abgeschlossener Workouts und im Favoriten-Anpassen-Modus gelten alle Sätze als gemacht.
// Im laufenden Workout zählt nur done === true (vorausgefüllte Sätze haben kein done-Feld).
const setTrackingActive = showProgressionHints

// Laufendes Workout: Server + KI-Relay wach halten, damit das Feedback beim Speichern ohne
// Kaltstart-Wartezeit kommt (utils/aiWarmup.js, Render Free-Plan).
let stopAiWarmup = null
watch(setTrackingActive, (active) => {
  if (active && !stopAiWarmup) stopAiWarmup = startAiWarmup()
  if (!active && stopAiWarmup) { stopAiWarmup(); stopAiWarmup = null }
}, { immediate: true })
onBeforeUnmount(() => {
  if (stopAiWarmup) { stopAiWarmup(); stopAiWarmup = null }
})

function isRowDone(row) {
  if (!setTrackingActive.value || row?.isWarmup) return true
  return row?.done === true
}

function toggleRowDone(row, exIndex = -1, rowIndex = -1) {
  if (!row || !setTrackingActive.value) return
  row.done = !isRowDone(row)
  // Pausentimer: Satz fertig -> Pause startet jetzt (nicht nach fester Arbeitszeit - wie lange
  // ein Satz dauert, weiß die App nicht). Haken wieder weg -> diese Pause abbrechen.
  if (row.done && !row.isWarmup && exIndex >= 0) {
    if (restTimer.autoStart) {
      const name = getTranslatedExerciseName(workout.value?.exercises?.[exIndex]?.name || '')
      restTimer.start({
        seconds: restSecondsForIndex(exIndex),
        exerciseName: name,
        exIndex,
        rowIndex,
        notifyTitle: t('restTimer.notifyTitle'),
        notifyBody: t('restTimer.notifyBody', { name })
      })
    }
  } else if (!row.done) {
    restTimer.stopFor(exIndex, rowIndex)
  }
  try { triggerAutoSave() } catch {}
}

// --- Pausentimer -----------------------------------------------------------------------------
const restTimer = useRestTimerStore()

// Dauer: gemerkte Dauer der Übung > Standard je Trainingsart/Übungsart (restTimerRules.js).
function restSecondsForIndex(index) {
  const ex = workout.value?.exercises?.[index]
  const type = classifyExercise(progressionInfoByIndex.value[index] || {})
  return restSecondsFor(goalByIndex.value[index], type, customRestForIndex(index))
}

// Gemerkte Pause: an der Übung, sonst aus der letzten Session dieser Übung (bleibt so auch ohne
// Favoriten-Update von Session zu Session erhalten - wie bei der Trainingsart).
function customRestForIndex(index) {
  const ex = workout.value?.exercises?.[index]
  return sanitizeCustomRest(ex?.restSeconds) || sanitizeCustomRest(lastSessionByIndex.value[index]?.restSeconds) || null
}

// Platzhalter im leeren Wiederholungsfeld: der Bereich, den die App auswertet (Kraft 1-6,
// Muskelaufbau 8-12) - keine erfundene Zahl.
function repsPlaceholderFor(index) {
  const target = repTargetsByIndex.value[index]
  return target ? t('workoutDetail.repsPlaceholder', { min: target.min, max: target.max }) : ''
}

// Neue Workouts (Generator/manuell) starten mit leeren Sätzen. Gibt es eine frühere Session
// DERSELBEN Trainingsart, werden deren Hauptsätze übernommen (grau, bis abgehakt) - wie bei
// Favoriten. Nur leere Sätze werden gefüllt, eingetragene Werte bleiben unangetastet.
function prefillEmptyExercisesFromHistory() {
  if (!setTrackingActive.value || isFavoriteSourceRoute()) return
  const exercises = workout.value?.exercises || []
  exercises.forEach((ex, index) => {
    const rows = (ex?.setDetails || []).filter((row) => row && !row.isWarmup)
    if (!rows.length) return
    const isEmpty = (row) => (row.reps == null || row.reps === '' || Number(row.reps) === 0)
      && (row.weight == null || row.weight === '' || Number(row.weight) === 0)
    if (!rows.every(isEmpty)) return
    const info = progressionInfoByIndex.value[index] || {}
    const [last] = compatibleSessions(info, recentSessionsByIndex.value[index] || [], goalByIndex.value[index])
    const split = last ? splitMainAndBackoffSets(getWorkingSets(last)) : null
    if (!split?.main?.length) return
    rows.forEach((row, k) => {
      const source = split.main[Math.min(k, split.main.length - 1)]
      row.reps = source.reps
      row.weight = source.weight
    })
  })
}

// "Für diese Übung merken" in der Pausen-Leiste: gilt ab jetzt für diese Übung, wird mit dem
// Workout gespeichert und in den Favoriten übernommen (exercise.restSeconds).
function rememberRestForExercise({ exIndex, seconds }) {
  const ex = workout.value?.exercises?.[exIndex]
  const value = sanitizeCustomRest(seconds)
  if (!ex || !value) return
  ex.restSeconds = value
  if (!isFavoriteAdjustMode.value) {
    try { triggerAutoSave() } catch {}
  }
}

// Pausentimer-Vollbild: nächster offener Arbeitssatz ab der Übung der laufenden Pause (diese
// Übung zuerst, sonst die folgenden). Satznummer zählt nur Arbeitssätze, wie in der Tabelle.
const restNextSet = computed(() => {
  if (!restTimer.isVisible || restTimer.exIndex < 0) return null
  const exercises = workout.value?.exercises || []
  for (let i = restTimer.exIndex; i < exercises.length; i++) {
    let setNumber = 0
    for (const row of exercises[i]?.setDetails || []) {
      if (!row || row.isWarmup) continue
      setNumber += 1
      if (row.done !== true) {
        return {
          name: getTranslatedExerciseName(exercises[i]?.name || ''),
          setNumber,
          reps: row.reps,
          weight: row.weight
        }
      }
    }
  }
  return null
})

// Pause vorbei: nächsten offenen Arbeitssatz dieser Übung kurz hervorheben.
const nextSetHighlight = ref({ exIndex: -1, rowIndex: -1 })
let nextSetHighlightTimer = null
watch(() => restTimer.finishedAt, (finishedAt) => {
  if (!finishedAt) return
  const exIndex = restTimer.exIndex
  const sets = workout.value?.exercises?.[exIndex]?.setDetails || []
  const rowIndex = sets.findIndex((row) => row && !row.isWarmup && row.done !== true)
  if (rowIndex < 0) return
  nextSetHighlight.value = { exIndex, rowIndex }
  clearTimeout(nextSetHighlightTimer)
  nextSetHighlightTimer = setTimeout(() => { nextSetHighlight.value = { exIndex: -1, rowIndex: -1 } }, 5000)
})
restTimer.restore()
onBeforeUnmount(() => clearTimeout(nextSetHighlightTimer))

async function loadProgressionData() {
  const currentId = String(workout.value?._id || workout.value?.id || '')
  try {
    const userId = resolveActiveWorkoutUserId()
    const history = userId ? await getAllWorkoutsOffline({ userId }).catch(() => []) : []
    progressionHistory.value = prepareHistoryCandidates(history, currentId)
  } catch (e) {
    logger.debug('[WorkoutDetail] Historie für Gewichtsvorschlag nicht verfügbar', e?.message)
    progressionHistory.value = []
  }
  try {
    progressionCatalog.value = await loadDefaultExercises()
  } catch {
    progressionCatalog.value = []
  }
}

// Einmal pro geöffnetem Workout laden (nicht bei jeder Eingabe).
watch(
  () => (showProgressionHints.value ? String(workout.value?._id || workout.value?.id || '') : ''),
  (id) => { if (id) loadProgressionData() },
  { immediate: true }
)

const progressionCatalogIndex = computed(() => buildCatalogIndex(progressionCatalog.value))

function findCatalogEntryForProgression(ex) {
  return findCatalogEntry(progressionCatalogIndex.value, ex || {})
}

function progressionInfo(ex) {
  const cat = findCatalogEntryForProgression(ex) || {}
  return {
    name: ex?.name,
    name_en: cat.name_en,
    category: cat.category_raw || cat.category || ex?.category,
    equipment: cat.equipment || ex?.equipment,
    equipment_en: cat.equipment_en || ex?.equipment_en,
    aiMetadata: cat.aiMetadata || ex?.aiMetadata
  }
}

// Hängt nur von Identität der Übungen (Name/ID/Muskelgruppe) ab, nicht von eingetippten Werten.
const progressionInfoByIndex = computed(() =>
  (workout.value?.exercises || []).map((ex) => progressionInfo({
    name: ex?.name, exerciseId: ex?.exerciseId, _id: ex?._id, category: ex?.category,
    equipment: ex?.equipment, equipment_en: ex?.equipment_en, aiMetadata: ex?.aiMetadata
  }))
)

// --- Trainingsart pro Übung ---------------------------------------------------------------
// Wirksame Trainingsart: eigene Wahl an der Übung > Wahl aus der letzten Session dieser Übung
// (damit eine einmal getroffene Wahl auch ohne Favoriten-Update erhalten bleibt) > automatisch
// "Explosiv" > Workout-Ziel. Siehe resolveExerciseGoal in utils/weightSuggestion.js.
function trainingTypeOverride(index) {
  const ex = workout.value?.exercises?.[index]
  return sanitizeExerciseTrainingType(ex?.trainingType)
    || sanitizeExerciseTrainingType(lastSessionByIndex.value[index]?.trainingType)
    || null
}

const goalByIndex = computed(() =>
  progressionInfoByIndex.value.map((info, index) =>
    resolveExerciseGoal(info, progressionGoal.value, trainingTypeOverride(index))
  )
)

// Im laufenden Workout und beim Anpassen eines Favoriten (dort wird die Wahl im Favoriten gespeichert).
const showTrainingTypeControl = computed(() => !!workout.value && workout.value.completed !== true)

const repTargetsByIndex = computed(() =>
  progressionInfoByIndex.value.map((info, index) =>
    isNoLoadExercise(info) ? null : getRepTarget(info, goalByIndex.value[index], { sessions: recentSessionsByIndex.value[index] || [] })
  )
)

const showTrainingTypeModal = ref(false)
const trainingTypeModalIndex = ref(-1)
const trainingTypeChoice = ref('')

const trainingTypeModalName = computed(() =>
  getTranslatedExerciseName(workout.value?.exercises?.[trainingTypeModalIndex.value]?.name || '')
)

// Voreinstellung ohne eigene Wahl (Workout-Ziel bzw. automatisch explosiv) - zur Info im Fenster.
const trainingTypeModalDefault = computed(() => {
  const info = progressionInfoByIndex.value[trainingTypeModalIndex.value] || {}
  return resolveExerciseGoal(info, progressionGoal.value, null)
})

const trainingTypeOptions = computed(() => {
  const info = progressionInfoByIndex.value[trainingTypeModalIndex.value] || {}
  const sessions = recentSessionsByIndex.value[trainingTypeModalIndex.value] || []
  const strengthTarget = getRepTarget(info, 'strength', { sessions })
  return [
    {
      value: 'strength',
      label: t('workoutDetail.trainingType_strength'),
      // Isolationsübungen laufen auch im Kraft-Workout im Bereich 8-12 (Zubehör).
      description: strengthTarget?.mode === 'range'
        ? t('workoutDetail.trainingTypeStrengthAccessoryDesc')
        : t('workoutDetail.trainingTypeStrengthDesc')
    },
    { value: 'hypertrophy', label: t('workoutDetail.trainingType_hypertrophy'), description: t('workoutDetail.trainingTypeHypertrophyDesc') },
    { value: 'explosive', label: t('workoutDetail.trainingType_explosive'), description: t('workoutDetail.trainingTypeExplosiveDesc') }
  ]
})

function openTrainingTypeModal(index) {
  trainingTypeModalIndex.value = index
  trainingTypeChoice.value = goalByIndex.value[index] || 'hypertrophy'
  showTrainingTypeModal.value = true
}

// Kurzform im Übungskopf: "Kraft · 5 Wdh." / "Explosiv".
function trainingTypeChipText(index) {
  const goal = goalByIndex.value[index]
  const label = t(`workoutDetail.trainingType_${goal || 'hypertrophy'}`)
  const target = repTargetsByIndex.value[index]
  if (goal === 'explosive' || !target) return label
  // Bereich (8-12) bzw. festes Schema "5x5" (Sätze = Arbeitssätze dieser Übung).
  if (target.mode === 'range') return t('workoutDetail.trainingTypeChipRange', { type: label, min: target.min, max: target.max })
  const sets = (workout.value?.exercises?.[index]?.setDetails || []).filter((row) => row && !row.isWarmup).length
  return sets
    ? t('workoutDetail.trainingTypeChipScheme', { type: label, sets, reps: target.target })
    : t('workoutDetail.trainingTypeChip', { type: label, reps: target.target })
}

// Zustand für die Farbe des Hinweiskastens.
function progressionStateFor(index) {
  const state = progressionStatusByIndex.value[index]?.state
  if (state) return state
  return goalByIndex.value[index] === 'explosive' ? 'explosive' : 'target'
}

// --- Aufwärmsätze einklappbar -----------------------------------------------------------
// Ohne eigene Wahl offen, bis der erste Arbeitssatz abgehakt ist (dann sind sie meist erledigt).
const warmupOpenOverride = ref({})

function warmupCount(ex) {
  return (ex?.setDetails || []).filter((row) => row?.isWarmup).length
}

function isWarmupOpen(index) {
  const own = warmupOpenOverride.value[index]
  if (typeof own === 'boolean') return own
  if (!setTrackingActive.value) return true
  const sets = workout.value?.exercises?.[index]?.setDetails || []
  return !sets.some((row) => row && !row.isWarmup && row.done === true)
}

function toggleWarmups(index) {
  warmupOpenOverride.value = { ...warmupOpenOverride.value, [index]: !isWarmupOpen(index) }
}

// --- "⋮"-Menü einer Übung -----------------------------------------------------------------
const showExerciseMenu = ref(false)
const exerciseMenuIndex = ref(-1)
const exerciseMenuExercise = computed(() => workout.value?.exercises?.[exerciseMenuIndex.value] || null)
const exerciseMenuName = computed(() => getTranslatedExerciseName(exerciseMenuExercise.value?.name || ''))

function openExerciseMenu(index) {
  exerciseMenuIndex.value = index
  showExerciseMenu.value = true
}

function exerciseMenuShowMedia() {
  const ex = exerciseMenuExercise.value
  showExerciseMenu.value = false
  if (ex) nextTick(() => openExerciseMedia(ex))
}

function exerciseMenuOneRepMax() {
  const index = exerciseMenuIndex.value
  showExerciseMenu.value = false
  if (!(showOneRepMax.value && showOneRepMax.value[index])) toggleOneRepMax(index)
}

function exerciseMenuRemove() {
  const index = exerciseMenuIndex.value
  showExerciseMenu.value = false
  nextTick(() => askRemoveExercise(index))
}

function applyTrainingType() {
  const ex = workout.value?.exercises?.[trainingTypeModalIndex.value]
  const choice = sanitizeExerciseTrainingType(trainingTypeChoice.value)
  if (!ex || !choice) return
  ex.trainingType = choice
  if (!isFavoriteAdjustMode.value) {
    try { triggerAutoSave() } catch {}
  }
}

// Erklärfenster zum Gewichtsvorschlag (ⓘ neben der Hinweiszeile, Text = FAQ-Eintrag).
const showWeightSuggestionInfo = ref(false)

// Dieselbe Übung aus der letzten abgeschlossenen Session (Basis für Hinweiszeile, Chip und die
// Speicher-Prüfung "Gewicht auffällig").
// Letzte bis zu 3 Sessions je Übung (neueste zuerst): Schema-Erkennung (5x5, 6x1 ...) und
// Bestätigungs-Regel bei Singles brauchen mehr als nur die letzte Session.
const recentSessionsByIndex = computed(() => {
  const candidates = progressionHistory.value
  return (workout.value?.exercises || []).map((ex) => findRecentSessionExercises(
    { name: ex?.name, exerciseId: ex?.exerciseId, _id: ex?._id, muscleGroup: ex?.muscleGroup },
    candidates,
    3
  ))
})

const lastSessionByIndex = computed(() => recentSessionsByIndex.value.map((list) => list[0] || null))

// Leere Sätze neuer Workouts aus einer passenden früheren Session füllen, sobald der Verlauf da ist.
watch(recentSessionsByIndex, () => prefillEmptyExercisesFromHistory())

// Steigern / Knapp dran / Halten (utils/weightSuggestion.js getProgressionStatus), null = nur Ziel.
const progressionStatusByIndex = computed(() =>
  lastSessionByIndex.value.map((last, index) =>
    getProgressionStatus(progressionInfoByIndex.value[index], last, goalByIndex.value[index], {
      previousSessions: (recentSessionsByIndex.value[index] || []).slice(1)
    })
  )
)


function progressionHintText(index) {
  const status = progressionStatusByIndex.value[index]
  const params = status
    ? { next: formatKg(status.suggestion?.suggestedWeights?.[0] ?? status.weight), weight: formatKg(status.weight), reps: status.targetReps, sets: status.sets, done: status.totalReps, total: status.targetTotal, missing: status.missingReps, nextReps: status.nextReps, min: status.min, max: status.max, minReps: status.minReps }
    : null
  // Bereich 8-12: "3x12 geschafft" statt "3x12" aus dem Ziel - Wiederholungen = erreichte Zahl.
  if (status?.state === 'increase' && status.aboveScheme) return t('workoutDetail.weightSuggestionReasonAbove', params)
  if (status?.state === 'increase') return t('workoutDetail.weightSuggestionReason', { ...params, reps: status.mode === 'range' ? status.max : status.targetReps })
  if (status?.state === 'climb' && status.belowRange) return t('workoutDetail.progressionBelowRange', params)
  if (status?.state === 'confirm') return t('workoutDetail.progressionConfirm', params)
  if (status?.state === 'climb') return t('workoutDetail.progressionClimb', params)
  if (status?.state === 'close') return t('workoutDetail.progressionClose', params)
  if (status?.state === 'hold') return t('workoutDetail.progressionHold', params)
  if (goalByIndex.value[index] === 'explosive') return t('workoutDetail.explosiveExplain')
  const target = repTargetsByIndex.value[index]
  if (target?.mode === 'range') return t('workoutDetail.repRangeExplain', { min: target.min, max: target.max })
  return t('workoutDetail.repTargetExplain', { reps: target?.target })
}

function formatKg(value) {
  const loc = (locale?.value || 'en').toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(value)
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

// Für den Hinweisbanner im Template - siehe editWindowDeadline in loadWorkout().
const editWindowDeadlineLabel = computed(() => editWindowDeadline.value ? formatDate(editWindowDeadline.value) : '')

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
      // Ein bereits abgeschlossenes Workout (completed:true) darf für eine gewisse Zeit nach
      // dem Abschluss noch nachträglich bearbeitet werden (z.B. vergessene Notiz/Gewicht
      // nachtragen) - siehe PUT /:id in server/routes/workouts.js für die maßgebliche,
      // serverseitige Durchsetzung des Fensters (dort per Env-Var konfigurierbar). Diese
      // clientseitige Prüfung ist nur eine UX-Vorabschätzung mit demselben Default (24h): sie
      // verhindert, dass der Nutzer ein längst abgelaufenes Workout überhaupt zu Gesicht
      // bekommt und dort Änderungen einträgt, die beim Speichern ohnehin serverseitig
      // abgelehnt würden - maßgeblich bleibt aber immer der Server-Check.
      editWindowDeadline.value = null
      const isRealServerId = requestedId !== 'draft'
        && !requestedId.startsWith('draft-')
        && !requestedId.startsWith('offline_')
      if (isRealServerId && workout.value.completed === true) {
        const completedAtMs = workout.value.completedAt ? new Date(workout.value.completedAt).getTime() : null
        // Fehlt completedAt (Workouts von vor Einführung dieses Felds), wird NICHT blockiert -
        // unbekannt statt fälschlich "abgelaufen" behandeln, siehe gleiche Logik server-seitig.
        const deadlineMs = completedAtMs ? completedAtMs + WORKOUT_EDIT_WINDOW_HOURS_CLIENT * 60 * 60 * 1000 : null
        if (deadlineMs && Date.now() > deadlineMs) {
          logger.warn('[WorkoutDetail] Zugriff außerhalb des Bearbeitungsfensters blockiert', { requestedId })
          toast.show(
            t('workoutDetail.editWindowExpired', { hours: WORKOUT_EDIT_WINDOW_HOURS_CLIENT }),
            { type: 'info', duration: 5000 }
          )
          router.replace('/stats')
          return
        }
        if (deadlineMs) {
          editWindowDeadline.value = deadlineMs
        }
      }
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
    error.value = (e && e.message) || t('workoutDetail.unknownError')
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
  const mapped = lookupDefaultExercise(ex)
  const mappedImage = typeof mapped?.imageUrl === 'string' && /\.gif($|[?#])/i.test(mapped.imageUrl) ? '' : mapped?.imageUrl
  return mapped?.thumbnailStaticUrl || mapped?.thumbnailUrl || mappedImage || '/exercises/play.svg'
}

function getExerciseLargeImage(ex) {
  const imageUrl = typeof ex?.imageUrl === 'string' ? resolveServerMediaUrl(ex.imageUrl) : ''
  const safeImage = /\.gif($|[?#])/i.test(imageUrl) ? '': imageUrl
  const direct = safeImage || ex?.thumbnailUrl
  if (direct) return direct
  const mapped = lookupDefaultExercise(ex)
  const mappedImage = typeof mapped?.imageUrl === 'string' && /\.gif($|[?#])/i.test(mapped.imageUrl) ? '' : mapped?.imageUrl
  return mappedImage || mapped?.thumbnailUrl || '/exercises/play.svg'
}

function openExerciseMedia(exercise) {
  if (!exercise || isReordering.value) return
  const requestId = ++mediaRequestId.value
  const mapped = lookupDefaultExercise(exercise)
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

function goToPostWorkoutSummary(workoutId, { deferred = false } = {}) {
  const id = String(workoutId || '').trim()
  logger.info('[WorkoutDetail] goToPostWorkoutSummary called', { workoutId, id, deferred })
  // DIAGNOSE: einziger Punkt, an dem alle Erfolgs-Zweige von performSaveWorkout() zusammen-
  // laufen - deckt "doppeltes Save-Event" auf, falls diese Funktion mehrfach aufgerufen wird.
  logDiagnostic('go-to-post-workout-summary', { workoutId, id, deferred })
  if (!id) {
    logger.warn('[WorkoutDetail] No workoutId, redirecting to dashboard')
    router.push('/dashboard')
    return
  }
  logger.info('[WorkoutDetail] Navigating to stats with postWorkout=1', { id, deferred })
  router.push({
    name: 'stats',
    query: {
      postWorkout: '1',
      workoutId: id,
      // Feature "Feedback später bewerten": PostWorkoutSummary.vue soll die KI-Analyse dann
      // NICHT automatisch anstoßen, sondern nur bestätigen, dass gespeichert wurde.
      ...(deferred ? { deferred: '1' } : {})
    }
  })
}

function shouldAutoScroll() {
  return route.query.created === '1' || route.query.focus === 'exercises' || route.hash === '#exercises'
}

async function discardDraftAndLeave() {
  const routeId = String(route.params.id || '')
  bypassTimerLeaveGuard.value = true
  await discardDraftAndLeaveFlow({
    route,
    workout: workout.value,
    store,
    db,
    getIdToken,
    isFavoriteAdjustMode: isFavoriteAdjustMode.value,
    suppressDraftPersistence,
    timerStore,
    router,
    clearActiveDraftForCurrentUser,
    clearAllDetailDraftSnapshots: clearAllDetailDraftSnapshotsUtil,
    clearAllWorkoutMapKeys: clearAllWorkoutMapKeysUtil,
    resolveRealIdFromDraftId,
    deleteWorkoutApiFn: deleteWorkoutApi
  })
  if (routeId) {
    logDiagnostic('discard-draft-and-leave', { routeId })
  }
}

function goDashboard() {
  goDashboardFlow({
    isFavoriteAdjustMode: isFavoriteAdjustMode.value,
    isDirty: isDirty.value,
    showLeaveModal,
    router,
    discardDraftAndLeave
  })
}

function confirmLeave() {
  confirmLeaveFlow({
    isFavoriteAdjustMode: isFavoriteAdjustMode.value,
    suppressDraftPersistence,
    router,
    discardDraftAndLeave
  })
}

async function applyPendingTimerAction() {
  await applyPendingTimerActionFlow({
    pendingTimerAction,
    performSaveWorkout,
    discardDraftAndLeave,
    bypassTimerLeaveGuard,
    router
  })
}

async function onTimerDecision(mode) {
  await onTimerDecisionFlow({
    mode,
    pendingTimerAction,
    showTimerActionModal,
    timerStore,
    applyPendingTimerAction
  })
}



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
  if (Array.isArray(showOneRepMax.value)) showOneRepMax.value.splice(exIndex, 1)
  if (Array.isArray(oneRepMaxInputs.value)) oneRepMaxInputs.value.splice(exIndex, 1)
  if (Array.isArray(oneRepMaxSaving.value)) oneRepMaxSaving.value.splice(exIndex, 1)

  try { triggerAutoSave() } catch {}
  toast.show(t('workoutDetail.exerciseRemoved'), { type: 'success', duration: 1500 })
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
    msSincePickerClose: getLastPickerCloseAt() ? Date.now() - getLastPickerCloseAt() : null,
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
  // Keine erfundenen Werte (User-Report: "10" und "0 kg" vorausgefüllt): Werte des letzten Satzes
  // übernehmen, sonst leer - Platzhalter zeigen den Zielbereich bzw. "kg".
  ex.setDetails.push({ reps: lastWorking?.reps ?? null, weight: lastWorking?.weight ?? null, isWarmup: false })
  try { triggerAutoSave() } catch {}
}

// Ob eine Übung bereits mindestens einen Aufwärmsatz hat - steuert, ob Label + Tabellenkopf
// für Aufwärmsätze überhaupt angezeigt werden (siehe Template). Vorher erschienen diese immer,
// auch ohne einen einzigen Aufwärmsatz, was unnötige Leerlauf-Struktur in jeder Übungskarte
// erzeugt hat.
function hasWarmupSets(ex) {
  return Array.isArray(ex?.setDetails) && ex.setDetails.some((row) => row?.isWarmup)
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
  if (!ex.setDetails[rowIndex]) return
  // Kein Mindest-1-Satz-Zwang mehr: sowohl Warm-up- als auch Arbeitssätze dürfen komplett
  // entfernt werden, sodass nur noch der jeweilige "+ Satz hinzufügen"-Button sichtbar bleibt
  // (User-Wunsch). Das Template rendert bei leerem setDetails ohnehin nur die Buttons (siehe
  // v-for über ex.setDetails im Template), es gibt also keinen leeren/kaputten Zwischenzustand.
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

// updateFavorite: explizite Nutzerwahl "Speichern + Favorit aktualisieren" (siehe
// saveWorkout()/showFavoriteUpdateOption). Ersetzt die frühere implizite, für den Nutzer
// unsichtbare Automatik (syncStartedFavoriteFromWorkout lief bisher immer mit, sobald diese
// Session aus einem Favoriten gestartet wurde - ohne Wahlmöglichkeit).
async function performSaveWorkout(updateFavorite = false, { deferAiFeedback = false } = {}) {
  // DIAGNOSE (User-Report "doppeltes Save-Event"): jeden Aufruf loggen, auch den vom Guard
  // abgewiesenen - bisher gab es dafür keine Sichtbarkeit im Diagnose-Log, nur Draft/Lifecycle-
  // Events waren dort protokolliert.
  if (saving.value) {
    logDiagnostic('save-blocked-duplicate', { id: String(route.params.id || '') })
    return // Guard gegen Doppel-Aufruf
  }
  logDiagnostic('save-start', { id: String(route.params.id || '') })
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
    const resolvedUserId = await resolveActiveWorkoutUserIdForSave()
    // Gesamttrainingsdauer kommt aus der Session-Stoppuhr (SessionStopwatch/Pinia-Store),
    // nicht mehr aus dem Pausen-Timer (timerStore) – der lief nur stückweise pro Satz.
    // Normalisierung (Dauer, Warmup-Filterung für reps/weight, Notizen-Zusammenbau) läuft
    // über den extrahierten Save-Flow-Util statt einer eigenen Inline-Kopie - siehe
    // utils/workoutDetailSaveFlow.js.
    const normalized = normalizeWorkoutForSave({
      // Eigene Trainingsart mitspeichern - auch wenn sie nur aus der letzten Session übernommen
      // wurde, damit die Wahl von Session zu Session erhalten bleibt.
      workout: { ...w, exercises: (w.exercises || []).map((ex, idx) => ({ ...ex, trainingType: trainingTypeOverride(idx) || undefined, restSeconds: customRestForIndex(idx) || undefined })) },
      exerciseNotes: exerciseNotes.value,
      sessionStopwatchStore,
      userId: resolvedUserId
    })
    // Wird weiter unten für die Erfolgsmeldung ("Gespeichert. Dauer: X min") gebraucht -
    // aus dem normalisierten Ergebnis lesen statt separat neu zu berechnen.
    const finalDurationMinutes = normalized.duration

    // Feature "Feedback später bewerten": markiert das Workout serverseitig als
    // "zurückgestellt" (siehe Workout.ai_feedback_status), damit die Feedback-Verlauf-Ansicht
    // es als ausstehend mit "Jetzt generieren"-Button zeigen kann, statt sofort unten
    // goToPostWorkoutSummary() die automatische KI-Analyse anzustoßen.
    if (deferAiFeedback) {
      normalized.ai_feedback_status = 'deferred'
    }

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
          toast.show(t('workoutDetail.favoriteUpdateFailed'), { type: 'error', duration: 4000 })
          saving.value = false
          suppressDraftPersistence.value = false
          releaseSaveKeepAwake()
          return
        }
        if (!updateResult?.success) {
          logger.warn('[WorkoutDetail] Favorit-Anpassen: Update fehlgeschlagen', updateResult?.code, updateResult?.message)
          if (updateResult?.code === 'NOT_FOUND') {
            toast.show(t('workoutDetail.favoriteNotFound'), { type: 'error', duration: 4000 })
            saving.value = false
            suppressDraftPersistence.value = false
            releaseSaveKeepAwake()
            return
          }
          if (updateResult?.code === 'INVALID_NAME') {
            toast.show(t('workoutDetail.favoriteNameInvalid'), { type: 'error', duration: 4000 })
            saving.value = false
            suppressDraftPersistence.value = false
            releaseSaveKeepAwake()
            return
          }
          // Unbekannter Fehlercode: Nutzer informieren, nicht still verlieren
          toast.show(t('workoutDetail.favoriteUpdateFailedCode', { code: updateResult?.code || t('common.unknown') }), { type: 'error', duration: 4000 })
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
        toast.show(t('workoutDetail.favoriteMissingId'), { type: 'error', duration: 4000 })
        saving.value = false
        suppressDraftPersistence.value = false
        releaseSaveKeepAwake()
        return
      }
      // Draft-Workout aus IndexedDB, Store UND sessionStorage entfernen.
      // sessionStorage muss zwingend geleert werden, sonst zeigt Dashboard diesen
      // Draft als "in Bearbeitung" an (readDetailDraft liest workout_detail_draft).
      // Bug-Fix: hieß fälschlich ohne "Util"-Suffix - die Funktion ist nur unter
      // clearAllDetailDraftSnapshotsUtil importiert (siehe oben), der alte Name warf einen
      // ReferenceError NACHDEM der Favorit bereits erfolgreich aktualisiert war und landete im
      // äußeren catch, der fälschlich die "Fehler beim Laden des Workouts"-Ansicht anzeigte.
      clearAllDetailDraftSnapshotsUtil()
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
      toast.show(t('workoutDetail.adjustSaved'), { type: 'success', duration: 2000 })
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
        if (updateFavorite) syncStartedFavoriteFromWorkout({ ...normalized, _id: realId })
        saveMsg.value = finalDurationMinutes > 0 ? `Gespeichert. Dauer: ${finalDurationMinutes} min` : 'Gespeichert.'
        if (updateFavorite) {
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
        goToPostWorkoutSummary(realId, { deferred: deferAiFeedback })
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
            ? t('workoutDetail.savedLocallyAuth')
            : t('workoutDetail.savedLocallyRetry')
          saveError.value = false
        }
      }

      try { await db.workouts.delete(id) } catch {}
      try {
        const idx = store.workouts.findIndex(wi => String(wi?._id || '') === String(id))
        if (idx !== -1) store.workouts.splice(idx, 1)
      } catch {}

      store.invalidateStatsCache()
      if (updateFavorite) syncStartedFavoriteFromWorkout({ ...createPayload, _id: savedWorkout?._id || id })
      if (!saveMsg.value) {
        saveMsg.value = finalDurationMinutes > 0 ? `Gespeichert. Dauer: ${finalDurationMinutes} min` : 'Gespeichert.'
        saveError.value = false
      }
      if (updateFavorite) {
        saveMsg.value += ' · Favorit aktualisiert'
        try { localStorage.removeItem(`fav_prefill_applied_v1_${savedWorkout?._id || id}`) } catch {}
      }
      initialSnapshot = snapshotCore({ ...createPayload, _id: savedWorkout?._id || id })
      await postSaveCleanup()
      timerStore.reset()
      sessionStopwatchStore.reset()
      bypassTimerLeaveGuard.value = true
      goToPostWorkoutSummary(savedWorkout?._id || id, { deferred: deferAiFeedback })
      return
    }

    let token = await getIdToken().catch(() => null)
    await store.updateWorkout(id, normalized, token)
    if (updateFavorite) syncStartedFavoriteFromWorkout({ ...normalized, _id: id })
    saveMsg.value = finalDurationMinutes > 0 ? `Gespeichert. Dauer: ${finalDurationMinutes} min` : 'Gespeichert.'
    if (updateFavorite) {
      saveMsg.value += ' · Favorit aktualisiert'
      try { localStorage.removeItem(`fav_prefill_applied_v1_${id}`) } catch {}
    }
    saveError.value = false
    initialSnapshot = snapshotCore({ ...w, ...normalized })
    await postSaveCleanup()
    timerStore.reset()
    sessionStopwatchStore.reset()
    bypassTimerLeaveGuard.value = true
    goToPostWorkoutSummary(id, { deferred: deferAiFeedback })
  } catch (e) {
    // workout.value.completed wurde vor dem ersten await auf true gesetzt.
    // Bei Fehler zurücksetzen, damit persistInProgressDraft() den Draft noch retten kann.
    if (workout.value) {
      workout.value = { ...workout.value, completed: false, _isDraft: true, isDraft: true }
    }
    suppressDraftPersistence.value = false
    error.value = e?.message || t('workoutDetail.saveFailed')
    saveMsg.value = t('workoutDetail.saveFailed')
    saveError.value = true
    releaseSaveKeepAwake()
    logDiagnostic('save-error', { id: String(route.params.id || ''), message: e?.message || String(e) })
  } finally {
    saving.value = false
    notesCheckAcknowledged = false
    logDiagnostic('save-end', { id: String(route.params.id || '') })
  }
}

// updateFavorite: true nur, wenn der Nutzer explizit "Speichern + Favorit aktualisieren"
// gewählt hat (siehe showFavoriteUpdateOption/Template) - ohne diese Wahl bleibt das
// verknüpfte Favoriten-Template unangetastet, auch wenn diese Session ursprünglich aus einem
// Favoriten gestartet wurde.
async function saveWorkout(updateFavorite = false, { deferAiFeedback = false } = {}) {
  // "Kurz prüfen" zuerst: läuft VOR dem Timer-Guard, damit es auch beim direkten Klick auf
  // "Speichern" greift (der Timer-Guard deferred den eigentlichen Save ohnehin über
  // pendingTimerAction -> performSaveWorkout(), würde die Prüfung also umgehen, wenn sie
  // erst danach käme). Im Favorit-Anpassen-Modus nicht relevant (kein echtes Workout-Save).
  if (!isFavoriteAdjustMode.value && !notesCheckAcknowledged) {
    const review = computeSaveReview()
    if (!review.isEmpty) {
      saveReview.value = review
      reviewDeferAi.value = false
      pendingUpdateFavoriteOnSave = updateFavorite
      showSaveReviewModal.value = true
      return
    }
  }
  // Im Adjust-Modus läuft kein Workout, Timer-Guard nicht anwenden
  if (!isFavoriteAdjustMode.value && timerStore.isRunningLike) {
    pendingTimerAction.value = { kind: 'save', updateFavorite, deferAiFeedback }
    showTimerActionModal.value = true
    return
  }
  await performSaveWorkout(updateFavorite, { deferAiFeedback })
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
    goal: source.goal,
    notes: buildWorkoutNotesSummary(source.exercises || []),
    exercises: (source.exercises || []).map((exercise, idx) => ({
      _id: exercise._id || exercise.exerciseId || null,
      exerciseId: exercise.exerciseId || exercise._id || null,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      category: exercise.category || source.type,
      sets: Number(exercise.sets) || Number(exercise.setDetails?.length) || 3,
      reps: Number(exercise.reps) || Number(exercise.setDetails?.[0]?.reps) || 10,
      weight: Number(exercise.weight) || Number(exercise.setDetails?.[0]?.weight) || 0,
      rest: Number(exercise.rest) || 90,
      ...(sanitizeExerciseTrainingType(exercise.trainingType) ? { trainingType: exercise.trainingType } : {}),
      ...(sanitizeCustomRest(exercise.restSeconds) ? { restSeconds: exercise.restSeconds } : {}),
      setDetails: Array.isArray(exercise.setDetails) && exercise.setDetails.length
        ? exercise.setDetails
        : [{
            reps: Number(exercise.reps) || 10,
            weight: Number(exercise.weight) || 0
          }],
      // User-Feedback: Notizen sollen im Favoriten mitgespeichert werden, damit beim nächsten
      // Start dieses Favoriten wieder sichtbar ist, was man sich letztes Mal notiert hat. Aus
      // exerciseNotes.value lesen (Live-Stand der Notiz-Eingabefelder), nicht nur aus
      // exercise.note (das wäre der Stand vom letzten Auto-Save, siehe getNote()/setNote()).
      note: (Array.isArray(exerciseNotes.value) && typeof exerciseNotes.value[idx] !== 'undefined')
        ? exerciseNotes.value[idx]
        : (typeof exercise.note === 'string' ? exercise.note : '')
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
    // Bug-Fix: Wenn dieses Workout bereits von einem Favoriten abstammt (favoriteId in der
    // Route, z.B. über "Favorit starten"/"Favorit anpassen"), muss der VORHANDENE Favorit
    // aktualisiert werden statt einen neuen anzulegen - saveFavoriteWorkout() legt immer neu
    // an und schlägt mit LIMIT_REACHED fehl, sobald der Typ bereits 10 Favoriten hat (leicht
    // erreicht, wenn man denselben Favoriten wiederholt über diesen Button "speichert" statt
    // ihn zu aktualisieren).
    const existingFavoriteId = String(route.query?.favoriteId || '').trim()
    const result = existingFavoriteId
      ? updateFavoriteWorkout({
          userId: getFavoriteUserId(),
          type,
          id: existingFavoriteId,
          name: nameCandidate,
          workout: sourceWorkout
        })
      : saveFavoriteWorkout({
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
  return saveActiveDraftDirectUtil({
    route,
    workout: workout.value,
    exerciseNotes: exerciseNotes.value,
    isDirty: isDirty.value,
    suppressDraftPersistence: suppressDraftPersistence.value,
    isFavoriteAdjustMode: isFavoriteAdjustMode.value,
    resolveActiveWorkoutUserIdFn: resolveActiveWorkoutUserId,
    shouldKeepAsDraftFn: shouldKeepAsDraft,
    getActiveDraftFn: getActiveDraft,
    setActiveDraftFn: setActiveDraft,
    loggerInstance: logger,
    diagnosticLogger: logDiagnostic,
    reason,
    forceIgnoreDirty
  })
}

async function persistActiveDraft(reason = '') {
  return saveActiveDraftDirect(reason, false)
}

function persistActiveDraftFromLifecycle(reason = 'unknown') {
  logDiagnostic('lifecycle-persist', { reason })
  return persistActiveDraftFromLifecycleUtil({
    route,
    workout: workout.value,
    exerciseNotes: exerciseNotes.value,
    isDirty: isDirty.value,
    suppressDraftPersistence: suppressDraftPersistence.value,
    isFavoriteAdjustMode: isFavoriteAdjustMode.value,
    resolveActiveWorkoutUserIdFn: resolveActiveWorkoutUserId,
    saveActiveDraftDirectFn: saveActiveDraftDirect,
    writeDetailViewStateFn: writeDetailViewState,
    reason
  })
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
  // DIAGNOSE (Temp-ID/Real-ID-Race-Verdacht): jedes Feuern loggen, auch der frühe Return,
  // inkl. ob gerade ein Auto-Save-Timer aussteht - der könnte mit veralteter ID feuern,
  // nachdem hier schon auf die neue ID migriert wurde. Rein lesend, kein Verhaltenswechsel.
  logDiagnostic('route-id-watch-fired', {
    oldId, newId,
    pendingAutoSaveTimer: autoSaveTimer !== null,
    workoutValueId: String(workout.value?._id || '')
  })
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
      clearAllDetailDraftSnapshotsUtil()
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

  // Kein Timer-Fenster beim Verlassen (Absprache Paul, 30.09.): Wechselt der Nutzer aus einem
  // laufenden Workout in einen anderen Tab, läuft der Timer einfach weiter - das Workout bleibt
  // aktiv (Entwurf ist oben gesichert, Timer ist app-weit sichtbar). Gefragt wird nur noch beim
  // Speichern (saveWorkout, pendingTimerAction 'save'). Beim Abbrechen setzt discardDraftAndLeave
  // den Timer selbst zurück.
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
.missing-notes-list { margin: 8px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.missing-notes-list li { font-weight: 600; }
.missing-notes-defer-hint { margin: 10px 0 0; font-size: 0.82rem; color: var(--muted); line-height: 1.4; }
.timer-stop-btn {
  align-self: flex-end;
  border: 1px solid color-mix(in srgb, var(--danger) 65%, black 35%);
  background: var(--danger, #dc2626);
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
.adjust-goal-picker {
  margin: 0 6px 12px;
}
.workout-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 6px 10px;
}
.workout-header h2 {
  margin: 0;
  font-size: 1.35rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workout-header-date {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 0.85rem;
}
.completed { color: var(--success); }
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
.ex-list-actions { display: flex; flex-direction: column; gap: 8px; align-items: stretch; width: 100%; }
.ex-list-header h3 { margin: 0; font-size: 1.1rem; }
/* Timer/Reihenfolge sind Werkzeuge, kein Haupt-Call-to-Action wie "Übung hinzufügen" -
   nebeneinander statt gestapelt und in der neutralen .secondary-Optik (siehe unten), damit sie
   nicht mehr optisch mit derselben Akzent-Intensität konkurrieren. Nur der aktive Reihenfolge-
   Modus bekommt weiterhin eine Akzent-Hervorhebung (siehe [aria-pressed="true"] unten), damit
   der Zustand weiterhin erkennbar bleibt. */
.ex-list-actions-row { display: flex; gap: 8px; width: 100%; }
.ex-list-actions-row > button { flex: 1; }
.reorder-toggle[aria-pressed="true"] {
  background: color-mix(in srgb, var(--accent) 20%, var(--bg-panel));
  color: var(--fg-strong);
  border-color: color-mix(in srgb, var(--accent) 65%, var(--line-strong));
}
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
/* Einheitliches Icon-Set (lucide) statt Emoji/ASCII-Mix (🗑️/📝/⋮⋮/▲▼/＋/−). Icons erben per
   currentColor die Textfarbe des jeweiligen Buttons, damit z.B. der "Entfernen"-Button weiter
   rot bleibt, ohne die Farbe an jeder Stelle neu zu definieren. */
.btn-icon {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  vertical-align: -3px;
  flex-shrink: 0;
}
.btn-icon--inline {
  width: 14px;
  height: 14px;
  vertical-align: -2px;
}
.remove-exercise-btn,
.remove-row-btn,
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.remove-exercise-btn .btn-icon,
.remove-row-btn .btn-icon,
.drag-handle .btn-icon {
  vertical-align: 0;
}
/* Minus-Icon im Remove-Button etwas fetter (dickerer Strich) und länger (breiter) als die
   sonstigen .btn-icon-Icons, damit es als "−" gut erkennbar ist statt als winziger Punkt. */
.remove-row-btn .btn-icon {
  width: 20px;
  stroke-width: 3;
}
/* Eigene, leicht abgesetzte Fläche für den Sätze-Bereich (statt nahtlos in den Info-Teil
   überzugehen) - macht auf einen Blick klar, wo "Infos zur Übung" aufhört und "Sätze
   eintragen" anfängt, statt dass die ganze Karte wie ein einziger durchgehender Block wirkt. */
.ex-sets {
  margin-top: 10px;
  padding: 10px 10px 6px;
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 10px;
}
.set-row {
  /* Gewichtsspalte breiter (1.35fr), Satznummer und Minus-Button schmaler - Platz für den
     Gewichtsvorschlag-Chip im Gewichtsfeld (siehe .weight-suggestion-chip). */
  display: grid;
  grid-template-columns: 34px 1fr 1.35fr 36px;
  gap: 8px;
  align-items: center;
  /* Etwas mehr Luft (Wunsch Paul: Zeilen wirkten zu eng). */
  padding: 6px 0;
}
.set-row.header { color: var(--muted); font-size: 0.75rem; padding-top: 0; }
/* Spaltentitel mittig über den (mittig ausgerichteten) Werten. */
.set-row.header .col { text-align: center; }
.set-row .col input { width: 100%; min-height: 40px; padding: 8px 6px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); text-align: center; font-size: 1.1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.weight-input { position: relative; }
/* UI-Überarbeitung: Hinweis als Kasten über den Sätzen. Steigern in Akzentfarbe, alles andere
   neutral - so fällt nur die eine handlungsrelevante Empfehlung auf. */
.progression-callout {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 2px 0 10px;
  padding: 9px 10px;
  border-radius: 10px;
  font-size: 0.84rem;
  line-height: 1.4;
  color: var(--fg);
  background: color-mix(in srgb, var(--fg) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--fg) 10%, transparent);
}
.progression-callout > span { flex: 1; }
.progression-callout--increase {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  font-weight: 600;
}
.progression-info-btn {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -6px -4px -6px auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 50%;
}
.progression-info-btn:active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.weight-suggestion-info-text { margin: 0 0 10px; line-height: 1.45; }
.weight-suggestion-info-text:last-child { margin-bottom: 0; }
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
/* Kein Hintergrund/Box mehr - ein deutliches, ausreichend großes Minus-Zeichen (siehe
   .remove-row-btn .btn-icon oben) ist als "Entfernen"-Aktion auch ohne farbige Fläche
   verständlich; die rote Farbe des Icons selbst signalisiert weiterhin "löschen". Breite/Höhe
   bleiben als Klick-/Touch-Zielgröße erhalten, nur ohne sichtbaren Kasten drumherum. */
.remove-row-btn { background: transparent; color: var(--danger); border: none; width: 28px; height: 28px; min-width: 0; min-height: 0; padding: 0; cursor: pointer; font-size: 1rem; }
.number-with-spinner { display: flex; align-items: center; gap: 6px; }
.spinner-vertical { display: flex; flex-direction: column; gap: 2px; }
.spin-btn { background: transparent; border: 1px solid var(--card-border); padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; line-height: 1; cursor: pointer; }
.spin-btn.up { transform-origin: center; }
.spin-btn.down { transform-origin: center; }
.spin-btn:active { transform: scale(0.98); }
.bodyweight-field {
  /* Einzeilig (siehe Template-Kommentar) - vorher eigener Kasten mit Überschrift und
     Eingabefeld darunter. */
  margin: 0 6px 12px;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--bg-elevated, transparent);
}
.bodyweight-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.bodyweight-icon {
  width: 16px;
  height: 16px;
  color: var(--muted);
  flex-shrink: 0;
}
.bodyweight-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--fg);
}
.bodyweight-optional {
  font-size: 0.72rem;
  color: var(--muted);
}
.bodyweight-spacer {
  flex: 1 1 0;
}
.bodyweight-row input {
  width: 64px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--line-soft);
  background: var(--bg);
  color: var(--fg);
  font-size: 16px; /* < 16px würde iOS beim Fokussieren reinzoomen */
  text-align: right;
}
.bodyweight-row .unit {
  color: var(--muted);
  font-size: 0.85rem;
}
.bodyweight-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 50%;
}
.bodyweight-info-btn:hover,
.bodyweight-info-btn[aria-pressed="true"] {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.bodyweight-hint {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.35;
}
/* 1RM-Feld pro Übung (aufklappbar, siehe toggleOneRepMax()) - bewusst kompakter als das
   Körpergewicht-Feld oben, da es innerhalb der bereits verschachtelten Übungskarte sitzt. */
.one-rep-max-field {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--bg-elevated, transparent);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.one-rep-max-field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg);
}
.one-rep-max-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.one-rep-max-input-row input {
  width: 90px;
  padding: 6px 9px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg);
  color: var(--fg);
  font-size: 0.95rem;
}
.one-rep-max-input-row .unit {
  color: var(--muted);
  font-size: 0.85rem;
}
.one-rep-max-hint {
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.3;
}
.one-rep-max-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  cursor: pointer;
}
.one-rep-max-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.actions { margin: 6px; display: flex; gap: 8px; }
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
.link.danger {
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  border-radius: 8px;
  padding: 4px 8px;
}

.save-btn{
  background: #dc2626;
  color: #000000;
}
.remove-row-btn {
  background: transparent;
  border: none;
}
.banner { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.85rem; }
.banner.warning { background: color-mix(in oklab, var(--warning) 20%, transparent); border: 1px solid color-mix(in oklab, var(--warning) 50%, transparent); color: var(--fg); }
.banner.dirty { background: color-mix(in oklab, var(--warning) 16%, transparent); border: 1px solid color-mix(in oklab, var(--warning) 40%, transparent); color: var(--fg); margin-bottom: 6px; }
.banner .dismiss { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 0.9rem; padding: 0; }
.save-msg { display: block; margin-top: 6px; color: var(--success); font-size: 0.85rem; }
.save-msg.error { color: var(--danger); }
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
.col.set {
  display: flex;
  align-items: center;
  justify-content: center;
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
/* Trainingsart-Auswahl im Arbeitssatz-Label (unauffällig, aber antippbar). */
.training-type-chip {
  min-width: 0;
  min-height: 0;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--fg);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.ex-title-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.ex-more-btn {
  min-width: 0;
  min-height: 0;
  width: 26px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.warmup-toggle {
  min-width: 0;
  min-height: 0;
  display: block;
  padding: 4px 0;
  margin: 2px 0;
  border: none;
  background: transparent;
  color: color-mix(in srgb, #f59e0b 65%, var(--muted));
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.ex-bottom-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ex-note-actions { display: inline-flex; align-items: center; gap: 6px; }
.ex-note-actions .has-note { color: var(--fg); }
.note-check { color: var(--accent); }
.ex-note-field { margin-top: 4px; }
.exercise-menu-actions { display: flex; flex-direction: column; gap: 8px; }
.exercise-menu-btn {
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.exercise-menu-btn.danger { color: var(--danger); }
.exercise-menu-toggle { display: flex; align-items: center; gap: 8px; padding: 6px 2px; font-size: 0.9rem; }
.training-type-exercise { font-weight: 700; margin: 0 0 10px; }
.training-type-options { display: flex; flex-direction: column; gap: 8px; }
.training-type-option {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.training-type-option span { font-size: 0.8rem; color: var(--muted); }
.training-type-option.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.training-type-default { margin: 10px 0 0; font-size: 0.78rem; color: var(--muted); }
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
/* Abhaken: Satznummer als runder Button (34px Spalte, volle Zeilenhöhe als Tippfläche). */
.set-done-btn {
  /* min-width/min-height: globale Button-Regel (style.css, 48px) würde in die Wdh.-Spalte ragen. */
  width: 28px;
  height: 28px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border-radius: 50%;
  border: none;
  /* Ohne Rahmen, nur leicht hinterlegt - erkennbar antippbar, ragt nicht in die Nachbarspalte. */
  background: color-mix(in srgb, var(--fg) 8%, transparent);
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.set-done-btn.done {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font-size: 0.95rem;
}
/* "Kurz prüfen"-Fenster (Slot-Inhalt von AppModal). */
.review-group + .review-group { margin-top: 14px; }
.review-group-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 6px;
}
.review-item {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
}
.review-item-chevron { color: var(--muted); font-size: 1.1rem; }
.review-defer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  font-size: 0.88rem;
  cursor: pointer;
}
.review-defer input { margin-top: 3px; }
.review-defer small { display: block; margin-top: 2px; color: var(--muted); font-size: 0.78rem; line-height: 1.35; }
/* Pause vorbei: nächster Satz kurz hervorgehoben. */
.set-row.set-row--next {
  box-shadow: 0 0 0 2px var(--accent);
  border-radius: 6px;
  animation: next-set-pulse 1s ease-in-out 3;
}
@keyframes next-set-pulse {
  50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 50%, transparent); }
}
/* Nicht abgehakt: Werte grau = nur übernommen / noch nicht gemacht. */
/* Abgehakte Sätze ganz hinterlegen - Fortschritt auf einen Blick. */
.set-row.set-row--done {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  /* Fläche etwas über die Zeile hinaus ziehen, ohne das Spaltenraster zu verschieben. */
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 6px;
}
.set-row.set-row--open .col input {
  color: var(--muted);
}
.set-row.set-row-empty .col input {
  border-color: var(--line-soft, rgba(255,255,255,0.1));
  color: var(--muted);
}
.row-actions.warmup-actions {
  margin-bottom: 4px;
}
/* Solange noch kein Aufwärmsatz existiert, fällt der Button dezenter aus (kein Rahmen, keine
   Box) - er tritt dann als einfacher Text-Link auf statt als weiterer optischer Block direkt
   über "Arbeitssätze". Sobald ein Aufwärmsatz angelegt wurde, erscheint wieder die normale,
   etwas betontere Button-Optik (siehe .add-warmup-btn), passend zu den sichtbaren Zeilen darüber. */
.warmup-actions--empty {
  margin-bottom: 2px;
}
.warmup-actions--empty .add-warmup-btn {
  border: none;
  background: transparent;
  padding: 4px 0;
  color: var(--muted);
}
.warmup-actions--empty .add-warmup-btn:hover {
  color: color-mix(in srgb, #f59e0b 70%, var(--muted));
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
  border: 1px solid color-mix(in srgb, var(--danger) 50%, transparent);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 0.85rem;
  cursor: pointer;
}
.remove-exercise-btn:hover {
  background: color-mix(in srgb, var(--danger) 20%, transparent);
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