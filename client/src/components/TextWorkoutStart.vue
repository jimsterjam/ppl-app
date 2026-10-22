<template>
  <!-- Freitext-Einstieg (Schritt 3 von 6, Absprache Paul): Eingabefeld "Was trainierst du heute?", darunter die Vorschau mit
       Rückfragen zum Antippen. Noch ohne Anbindung an den Workout-Start (Schritt 4) und nur für Admin-Konten sichtbar
       (DashboardView). Nichts wird gespeichert. -->
  <section class="card text-start">
    <h4 class="ts-title">{{ t('textStart.title') }}</h4>
    <textarea
      v-model="text"
      class="ts-input"
      rows="2"
      maxlength="500"
      :placeholder="t('textStart.placeholder')"
      :aria-label="t('textStart.title')"
      @keydown.enter.exact.prevent="submit"
    ></textarea>
    <div class="ts-row">
      <button type="button" class="ts-chip" @click="openGoalModal">{{ goalChipLabel }} <span aria-hidden="true">▾</span></button>
      <button type="button" class="ts-go" :disabled="!text.trim() || loading" @click="submit">{{ t('textStart.go') }}</button>
    </div>
  </section>

  <!-- Vorschau: Modal-Muster Teleport + Scroll-Sperre -->
  <Teleport to="body">
    <div v-if="open" class="ts-sheet" role="dialog" aria-modal="true" :aria-label="t('textStart.previewTitle')">
      <div class="ts-sheet-top">
        <h3 class="ts-sheet-title">{{ t('textStart.previewTitle') }}</h3>
        <button type="button" class="ts-close" :aria-label="t('common.close')" @click="closeSheet">✕</button>
      </div>

      <div class="ts-sheet-body">
        <p v-if="model.state === 'empty'" class="ts-empty">{{ t('textStart.empty') }}</p>

        <template v-else>
          <div class="card ts-head">
            <b>{{ goalLabel ? t('textStart.workoutHeader', { goal: goalLabel }) : t('textStart.workoutHeaderNoGoal') }}</b>
            <span class="ts-tag">{{ t('textStart.fromText') }}</span>
            <span class="ts-tag">{{ typeLine }}</span>
          </div>

          <!-- Rückfrage (immer nur eine): Ziel, Variante oder nicht gefunden -->
          <div v-if="question" class="card ts-question">
            <template v-if="question.kind === 'goal'">
              <h3>{{ t('workoutGoal.question') }}</h3>
              <WorkoutGoalPicker v-model="goalChoice" hide-question @update:model-value="onGoalPicked" />
            </template>
            <template v-else>
              <h3>
                {{ question.kind === 'variant'
                  ? t('textStart.questionVariant', { name: questionItem.rawText })
                  : t('textStart.questionNotFound', { name: questionItem.rawText }) }}
              </h3>
              <p v-if="question.kind === 'not_found' && questionItem.suggestions.length" class="ts-tag">{{ t('textStart.suggestions') }}</p>
              <button
                v-for="option in (question.kind === 'variant' ? questionItem.candidates : questionItem.suggestions)"
                :key="option.exercise_id"
                type="button"
                class="ts-option"
                @click="choose(questionItem.key, option)"
              >{{ formatName(option.name_en) }}</button>
              <button type="button" class="ts-option ts-option-skip" @click="choose(questionItem.key, 'skip')">{{ t('textStart.skip') }}</button>
            </template>
          </div>

          <!-- Erkannte Übungen -->
          <div v-for="item in shownItems" :key="item.key" class="card ts-ex">
            <b>{{ item.display }}</b>
            <div class="ts-cells">
              <span v-for="cell in cellsOf(item)" :key="cell.field" class="ts-cell" :class="cell.given ? 'given' : 'ghost'">{{ cell.text }}</span>
            </div>
            <button
              v-if="item.assumedVariant && item.alternatives.length"
              type="button"
              class="ts-link"
              :aria-expanded="altOpen === item.key"
              @click="altOpen = altOpen === item.key ? '' : item.key"
            >{{ t('textStart.variantAssumed') }}</button>
            <div v-if="altOpen === item.key" class="ts-alts">
              <button
                v-for="alt in item.alternatives"
                :key="alt.exercise_id"
                type="button"
                class="ts-option"
                @click="choose(item.key, alt)"
              >{{ formatName(alt.name_en) }}</button>
            </div>
            <span v-if="!hasAnyValue(item)" class="ts-tag">{{ t('textStart.fillLater') }}</span>
          </div>

          <!-- Hinweise -->
          <ul v-if="model.hints.length || model.notUnderstood.length" class="ts-hints">
            <li v-for="(hint, i) in model.hints" :key="`h${i}`">{{ hintText(hint) }}</li>
            <li v-for="(raw, i) in model.notUnderstood" :key="`n${i}`">{{ t('textStart.notUnderstood', { text: raw }) }}</li>
          </ul>
          <p class="ts-legend">{{ t('textStart.legend') }}</p>
        </template>
      </div>

      <div class="ts-sheet-actions">
        <button type="button" class="ts-cta" :disabled="!ready" @click="start">{{ t('textStart.start') }}</button>
      </div>
    </div>
  </Teleport>

  <AppModal
    v-model="goalModal"
    :title="t('workoutGoal.question')"
    :confirm-text="t('common.confirm')"
    :cancel-text="t('common.cancel')"
    :close-on-confirm="false"
    type="info"
    @confirm="confirmGoal"
    @cancel="goalModal = false"
  >
    <WorkoutGoalPicker v-model="goalChoice" hide-question />
  </AppModal>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/AppModal.vue'
import WorkoutGoalPicker from '@/components/WorkoutGoalPicker.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { useScrollLock } from '@/composables/useScrollLock'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { toTitleCase } from '@/utils/exerciseTranslation'
import { sanitizeWorkoutGoal, WORKOUT_GOAL_LABEL_KEYS } from '@/utils/workoutGoal'
import { createExerciseMatcher } from '@/utils/textWorkout/matchExercise'
import { answerItem, buildTextWorkoutModel, canStart, describeValues, pendingQuestion, setGoal } from '@/utils/textWorkout/preview'

const { t } = useI18n()
const settings = useSettingsStore()
const toast = useToastStore()
const emit = defineEmits(['start'])

const text = ref('')
const loading = ref(false)
const open = ref(false)
const model = ref({ state: 'empty', goal: null, items: [], hints: [], notUnderstood: [], sessionLabel: null, type: null, typeAssumed: true })
const altOpen = ref('')
const goalModal = ref(false)
const goalChoice = ref('')

const { lock, unlock } = useScrollLock()
watch(open, (isOpen) => (isOpen ? lock() : unlock()))
onBeforeUnmount(unlock)

const formatName = (name) => toTitleCase(name)

const goalLabel = computed(() => {
  const goal = sanitizeWorkoutGoal(model.value.goal || settings.lastWorkoutGoal)
  return goal ? t(WORKOUT_GOAL_LABEL_KEYS[goal]) : ''
})
const goalChipLabel = computed(() => (goalLabel.value ? t('textStart.goalChip', { goal: goalLabel.value }) : t('textStart.goalChoose')))

const typeLine = computed(() => {
  const label = model.value.sessionLabel || (model.value.type ? model.value.type : t('dashboard.fullBodyLabel'))
  return model.value.typeAssumed ? t('textStart.typeAssumed', { type: label }) : t('textStart.typeLine', { type: label })
})

const question = computed(() => pendingQuestion(model.value))
const questionItem = computed(() => (question.value?.key ? model.value.items.find((item) => item.key === question.value.key) : null))
const ready = computed(() => canStart(model.value))
// Die Übung, nach der gerade gefragt wird, steht in der Frage - nicht doppelt als Karte.
const shownItems = computed(() => model.value.items.filter((item) => item.status === 'matched'))

let matcher = null
let matcherSource = null
async function getMatcher() {
  const catalog = await loadDefaultExercises()
  if (!matcher || matcherSource !== catalog) {
    matcher = createExerciseMatcher({ catalog })
    matcherSource = catalog
  }
  return matcher
}

async function submit() {
  const value = text.value.trim()
  if (!value || loading.value) return
  loading.value = true
  try {
    const match = await getMatcher()
    model.value = buildTextWorkoutModel(value, { match, goal: sanitizeWorkoutGoal(settings.lastWorkoutGoal), formatName })
    altOpen.value = ''
    open.value = true
  } finally {
    loading.value = false
  }
}

function closeSheet() {
  open.value = false
}

function choose(key, option) {
  model.value = answerItem(model.value, key, option, { formatName })
  altOpen.value = ''
}

function openGoalModal() {
  goalChoice.value = sanitizeWorkoutGoal(model.value.goal || settings.lastWorkoutGoal) || ''
  goalModal.value = true
}

function applyGoal(goal) {
  const valid = sanitizeWorkoutGoal(goal)
  if (!valid) return
  settings.setLastWorkoutGoal(valid)
  model.value = setGoal(model.value, valid)
}

function confirmGoal() {
  applyGoal(goalChoice.value)
  goalModal.value = false
}

// Erste Rückfrage "Ziel": ein Tap auf eine Karte genügt.
function onGoalPicked(goal) {
  applyGoal(goal)
}

function cellsOf(item) {
  return describeValues(item).map((cell) => {
    let label
    if (cell.field === 'sets') label = cell.given ? t('textStart.sets', { n: cell.value }) : t('textStart.setsAssumed', { n: cell.value })
    else if (cell.field === 'reps') label = cell.value != null ? t('textStart.reps', { n: cell.value }) : t('textStart.repsEmpty')
    else if (cell.field === 'repsRange') label = t('textStart.repsRange', { from: cell.value[0], to: cell.value[1] })
    else if (cell.field === 'duration') label = t('textStart.seconds', { n: cell.value })
    else label = cell.value != null ? t('textStart.kg', { n: cell.value }) : t('textStart.kgEmpty')
    return { ...cell, text: label }
  })
}

const hasAnyValue = (item) => item.reps != null || item.repsRange != null || item.weightKg != null || item.durationSeconds != null

function hintText(hint) {
  return t(`textStart.hint_${hint.code}`, { text: hint.text })
}

function start() {
  if (!ready.value) return
  // Schritt 4 verbindet das mit dem Workout-Start (Prefill + Builder). Bis dahin nur Hinweis.
  emit('start', model.value)
  toast.info(t('textStart.startSoon'))
}
</script>

<style scoped>
.text-start { display: flex; flex-direction: column; gap: 10px; }
.ts-title { margin: 0; font-size: 1.15rem; text-align: left; }
.ts-input {
  width: 100%;
  min-height: 56px;
  resize: none;
  padding: 12px;
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  background: var(--card-soft);
  color: var(--fg);
  font: inherit;
}
.ts-row { display: flex; align-items: center; gap: 8px; }
.ts-chip {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 0.85rem;
}
.ts-go {
  margin-left: auto;
  min-width: 88px;
  min-height: 44px;
  border-radius: var(--card-radius);
  background: linear-gradient(120deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast, #060606);
  font-weight: 800;
}
.ts-go:disabled { opacity: 0.45; }

.ts-sheet {
  position: fixed;
  inset: 0;
  z-index: 1260;
  display: flex;
  flex-direction: column;
  background: var(--bg, #08090b);
  color: var(--fg);
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
}
.ts-sheet-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 8px; }
.ts-sheet-title { margin: 0; font-size: 1.15rem; }
.ts-close { min-width: 44px; min-height: 44px; padding: 0; border-radius: 50%; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--fg); }
.ts-sheet-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 8px; }
.ts-head { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; }
.ts-tag { font-size: 0.78rem; color: var(--muted); }
.ts-empty { color: var(--muted); text-align: center; padding: 24px 8px; }

.ts-question { display: flex; flex-direction: column; gap: 10px; }
.ts-question h3 { margin: 0; font-size: 1.05rem; }
.ts-option {
  min-height: 48px;
  padding: 0 14px;
  text-align: left;
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  background: var(--card-soft);
  color: var(--fg);
  font: inherit;
  font-weight: 700;
}
.ts-option-skip { color: var(--muted); font-weight: 500; }

.ts-ex { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; }
.ts-cells { display: flex; flex-wrap: wrap; gap: 6px; }
.ts-cell { padding: 6px 10px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--card-soft); font-size: 0.9rem; }
.ts-cell.given { font-weight: 700; }
.ts-cell.ghost { border-style: dashed; color: var(--muted); }
.ts-link { align-self: flex-start; min-height: 36px; padding: 0; background: none; border: none; color: var(--muted); font: inherit; font-size: 0.8rem; text-decoration: underline; }
.ts-alts { display: flex; flex-direction: column; gap: 6px; }

.ts-hints { margin: 0; padding-left: 18px; color: var(--muted); font-size: 0.82rem; display: grid; gap: 4px; }
.ts-legend { margin: 0; text-align: center; font-size: 0.78rem; color: var(--muted); }

.ts-sheet-actions { padding-top: 8px; }
.ts-cta {
  width: 100%;
  min-height: 60px;
  border-radius: var(--card-radius);
  background: linear-gradient(120deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast, #060606);
  font-weight: 800;
  font-size: 1.15rem;
}
.ts-cta:disabled { opacity: 0.4; }
</style>
