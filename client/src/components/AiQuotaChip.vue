<template>
  <button
    v-if="isFree"
    type="button"
    class="quota-chip"
    :class="`quota-chip--${level}`"
    :aria-label="t('aiQuota.chipAria')"
    @click="router.push({ name: 'settings', query: { open: 'aiQuota' } })"
  >
    <span class="quota-dot" aria-hidden="true"></span>
    {{ level === 'empty' ? t('aiQuota.chipEmpty', { date: resetDateLabel }) : t('aiQuota.chip', { remaining, limit }) }}
  </button>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAiQuota } from '@/composables/useAiQuota'

// Kleine Zeile "Noch X von 60 KI-Anfragen" - Tippen öffnet die Kontingent-Karte in den Einstellungen.
const { t } = useI18n()
const router = useRouter()
const { isFree, limit, remaining, level, resetDateLabel } = useAiQuota()
</script>

<style scoped>
.quota-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid var(--border, rgba(128, 128, 128, 0.35));
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.quota-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success, #22c55e); }
.quota-chip--low { color: var(--warning-text, var(--muted)); border-color: color-mix(in srgb, var(--warning) 55%, transparent); }
.quota-chip--low .quota-dot { background: var(--warning); }
.quota-chip--empty { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
.quota-chip--empty .quota-dot { background: var(--danger); }
</style>
