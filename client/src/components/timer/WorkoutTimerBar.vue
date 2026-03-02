<template>
  <div
    v-if="showFullscreenCountdown"
    :key="pulseKey"
    class="fullscreen-countdown"
    aria-live="assertive"
    aria-atomic="true"
  >
    <span class="fullscreen-countdown-number">{{ fullscreenCountdownValue }}</span>
  </div>
  <div class="timer-bar" :class="[timerStateClass, { expanded: isExpanded }]">
    <span class="timer-accent" aria-hidden="true" />
    <span v-if="timerStore.countdownOverlayNumber" 
          :key="pulseKey" 
          class="timer-pulse" 
          aria-hidden="true" />
    <div class="timer-main">
      <div class="timer-status">
        <span class="status-text">{{ statusLabel }}</span>
        <span v-if="intervalLabel" class="interval-text">{{ intervalLabel }}</span>
      </div>
      <div class="timer-time">{{ formattedTime }}</div>
    </div>

    <div class="timer-controls">
      <button class="timer-icon primary" type="button" :aria-label="primaryLabel" @click="toggleRun">
        <svg v-if="timerStore.isRunning" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="7,4 20,12 7,20" />
        </svg>
      </button>
      <button class="timer-icon" type="button" :aria-label="t('timer.reset')" @click="resetTimer">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <polyline points="3 4 3 10 9 10" />
        </svg>
      </button>
      <button class="timer-icon expand" type="button" aria-label="Expand timer" @click="isExpanded = !isExpanded">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="8 10 12 6 16 10" />
          <polyline points="8 14 12 18 16 14" />
        </svg>
      </button>
      <button class="timer-icon close" type="button" :aria-label="t('timer.close')" @click="closeTimer">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="timer-progress" aria-hidden="true">
      <span class="timer-progress-fill" :style="{ width: progressWidth }" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timerStore'

const emit = defineEmits(['close'])

const { t } = useI18n()
const timerStore = useTimerStore()

const isExpanded = ref(false)
const isLandscape = ref(false)

// Overlay Pulse
const pulseKey = computed(() => timerStore.countdownOverlayKey)
const fullscreenCountdownValue = computed(() => {
  const raw = timerStore.countdownOverlayNumber
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 1 || parsed > 3) return null
  return String(parsed)
})
const showFullscreenCountdown = computed(() => Boolean(fullscreenCountdownValue.value))

// Phase Info
const phaseInfo = computed(() => timerStore.phaseInfo)
const isRest = computed(() => phaseInfo.value.isRest)
const prepRemainingMs = computed(() => {
  if (!timerStore.startedAt) return 0
  const remaining = timerStore.startedAt - rafNow.value
  return remaining > 0 ? remaining : 0
})
const isPrepPhase = computed(() => prepRemainingMs.value > 0)

// Labels
const statusLabel = computed(() => {
  if (isPrepPhase.value) return 'PREP'
  if (timerStore.isPaused) return t('timer.statusPaused')
  if (isRest.value) return t('timer.statusRest')
  return t('timer.statusRunning')
})
const intervalLabel = computed(() => {
  if (isPrepPhase.value) return ''
  if (phaseInfo.value.intervalTotal <= 1) return ''
  return t('timer.intervalLabel', {
    current: phaseInfo.value.intervalIndex,
    total: phaseInfo.value.intervalTotal
  })
})
const primaryLabel = computed(() => (timerStore.isRunning ? t('timer.pause') : t('timer.resume')))
const timerStateClass = computed(() => ({
  running: timerStore.isRunning,
  paused: timerStore.isPaused,
  rest: isRest.value
}))

const rafNow = ref(Date.now())
let rafId = null

const visualElapsedMs = computed(() => {
  if (!timerStore.startedAt) return 0
  if (timerStore.isRunning) {
    return Math.max(0, rafNow.value - timerStore.startedAt - timerStore.pausedTotalMs)
  }
  if (timerStore.isPaused && timerStore.pausedAt) {
    return Math.max(0, timerStore.pausedAt - timerStore.startedAt - timerStore.pausedTotalMs)
  }
  return 0
})

const visualPhase = computed(() => {
  const work = timerStore.workMs
  const rest = timerStore.restMs
  const intervals = Math.max(1, timerStore.config.intervals)
  if (work <= 0) return { phaseElapsed: 0, phaseDuration: 0 }
  const cycleMs = work + rest
  const elapsed = Math.min(visualElapsedMs.value, (work * intervals) + (rest * Math.max(0, intervals - 1)))
  const intervalIndex = Math.min(intervals - 1, Math.floor(elapsed / cycleMs))
  const offset = elapsed - (intervalIndex * cycleMs)
  const isRestPhase = offset >= work && intervalIndex < intervals - 1 && rest > 0
  const phaseElapsed = isRestPhase ? Math.min(rest, offset - work) : Math.min(work, offset)
  const phaseDuration = isRestPhase ? rest : work
  return { phaseElapsed, phaseDuration }
})

const displayMs = computed(() => {
  if (isPrepPhase.value) return prepRemainingMs.value
  if (!timerStore.config.countdown) return visualPhase.value.phaseElapsed
  return Math.max(0, visualPhase.value.phaseDuration - visualPhase.value.phaseElapsed)
})

const formattedTime = computed(() => formatTime(displayMs.value))
const progressWidth = computed(() => {
  if (isPrepPhase.value) {
    const prepTotalMs = Math.max(0, Number(timerStore.config.prepSeconds || 0) * 1000)
    if (!prepTotalMs) return '0%'
    const prepElapsed = Math.max(0, prepTotalMs - prepRemainingMs.value)
    return `${Math.min(100, (prepElapsed / prepTotalMs) * 100).toFixed(2)}%`
  }
  const duration = visualPhase.value.phaseDuration
  if (!duration) return '0%'
  const percent = (visualPhase.value.phaseElapsed / duration) * 100
  return `${percent.toFixed(2)}%`
})

const startRaf = () => {
  if (rafId) return
  const loop = () => {
    rafNow.value = Date.now()
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

const stopRaf = () => {
  if (!rafId) return
  cancelAnimationFrame(rafId)
  rafId = null
}

watch(() => timerStore.isRunning, (running) => {
  if (running) startRaf()
  else stopRaf()
}, { immediate: true })

onMounted(() => {
  if (timerStore.isRunning) startRaf()
  updateOrientation()
  window.addEventListener('resize', updateOrientation)
  window.addEventListener('orientationchange', updateOrientation)
})

onBeforeUnmount(() => {
  stopRaf()
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', updateOrientation)
})


// Timer Controls
function toggleRun() {
  timerStore.unlockAudio()
  timerStore.unlockSpeech()

  if (timerStore.isRunning) {
    timerStore.pause()
  } else if (timerStore.isPaused) {
    timerStore.resume()
  } else {
    timerStore.start()
  }
}

function resetTimer() {
  timerStore.unlockAudio()
  timerStore.unlockSpeech()
  timerStore.prepare({ ...timerStore.config })
}

function closeTimer() {
  timerStore.reset()
  emit('close')
}


function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  // const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
}

function updateOrientation() {
  if (typeof window === 'undefined') return
  const media = window.matchMedia?.('(orientation: landscape)')
  isLandscape.value = media ? media.matches : window.innerWidth > window.innerHeight
  if (isLandscape.value) {
    isExpanded.value = false
  }
}
</script>

<style scoped>
.timer-bar {
  position: fixed;
  top: env(safe-area-inset-top);
  left: 0;
  right: 0;
  z-index: 3000;
  --timer-time-base: 2.2rem;
  --timer-time-size: var(--timer-time-base);
  --timer-icon-size: 44px;
  --timer-icon-primary-size: 56px;
  --timer-glyph-size: 24px;
  --timer-glyph-primary-size: 28px;
  --timer-controls-gap: 12px;
  display: grid;
  gap: 6px;
  padding: 10px 14px 10px;
  border-radius: 0 0 16px 16px;
  background: color-mix(in srgb, var(--bg-panel) 92%, black 8%);
  border: none;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  box-sizing: border-box;
  transition: padding 280ms ease-in-out, border-radius 280ms ease-in-out, background 280ms ease-in-out;
}

.fullscreen-countdown {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  place-items: center;
  pointer-events: none;
  background: color-mix(in srgb, var(--bg, #111214) 70%, transparent);
}

.fullscreen-countdown-number {
  font-size: min(80vw, 80vh);
  line-height: 1;
  font-weight: 900;
  color: var(--fg, #ffffff);
  text-shadow: 0 10px 35px rgba(0, 0, 0, 0.55);
  font-variant-numeric: tabular-nums;
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
}

.timer-bar.expanded {
  --timer-time-size: calc(var(--timer-time-base) * 3);
  --timer-icon-size: 54px;
  --timer-icon-primary-size: 68px;
  --timer-glyph-size: 28px;
  --timer-glyph-primary-size: 34px;
  --timer-controls-gap: 14px;
  padding: 12px 14px 12px;
  background: color-mix(in srgb, var(--bg-panel) 96%, black 4%);
}

.timer-accent {
  display: none;
}

.timer-bar.running .timer-accent {
  display: none;
}

.timer-pulse {
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  border-radius: 18px;
  animation: timerPulse 0.55s ease-out;
  pointer-events: none;
}

.timer-bar.running,
.timer-bar.rest {
  border: none;
}

.timer-main {
  display: grid;
  gap: 4px;
}

.timer-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.15;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--fg) 72%, transparent);
  text-align: center;
  margin-bottom: 2px;
}

.status-text,
.interval-text {
  display: block;
  width: 100%;
  text-align: center;
}

.status-text {
  font-size: 1em;
}

.interval-text {
  font-size: 0.86em;
  letter-spacing: 0.07em;
  color: color-mix(in srgb, var(--fg) 62%, transparent);
}

.timer-time {
  font-size: var(--timer-time-size);
  font-weight: 800;
  /* letter-spacing: 0.08em; */
  color: var(--accent);
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  transition: font-size 340ms ease-in-out, letter-spacing 340ms ease-in-out;
}

.timer-bar.expanded .timer-time {
  font-size: var(--timer-time-size);
  line-height: 1;
  text-align: center;
  width: 90vw;
  max-width: 90vw;
  height: 30vh;
  height: 30dvh;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
}

.timer-bar.expanded .timer-status {
  font-size: 1.22rem;
  margin-bottom: 4px;
}

.timer-bar.expanded .interval-text {
  font-size: 0.88em;
}

.timer-bar.running .timer-time {
  color: var(--accent);
}

.timer-controls {
  display: flex;
  justify-content: center;
  gap: var(--timer-controls-gap);
  align-items: center;
}

.timer-icon {
  width: var(--timer-icon-size);
  height: var(--timer-icon-size);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  background: transparent;
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
}

.timer-bar.expanded .timer-icon {
  width: var(--timer-icon-size);
  height: var(--timer-icon-size);
}

.timer-icon.primary {
  width: var(--timer-icon-primary-size);
  height: var(--timer-icon-primary-size);
  background: var(--accent);
  color: var(--accent-contrast);
}

.timer-bar.expanded .timer-icon.primary {
  width: var(--timer-icon-primary-size);
  height: var(--timer-icon-primary-size);
}

.timer-bar.running .timer-icon.primary {
  background: var(--accent);
  border-color: var(--accent);
}

.timer-icon .icon {
  width: var(--timer-glyph-size);
  height: var(--timer-glyph-size);
  stroke-width: 2.25;
}

.timer-icon.primary .icon {
  width: var(--timer-glyph-primary-size);
  height: var(--timer-glyph-primary-size);
}

.timer-bar.expanded .timer-icon .icon {
  width: var(--timer-glyph-size);
  height: var(--timer-glyph-size);
}

.timer-bar.expanded .timer-icon.primary .icon {
  width: var(--timer-glyph-primary-size);
  height: var(--timer-glyph-primary-size);
}

.timer-progress {
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}


.timer-progress-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.timer-bar.paused .timer-progress-fill {
  background: rgba(255, 255, 255, 0.35);
}

@keyframes timerPulse {
  0% { opacity: 0.9; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.02); }
}

@media (max-width: 480px) {
  .timer-bar {
    --timer-time-base: 2rem;
    --timer-time-size: var(--timer-time-base);
    --timer-icon-size: 44px;
    --timer-icon-primary-size: 54px;
    --timer-glyph-size: 24px;
    --timer-glyph-primary-size: 28px;
    --timer-controls-gap: 10px;
  }
  .timer-bar.expanded {
    --timer-time-size: calc(var(--timer-time-base) * 3);
    --timer-icon-size: 52px;
    --timer-icon-primary-size: 66px;
    --timer-glyph-size: 28px;
    --timer-glyph-primary-size: 34px;
    --timer-controls-gap: 12px;
  }

  .timer-status {
    font-size: 0.92rem;
  }

  .timer-bar.expanded .timer-status {
    font-size: 1.08rem;
  }
}

@media (orientation: landscape) {

  :global(body) {
    background: #050505;
    overflow: hidden;
  }

  :global(.app-nav),
  :global(.header-bar) {
    display: none;
  }

  .timer-bar {
    position: fixed;
    inset: 0;
    width: 100vw;
    width: 100dvw;
    height: 100vh;
    height: 100dvh;

    display: grid;
    grid-template-rows: auto auto;
    place-content: center;
    place-items: center;

    /* gap: 48px; */

    background: color-mix(in srgb, var(--bg-panel) 95%, black 5%);
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    box-sizing: border-box;
  }

  .timer-handle {
    display: none;
  }

  .timer-icon.expand {
    display: none;
  }

  /* Alles ausblenden */
  .timer-accent,
  .timer-pulse,
  .timer-progress {
    display: none !important;
  }

  .timer-status {
    display: flex !important;
    margin-bottom: 18px;
    font-size: clamp(1.2rem, 2.2vw, 2rem);
    letter-spacing: 0.08em;
    color: color-mix(in srgb, var(--fg) 88%, transparent);
  }

  .interval-text {
    font-size: 0.74em;
    color: color-mix(in srgb, var(--fg) 72%, transparent);
  }

  /* Zeit riesig */
  .timer-time {
    font-size: clamp(100px, 20vw, 280px);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent);
    text-align: center;
    line-height: 1;
    width: auto;
    max-width: none;
    height: auto;
    margin: 0;
    display: block;
  }

  /* Controls */
  .timer-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 36px;
  }

  .timer-icon {
    width: 110px;
    height: 110px;
    border-radius: 20px;

    display: flex;
    align-items: center;
    justify-content: center;

    border: 2px solid var(--accent);
    background: transparent;
    color: var(--accent);
  }

  .timer-icon.primary {
    width: 140px;
    height: 140px;
    border-radius: 26px;

    background: var(--accent);
    color: var(--accent-contrast);
    border: none;
  }

  .timer-icon .icon {
    width: 48px;
    height: 48px;
  }

  .timer-icon.primary .icon {
    width: 60px;
    height: 60px;
  }
}
</style>