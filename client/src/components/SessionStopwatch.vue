<template>
  <div class="session-stopwatch" ref="rootRef">
    <!-- Trigger Button -->
    <button
      class="sw-trigger"
      :class="{
        'sw-trigger--running': isRunning,
        'sw-trigger--paused': !isRunning && elapsedMs > 0
      }"
      type="button"
      @click="toggleOverlay"
    >
      <span v-if="!isRunning && elapsedMs === 0">⏱ Gesamtzeit</span>
      <span v-else>{{ formattedTime }}</span>
    </button>

    <!-- Overlay -->
    <div v-if="overlayOpen" class="sw-overlay" @click.self="closeOverlay">
      <div class="sw-panel">
        <div class="sw-time" :class="{ 'sw-time--running': isRunning, 'sw-time--paused': !isRunning && elapsedMs > 0 }">
          {{ elapsedMs === 0 ? '00:00' : formattedTime }}
        </div>

        <div class="sw-controls">
          <!-- Nicht gestartet -->
          <button v-if="!startedAt" class="sw-btn sw-btn--primary" type="button" @click="start">
            ▶ Start
          </button>

          <!-- Läuft -->
          <template v-else-if="isRunning">
            <button class="sw-btn sw-btn--secondary" type="button" @click="stop">
              ⏸ Pause
            </button>
            <button class="sw-btn sw-btn--ghost" type="button" @click="handleReset">
              ↺ Reset
            </button>
          </template>

          <!-- Pausiert -->
          <template v-else>
            <button class="sw-btn sw-btn--primary" type="button" @click="resume">
              ▶ Weiter
            </button>
            <button class="sw-btn sw-btn--ghost" type="button" @click="handleReset">
              ↺ Reset
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSessionStopwatch } from '@/composables/useSessionStopwatch'
import { releaseKeepAwake } from '@/utils/keepAwakeGuard'

const emit = defineEmits(['session-time'])

const {
  startedAt,
  isRunning,
  elapsedMs,
  formattedTime,
  start,
  stop,
  resume,
  reset
} = useSessionStopwatch()

const overlayOpen = ref(false)
const rootRef = ref(null)

function toggleOverlay() {
  overlayOpen.value = !overlayOpen.value
}

function closeOverlay() {
  overlayOpen.value = false
  if (elapsedMs.value > 0) {
    emit('session-time', {
      totalMs: elapsedMs.value,
      formattedTime: formattedTime.value
    })
  }
}

function handleReset() {
  reset()
}

function onOutsideClick(e) {
  if (!overlayOpen.value) return
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    closeOverlay()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsideClick, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsideClick)
  // Sicherheitsnetz: falls die Komponente verschwindet (z.B. Workout-Ansicht
  // verlassen) während die Stoppuhr noch lief, darf der Bildschirm wieder
  // einschlafen dürfen - der Store selbst gibt den Tag zwar bei stop()/reset()
  // frei, aber nicht automatisch beim Unmount der Anzeige.
  releaseKeepAwake('session-stopwatch')
})
</script>

<style scoped>
.session-stopwatch {
  position: relative;
  display: flex;
  width: 100%;
}

/* Trigger */
.sw-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 16px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  /* War #ffffff - im Standard-"Lime"-Akzent (heller gelbgrün) war weißer Text darauf sehr
     schlecht lesbar. var(--accent-contrast) ist die im Rest der App genutzte, zum Akzent
     passende Kontrastfarbe (siehe z.B. .primary in WorkoutDetailView.vue). */
  color: var(--accent-contrast, #060606);
  /* Etwas größer (war 1.05rem) und zentriert (fehlte bisher trotz width:100%, Inhalt hing
     am linken Rand) - deutlicherer, besser lesbarer Zeit-Anzeiger. */
  font-size: 1.15rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background-color 0.15s;
  width: 100%;
  text-align: center;
}

.sw-trigger--running {
  color: var(--accent-contrast, #060606);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--accent);
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.sw-trigger--paused {
  background: #7f1d1d;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Overlay */
.sw-overlay {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 500;
}

.sw-panel {
  background: color-mix(in srgb, var(--bg-panel) 97%, transparent);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 180px;
}

/* Zeit-Anzeige */
.sw-time {
  font-size: 2.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: color-mix(in srgb, var(--fg) 45%, transparent);
  line-height: 1;
  letter-spacing: 0.04em;
}

.sw-time--running {
  color: var(--accent);
}

.sw-time--paused {
  color: color-mix(in srgb, var(--fg) 55%, transparent);
}

/* Buttons */
.sw-controls {
  display: flex;
  gap: 8px;
}

.sw-btn {
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid transparent;
  transition: opacity 0.15s;
}

.sw-btn:active {
  opacity: 0.75;
}

.sw-btn--primary {
  background: var(--accent);
  color: var(--accent-color-contrast, #060606);
  border-color: var(--accent);
}

.sw-btn--secondary {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.sw-btn--ghost {
  background: transparent;
  color: color-mix(in srgb, var(--fg) 60%, transparent);
  border-color: var(--card-border);
}
</style>
