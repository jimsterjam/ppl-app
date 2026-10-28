<template>
  <div class="plan-template-view">
    <HeaderBar :title="template ? t(`plans.templates.${template.id}.name`) : t('plans.newTitle')" />

    <div v-if="template" class="content">
      <button type="button" class="back-btn" @click="router.push({ name: 'plan-new' })">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <!-- Stufe: Anfänger ist der Standard; Übungen und Erklärung passen sich an. -->
      <section class="card level-card">
        <h2 class="section-title">{{ t('plans.levelTitle') }}</h2>
        <div class="level-toggle" role="group" :aria-label="t('plans.levelTitle')">
          <button
            v-for="option in PLAN_TEMPLATE_LEVELS"
            :key="option"
            type="button"
            class="level-btn"
            :class="{ active: level === option }"
            :aria-pressed="level === option"
            @click="level = option"
          >{{ t(`plans.level.${option}`) }}</button>
        </div>
        <p class="muted">{{ level === 'beginner' ? t('plans.levelBeginnerHint') : t('plans.levelAdvancedHint') }}</p>
      </section>

      <section class="card">
        <h2 class="section-title">{{ t('plans.explainTitle') }}</h2>
        <p v-for="(text, i) in explainParagraphs" :key="i" class="explain">{{ text }}</p>
        <p v-if="hasVariants" class="explain muted">{{ t('plans.abExplain') }}</p>
      </section>

      <h2 class="section-title">{{ t('plans.previewDays') }}</h2>
      <div v-for="day in days" :key="day.labelKey" class="card day-card">
        <div class="day-head">
          <strong class="day-title">{{ day.label }}</strong>
          <span class="muted">{{ musclesOf(day) }}</span>
        </div>
        <ul class="exercise-list">
          <li v-for="item in day.exercises" :key="item.exerciseId" class="exercise-row">
            <img :src="thumbOf(item.entry)" alt="" class="thumb" @error="onThumbError" />
            <span class="exercise-name">{{ getTranslatedExerciseName(item.name) }}</span>
            <span class="muted sets">{{ t('plans.exerciseSets', { count: item.sets }) }}</span>
          </li>
        </ul>
      </div>

      <p class="muted small">{{ t('plans.templateDisclaimer') }}</p>
      <p class="muted small">{{ t('plans.choosePlanHint') }}</p>
      <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
      <p v-else-if="!canCreate" class="muted" role="status">{{ t('plans.limitHint') }}</p>
      <button type="button" class="btn-primary" :disabled="busy || !canCreate || loading" @click="choosePlan">
        {{ busy ? t('plans.creating') : t('plans.choosePlan') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import { useToastStore } from '@/stores/toastStore'
import { usePlanUserId } from '@/composables/usePlanUserId'
import { PLAN_TEMPLATES, PLAN_TEMPLATE_LEVELS, DEFAULT_PLAN_LEVEL } from '@/utils/planTemplates'
import { createPlanFromTemplate, resolveTemplateDays } from '@/utils/planFromTemplate'
import { getTrainingPlans } from '@/utils/trainingPlanStorage'
import { canCreatePlan } from '@/utils/trainingPlan'
import { getDayMuscleGroups } from '@/utils/planProgress'
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

// Vorschau einer Vorlage (Absprache Paul 28.10.): Erklärung, Stufe (Anfänger/Fortgeschritten), Tage mit Übungen - erst
// „Diesen Plan wählen“ legt den Plan an.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const userId = usePlanUserId()
const { getTranslatedExerciseName, getTranslatedMuscleGroup } = useExerciseTranslation()

const template = PLAN_TEMPLATES[String(route.params.templateId || '')] || null
const level = ref(DEFAULT_PLAN_LEVEL)
const catalog = ref([])
const loading = ref(true)
const busy = ref(false)
const errorText = ref('')
const canCreate = computed(() => canCreatePlan(getTrainingPlans(userId.value)))

onMounted(async () => {
  if (!template) { router.replace({ name: 'plan-new' }); return }
  try {
    catalog.value = await loadDefaultExercises()
  } catch {
    catalog.value = []
  } finally {
    loading.value = false
  }
})

const labelFor = (key) => t(`plans.dayLabel.${key}`)
const days = computed(() => resolveTemplateDays({ templateId: template?.id, level: level.value, catalog: catalog.value, labelFor })?.days || [])
const explainParagraphs = computed(() => t(`plans.templates.${template.id}.explain.${level.value}`).split('\n\n'))
// A/B-Tage vorhanden: kurz erklären, was das bedeutet.
const hasVariants = computed(() => template.days.some((day) => /[B-C]$/.test(day.labelKey)))

function musclesOf(day) {
  const labels = getDayMuscleGroups(day.exercises).map((group) => getTranslatedMuscleGroup(group))
  return [...new Set(labels.filter(Boolean))].join(', ')
}

const PLACEHOLDER = '/exercises/play.svg'
function thumbOf(entry) {
  return entry?.thumbnailStaticUrl || entry?.thumbnailUrl || PLACEHOLDER
}
function onThumbError(evt) {
  const img = evt?.target
  if (!img || img.src.includes('play.svg')) return
  img.onerror = null
  img.src = PLACEHOLDER
}

function choosePlan() {
  if (busy.value || loading.value) return
  busy.value = true
  errorText.value = ''
  const result = createPlanFromTemplate({
    userId: userId.value,
    templateId: template.id,
    level: level.value,
    planName: t(`plans.templates.${template.id}.name`),
    labelFor,
    catalog: catalog.value
  })
  busy.value = false
  if (!result.ok) {
    errorText.value = result.error === 'limit' ? t('plans.errorLimit') : t('plans.errorGeneric')
    return
  }
  toast.show(t('plans.created', { name: result.plan.name }), { type: 'success' })
  // Der erste Plan ist sofort aktiv: direkt zum Dashboard („Heute“), sonst zur Plan-Seite.
  if (result.plan.active) router.replace({ name: 'dashboard' })
  else router.replace({ name: 'plan-detail', params: { id: result.plan.id } })
}
</script>

<style scoped>
.plan-template-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 14px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); margin: 0; font-size: 0.9rem; }
.small { font-size: 0.8rem; line-height: 1.5; }
.level-card, .day-card { display: grid; gap: 10px; }
.level-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: 14px; background: var(--surface); border: 1px solid var(--card-border); }
.level-btn { min-height: 44px; border: none; border-radius: 10px; background: transparent; color: var(--fg); font: inherit; font-weight: 700; cursor: pointer; }
.level-btn.active { background: var(--accent); color: var(--accent-contrast, #060606); }
.explain { margin: 0; line-height: 1.5; font-size: 0.92rem; }
.day-head { display: grid; gap: 2px; }
.day-title { font-family: var(--font-heading); }
.exercise-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.exercise-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.thumb { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 10px; object-fit: cover; background: var(--surface); border: 1px solid var(--card-border); }
.exercise-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; font-weight: 600; font-size: 0.9rem; }
.sets { flex: 0 0 auto; font-size: 0.8rem; }
.error { color: var(--danger); margin: 0; font-size: 0.9rem; }
.btn-primary { min-height: 52px; border: none; border-radius: 14px; background: var(--accent); color: var(--accent-contrast, #060606); font: inherit; font-weight: 800; cursor: pointer; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }
</style>
