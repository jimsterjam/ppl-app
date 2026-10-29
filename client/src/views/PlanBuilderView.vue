<template>
  <div class="plan-builder-view">
    <HeaderBar :title="isEdit ? t('plans.custom.editTitle') : t('plans.custom.builderTitle')" />

    <div class="content">
      <button type="button" class="back-btn" @click="goBack">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <p v-if="!isEdit && !canCreate" class="error" role="alert">{{ t('plans.errorLimit') }}</p>

      <label class="field">
        <span>{{ t('plans.nameLabel') }}</span>
        <input v-model="draft.name" type="text" maxlength="40" :placeholder="t('plans.namePlaceholder')" />
      </label>
      <p v-if="showErrors && !check.name" class="error" role="alert">{{ t('plans.custom.errorName') }}</p>

      <section v-for="(day, dIndex) in draft.days" :key="dIndex" class="card day-card" :class="{ 'day-card--error': showErrors && check.emptyDays.includes(dIndex) }">
        <div class="day-head">
          <strong class="day-title">{{ t('plans.custom.dayHeading', { n: dIndex + 1 }) }}</strong>
          <span class="day-actions">
            <button type="button" class="icon-btn" :disabled="dIndex === 0" :aria-label="t('plans.moveUp')" @click="draft = moveDayBy(draft, dIndex, -1)">▲</button>
            <button type="button" class="icon-btn" :disabled="dIndex === draft.days.length - 1" :aria-label="t('plans.moveDown')" @click="draft = moveDayBy(draft, dIndex, 1)">▼</button>
            <button type="button" class="icon-btn" :disabled="draft.days.length <= 1" :aria-label="t('plans.custom.removeDay')" @click="draft = removeDayAt(draft, dIndex)">✕</button>
          </span>
        </div>
        <input
          class="day-name"
          type="text"
          maxlength="24"
          :value="day.label"
          :placeholder="t('plans.custom.dayNamePlaceholder')"
          :aria-label="t('plans.custom.dayNameAria', { n: dIndex + 1 })"
          @input="draft = setDayLabel(draft, dIndex, $event.target.value)"
        />

        <p v-if="!day.exercises.length" class="muted">{{ t('plans.custom.emptyDay') }}</p>
        <ul v-else class="exercise-list">
          <li v-for="(item, eIndex) in day.exercises" :key="item.exerciseId" class="exercise-row">
            <span class="exercise-text">
              <span class="exercise-name">{{ getTranslatedExerciseName(item.name) }}</span>
              <small class="muted">{{ getTranslatedMuscleGroup(item.muscleGroup) }}</small>
            </span>
            <span class="sets">
              <button type="button" class="icon-btn" :aria-label="t('plans.custom.setsMinus')" @click="draft = changeSets(draft, dIndex, eIndex, -1)">−</button>
              <span class="sets-count">{{ item.sets }}</span>
              <button type="button" class="icon-btn" :aria-label="t('plans.custom.setsPlus')" @click="draft = changeSets(draft, dIndex, eIndex, 1)">+</button>
            </span>
            <span class="row-actions">
              <button type="button" class="icon-btn" :disabled="eIndex === 0" :aria-label="t('plans.moveUp')" @click="draft = moveExerciseBy(draft, dIndex, eIndex, -1)">▲</button>
              <button type="button" class="icon-btn" :disabled="eIndex === day.exercises.length - 1" :aria-label="t('plans.moveDown')" @click="draft = moveExerciseBy(draft, dIndex, eIndex, 1)">▼</button>
              <button type="button" class="icon-btn" :aria-label="t('plans.custom.removeExercise')" @click="draft = removeExerciseAt(draft, dIndex, eIndex)">✕</button>
            </span>
          </li>
        </ul>
        <button type="button" class="btn-secondary" :disabled="day.exercises.length >= PLAN_LIMITS.maxExercises" @click="openPicker(dIndex)">{{ t('plans.custom.addExercise') }}</button>
      </section>
      <p v-if="showErrors && check.emptyDays.length" class="error" role="alert">{{ t('plans.custom.errorDays') }}</p>

      <button type="button" class="btn-secondary" :disabled="draft.days.length >= PLAN_LIMITS.maxDays" @click="draft = addDayTo(draft)">{{ t('plans.custom.addDay') }}</button>
      <p class="muted small">{{ t('plans.custom.limits', { days: PLAN_LIMITS.maxDays, exercises: PLAN_LIMITS.maxExercises }) }}</p>
      <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>

      <button type="button" class="btn-primary" :disabled="busy || (!isEdit && !canCreate)" @click="save">
        {{ busy ? t('plans.custom.saving') : t('plans.custom.save') }}
      </button>
    </div>

    <AppModal
      v-model="pickerOpen"
      :title="t('plans.custom.pickTitle')"
      :confirm-text="t('plans.custom.pickConfirm')"
      :cancel-text="t('common.cancel')"
      type="info"
      @confirm="confirmPicker"
    >
      <div class="picker">
        <p v-if="loadingList" class="muted">{{ t('exercises.loading') }}</p>
        <ExerciseList
          v-else
          :show-title="false"
          :show-controls="true"
          :items="allExercises"
          :selectable="true"
          :selected-ids="pickedIds"
          :user-id="userId"
          @toggle="togglePicked"
          @custom-added="loadList"
        />
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import AppModal from '@/components/AppModal.vue'
import ExerciseList from '@/components/ExerciseList.vue'
import { useToastStore } from '@/stores/toastStore'
import { usePlanUserId } from '@/composables/usePlanUserId'
import { useExerciseTranslation, getEnglishExerciseName } from '@/utils/exerciseTranslation'
import { getMergedSortedExercises } from '@/utils/exerciseList'
import { createTrainingPlan, getTrainingPlans, updateTrainingPlan } from '@/utils/trainingPlanStorage'
import { canCreatePlan, PLAN_LIMITS } from '@/utils/trainingPlan'
import {
  emptyDraft, draftFromPlan, draftToPlanInput, applyDraftToPlan, validateDraft, addDayTo, removeDayAt, moveDayBy, setDayLabel,
  addExercisesTo, removeExerciseAt, moveExerciseBy, changeSets
} from '@/utils/planBuilder'

// Eigener Plan (Absprache Paul 29.10.): Name, Tage und Übungen frei wählen. Mit Plan-ID in der Route wird ein
// bestehender eigener Plan bearbeitet.
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const userId = usePlanUserId()
const { getTranslatedExerciseName, getTranslatedMuscleGroup } = useExerciseTranslation()

const planId = String(route.params.id || '')
const isEdit = Boolean(planId)
const existing = isEdit ? getTrainingPlans(userId.value).find((plan) => plan.id === planId) || null : null
const draft = ref(existing ? draftFromPlan(existing) : emptyDraft())
const canCreate = computed(() => canCreatePlan(getTrainingPlans(userId.value)))
const showErrors = ref(false)
const busy = ref(false)
const errorText = ref('')
const check = computed(() => validateDraft(draft.value))

onMounted(() => {
  if (isEdit && !existing) router.replace({ name: 'plans' })
})

function goBack() {
  if (isEdit) router.push({ name: 'plan-detail', params: { id: planId } })
  else router.push({ name: 'plan-new' })
}

// --- Übungen wählen -------------------------------------------------------------------------
const pickerOpen = ref(false)
const pickerDay = ref(0)
const allExercises = ref([])
const loadingList = ref(false)
const picked = ref([])

const entryId = (entry) => String(entry?._id || entry?.exerciseId || entry?.id || entry?.mediaId || '')
const pickedIds = computed(() => picked.value.map(entryId))

async function loadList() {
  loadingList.value = true
  try {
    allExercises.value = await getMergedSortedExercises({ locale: String(locale.value || ''), includeRemote: false, userId: userId.value })
  } catch {
    allExercises.value = []
  } finally {
    loadingList.value = false
  }
}

function openPicker(dayIndex) {
  pickerDay.value = dayIndex
  picked.value = []
  pickerOpen.value = true
  if (!allExercises.value.length) loadList()
}

function togglePicked(entry) {
  const id = entryId(entry)
  picked.value = picked.value.some((item) => entryId(item) === id) ? picked.value.filter((item) => entryId(item) !== id) : [...picked.value, entry]
}

function confirmPicker() {
  const entries = picked.value.map((entry) => ({
    exerciseId: entryId(entry),
    name: getEnglishExerciseName(entry),
    muscleGroup: entry.muscleGroup || '',
    category: entry.category || ''
  }))
  draft.value = addExercisesTo(draft.value, pickerDay.value, entries)
}

// --- Speichern --------------------------------------------------------------------------------
function save() {
  if (busy.value) return
  showErrors.value = true
  errorText.value = ''
  if (!check.value.ok) return
  busy.value = true
  try {
    if (isEdit) {
      const result = updateTrainingPlan({ userId: userId.value, planId, updater: (plan) => applyDraftToPlan(plan, draft.value) })
      if (!result.ok) { errorText.value = t('plans.errorGeneric'); return }
      toast.show(t('plans.custom.saved'), { type: 'success' })
      router.replace({ name: 'plan-detail', params: { id: planId } })
      return
    }
    const input = draftToPlanInput(draft.value, (n) => t('plans.custom.dayHeading', { n }))
    const result = createTrainingPlan({ userId: userId.value, name: input.name, days: input.days })
    if (!result.ok) { errorText.value = result.error === 'limit' ? t('plans.errorLimit') : t('plans.errorGeneric'); return }
    toast.show(t('plans.created', { name: result.plan.name }), { type: 'success' })
    // Der erste Plan ist sofort aktiv: direkt zum Dashboard („Heute“), sonst zur Plan-Seite.
    if (result.plan.active) router.replace({ name: 'dashboard' })
    else router.replace({ name: 'plan-detail', params: { id: result.plan.id } })
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.plan-builder-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 12px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); margin: 0; font-size: 0.85rem; }
.small { font-size: 0.8rem; line-height: 1.5; }
.error { color: var(--danger); margin: 0; font-size: 0.9rem; }
.field { display: grid; gap: 6px; font-size: 0.9rem; }
.field input, .day-name { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--bg); color: var(--fg); font: inherit; }
.day-card { display: grid; gap: 10px; }
.day-card--error { border-color: var(--danger); }
.day-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.day-title { font-family: var(--font-heading); }
.day-actions, .row-actions, .sets { display: inline-flex; align-items: center; gap: 2px; }
.icon-btn { min-width: 40px; min-height: 40px; border: none; border-radius: 10px; background: transparent; color: var(--muted); font: inherit; font-size: 0.95rem; cursor: pointer; }
.icon-btn:disabled { opacity: 0.25; cursor: default; }
.exercise-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.exercise-row { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--card-border); }
.exercise-row:first-child { border-top: none; }
.exercise-text { display: grid; gap: 2px; min-width: 0; }
.exercise-name { font-weight: 600; overflow-wrap: anywhere; }
.sets { justify-self: end; }
.sets-count { min-width: 22px; text-align: center; font-weight: 800; }
.row-actions { grid-column: 1 / -1; justify-self: end; }
.btn-primary { min-height: 52px; border: none; border-radius: 14px; background: var(--accent); color: var(--accent-contrast, #060606); font: inherit; font-weight: 800; cursor: pointer; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }
.btn-secondary { min-height: 48px; border-radius: 14px; border: 1px solid var(--card-border); background: transparent; color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.btn-secondary:disabled { opacity: 0.4; cursor: default; }
.picker { max-height: 60vh; overflow-y: auto; }
</style>
