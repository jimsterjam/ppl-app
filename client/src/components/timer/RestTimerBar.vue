<template>
  <!-- Pausentimer zwischen Sätzen (stores/restTimerStore.js). Unten über der Navigation, gut
       lesbar. Läuft gleichzeitig ein Intervall-Timer (oben), wird die Pause kompakter gezeigt. -->
  <Teleport to="body">
    <div
      v-if="rest.isVisible"
      class="rest-bar"
      :class="{ compact: compact, finished: rest.showFinished }"
      role="timer"
      aria-live="polite"
    >
      <template v-if="rest.showFinished">
        <span class="rest-label">{{ t('restTimer.finished') }}</span>
        <button type="button" class="rest-btn" @click="rest.clear()">{{ t('common.close') }}</button>
      </template>
      <template v-else>
        <div class="rest-info">
          <span class="rest-label">{{ t('restTimer.label') }}<template v-if="rest.exerciseName"> · {{ rest.exerciseName }}</template></span>
          <span class="rest-time">{{ formatRest(rest.remainingMs) }}</span>
        </div>
        <div class="rest-actions">
          <button type="button" class="rest-btn" :aria-label="t('restTimer.minusAria')" @click="rest.adjust(-REST_STEP_SECONDS)">−15</button>
          <button type="button" class="rest-btn" :aria-label="t('restTimer.plusAria')" @click="rest.adjust(REST_STEP_SECONDS)">+15</button>
          <button type="button" class="rest-btn skip" @click="rest.skip()">{{ t('restTimer.skip') }}</button>
        </div>
        <!-- Dauer angepasst: für diese Übung merken (auch im Favoriten, siehe exercise.restSeconds). -->
        <button
          v-if="rest.isAdjusted && !remembered"
          type="button"
          class="rest-remember"
          @click="remember"
        >{{ t('restTimer.remember', { time: formatRest(rest.durationSec * 1000) }) }}</button>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { useTimerStore } from '@/stores/timerStore'
import { formatRest, REST_STEP_SECONDS } from '@/utils/restTimerRules'

const emit = defineEmits(['remember'])
const { t } = useI18n()
const rest = useRestTimerStore()
const timerStore = useTimerStore()

// Intervall-Timer aktiv (große Leiste oben) -> Pause kompakter.
const compact = computed(() => timerStore.isActive && timerStore.miniVisible)

const remembered = ref(false)
watch(() => rest.baseSec, () => { remembered.value = false })

function remember() {
  emit('remember', { exIndex: rest.exIndex, seconds: rest.durationSec })
  remembered.value = true
}
</script>

<style scoped>
.rest-bar {
  position: fixed;
  left: 10px;
  right: 10px;
  /* Über der Bottom-Navigation (siehe BottomNav.vue), unter Fenstern (AppModal z-index 1300). */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 78px);
  z-index: 1250;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--bg-panel, #0c0d10) 94%, var(--accent) 6%);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: var(--fg);
}
.rest-bar.finished {
  background: color-mix(in srgb, var(--accent) 22%, var(--bg-panel, #0c0d10));
}
.rest-info { display: flex; flex-direction: column; min-width: 0; }
.rest-label {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 55vw;
}
.rest-bar.finished .rest-label { font-size: 1rem; font-weight: 700; color: var(--fg); }
.rest-time {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.rest-actions { display: flex; gap: 6px; }
.rest-btn {
  min-width: 0;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.rest-btn.skip { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.rest-remember {
  flex-basis: 100%;
  min-width: 0;
  min-height: 0;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.rest-bar.compact { padding: 6px 10px; }
.rest-bar.compact .rest-time { font-size: 1.3rem; }
.rest-bar.compact .rest-btn { min-height: 32px; padding: 0 8px; }
</style>
