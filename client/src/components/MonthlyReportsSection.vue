<template>
  <!-- Statistik-Seite: alle Monatsberichte (Pro) bzw. der Beispielbericht, solange es keinen echten gibt. -->
  <section class="reports-section">
    <h3 class="reports-title">{{ t('monthlyReport.sectionTitle') }}</h3>

    <ul v-if="rows.length" class="reports-list">
      <li v-for="row in rows" :key="row.id">
        <button type="button" class="reports-item" @click="open(row)">
          <span class="reports-item-text">
            <strong>{{ row.title }}</strong>
            <small>{{ row.subtitle }}</small>
          </span>
          <span v-if="row.badge" class="reports-badge">{{ row.badge }}</span>
          <ChevronRight class="reports-chevron" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else class="reports-empty">{{ t('monthlyReport.sectionLoading') }}</p>
  </section>

  <MonthlyReportModal
    v-model="showReport"
    :report-id="selectedId"
    :example="selectedId === ''"
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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight } from 'lucide-vue-next'
import MonthlyReportModal from '@/components/MonthlyReportModal.vue'
import UpgradeModal from '@/components/UpgradeModal.vue'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useMonthlyReportStore } from '@/stores/monthlyReportStore'
import { formatReportPeriod, isUnseen } from '@/utils/monthlyReportView'

const { t, locale } = useI18n()
const subscriptionStore = useSubscriptionStore()
const store = useMonthlyReportStore()

const showReport = ref(false)
const showUpgrade = ref(false)
const selectedId = ref('')

const showsExample = computed(() => !subscriptionStore.isPremium || (store.loaded && !store.hasRealReport))

const rows = computed(() => {
  if (subscriptionStore.isPremium && store.hasRealReport) {
    return store.reports.map((report) => ({
      id: report.id,
      title: t('monthlyReport.modalTitle'),
      subtitle: formatReportPeriod(report.periodStart, report.periodEnd, locale.value),
      badge: isUnseen(report) ? t('monthlyReport.badgeNew') : ''
    }))
  }
  if (showsExample.value) {
    return [{
      id: 'example',
      title: t('monthlyReport.rowExampleTitle'),
      subtitle: subscriptionStore.isPremium ? t('monthlyReport.rowExamplePro') : t('monthlyReport.rowExampleFree'),
      badge: t('monthlyReport.badgeExample')
    }]
  }
  return []
})

async function open(row) {
  selectedId.value = row.id === 'example' ? '' : row.id
  showReport.value = true
  if (row.id !== 'example') await store.markSeen(row.id)
}

async function onUpgraded() {
  showUpgrade.value = false
  showReport.value = false
  await store.refresh({ force: true })
}

onMounted(() => { if (subscriptionStore.isPremium) store.refresh() })
</script>

<style scoped>
.reports-section { display: grid; gap: 8px; }
.reports-title { margin: 0; font-size: 1rem; }
.reports-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.reports-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  color: var(--fg);
  text-align: left;
  cursor: pointer;
}
.reports-item-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.reports-item-text small { color: var(--muted); }
.reports-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}
.reports-chevron { width: 18px; height: 18px; flex: 0 0 auto; color: var(--muted); }
.reports-empty { margin: 0; color: var(--muted); font-size: 0.85rem; }
</style>
