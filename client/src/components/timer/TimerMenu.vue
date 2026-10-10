<template>
  <Teleport to="body">
    <div class="timer-menu-overlay" @click.self="$emit('close')">
      <div class="timer-menu" role="dialog" aria-modal="true" :aria-label="t('timer.menuTitle')">
        <header class="timer-menu-header">
          <h3>{{ t('timer.menuTitle') }}</h3>
          <button class="close-btn" type="button" :aria-label="t('common.close')" @click="$emit('close')">✕</button>
        </header>
        <div class="timer-menu-body">
          <button class="menu-card" type="button" @click="$emit('select', 'rest')">
            <strong>{{ t('timer.menuRestTitle') }}</strong>
            <span>{{ t('timer.menuRestDesc') }}</span>
          </button>
          <button class="menu-card" type="button" @click="$emit('select', 'workout')">
            <strong>{{ t('timer.menuWorkoutTitle') }}</strong>
            <span>{{ t('timer.menuWorkoutDesc') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollLock } from '@/composables/useScrollLock'

defineEmits(['close', 'select'])
const { t } = useI18n()
const { lock, unlock } = useScrollLock()
onMounted(lock)
onBeforeUnmount(unlock)
</script>

<style scoped>
.timer-menu-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 55%, black 45%);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.timer-menu {
  width: min(460px, 100%);
  background: color-mix(in srgb, var(--bg-panel) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-border) 65%, transparent);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
.timer-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
}
.timer-menu-header h3 { margin: 0; font-size: 1.25rem; font-weight: 800; }
.close-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
}
.timer-menu-body { padding: 18px 22px 24px; display: flex; flex-direction: column; gap: 12px; }
.menu-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  text-align: left;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1.5px solid color-mix(in srgb, var(--card-border) 80%, transparent);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  color: var(--fg);
  font-family: inherit;
  cursor: pointer;
}
.menu-card strong { font-size: 1.05rem; }
.menu-card span { color: var(--muted); font-size: 0.85rem; }
.menu-card:active { transform: scale(0.99); }
</style>
