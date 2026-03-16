<template>
  <WorkoutTimerBar v-if="showTimerBar" />

  <button
    v-else-if="showReopenButton"
    class="timer-reopen"
    type="button"
    :aria-label="t('timer.open')"
    @click="timerStore.showMini()"
  >
    {{ t('timer.open') }}
  </button>

  <div v-if="showDevDebug" class="timer-debug-indicator" aria-live="polite">
    <div>restore: {{ restoreStatus }}</div>
    <div>from: {{ timerStore.debugRestoreSource || 'n/a' }}</div>
    <div>persist: {{ timerStore.debugPersistSource || 'n/a' }}</div>
    <div>active: {{ timerStore.isActive ? 'yes' : 'no' }} | mini: {{ timerStore.miniVisible ? 'yes' : 'no' }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkoutTimerBar from '@/components/timer/WorkoutTimerBar.vue'
import { useTimerStore } from '@/stores/timerStore'

const { t } = useI18n()
const timerStore = useTimerStore()

const showTimerBar = computed(() => timerStore.isActive && timerStore.miniVisible)
const showReopenButton = computed(() => timerStore.isActive && !timerStore.miniVisible)
const showDevDebug = computed(() => import.meta.env.DEV)
const restoreStatus = computed(() => {
  if (!timerStore.debugRestoreLastCallAt) return 'never'
  return timerStore.debugRestoreFoundState
    ? `found (${timerStore.debugRestoreWasActive ? 'active' : 'idle'})`
    : 'none'
})
</script>

<style scoped>
.timer-reopen {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 10px);
  right: 12px;
  z-index: 3001;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  border-radius: 999px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--bg-panel) 95%, black 5%);
  color: var(--fg);
  font-size: 0.82rem;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}

.timer-debug-indicator {
  position: fixed;
  left: 10px;
  bottom: calc(env(safe-area-inset-bottom) + 10px);
  z-index: 3200;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 11px;
  line-height: 1.3;
  color: #d8ffe5;
  background: rgba(7, 26, 16, 0.92);
  border: 1px solid rgba(95, 220, 150, 0.55);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
}

@media (max-width: 768px) {
  .timer-reopen {
    right: 10px;
    padding: 7px 10px;
    font-size: 0.78rem;
  }
}
</style>
