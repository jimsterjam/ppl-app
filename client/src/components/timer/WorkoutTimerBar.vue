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
  <div class="timer-bar" :class="[timerStateClass, { expanded: isExpanded, 'portrait-fullscreen': isExpanded && !isLandscape, 'landscape-fullscreen': isExpanded && isLandscape }]">
    <span class="timer-accent" aria-hidden="true" />
    <span v-if="timerStore.countdownOverlayNumber" 
          :key="pulseKey" 
          class="timer-pulse" 
          aria-hidden="true" />
    <div class="timer-main" role="button" tabindex="0" @click="toggleExpandedFromMain" @keydown.enter.prevent="toggleExpandedFromMain" @keydown.space.prevent="toggleExpandedFromMain">
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

  <AppModal
    v-model="showTimerConfirmModal"
    :title="pendingTimerConfirmAction === 'close' ? t('timer.closeConfirmTitle') : t('timer.resetConfirmTitle')"
    :message="pendingTimerConfirmAction === 'close' ? t('timer.closeConfirmMsg') : t('timer.resetConfirmMsg')"
    :confirm-text="pendingTimerConfirmAction === 'close' ? t('timer.close') : t('timer.reset')"
    :cancel-text="t('timer.pause')"
    type="warning"
    @confirm="confirmTimerAction"
    @cancel="showTimerConfirmModal = false"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timerStore'
import AppModal from '@/components/AppModal.vue'

const { t } = useI18n()
const timerStore = useTimerStore()

const isExpanded = ref(false)
const isLandscape = ref(false)
const showTimerConfirmModal = ref(false)
const pendingTimerConfirmAction = ref(null)
const BODY_FULLSCREEN_CLASS = 'timer-landscape-fullscreen'

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
  if (isPrepPhase.value) return t('timer.prepTime') || 'Prep Time'
  if (timerStore.isCompleted) return t('timer.statusCompleted') || 'Fertig'
  if (timerStore.isArmed) return t('timer.statusArmed') || 'Bereit'
  if (timerStore.isStopwatchMode) {
    return timerStore.isPaused ? t('timer.statusPaused') : (t('timer.modeStopwatch') || 'Stoppuhr')
  }
  if (timerStore.isPaused) return t('timer.statusPaused')
  if (isRest.value) return t('timer.statusRest')
  return t('timer.statusRunning')
})
const intervalLabel = computed(() => {
  if (timerStore.isStopwatchMode) return ''
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
let orientationPollId = null

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
  if (timerStore.isStopwatchMode) {
    const startMs = Math.max(0, (Number(timerStore.config.minutes || 0) * 60 + Number(timerStore.config.seconds || 0)) * 1000)
    const direction = String(timerStore.config.countDirection || 'down') === 'up' ? 'up' : 'down'
    if (direction === 'down') {
      return {
        phaseElapsed: Math.min(startMs, visualElapsedMs.value),
        phaseDuration: startMs
      }
    }
    return { phaseElapsed: visualElapsedMs.value, phaseDuration: 0 }
  }
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
  if (timerStore.isStopwatchMode) {
    const startMs = Math.max(0, (Number(timerStore.config.minutes || 0) * 60 + Number(timerStore.config.seconds || 0)) * 1000)
    const direction = String(timerStore.config.countDirection || 'down') === 'up' ? 'up' : 'down'
    return direction === 'down'
      ? Math.max(0, startMs - visualElapsedMs.value)
      : (startMs + visualElapsedMs.value)
  }
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
  if (timerStore.isStopwatchMode) {
    const direction = String(timerStore.config.countDirection || 'down') === 'up' ? 'up' : 'down'
    if (direction === 'up') return '0%'
    const duration = visualPhase.value.phaseDuration
    if (!duration) return '0%'
    const percent = (visualPhase.value.phaseElapsed / duration) * 100
    return `${Math.min(100, percent).toFixed(2)}%`
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
  window.visualViewport?.addEventListener('resize', updateOrientation)
  window.screen?.orientation?.addEventListener?.('change', updateOrientation)
  // Fallback for environments where orientation events are flaky (e.g. iOS/Capacitor).
  orientationPollId = window.setInterval(updateOrientation, 700)
})

onBeforeUnmount(() => {
  stopRaf()
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', updateOrientation)
  window.visualViewport?.removeEventListener('resize', updateOrientation)
  window.screen?.orientation?.removeEventListener?.('change', updateOrientation)
  if (orientationPollId) {
    clearInterval(orientationPollId)
    orientationPollId = null
  }
  if (typeof document !== 'undefined') {
    document.body.classList.remove(BODY_FULLSCREEN_CLASS)
  }
})

watch([isExpanded, isLandscape], ([expanded, landscape]) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle(BODY_FULLSCREEN_CLASS, expanded && landscape)
}, { immediate: true })


// Timer Controls
function toggleRun() {
  timerStore.unlockAudio()

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
  if (timerStore.isRunning) {
    pendingTimerConfirmAction.value = 'reset'
    showTimerConfirmModal.value = true
    return
  }
  timerStore.prepare({ ...timerStore.config })
}

function closeTimer() {
  if (timerStore.isRunning || timerStore.isPaused) {
    pendingTimerConfirmAction.value = 'close'
    showTimerConfirmModal.value = true
    return
  }
  timerStore.reset()
}

function confirmTimerAction() {
  if (pendingTimerConfirmAction.value === 'close') {
    timerStore.reset()
  } else if (pendingTimerConfirmAction.value === 'reset') {
    timerStore.prepare({ ...timerStore.config })
  }
  pendingTimerConfirmAction.value = null
  showTimerConfirmModal.value = false
}

function toggleExpandedFromMain() {
  isExpanded.value = !isExpanded.value
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
  const mediaLandscape = Boolean(media?.matches)
  const viewportWidth = Number(window.visualViewport?.width || window.innerWidth || 0)
  const viewportHeight = Number(window.visualViewport?.height || window.innerHeight || 0)
  const aspectLandscape = viewportWidth > viewportHeight
  const screenType = String(window.screen?.orientation?.type || '')
  const screenLandscape = screenType.includes('landscape')
  const legacyOrientation = Number(window.orientation)
  const legacyLandscape = legacyOrientation === 90 || legacyOrientation === -90
  isLandscape.value = mediaLandscape || aspectLandscape || screenLandscape || legacyLandscape
  // In Landscape always start in fullscreen-like expanded mode for readability.
  if (isLandscape.value) {
    isExpanded.value = true
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
  --timer-icon-size: 62px;
  --timer-icon-primary-size: 76px;
  --timer-glyph-size: 36px;
  --timer-glyph-primary-size: 42px;
  --timer-controls-gap: 12px;
  display: grid;
  gap: 6px;
  padding: 10px 14px 10px;
  border-radius: 0 0 16px 16px;
  background: #07090d;
  border: none;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  box-sizing: border-box;
  transition: padding 280ms ease-in-out, border-radius 280ms ease-in-out, background 280ms ease-in-out;
}

.fullscreen-countdown {
  position: fixed;
  inset: 0;
  z-index: 3500;
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
  background: #07090d;
  min-height: min(52vh, 460px);
}

.timer-bar.portrait-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3200;
  width: 100vw;
  width: 100dvw;
  height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: #050508;
  padding:
    max(10px, env(safe-area-inset-top))
    max(12px, env(safe-area-inset-right))
    max(10px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 2fr) auto;
  gap: 0;
  align-content: stretch;
}

.timer-bar.portrait-fullscreen .timer-progress,
.timer-bar.portrait-fullscreen .timer-accent,
.timer-bar.portrait-fullscreen .timer-pulse {
  display: none;
}

.timer-bar.portrait-fullscreen .timer-main {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 2.5fr);
  align-items: center;
  justify-items: center;
  gap: clamp(8px, 2vh, 20px);
}

.timer-bar.portrait-fullscreen .timer-status {
  margin-bottom: 0;
  font-size: clamp(1.1rem, 3.5vh, 2.4rem);
}

.timer-bar.portrait-fullscreen .timer-time {
  font-size: clamp(84px, 30vw, 30dvh);
  line-height: 1;
  letter-spacing: clamp(0.02em, 0.15vw, 0.06em);
  width: 100%;
  max-width: 100%;
  height: 100%;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  padding: 0 clamp(8px, 2.5vw, 20px);
  box-sizing: border-box;
}

.timer-bar.portrait-fullscreen .timer-controls {
  grid-row: 3;
  gap: clamp(10px, 2.6vw, 20px);
  padding-bottom: max(4px, env(safe-area-inset-bottom));
}

.timer-bar.portrait-fullscreen .timer-icon {
  width: clamp(62px, 14vw, 98px);
  height: clamp(62px, 14vw, 98px);
  border-radius: clamp(12px, 2.8vw, 20px);
}

.timer-bar.portrait-fullscreen .timer-icon.primary {
  width: clamp(78px, 18vw, 124px);
  height: clamp(78px, 18vw, 124px);
  border-radius: clamp(14px, 3.2vw, 26px);
}

.timer-bar.portrait-fullscreen .timer-icon .icon {
  width: clamp(28px, 6.6vw, 48px);
  height: clamp(28px, 6.6vw, 48px);
}

.timer-bar.portrait-fullscreen .timer-icon.primary .icon {
  width: clamp(34px, 8vw, 60px);
  height: clamp(34px, 8vw, 60px);
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
  cursor: pointer;
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
  text-shadow:
    0 1px 0 color-mix(in srgb, white 22%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.32);
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  transition: font-size 340ms ease-in-out, letter-spacing 340ms ease-in-out;
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .timer-time {
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

.timer-bar.portrait-fullscreen .timer-time {
  width: 100%;
  max-width: 100%;
  height: 100%;
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .timer-status {
  font-size: 1.38rem;
  margin-bottom: 4px;
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .interval-text {
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
  border: 2px solid color-mix(in srgb, var(--accent) 85%, transparent);
  background: transparent;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .timer-icon {
  width: var(--timer-icon-size);
  height: var(--timer-icon-size);
}

.timer-icon.primary {
  width: var(--timer-icon-primary-size);
  height: var(--timer-icon-primary-size);
  background: var(--accent);
  color: #ffffff;
  border-color: color-mix(in srgb, var(--accent) 92%, black 8%);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .timer-icon.primary {
  width: var(--timer-icon-primary-size);
  height: var(--timer-icon-primary-size);
}

.timer-bar.running .timer-icon.primary {
  background: #07090d;
  border-color: var(--accent);
}

.timer-icon .icon {
  width: var(--timer-glyph-size);
  height: var(--timer-glyph-size);
}

.timer-icon.primary .icon {
  width: var(--timer-glyph-primary-size);
  height: var(--timer-glyph-primary-size);
}

.timer-icon.close {
  border-color: #dc2626;
  background: #dc2626;
  color: #ffffff;
}

.timer-icon.close:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

.timer-icon:active {
  transform: translateY(1px);
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .timer-icon .icon {
  width: var(--timer-glyph-size);
  height: var(--timer-glyph-size);
}

.timer-bar.expanded:not(.portrait-fullscreen):not(.landscape-fullscreen) .timer-icon.primary .icon {
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
    --timer-icon-size: 64px;
    --timer-icon-primary-size: 80px;
    --timer-glyph-size: 38px;
    --timer-glyph-primary-size: 44px;
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
    font-size: 2.08rem;
    color: #ffffff;
  }
}

:global(body.timer-landscape-fullscreen) {
  background: #050505;
  overflow: hidden;
}

:global(body.timer-landscape-fullscreen .app-nav),
:global(body.timer-landscape-fullscreen .header-bar) {
  display: none;
}

.timer-bar.landscape-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3200;
  width: 100vw;
  width: 100dvw;
  height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto auto;
  place-content: center;
  place-items: center;
  background: #050508;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  box-sizing: border-box;
}

.timer-bar.landscape-fullscreen .timer-handle {
  display: none;
}

.timer-bar.landscape-fullscreen .timer-accent,
.timer-bar.landscape-fullscreen .timer-pulse,
.timer-bar.landscape-fullscreen .timer-progress {
  display: none !important;
}

.timer-bar.landscape-fullscreen .timer-status {
  display: flex !important;
  margin-bottom: 18px;
  font-size: clamp(1.4rem, 3vw, 2.6rem);
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--fg) 88%, transparent);
}

.timer-bar.landscape-fullscreen .interval-text {
  font-size: 0.74em;
  color: color-mix(in srgb, var(--fg) 72%, transparent);
}

.timer-bar.landscape-fullscreen .timer-time {
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

.timer-bar.landscape-fullscreen .timer-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 36px;
}

.timer-bar.landscape-fullscreen .timer-icon {
  width: 110px;
  height: 110px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--accent);
  background: transparent;
  color: #ffffff;
}

.timer-bar.landscape-fullscreen .timer-icon.close {
  border-color: #dc2626;
  background: #dc2626;
  color: #ffffff;
}

.timer-bar.landscape-fullscreen .timer-icon.primary {
  width: 140px;
  height: 140px;
  border-radius: 26px;
  background: #07090d;
  color: #ffffff;
  border-color: var(--accent);
}

.timer-bar.landscape-fullscreen .timer-icon .icon {
  width: 48px;
  height: 48px;
}

.timer-bar.landscape-fullscreen .timer-icon.primary .icon {
  width: 60px;
  height: 60px;
}
</style>