<template>
  <!-- Kurzer Hinweis, wenn Mitteilungen noch nicht erlaubt (iOS hat nie gefragt) oder ausgeschaltet sind (iOS fragt nur einmal). -->
  <div v-if="hint.visible.value" class="notify-hint" role="note">
    <p class="notify-hint-text">{{ hint.permission.value === 'prompt' ? t('notifyHint.textAsk') : t('notifyHint.text') }}</p>
    <div class="notify-hint-actions">
      <button v-if="hint.permission.value === 'prompt'" type="button" class="notify-hint-btn" @click="hint.allow()">{{ t('notifyHint.allow') }}</button>
      <button v-else type="button" class="notify-hint-btn" @click="hint.openSettings()">{{ t('notifyHint.openSettings') }}</button>
      <button type="button" class="notify-hint-btn ghost" @click="hint.dismiss()">{{ t('notifyHint.dismiss') }}</button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useNotificationHint } from '@/composables/useNotificationHint'

const { t } = useI18n()
const hint = useNotificationHint()
</script>

<style scoped>
.notify-hint {
  margin: 6px 0 4px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--warning, #ff9e3d) 55%, transparent);
  background: color-mix(in srgb, var(--warning, #ff9e3d) 14%, transparent);
}
.notify-hint-text { margin: 0; font-size: 0.8rem; line-height: 1.4; }
.notify-hint-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.notify-hint-btn {
  min-height: 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--warning, #ff9e3d) 70%, transparent);
  background: color-mix(in srgb, var(--warning, #ff9e3d) 22%, transparent);
  color: var(--fg);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.notify-hint-btn.ghost { background: transparent; border-color: var(--line-strong); font-weight: 600; }
</style>
