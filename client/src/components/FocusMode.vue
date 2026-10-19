<template>
  <!-- Fokus-Modus (Absprache Paul 19.10.): Großansicht für den aktuellen Satz; die Pause zeigt der Pausentimer
       (RestTimerBar, ebenfalls groß). Modal-Muster: Teleport + Scroll-Sperre; Minimieren beendet nichts. -->
  <Teleport to="body">
    <div v-if="focus.visible && current" class="fm" role="dialog" aria-modal="true" :aria-label="t('focus.dialogAria')">
      <div class="fm-top">
        <span class="fm-clock" aria-hidden="true">{{ clockText }}</span>
        <button type="button" class="fm-chip" :aria-label="t('focus.overviewAria')" @click="focus.minimize()">
          <span aria-hidden="true">⌄</span> {{ t('focus.overview') }}
        </button>
      </div>

      <div class="fm-body">
        <p class="fm-kicker">{{ t('focus.exerciseOf', { n: current.exPos, total: current.exCount }) }}</p>
        <h2 class="fm-name">{{ current.name }}</h2>
        <div class="fm-dots" aria-hidden="true">
          <i v-for="n in current.setTotal" :key="n" :class="{ done: n < current.setNumber, cur: n === current.setNumber }"></i>
        </div>
        <p class="fm-hint">
          <template v-if="current.isWarmup">{{ t('focus.warmupSetOf', { n: current.setNumber, total: current.setTotal }) }}</template>
          <template v-else>{{ t('focus.setOf', { n: current.setNumber, total: current.setTotal }) }}<template v-if="hintText"> · {{ hintText }}</template></template>
        </p>
        <p v-if="current.isWarmup" class="fm-warm-note">{{ t('focus.warmupNote') }}</p>

        <!-- Zeit halten / Wiederholungen in fester Zeit: Satz-Timer -->
        <template v-if="current.mode !== 'weight'">
          <div class="fm-ring" role="timer" aria-live="off">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="fm-ring-track" cx="50" cy="50" r="46" />
              <circle class="fm-ring-progress" cx="50" cy="50" r="46" :stroke-dasharray="RING_LENGTH" :stroke-dashoffset="ringOffset" />
            </svg>
            <div class="fm-ring-text">
              <span class="fm-ring-time">{{ timerText }}</span>
              <span class="fm-ring-label">{{ timerStarted ? t('focus.remaining') : t('focus.holdTime') }}</span>
            </div>
          </div>
          <div class="fm-row">
            <button type="button" class="fm-btn" :aria-label="t('focus.minusSecAria')" @click="adjustSeconds(-15)">{{ t('restTimer.minusLabel') }}</button>
            <button type="button" class="fm-btn" :aria-label="t('focus.plusSecAria')" @click="adjustSeconds(15)">{{ t('restTimer.plusLabel') }}</button>
          </div>
        </template>

        <!-- Wiederholungen (Kraft und Wiederholungen in fester Zeit) -->
        <div v-if="current.mode !== 'time'" class="fm-step">
          <p class="fm-step-label">{{ t('focus.reps') }}</p>
          <div class="fm-step-row">
            <button type="button" class="fm-step-btn" :aria-label="t('focus.repsMinusAria')" v-bind="spinBind('reps', -1)">−</button>
            <span class="fm-step-value">{{ repsText }}</span>
            <button type="button" class="fm-step-btn" :aria-label="t('focus.repsPlusAria')" v-bind="spinBind('reps', 1)">+</button>
          </div>
        </div>

        <!-- Gewicht (nur Messart Kraft) -->
        <div v-if="current.mode === 'weight'" class="fm-step">
          <p class="fm-step-label">{{ t('focus.weight') }}</p>
          <div class="fm-step-row">
            <button type="button" class="fm-step-btn" :aria-label="t('focus.weightMinusAria')" v-bind="spinBind('weight', -1)">−</button>
            <span class="fm-step-value">{{ weightText }}<small>kg</small></span>
            <button type="button" class="fm-step-btn" :aria-label="t('focus.weightPlusAria')" v-bind="spinBind('weight', 1)">+</button>
          </div>
        </div>
      </div>

      <!-- Aufwärmsatz: kein Timer - abhaken oder überspringen. -->
      <div v-if="current.isWarmup" class="fm-actions">
        <button type="button" class="fm-cta" @click="emit('done', {})">
          <span aria-hidden="true">✓</span> {{ t('focus.warmupDone') }}
        </button>
        <button type="button" class="fm-btn fm-btn-wide" @click="emit('skip')">{{ t('focus.warmupSkip') }}</button>
      </div>
      <div v-else class="fm-actions">
        <button v-if="current.mode !== 'weight' && !timerStarted" type="button" class="fm-cta" @click="startTimer">
          {{ t('focus.start') }}
        </button>
        <template v-else-if="current.mode !== 'weight'">
          <button type="button" class="fm-btn fm-btn-wide" @click="toggleTimer">
            {{ focus.timerRunning ? t('focus.pause') : t('focus.resumeTimer') }}
          </button>
        </template>
        <button
          v-if="current.mode === 'weight' || current.mode === 'repsTime' || timerStarted"
          type="button"
          class="fm-cta"
          :class="{ outline: current.mode === 'time' }"
          @click="emit('done', { early: current.mode === 'time' })"
        >
          <span aria-hidden="true">✓</span> {{ current.mode === 'time' ? t('focus.earlyDone') : t('focus.done') }}
        </button>
      </div>
    </div>

    <!-- Minimiert: große, gut lesbare Leiste (ersetzt die kleine Pausen-Leiste), Tippen öffnet die Großansicht. -->
    <button v-if="focus.active && focus.minimized" type="button" class="fm-mini" :aria-label="t('focus.openAria')" @click="emit('open')">
      <span class="fm-mini-time">{{ miniTime }}</span>
      <span class="fm-mini-text">
        <b>{{ miniTitle }}</b>
        <span v-if="miniSub">{{ miniSub }}</span>
      </span>
      <span class="fm-mini-go" aria-hidden="true"><Maximize2 class="fm-mini-go-icon" /></span>
    </button>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFocusModeStore } from '@/stores/focusModeStore'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'
import { Maximize2 } from 'lucide-vue-next'
import { formatRest } from '@/utils/restTimerRules'
import { useScrollLock } from '@/composables/useScrollLock'

// current: { key, exPos, exCount, name, setNumber, setTotal, mode, row, targetText, durationTarget, isWarmup } oder null
// (isWarmup: Aufwärmsatz - Nummer/Anzahl zählen nur Aufwärmsätze, kein Timer)
const props = defineProps({
  current: { type: Object, default: null }
})
const emit = defineEmits(['done', 'skip', 'adjust', 'spin', 'open'])
const { t } = useI18n()
const focus = useFocusModeStore()
const rest = useRestTimerStore()
const stopwatch = useSessionStopwatchStore()

const RING_LENGTH = 2 * Math.PI * 46

const clockText = computed(() => formatRest(stopwatch.elapsedMs))

const row = computed(() => props.current?.row || null)
const isOwnTimer = computed(() => !!props.current && focus.timerKey === props.current.key)
const timerStarted = computed(() => isOwnTimer.value && focus.timerStarted)
const plannedSeconds = computed(() => {
  const sec = Number(row.value?.durationSeconds)
  return Number.isFinite(sec) && sec > 0 ? sec : 60
})
const timerText = computed(() => {
  if (timerStarted.value) return formatRest(Math.ceil(focus.remainingMs / 1000) * 1000)
  return formatRest(plannedSeconds.value * 1000)
})
const ringOffset = computed(() => {
  if (!timerStarted.value) return 0
  const total = Math.max(1, focus.durationSec) * 1000
  const share = Math.min(1, Math.max(0, focus.remainingMs / total))
  return RING_LENGTH * (1 - share)
})

const hintText = computed(() => {
  const cur = props.current
  if (!cur) return ''
  if (cur.mode === 'time') return t('focus.targetSeconds', { seconds: plannedSeconds.value })
  if (cur.mode === 'repsTime') return t('focus.targetTime', { time: formatRest(plannedSeconds.value * 1000) })
  return cur.targetText ? t('focus.targetReps', { range: cur.targetText }) : ''
})

const repsText = computed(() => {
  const v = Number(row.value?.reps)
  return Number.isFinite(v) && v > 0 ? String(v) : '–'
})
const weightText = computed(() => {
  const v = Number(row.value?.weight)
  return Number.isFinite(v) && v > 0 ? String(v) : '–'
})

// Gedrückt halten wiederholt und beschleunigt (wie die Pfeile in der Übersicht); Tastatur: einzelner Schritt.
function spinBind(field, direction) {
  return {
    onPointerdown: (e) => { e.preventDefault(); emit('spin', field, direction, true) },
    onPointerup: () => emit('spin', field, direction, false),
    onPointerleave: () => emit('spin', field, direction, false),
    onPointercancel: () => emit('spin', field, direction, false),
    onKeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('adjust', field, direction) }
    }
  }
}
function stopAllSpins() {
  for (const field of ['reps', 'weight']) emit('spin', field, 1, false)
}
onMounted(() => window.addEventListener('pointerup', stopAllSpins))
onBeforeUnmount(() => { window.removeEventListener('pointerup', stopAllSpins); stopAllSpins() })

function startTimer() {
  if (!props.current) return
  focus.startTimer(props.current.key, plannedSeconds.value)
}
function toggleTimer() {
  if (focus.timerRunning) focus.pauseTimer()
  else focus.resumeTimer()
}
function adjustSeconds(delta) {
  if (timerStarted.value) {
    focus.adjustTimer(delta)
  } else {
    emit('adjust', 'durationSeconds', delta)
  }
}

// Minimierte Leiste: Pause hat Vorrang, dann der Satz-Timer, sonst der aktuelle Satz.
const miniTime = computed(() => {
  if (rest.isVisible) return rest.showFinished ? '0:00' : formatRest(rest.remainingMs)
  if (timerStarted.value) return timerText.value
  return props.current ? `${props.current.setNumber}/${props.current.setTotal}` : ''
})
const miniTitle = computed(() => {
  if (rest.isVisible) return rest.showFinished ? t('restTimer.finished') : t('focus.miniRest')
  if (timerStarted.value) return t('focus.miniHold')
  if (props.current?.isWarmup) return t('focus.miniWarmup', { n: props.current.setNumber })
  return t('focus.miniSet', { n: props.current?.setNumber || 1 })
})
const miniSub = computed(() => props.current?.name || '')

const { lock, unlock } = useScrollLock()
watch(() => focus.visible, (open) => (open ? lock() : unlock()), { immediate: true })
onBeforeUnmount(unlock)
</script>

<style scoped>
.fm {
  position: fixed;
  inset: 0;
  /* Unter dem großen Pausen-Fenster (1290), über Navigation und Leisten. */
  z-index: 1280;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 18px calc(env(safe-area-inset-bottom, 0px) + 18px);
  background: var(--bg, #08090b);
  color: var(--fg);
  overflow-y: auto;
}
.fm-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.fm-clock { font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--muted); }
.fm-chip {
  min-width: 0;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.fm-body { flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.fm-kicker { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; }
.fm-name { margin: 2px 0 6px; font-size: 1.9rem; line-height: 1.12; font-weight: 800; overflow-wrap: anywhere; }
.fm-dots { display: flex; gap: 8px; margin: 6px 0 4px; }
.fm-dots i { flex: 1; height: 8px; border-radius: 4px; background: var(--line-strong, rgba(128, 128, 128, 0.3)); }
.fm-dots i.done { background: var(--accent); }
.fm-dots i.cur { background: color-mix(in srgb, var(--accent) 45%, transparent); outline: 2px solid var(--accent); }
.fm-hint { margin: 2px 0 8px; color: var(--muted); font-size: 1.02rem; }
.fm-warm-note { margin: 0 0 6px; color: var(--muted); font-size: 0.9rem; }

.fm-step { margin-top: 10px; padding: 12px; border-radius: 22px; border: 1px solid var(--card-border); background: var(--bg-panel, var(--surface)); }
.fm-step-label { margin: 0 0 6px; text-align: center; color: var(--muted); font-size: 0.9rem; }
.fm-step-row { display: grid; grid-template-columns: 68px 1fr 68px; align-items: center; gap: 8px; }
.fm-step-value { text-align: center; font-size: 3.4rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.fm-step-value small { margin-left: 6px; font-size: 1.2rem; font-weight: 600; color: var(--muted); }
.fm-step-btn {
  min-width: 0;
  min-height: 68px;
  padding: 0;
  border-radius: 18px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 2.2rem;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fm-step-btn:active { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }

.fm-ring { position: relative; width: min(64vw, 260px); aspect-ratio: 1; margin: 10px auto 8px; }
.fm-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.fm-ring-track { fill: none; stroke: var(--line-strong, rgba(128, 128, 128, 0.3)); stroke-width: 6; }
.fm-ring-progress { fill: none; stroke: var(--accent); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.25s linear; }
.fm-ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.fm-ring-time { font-size: 3.6rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.fm-ring-label { color: var(--muted); font-size: 0.95rem; }
.fm-row { display: flex; gap: 10px; }

.fm-btn {
  flex: 1;
  min-width: 0;
  min-height: 56px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
}
.fm-btn-wide { width: 100%; flex: 0 0 auto; }
.fm-actions { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; }
.fm-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  min-height: 76px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(120deg, var(--accent), var(--accent-strong));
  color: var(--accent-contrast, #060606);
  font: inherit;
  font-size: 1.5rem;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fm-cta.outline { background: transparent; color: var(--fg); border: 2px solid var(--accent); }
.fm-cta:active { transform: scale(0.99); }

.fm-mini {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 78px);
  z-index: 1250;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 10px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--accent);
  background: color-mix(in srgb, var(--bg-panel, #0c0d10) 92%, var(--accent) 8%);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fm-mini-time { font-size: 2rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.fm-mini-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.fm-mini-text b { font-size: 1rem; }
.fm-mini-text span { color: var(--muted); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm-mini-go { flex: 0 0 auto; display: grid; place-items: center; width: 60px; height: 60px; border-radius: 16px; background: var(--accent); color: var(--accent-contrast, #060606); }
.fm-mini-go-icon { width: 30px; height: 30px; stroke-width: 2.6; }

@media (max-height: 700px) {
  .fm-step-value { font-size: 2.8rem; }
  .fm-step-btn { min-height: 58px; }
  .fm-cta { min-height: 64px; font-size: 1.3rem; }
  .fm-ring-time { font-size: 3rem; }
}
</style>
