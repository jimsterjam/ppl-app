<template>
  <div class="plans-view">
    <HeaderBar :title="t('plans.title')" />

    <div class="content">
      <button type="button" class="back-btn" @click="router.push({ name: 'dashboard' })">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <div v-if="!plans.length" class="card empty">
        <h3 class="card-title">{{ t('plans.emptyTitle') }}</h3>
        <p class="muted">{{ t('plans.emptyText') }}</p>
      </div>

      <template v-else>
        <h2 class="section-title">{{ t('plans.activeSection') }}</h2>
        <button v-if="activePlan" type="button" class="card plan-card plan-card--active" @click="openPlan(activePlan)">
          <span class="plan-main">
            <span class="plan-name-row">
              <span class="card-title">{{ activePlan.name }}</span>
              <span class="pill">{{ t('plans.activeBadge') }}</span>
            </span>
            <span class="muted">{{ summary(activePlan) }}</span>
          </span>
          <span class="chevron" aria-hidden="true"></span>
        </button>

        <template v-if="otherPlans.length">
          <h2 class="section-title">{{ t('plans.otherSection') }}</h2>
          <div v-for="plan in otherPlans" :key="plan.id" class="card plan-card plan-card--row">
            <button type="button" class="plan-open" @click="openPlan(plan)">
              <span class="card-title">{{ plan.name }}</span>
              <span class="muted">{{ summary(plan) }}</span>
            </button>
            <button type="button" class="activate-btn" @click="activate(plan)">{{ t('plans.activate') }}</button>
          </div>
        </template>
      </template>

      <button type="button" class="btn-primary" :disabled="!canCreate" @click="router.push({ name: 'plan-new' })">
        + {{ t('plans.create') }}
      </button>
      <p v-if="!canCreate" class="muted small">{{ t('plans.limitHint') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import { usePlanUserId, formatPlanDate } from '@/composables/usePlanUserId'
import { useToastStore } from '@/stores/toastStore'
import { activateTrainingPlan, getTrainingPlans } from '@/utils/trainingPlanStorage'
import { canCreatePlan, getActivePlan } from '@/utils/trainingPlan'

const { t, locale } = useI18n()
const router = useRouter()
const toast = useToastStore()
const userId = usePlanUserId()
const plans = ref([])

function reload() {
  plans.value = getTrainingPlans(userId.value)
}
onMounted(reload)

const activePlan = computed(() => getActivePlan(plans.value))
const otherPlans = computed(() => plans.value.filter((plan) => !plan.active))
const canCreate = computed(() => canCreatePlan(plans.value))

function summary(plan) {
  const count = plan.days.length
  const dates = plan.days.map((day) => day.lastDoneAt).filter(Boolean).sort()
  const last = dates.length ? t('plans.lastTrained', { date: formatPlanDate(dates[dates.length - 1], locale.value) }) : t('plans.neverTrained')
  return `${t('plans.daysCount', { count }, count)} · ${last}`
}

function openPlan(plan) {
  router.push({ name: 'plan-detail', params: { id: plan.id } })
}

function activate(plan) {
  const result = activateTrainingPlan({ userId: userId.value, planId: plan.id })
  reload()
  if (!result.ok) return
  // Aktiver Plan festgelegt: direkt zum Dashboard, dort steht „Heute“.
  toast.show(t('plans.activated', { name: plan.name }), { type: 'success' })
  router.push({ name: 'dashboard' })
}
</script>

<style scoped>
.plans-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 14px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); margin: 0; font-size: 0.9rem; }
.small { font-size: 0.8rem; }
.empty { display: grid; gap: 8px; }
.plan-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 68px; color: var(--fg); font: inherit; text-align: left; cursor: pointer; }
.plan-card--active { border-color: var(--accent); }
.plan-main { display: grid; gap: 6px; min-width: 0; }
.plan-name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pill { font-size: 0.7rem; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--accent); color: var(--accent); font-weight: 700; }
.chevron { flex: 0 0 auto; width: 9px; height: 9px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(-45deg); }
.plan-card--row { cursor: default; }
.plan-open { display: grid; gap: 6px; flex: 1; min-width: 0; padding: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.activate-btn { flex: 0 0 auto; min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.btn-primary { min-height: 52px; border: none; border-radius: 14px; background: linear-gradient(120deg, var(--accent), var(--accent-strong, var(--accent))); color: var(--accent-contrast, #060606); font: inherit; font-weight: 800; cursor: pointer; }
.btn-primary:disabled { opacity: 0.45; cursor: default; }
</style>
