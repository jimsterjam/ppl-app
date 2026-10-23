<template>
  <!-- Übergangs-Stoppuhr (stores/transitionTimerStore.js): zählt nach der letzten Übung hoch, bis die nächste
       Übung gestartet wird. Groß in der Mitte; "Verkleinern" zeigt sie als Leiste unten (läuft weiter). -->
  <Teleport to="body">
    <div v-if="showOverlay" class="tt-overlay" role="dialog" aria-modal="true" :aria-label="t('transition.overlayAria')">
      <div class="tt-inner">
        <p class="tt-label">{{ t('transition.label') }}</p>
        <p class="tt-time" role="timer" aria-live="off">{{ timeText }}</p>

        <div v-if="nextSet" class="tt-next">
          <span class="tt-next-label">{{ t('restTimer.nextSet') }}</span>
          <span class="tt-next-name">{{ nextSet.name }} · {{ t('restTimer.setNumber', { n: nextSet.setNumber }) }}</span>
          <div v-if="nextSet.mode && nextSet.mode !== 'time'" class="tt-adjust">
            <span class="tt-adjust-label">{{ t('focus.reps') }}</span>
            <button type="button" class="tt-adjust-btn" :aria-label="t('focus.repsMinusAria')" v-bind="spinBind('reps', -1)">−</button>
            <span class="tt-adjust-value">{{ nextRepsText }}</span>
            <button type="button" class="tt-adjust-btn" :aria-label="t('focus.repsPlusAria')" v-bind="spinBind('reps', 1)">+</button>
          </div>
          <div v-if="nextSet.mode === 'weight'" class="tt-adjust">
            <span class="tt-adjust-label">{{ t('focus.weight') }}</span>
            <button type="button" class="tt-adjust-btn" :aria-label="t('focus.weightMinusAria')" v-bind="spinBind('weight', -1)">−</button>
            <span class="tt-adjust-value">{{ nextWeightText }}<small>kg</small></span>
            <button type="button" class="tt-adjust-btn" :aria-label="t('focus.weightPlusAria')" v-bind="spinBind('weight', 1)">+</button>
          </div>
          <div v-if="nextSet.mode === 'time' || nextSet.mode === 'repsTime'" class="tt-adjust">
            <span class="tt-adjust-label">{{ t('focus.holdTime') }}</span>
            <button type="button" class="tt-adjust-btn" :aria-label="t('focus.minusSecAria')" @click="emit('adjust-next', 'durationSeconds', -15)">−</button>
            <span class="tt-adjust-value">{{ nextSet.durationSeconds || 60 }}<small>s</small></span>
            <button type="button" class="tt-adjust-btn" :aria-label="t('focus.plusSecAria')" @click="emit('adjust-next', 'durationSeconds', 15)">+</button>
          </div>
        </div>

        <button type="button" class="tt-start" @click="emit('start')">{{ t('transition.start') }}</button>
        <button type="button" class="tt-link" @click="minimizeOverlay">{{ t('restTimer.minimize') }}</button>
      </div>
    </div>

    <div v-else-if="transition.isActive && !hideMinimized" class="tt-bar" role="timer" aria-live="off">
      <button type="button" class="tt-expand" :aria-label="t('transition.expandAria')" :title="t('transition.expandAria')" @click="transition.expand()">⤢</button>
      <div class="tt-bar-info">
        <span class="tt-bar-label">{{ t('transition.label') }}</span>
        <span class="tt-bar-time">{{ timeText }}</span>
      </div>
      <button type="button" class="tt-bar-start" @click="emit('start')">{{ t('transition.start') }}</button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransitionTimerStore } from '@/stores/transitionTimerStore'
import { formatRest } from '@/utils/restTimerRules'
import { useScrollLock } from '@/composables/useScrollLock'

const props = defineProps({
  // Erster offener Arbeitssatz der nächsten Übung: { name, setNumber, reps, weight, durationSeconds, mode } oder null.
  nextSet: { type: Object, default: null },
  // Großansicht (Fokus-Modus) sichtbar: der Übergang bleibt groß, minimiert zeigt der Fokus-Modus seine Leiste.
  forceFull: { type: Boolean, default: false },
  hideMinimized: { type: Boolean, default: false }
})
const emit = defineEmits(['start', 'minimize', 'adjust-next', 'spin-next'])
const { t } = useI18n()
const transition = useTransitionTimerStore()

const showOverlay = computed(() => transition.isActive && (!transition.minimized || props.forceFull))
const timeText = computed(() => formatRest(Math.floor(transition.elapsedMs / 1000) * 1000))
const nextRepsText = computed(() => (Number(props.nextSet?.reps) > 0 ? String(props.nextSet.reps) : '–'))
const nextWeightText = computed(() => (Number(props.nextSet?.weight) > 0 ? String(props.nextSet.weight) : '–'))

function minimizeOverlay() {
  transition.minimize()
  emit('minimize')
}

// Gedrückt halten wiederholt und beschleunigt (wie im Pausenfenster); Tastatur: einzelner Schritt.
function spinBind(field, direction) {
  return {
    onPointerdown: (e) => { e.preventDefault(); emit('spin-next', field, direction, true) },
    onPointerup: () => emit('spin-next', field, direction, false),
    onPointerleave: () => emit('spin-next', field, direction, false),
    onPointercancel: () => emit('spin-next', field, direction, false),
    onKeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('adjust-next', field, direction) }
    }
  }
}
function stopAllSpins() {
  for (const field of ['reps', 'weight']) emit('spin-next', field, 1, false)
}
onMounted(() => window.addEventListener('pointerup', stopAllSpins))
onBeforeUnmount(() => { window.removeEventListener('pointerup', stopAllSpins); stopAllSpins() })

// Modal-Muster: Hintergrund nicht scrollbar, solange das Vollbild offen ist. Verkleinern beendet nichts.
const { lock, unlock } = useScrollLock()
watch(showOverlay, (open) => (open ? lock() : unlock()), { immediate: true })
onBeforeUnmount(unlock)
</script>

<style scoped>
.tt-overlay {
  position: fixed;
  inset: 0;
  /* Gleiche Ebene wie das Pausenfenster: über Großansicht und Navigation, unter Fenstern (AppModal 1300). */
  z-index: 1290;
  display: flex;
  align-items: safe center;
  justify-content: center;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px);
  background: color-mix(in srgb, var(--bg, #08090b) 94%, transparent);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  color: var(--fg);
  overflow-y: auto;
}
.tt-inner { width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.tt-label { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.tt-time {
  margin: 0;
  font-size: clamp(72px, 26vw, 120px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--accent);
}
.tt-next { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.tt-next-label { font-size: 0.95rem; color: var(--muted); }
.tt-next-name { font-size: 1.35rem; font-weight: 700; }
.tt-adjust { display: grid; grid-template-columns: 1fr 52px minmax(72px, auto) 52px; align-items: center; gap: 8px; }
.tt-adjust-label { text-align: left; color: var(--muted); font-size: 0.95rem; }
.tt-adjust-value { text-align: center; font-size: 1.7rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.tt-adjust-value small { margin-left: 4px; font-size: 0.9rem; font-weight: 600; color: var(--muted); }
.tt-adjust-btn {
  min-width: 0;
  min-height: 52px;
  padding: 0;
  border-radius: 14px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 1.6rem;
  cursor: pointer;
}
.tt-adjust-btn:active { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
.tt-start {
  width: 100%;
  min-height: 64px;
  padding: 0 16px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(120deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast, #060606);
  font: inherit;
  font-size: 1.3rem;
  font-weight: 800;
  cursor: pointer;
}
.tt-link { min-height: 44px; padding: 0 12px; border: none; background: transparent; color: var(--muted); font: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; }
@media (max-height: 700px) {
  .tt-time { font-size: clamp(56px, 20vw, 88px); }
  .tt-inner { gap: 10px; }
  .tt-start { min-height: 56px; }
}

.tt-bar {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 78px);
  z-index: 1250;
  display: flex;
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
.tt-expand {
  width: 44px;
  height: 44px;
  min-width: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}
.tt-bar-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.tt-bar-label { font-size: 0.78rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tt-bar-time { font-size: 1.8rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tt-bar-start {
  min-height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
</style>
