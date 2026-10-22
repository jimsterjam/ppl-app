<template>
  <div class="quota-card">
    <template v-if="isFree">
      <p class="quota-main" :class="`quota-main--${level}`">
        {{ t('aiQuota.remaining', { remaining, limit }) }}
      </p>
      <div
        class="quota-bar"
        role="progressbar"
        :aria-valuenow="remaining"
        aria-valuemin="0"
        :aria-valuemax="limit"
        :aria-label="t('aiQuota.barAria')"
      >
        <span class="quota-fill" :class="`quota-fill--${level}`" :style="{ width: `${percentLeft}%` }"></span>
      </div>
      <p class="quota-line">{{ t('aiQuota.renews', { date: resetDateLabel }) }}</p>
      <p class="quota-line">{{ t('aiQuota.used', { used }) }}</p>
      <p v-if="level === 'empty'" class="quota-alert">{{ t('aiQuota.emptyText', { date: resetDateLabel }) }}</p>
      <p v-else-if="level === 'low'" class="quota-warn">{{ t('aiQuota.lowText') }}</p>
      <p class="quota-hint">{{ t('aiQuota.costRule') }}</p>
      <template v-if="PRO_PURCHASE_ENABLED">
        <button type="button" class="quota-pro" @click="showUpgrade = true">{{ t('aiQuota.proButton') }}</button>
        <UpgradeModal :show="showUpgrade" limit-type="general" @close="showUpgrade = false" @continue-free="showUpgrade = false" @upgraded="onUpgraded" />
      </template>
    </template>
    <p v-else class="quota-main">{{ t('aiQuota.unlimited') }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UpgradeModal from '@/components/UpgradeModal.vue'
import { useAiQuota } from '@/composables/useAiQuota'
import { PRO_PURCHASE_ENABLED } from '@/config/features'

const { t } = useI18n()
const { isFree, limit, used, remaining, percentLeft, level, resetDateLabel, reload } = useAiQuota()
const showUpgrade = ref(false)

async function onUpgraded() {
  showUpgrade.value = false
  await reload()
}
</script>

<style scoped>
.quota-main { margin: 0 0 10px; font-size: 1.15rem; font-weight: 700; }
.quota-main--low { color: var(--warning-text, inherit); }
.quota-main--empty { color: var(--danger); }
.quota-bar { height: 10px; border-radius: 999px; background: rgba(128, 128, 128, 0.25); overflow: hidden; }
.quota-fill { display: block; height: 100%; border-radius: 999px; background: var(--success, #22c55e); transition: width 0.3s ease; }
.quota-fill--low { background: var(--warning); }
.quota-fill--empty { background: var(--danger); }
.quota-line { margin: 10px 0 0; color: var(--muted); font-size: 0.9rem; }
.quota-hint { margin: 12px 0; color: var(--muted); font-size: 0.85rem; }
.quota-warn, .quota-alert { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 0.9rem; }
.quota-warn { background: color-mix(in srgb, var(--warning) 18%, transparent); color: var(--warning-text, inherit); }
.quota-alert { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.quota-pro {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--accent, currentColor);
  border-radius: 12px;
  background: transparent;
  color: var(--accent, inherit);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
</style>
