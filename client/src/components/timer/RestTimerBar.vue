<template>
  <!-- Pausentimer zwischen Sätzen (stores/restTimerStore.js).
       Standard: groß in der Mitte (Vollbild-Overlay), aus ~2 m lesbar (User-Report 2026-10-01).
       "Verkleinern" bzw. Einstellung "Leiste" -> kompakte Leiste unten über der Navigation; die
       Pause läuft dabei unverändert weiter. Läuft gleichzeitig ein Intervall-Timer (oben), wird
       die Leiste kompakter gezeigt. -->
  <Teleport to="body">
    <div
      v-if="rest.showOverlay"
      class="rest-overlay"
      :class="{ finished: rest.showFinished, ending: isEnding }"
      role="dialog"
      aria-modal="true"
      :aria-label="t('restTimer.overlayAria')"
    >
      <div class="ro-inner">
        <template v-if="rest.showFinished">
          <p class="ro-finished">{{ t('restTimer.finished') }}</p>
          <p v-if="nextSet" class="ro-next">
            <span class="ro-next-name">{{ nextSet.name }}</span>
            <span class="ro-next-detail">{{ nextSetDetail }}</span>
          </p>
          <button type="button" class="ro-btn ro-primary" @click="rest.clear()">{{ t('restTimer.continue') }}</button>
        </template>

        <template v-else>
          <p class="ro-label">{{ t('restTimer.label') }}</p>
          <div class="ro-ring" role="timer" aria-live="off">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="ro-ring-track" cx="50" cy="50" r="46" />
              <circle
                class="ro-ring-progress"
                cx="50"
                cy="50"
                r="46"
                :stroke-dasharray="RING_LENGTH"
                :stroke-dashoffset="ringOffset"
              />
            </svg>
            <span class="ro-time" :class="{ long: timeText.length > 4 }">{{ timeText }}</span>
          </div>

          <p v-if="nextSet" class="ro-next">
            <span class="ro-next-label">{{ t('restTimer.nextSet') }}</span>
            <span class="ro-next-name">{{ nextSet.name }}</span>
            <span class="ro-next-detail">{{ nextSetDetail }}</span>
          </p>

          <div class="ro-actions">
            <button type="button" class="ro-btn" :aria-label="t('restTimer.minusAria')" @click="rest.adjust(-REST_STEP_SECONDS)">−15</button>
            <button type="button" class="ro-btn" :aria-label="t('restTimer.plusAria')" @click="rest.adjust(REST_STEP_SECONDS)">+15</button>
          </div>
          <button type="button" class="ro-btn ro-primary" @click="rest.skip()">{{ t('restTimer.skip') }}</button>

          <!-- Dauer angepasst: für diese Übung merken (auch im Favoriten, siehe exercise.restSeconds). -->
          <button
            v-if="rest.isAdjusted && !remembered"
            type="button"
            class="ro-link"
            @click="remember"
          >{{ t('restTimer.remember', { time: formatRest(rest.durationSec * 1000) }) }}</button>
        </template>

        <button type="button" class="ro-link ro-minimize" @click="rest.minimize()">{{ t('restTimer.minimize') }}</button>
      </div>
    </div>

    <div
      v-else-if="rest.isVisible"
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
          <span class="rest-time">{{ timeText }}</span>
        </div>
        <div class="rest-actions">
          <button type="button" class="rest-btn" :aria-label="t('restTimer.minusAria')" @click="rest.adjust(-REST_STEP_SECONDS)">−15</button>
          <button type="button" class="rest-btn" :aria-label="t('restTimer.plusAria')" @click="rest.adjust(REST_STEP_SECONDS)">+15</button>
          <button type="button" class="rest-btn skip" @click="rest.skip()">{{ t('restTimer.skip') }}</button>
          <button
            v-if="rest.fullscreen"
            type="button"
            class="rest-btn"
            :aria-label="t('restTimer.expandAria')"
            :title="t('restTimer.expandAria')"
            @click="rest.expand()"
          >⤢</button>
        </div>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { useTimerStore } from '@/stores/timerStore'
import { formatRest, REST_STEP_SECONDS } from '@/utils/restTimerRules'
import { useScrollLock } from '@/composables/useScrollLock'

const props = defineProps({
  // Nächster offener Arbeitssatz: { name, setNumber, reps, weight } oder null (WorkoutDetailView).
  nextSet: { type: Object, default: null }
})
const emit = defineEmits(['remember'])
const { t, locale } = useI18n()
const rest = useRestTimerStore()
const timerStore = useTimerStore()

// Umfang des Fortschrittsrings (r = 46 im viewBox 0..100).
const RING_LENGTH = 2 * Math.PI * 46
// Letzte Sekunden farblich hervorheben - auch aus Entfernung erkennbar.
const ENDING_MS = 10000

// Intervall-Timer aktiv (große Leiste oben) -> Pause kompakter.
const compact = computed(() => timerStore.isActive && timerStore.miniVisible)

const timeText = computed(() => formatRest(rest.remainingMs))
const isEnding = computed(() => rest.isRunning && rest.remainingMs <= ENDING_MS)
const ringOffset = computed(() => {
  const total = (rest.durationSec || 0) * 1000
  const share = total > 0 ? Math.min(1, Math.max(0, rest.remainingMs / total)) : 0
  return RING_LENGTH * (1 - share)
})

const nextSetDetail = computed(() => {
  const next = props.nextSet
  if (!next) return ''
  const parts = [t('restTimer.setNumber', { n: next.setNumber })]
  const reps = Number(next.reps) || 0
  const weight = Number(next.weight) || 0
  if (reps > 0 && weight > 0) {
    parts.push(t('restTimer.setTarget', { reps, weight: weight.toLocaleString(locale.value) }))
  } else if (reps > 0) {
    parts.push(t('restTimer.setTargetReps', { reps }))
  }
  return parts.join(' · ')
})

const remembered = ref(false)
watch(() => rest.baseSec, () => { remembered.value = false })

function remember() {
  emit('remember', { exIndex: rest.exIndex, seconds: rest.durationSec })
  remembered.value = true
}

// Modal-Muster: Hintergrund nicht scrollbar, solange das Vollbild offen ist. Schließen/Verkleinern
// beendet die Pause nicht.
const { lock, unlock } = useScrollLock()
watch(() => rest.showOverlay, (open) => (open ? lock() : unlock()), { immediate: true })
onBeforeUnmount(unlock)
</script>

<style scoped>
/* --- Vollbild ------------------------------------------------------------------------------ */
.rest-overlay {
  position: fixed;
  inset: 0;
  /* Über Bottom-Navigation (1200) und Leiste, unter Fenstern (AppModal 1300). */
  z-index: 1290;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px);
  background: color-mix(in srgb, var(--bg, #08090b) 94%, transparent);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  color: var(--fg);
  --ro-color: var(--accent);
}
.rest-overlay.ending { --ro-color: #ff9f1a; }
.rest-overlay.finished {
  --ro-color: #2fbf71;
  background: color-mix(in srgb, #2fbf71 35%, var(--bg, #08090b));
}
.ro-inner {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.ro-label {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
.ro-ring {
  position: relative;
  width: min(86vw, 380px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ro-ring svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ro-ring-track { fill: none; stroke: var(--card-border, rgba(255, 255, 255, 0.12)); stroke-width: 4; }
.ro-ring-progress {
  fill: none;
  stroke: var(--ro-color);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.25s linear, stroke 0.3s ease;
}
/* ~130 px auf einem 393-pt-iPhone: Ziffern rund 1,5 cm hoch - aus ca. 2 m gut lesbar. */
.ro-time {
  position: relative;
  font-size: clamp(88px, 33vw, 150px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--ro-color);
  transition: color 0.3s ease;
}
.ro-time.long { font-size: clamp(72px, 25vw, 120px); }
.ro-finished {
  margin: 0;
  font-size: clamp(2.2rem, 11vw, 3.4rem);
  font-weight: 800;
  line-height: 1.15;
  color: var(--fg);
}
.ro-next {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ro-next-label { font-size: 0.95rem; color: var(--muted); }
.ro-next-name { font-size: 1.35rem; font-weight: 700; }
.ro-next-detail { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.ro-actions { display: flex; gap: 12px; width: 100%; }
.ro-actions .ro-btn { flex: 1; }
.ro-btn {
  min-width: 0;
  min-height: 60px;
  width: 100%;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.ro-primary {
  border-color: transparent;
  background: var(--ro-color);
  color: #0b0c0f;
}
.ro-link {
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.ro-minimize { color: var(--muted); }
/* Niedrige Displays (z. B. iPhone SE): Ring etwas kleiner, damit alles ohne Scrollen passt. */
@media (max-height: 700px) {
  .ro-ring { width: min(70vw, 300px); }
  .ro-time { font-size: clamp(80px, 27vw, 130px); }
  .ro-btn { min-height: 52px; }
  .ro-inner { gap: 10px; }
}

/* --- Leiste (verkleinert bzw. Einstellung "Leiste") ------------------------------------------ */
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
