<template>
  <div class="plan-detail-view">
    <HeaderBar :title="plan?.name || t('plans.title')" />

    <div v-if="plan" class="content">
      <button type="button" class="back-btn" @click="router.push({ name: 'plans' })">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <div class="status-row">
        <span v-if="plan.active" class="pill">{{ t('plans.activeBadge') }}</span>
        <button v-else type="button" class="btn-secondary" @click="activate">{{ t('plans.setActive') }}</button>
      </div>

      <h2 class="section-title">{{ t('plans.daysSection') }}</h2>
      <div v-for="(day, index) in plan.days" :key="day.id" class="day" :class="{ now: index === plan.activeDayIndex }">
        <button type="button" class="day-main" @click="openDayMenu(day)">
          <span class="num">{{ index + 1 }}</span>
          <span class="day-text">
            <span class="day-name">{{ dayTitle(day) }}</span>
            <span class="muted">{{ daySub(day, index) }}</span>
          </span>
        </button>
        <span class="move">
          <button type="button" :disabled="index === 0" :aria-label="t('plans.moveUp')" @click="move(day, -1)">▲</button>
          <button type="button" :disabled="index === plan.days.length - 1" :aria-label="t('plans.moveDown')" @click="move(day, 1)">▼</button>
        </span>
      </div>

      <button type="button" class="btn-secondary" @click="openAddDay">{{ t('plans.addDay') }}</button>
      <p v-if="notice" class="muted notice" role="status">{{ notice }}</p>
      <p class="muted small">{{ t('plans.explain') }}</p>
      <p class="muted small">{{ t('plans.abExplain') }}</p>

      <button type="button" class="btn-secondary" @click="openRename">{{ t('plans.rename') }}</button>
      <button type="button" class="btn-secondary danger" @click="showDelete = true">{{ t('plans.delete') }}</button>
    </div>

    <AppModal
      v-model="showDayMenu"
      :title="dayMenuTarget ? dayTitle(dayMenuTarget) : ''"
      :confirm-text="t('common.close')"
      :show-cancel="false"
      type="info"
    >
      <div class="menu-actions">
        <button type="button" class="menu-btn" @click="setNextDay">{{ t('plans.dayMenuSetNext') }}</button>
        <button type="button" class="menu-btn" @click="openRenameDay">{{ t('plans.dayMenuRename') }}</button>
        <button type="button" class="menu-btn menu-btn--danger" @click="removeDayAction">{{ t('plans.dayMenuRemove') }}</button>
      </div>
    </AppModal>

    <AppModal
      v-model="showAddDay"
      :title="t('plans.addDayTitle')"
      :confirm-text="t('common.close')"
      :show-cancel="false"
      type="info"
    >
      <p class="muted">{{ favorites.length ? t('plans.addDayHint') : t('plans.noFavorites') }}</p>
      <div class="menu-actions">
        <button v-for="fav in favorites" :key="fav.id" type="button" class="menu-btn" @click="addDay(fav)">{{ fav.name }}</button>
      </div>
    </AppModal>

    <AppModal
      v-model="showRename"
      :title="renameDayId ? t('plans.dayMenuRename') : t('plans.renameTitle')"
      :confirm-text="t('common.save')"
      :cancel-text="t('common.cancel')"
      type="info"
      @confirm="saveRename"
    >
      <label class="field">
        <span>{{ renameDayId ? t('plans.dayLabelLabel') : t('plans.nameLabel') }}</span>
        <input v-model="renameInput" type="text" :maxlength="renameDayId ? 24 : 40" :placeholder="renameDayId ? t('plans.dayLabelPlaceholder') : t('plans.namePlaceholder')" />
      </label>
    </AppModal>

    <AppModal
      v-model="showDelete"
      :title="t('plans.deleteConfirmTitle')"
      :message="t('plans.deleteConfirmMsg', { name: plan?.name || '' })"
      :confirm-text="t('plans.delete')"
      :cancel-text="t('common.cancel')"
      type="warning"
      @confirm="deletePlan"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import AppModal from '@/components/AppModal.vue'
import { usePlanUserId, formatPlanDate } from '@/composables/usePlanUserId'
import { useToastStore } from '@/stores/toastStore'
import { activateTrainingPlan, deleteTrainingPlan, getTrainingPlans, updateTrainingPlan } from '@/utils/trainingPlanStorage'
import { addDay as addPlanDay, moveDay, removeDay, renameDay, renamePlan, selectDay, PLAN_LIMITS } from '@/utils/trainingPlan'
import { getAllFavorites } from '@/utils/planFromTemplate'
import { getDayMuscleGroups } from '@/utils/planProgress'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const userId = usePlanUserId()
const toast = useToastStore()
const { getTranslatedMuscleGroup } = useExerciseTranslation()

const plan = ref(null)
const favorites = ref([])
const notice = ref('')

function reload() {
  plan.value = getTrainingPlans(userId.value).find((entry) => entry.id === route.params.id) || null
  favorites.value = getAllFavorites(userId.value)
  if (!plan.value) router.replace({ name: 'plans' })
}
onMounted(reload)

const favoriteById = computed(() => new Map(favorites.value.map((fav) => [fav.id, fav])))

function dayTitle(day) {
  return day.label || favoriteById.value.get(day.favoriteId)?.name || t('plans.favoriteMissing')
}

function daySub(day, index) {
  const parts = []
  if (index === plan.value.activeDayIndex) parts.push(t('plans.nextDay'))
  const fav = favoriteById.value.get(day.favoriteId)
  if (!fav) parts.push(t('plans.favoriteMissing'))
  else {
    const muscles = [...new Set(getDayMuscleGroups(fav).map((group) => getTranslatedMuscleGroup(group)).filter(Boolean))].join(', ')
    if (muscles) parts.push(muscles)
  }
  parts.push(day.lastDoneAt ? t('plans.lastShort', { date: formatPlanDate(day.lastDoneAt, locale.value) }) : t('plans.neverTrained'))
  return parts.join(' · ')
}

function apply(updater) {
  notice.value = ''
  const result = updateTrainingPlan({ userId: userId.value, planId: plan.value.id, updater })
  if (result.ok && result.plan === null) { router.replace({ name: 'plans' }); return }
  reload()
}

function activate() {
  const name = plan.value.name
  const result = activateTrainingPlan({ userId: userId.value, planId: plan.value.id })
  reload()
  if (!result.ok) return
  // Aktiver Plan festgelegt: direkt zum Dashboard, dort steht „Heute“.
  toast.show(t('plans.activated', { name }), { type: 'success' })
  router.push({ name: 'dashboard' })
}

function move(day, direction) {
  apply((p) => moveDay(p, day.id, direction))
}

// Tag-Menü
const showDayMenu = ref(false)
const dayMenuTarget = ref(null)
function openDayMenu(day) {
  dayMenuTarget.value = day
  showDayMenu.value = true
}
function setNextDay() {
  const day = dayMenuTarget.value
  showDayMenu.value = false
  if (day) apply((p) => selectDay(p, day.id))
}
function removeDayAction() {
  const day = dayMenuTarget.value
  showDayMenu.value = false
  if (!day) return
  if (plan.value.days.length <= 1) { notice.value = t('plans.lastDayHint'); return }
  apply((p) => removeDay(p, day.id))
}

// Tag hinzufügen
const showAddDay = ref(false)
function openAddDay() {
  notice.value = ''
  if (plan.value.days.length >= PLAN_LIMITS.maxDays) { notice.value = t('plans.maxDays'); return }
  favorites.value = getAllFavorites(userId.value)
  showAddDay.value = true
}
function addDay(fav) {
  showAddDay.value = false
  apply((p) => addPlanDay(p, { favoriteId: fav.id }) || p)
}

// Umbenennen (Plan oder Tag)
const showRename = ref(false)
const renameInput = ref('')
const renameDayId = ref('')
function openRename() {
  renameDayId.value = ''
  renameInput.value = plan.value.name
  showRename.value = true
}
function openRenameDay() {
  const day = dayMenuTarget.value
  showDayMenu.value = false
  if (!day) return
  renameDayId.value = day.id
  renameInput.value = day.label || ''
  showRename.value = true
}
function saveRename() {
  const value = renameInput.value
  if (renameDayId.value) {
    const id = renameDayId.value
    apply((p) => renameDay(p, id, value))
  } else {
    apply((p) => renamePlan(p, value))
  }
}

// Löschen
const showDelete = ref(false)
function deletePlan() {
  deleteTrainingPlan({ userId: userId.value, planId: plan.value.id })
  router.replace({ name: 'plans' })
}
</script>

<style scoped>
.plan-detail-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 12px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); margin: 0; font-size: 0.85rem; }
.small { font-size: 0.8rem; line-height: 1.5; }
.notice { color: var(--warning-text, var(--muted)); }
.status-row { display: flex; align-items: center; }
.pill { font-size: 0.72rem; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--accent); color: var(--accent); font-weight: 700; }
.day { display: flex; align-items: center; gap: 8px; border: 1px solid var(--card-border); background: var(--card-bg); border-radius: var(--card-radius); padding: 6px 8px 6px 6px; }
.day.now { border-color: var(--accent); }
.day-main { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; min-height: 56px; padding: 0 6px; border: none; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.num { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; font-weight: 700; font-size: 0.9rem; }
.day.now .num { background: var(--accent); color: var(--accent-contrast, #060606); }
.day-text { display: grid; gap: 2px; min-width: 0; }
.day-name { font-family: var(--font-heading); font-weight: 700; overflow-wrap: anywhere; }
.move { display: flex; flex-direction: column; gap: 2px; flex: 0 0 auto; }
.move button { min-width: 44px; min-height: 28px; padding: 0; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-size: 0.85rem; cursor: pointer; }
.move button:disabled { opacity: 0.25; cursor: default; }
.btn-secondary { min-height: 48px; border-radius: 14px; border: 1px solid var(--card-border); background: transparent; color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.btn-secondary.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, var(--card-border)); }
.menu-actions { display: grid; gap: 8px; }
.menu-btn { min-height: 48px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.menu-btn--danger { color: var(--danger); }
.field { display: grid; gap: 6px; font-size: 0.9rem; }
.field input { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--bg); color: var(--fg); font: inherit; }
</style>
