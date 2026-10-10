<template>
  <!-- Kompakte Dashboard-Zeile nur bei neuem Bericht - oder als Beispielbericht, solange noch kein
       echter Bericht existiert (auch ohne Pro). Sonst nichts (Absprache Paul 10.10.). -->
  <button v-if="mode" type="button" class="report-row" :class="{ attention: mode === 'new' }" @click="open">
    <FileBarChart class="report-row-icon" aria-hidden="true" />
    <span class="report-row-text">
      <span class="report-row-title">{{ mode === 'new' ? t('monthlyReport.rowTitle') : t('monthlyReport.rowExampleTitle') }}</span>
      <span class="report-row-status">{{ status }}</span>
    </span>
    <span v-if="mode === 'example'" class="report-row-badge">{{ t('monthlyReport.badgeExample') }}</span>
    <span v-else class="report-row-badge">{{ t('monthlyReport.badgeNew') }}</span>
    <ChevronRight class="report-row-chevron" aria-hidden="true" />
  </button>

  <MonthlyReportModal
    v-model="showReport"
    :report-id="mode === 'new' ? unseen.id : ''"
    :example="mode !== 'new'"
    :is-pro="subscriptionStore.isPremium"
    @upgrade="showUpgrade = true"
  />

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
import { FileBarChart, ChevronRight } from 'lucide-vue-next'
import MonthlyReportModal from '@/components/MonthlyReportModal.vue'
import UpgradeModal from '@/components/UpgradeModal.vue'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useAuthStore } from '@/stores/authStore'
import { useMonthlyReportStore } from '@/stores/monthlyReportStore'
import { formatReportPeriod } from '@/utils/monthlyReportView'

const { t, locale } = useI18n()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const store = useMonthlyReportStore()

const showReport = ref(false)
const showUpgrade = ref(false)

const unseen = computed(() => (subscriptionStore.isPremium ? store.unseen : null))

// 'new': echter, noch nicht geöffneter Bericht · 'example': noch kein echter Bericht · null: nichts
const mode = computed(() => {
  if (unseen.value) return 'new'
  if (!subscriptionStore.isPremium) return 'example'
  // Pro: erst zeigen, wenn die Liste geladen ist - sonst blitzt kurz das Beispiel auf.
  return store.loaded && !store.hasRealReport ? 'example' : null
})

const status = computed(() => {
  if (mode.value === 'new') {
    return t('monthlyReport.rowNew', { period: formatReportPeriod(unseen.value.periodStart, unseen.value.periodEnd, locale.value) })
  }
  return subscriptionStore.isPremium ? t('monthlyReport.rowExamplePro') : t('monthlyReport.rowExampleFree')
})

async function open() {
  showReport.value = true
  if (mode.value === 'new') await store.markSeen(unseen.value.id)
}

async function refresh(force = false) {
  if (!subscriptionStore.isPremium) return
  await store.refresh({ force })
}

async function onUpgraded() {
  showUpgrade.value = false
  showReport.value = false
  await refresh(true)
}

onMounted(() => refresh())
watch(() => subscriptionStore.isPremium, (premium) => { if (premium) refresh(true) })
// Anderer Nutzer in derselben Sitzung: keine Berichte des Vorgängers anzeigen.
watch(() => authStore.uid, () => { store.reset(); refresh(true) })
</script>

<style scoped>
.report-row {
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
.report-row.attention { border-color: color-mix(in srgb, var(--accent) 55%, var(--line-strong)); }
.report-row-icon { width: 20px; height: 20px; flex: 0 0 auto; color: var(--accent); }
.report-row-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.report-row-title { font-weight: 700; font-size: 0.9rem; }
.report-row-status {
  color: var(--muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.report-row.attention .report-row-status { color: var(--fg); }
.report-row-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}
.report-row-chevron { width: 18px; height: 18px; flex: 0 0 auto; color: var(--muted); }
</style>
