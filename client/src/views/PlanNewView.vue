<template>
  <div class="plan-new-view">
    <HeaderBar :title="t('plans.newTitle')" />

    <div class="content">
      <button type="button" class="back-btn" @click="router.push({ name: 'plans' })">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <h2 class="section-title">{{ t('plans.templatesSection') }}</h2>
      <p class="muted small">{{ t('plans.templatesIntro') }}</p>
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        class="card template-card"
        @click="openTemplate(template)"
      >
        <span class="template-main">
          <span class="card-title">{{ t(`plans.templates.${template.id}.name`) }}</span>
          <span class="muted">{{ t(`plans.templates.${template.id}.desc`) }}</span>
          <span class="muted days-line">{{ t('plans.daysShort', { count: template.days.length }) }} · {{ dayLine(template) }}</span>
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <p class="muted small">{{ t('plans.templateDisclaimer') }}</p>
      <p class="muted small">{{ t('plans.abExplain') }}</p>

      <!-- „Eigenen Plan zusammenstellen“ vorerst ausgeblendet (Absprache Paul 28.10.): die Vorlagen reichen. -->
      <template v-if="SHOW_CUSTOM_PLAN">
        <h2 class="section-title">{{ t('plans.customSection') }}</h2>
        <button type="button" class="card template-card" :disabled="busy" @click="openCustom">
          <span class="card-title">{{ t('plans.startEmpty') }}</span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
      </template>

    </div>

    <AppModal
      v-if="SHOW_CUSTOM_PLAN"
      v-model="showCustom"
      :title="t('plans.customTitle')"
      :confirm-text="t('plans.createConfirm')"
      :cancel-text="t('common.cancel')"
      :close-on-confirm="false"
      type="info"
      @confirm="createCustom"
    >
      <div class="custom-form">
        <label class="field">
          <span>{{ t('plans.nameLabel') }}</span>
          <input v-model="customName" type="text" maxlength="40" :placeholder="t('plans.namePlaceholder')" />
        </label>
        <div class="field">
          <span>{{ t('plans.pickFavoritesLabel') }}</span>
          <p v-if="!favorites.length" class="muted">{{ t('plans.noFavorites') }}</p>
          <label v-for="fav in favorites" :key="fav.id" class="pick">
            <input v-model="pickedIds" type="checkbox" :value="fav.id" />
            <span>{{ fav.name }}</span>
          </label>
        </div>
        <p v-if="customError" class="error" role="alert">{{ customError }}</p>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import AppModal from '@/components/AppModal.vue'
import { useToastStore } from '@/stores/toastStore'
import { usePlanUserId } from '@/composables/usePlanUserId'
import { PLAN_TEMPLATES, PLAN_TEMPLATE_IDS } from '@/utils/planTemplates'
import { getAllFavorites } from '@/utils/planFromTemplate'
import { createTrainingPlan } from '@/utils/trainingPlanStorage'

const { t } = useI18n()
const router = useRouter()
const toast = useToastStore()
const userId = usePlanUserId()

// Vorerst aus: leerer Plan aus eigenen Favoriten (Funktionen unten bleiben für später erhalten).
const SHOW_CUSTOM_PLAN = false

const templates = PLAN_TEMPLATE_IDS.map((id) => PLAN_TEMPLATES[id])
const busy = ref(false)

function dayLine(template) {
  return template.days.map((day) => t(`plans.dayLabel.${day.labelKey}`)).join(' · ')
}

function errorMessage(code) {
  if (code === 'limit') return t('plans.errorLimit')
  if (code === 'favoriteLimit') return t('plans.errorFavoriteLimit')
  return t('plans.errorGeneric')
}

function openTemplate(template) {
  router.push({ name: 'plan-template', params: { templateId: template.id } })
}

// Der erste Plan ist sofort aktiv: dann direkt zum Dashboard („Heute“), sonst zur Plan-Seite.
function goAfterCreate(plan) {
  if (plan.active) router.replace({ name: 'dashboard' })
  else router.replace({ name: 'plan-detail', params: { id: plan.id } })
}

// Leerer Plan: Name + Tage aus vorhandenen Favoriten.
const showCustom = ref(false)
const customName = ref('')
const pickedIds = ref([])
const customError = ref('')
const favorites = computed(() => (showCustom.value ? getAllFavorites(userId.value) : []))

function openCustom() {
  customName.value = ''
  pickedIds.value = []
  customError.value = ''
  showCustom.value = true
}

function createCustom() {
  if (!customName.value.trim()) { customError.value = t('plans.errorName'); return }
  if (!pickedIds.value.length) { customError.value = t('plans.errorDays'); return }
  // Reihenfolge wie in der Favoritenliste, nicht in der Reihenfolge des Anklickens.
  const days = favorites.value.filter((fav) => pickedIds.value.includes(fav.id)).map((fav) => ({ favoriteId: fav.id }))
  const result = createTrainingPlan({ userId: userId.value, name: customName.value, days })
  if (!result.ok) { customError.value = errorMessage(result.error); return }
  showCustom.value = false
  toast.show(t('plans.created', { name: result.plan.name }), { type: 'success' })
  goAfterCreate(result.plan)
}
</script>

<style scoped>
.plan-new-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 14px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); margin: 0; font-size: 0.9rem; }
.small { font-size: 0.8rem; line-height: 1.5; }
.template-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 64px; color: var(--fg); font: inherit; text-align: left; cursor: pointer; }
.template-card:disabled { opacity: 0.6; cursor: default; }
.template-main { display: grid; gap: 6px; min-width: 0; }
.days-line { font-size: 0.78rem; }
.chevron { flex: 0 0 auto; width: 9px; height: 9px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(-45deg); }
.error { color: var(--danger); margin: 0; font-size: 0.9rem; }
.custom-form { display: grid; gap: 14px; }
.field { display: grid; gap: 6px; font-size: 0.9rem; }
.field input[type='text'] { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--bg); color: var(--fg); font: inherit; }
.pick { display: flex; align-items: center; gap: 10px; min-height: 40px; }
</style>
