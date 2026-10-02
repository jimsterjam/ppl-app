<template>
  <!-- Kompakte Zeile statt Karte: das Dashboard soll nicht scrollen (siehe .dashboard-content).
       Details im Fenster (AppModal: Teleport + Scroll-Sperre). -->
  <button
    type="button"
    class="coach-row"
    :class="{ locked: !hasAccess, attention: hasAccess && stalledCount > 0 }"
    @click="onRowClick"
  >
    <Stethoscope class="coach-row-icon" aria-hidden="true" />
    <span class="coach-row-text">
      <span class="coach-row-title">{{ t('coachDiagnosis.title') }}</span>
      <span class="coach-row-status">{{ rowStatus }}</span>
    </span>
    <span v-if="!hasAccess" class="coach-row-badge">Pro</span>
    <ChevronRight class="coach-row-chevron" aria-hidden="true" />
  </button>

  <AppModal
    v-model="showDetails"
    :title="t('coachDiagnosis.title')"
    :confirm-text="t('common.close')"
    :show-cancel="false"
    type="info"
    modal-class="coach-diagnosis-modal"
  >
    <div class="coach-diagnosis">
      <p v-if="state === 'loading'" class="coach-muted">{{ t('coachDiagnosis.loading') }}</p>
      <p v-else-if="state !== 'ok'" class="coach-muted">{{ unavailableText }}</p>
      <template v-else>
        <p v-if="!entries.length" class="coach-none">{{ t('coachDiagnosis.noneText') }}</p>
        <article v-for="entry in entries" :key="entry.key" class="coach-item">
          <header class="coach-item-head">
            <strong>{{ entry.name }}</strong>
            <small v-if="entry.weeksText">{{ entry.weeksText }}</small>
          </header>
          <p><span class="coach-label">{{ t('coachDiagnosis.causeLabel') }}</span> {{ entry.cause }}</p>
          <p><span class="coach-label">{{ t('coachDiagnosis.nextLabel') }}</span> {{ entry.next }}</p>
        </article>
        <p class="coach-basis">{{ t('coachDiagnosis.basis', { count: result?.analyzedExercises || 0 }) }}</p>
      </template>
    </div>
  </AppModal>

  <UpgradeModal
    :show="showUpgrade"
    limit-type="general"
    @close="showUpgrade = false"
    @continue-free="showUpgrade = false"
    @upgraded="onUpgraded"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Stethoscope, ChevronRight } from 'lucide-vue-next'
import AppModal from '@/components/AppModal.vue'
import UpgradeModal from '@/components/UpgradeModal.vue'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useAuthStore } from '@/stores/authStore'
import { getAuthToken } from '@/utils/authToken'
import { fetchStagnationDiagnosis } from '@/api/coach'
import { diagnosisTextKeys } from '@/utils/coachDiagnosisText'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

// Ergebnis für ein paar Minuten merken (je Nutzer): das Dashboard wird oft geöffnet, der Server
// begrenzt Abrufe ohnehin (siehe server/routes/coach.js).
const CLIENT_CACHE_MS = 5 * 60 * 1000
const clientCache = { uid: null, at: 0, response: null }

const { t, locale } = useI18n()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const { getTranslatedExerciseName } = useExerciseTranslation()

const state = ref('idle') // idle | loading | ok | locked | rate_limited | error | offline
const result = ref(null)
const showDetails = ref(false)
const showUpgrade = ref(false)

const hasAccess = computed(() => subscriptionStore.isPremium && state.value !== 'locked')
const items = computed(() => (Array.isArray(result.value?.items) ? result.value.items : []))
const stalledCount = computed(() => Number(result.value?.stalledCount) || 0)

const rowStatus = computed(() => {
  if (!hasAccess.value) return t('coachDiagnosis.rowLocked')
  if (state.value === 'loading' || state.value === 'idle') return t('coachDiagnosis.rowLoading')
  if (state.value !== 'ok') return t('coachDiagnosis.rowUnavailable')
  if (stalledCount.value === 1) return t('coachDiagnosis.rowStalledOne')
  if (stalledCount.value > 1) return t('coachDiagnosis.rowStalledMany', { count: stalledCount.value })
  if (items.value.length) return t('coachDiagnosis.rowDataOnly')
  return t('coachDiagnosis.rowNone')
})

const unavailableText = computed(() => {
  if (state.value === 'offline') return t('coachDiagnosis.offline')
  if (state.value === 'rate_limited') return t('coachDiagnosis.rateLimited')
  return t('coachDiagnosis.error')
})

const entries = computed(() => items.value
  .map((item, index) => {
    const keys = diagnosisTextKeys(item, locale.value)
    if (!keys) return null
    return {
      key: `${item.name}-${index}`,
      name: getTranslatedExerciseName(item.name) || item.name,
      weeksText: keys.showWeeks ? t('coachDiagnosis.stalledFor', { weeks: item.weeks }) : '',
      cause: t(keys.causeKey, keys.params),
      next: t(keys.nextKey, keys.params)
    }
  })
  .filter(Boolean))

function applyResponse(response) {
  if (response.status === 'ok') {
    result.value = response.data
    state.value = 'ok'
  } else {
    state.value = response.status
  }
}

async function load({ force = false } = {}) {
  if (!subscriptionStore.isPremium) return
  const uid = authStore.uid
  if (!force && clientCache.response && clientCache.uid === uid && Date.now() - clientCache.at < CLIENT_CACHE_MS) {
    applyResponse(clientCache.response)
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    state.value = 'offline'
    return
  }
  state.value = 'loading'
  const token = await getAuthToken().catch(() => null)
  const response = await fetchStagnationDiagnosis(token)
  // Fehler nicht merken - nächster Dashboard-Besuch versucht es erneut.
  if (response.status === 'ok' || response.status === 'locked') {
    Object.assign(clientCache, { uid, at: Date.now(), response })
  }
  applyResponse(response)
}

function onRowClick() {
  if (!hasAccess.value) {
    showUpgrade.value = true
    return
  }
  if (state.value !== 'ok' && state.value !== 'loading') load({ force: true })
  showDetails.value = true
}

async function onUpgraded() {
  showUpgrade.value = false
  await load({ force: true })
}

onMounted(() => load())
watch(() => subscriptionStore.isPremium, (premium) => { if (premium) load({ force: true }) })
</script>

<style scoped>
.coach-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  width: 100%;
  min-height: 0;
  padding: 8px 12px;
  border-radius: calc(var(--panel-radius) - 12px);
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  color: var(--fg);
  text-align: left;
  cursor: pointer;
}
.coach-row.attention {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line-strong));
}
.coach-row-icon { width: 20px; height: 20px; flex: 0 0 auto; color: var(--accent); }
.coach-row-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.coach-row-title { font-weight: 700; font-size: 0.9rem; }
.coach-row-status {
  color: var(--muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.coach-row.attention .coach-row-status { color: var(--fg); }
.coach-row-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}
.coach-row-chevron { width: 18px; height: 18px; flex: 0 0 auto; color: var(--muted); }

.coach-diagnosis { display: grid; gap: 12px; text-align: left; }
.coach-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
  background: var(--card-soft);
}
.coach-item p { margin: 0; line-height: 1.45; font-size: 0.9rem; }
.coach-item-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; }
.coach-item-head small { color: var(--muted); }
.coach-label { font-weight: 700; }
.coach-muted, .coach-basis { color: var(--muted); font-size: 0.82rem; margin: 0; }
.coach-none { margin: 0; }
</style>
