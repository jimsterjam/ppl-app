<template>
  <div
    class="timer-pill"
    :class="{ running, minimized }"
    :style="stylePos"
    ref="pill"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <template v-if="!minimized">
      <button class="btn" @click.stop="toggle">
        <span v-if="running">⏸️</span>
        <span v-else>▶️</span>
      </button>
  <span class="time" :aria-live="running ? 'polite' : 'off'">{{ formatted }}</span>
  <button class="btn small" :title="$t('timer.reset')" @click.stop="reset">↺</button>
  <button class="btn small" :title="$t('timer.minimize')" @click.stop="minimize">▁</button>
  <button class="btn small" :title="$t('timer.close')" @click.stop="close">✕</button>
    </template>
    <template v-else>
      <div
        class="analog"
  :style="{ '--size': analogSize + 'px' }"
  :title="$t('timer.restoreHint')"
        role="button"
        tabindex="0"
        @click.stop="restore"
        @keydown.enter.prevent="restore"
        @keydown.space.prevent="restore"
      >
        <span class="hand hour" :style="{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }"></span>
        <span class="hand minute" :style="{ transform: `translate(-50%, -100%) rotate(${minDeg}deg)` }"></span>
        <span class="hand second" :style="{ transform: `translate(-50%, -100%) rotate(${secDeg}deg)` }"></span>
        <span class="center"></span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

const props = defineProps({
  autoStart: { type: Boolean, default: false }
})
const emit = defineEmits(['stop'])

const running = ref(false)
const startTs = ref(0)
const elapsedMs = ref(0)
let tick = null
const minimized = ref(false)
const pill = ref(null)
let currentPillWidth = 220

// Position
const top = ref(64)
const left = ref()
const right = ref(12) // default rechts ausgerichtet
const dragging = ref(false)
let dragStart = null

function start() {
  if (running.value) return
  running.value = true
  startTs.value = Date.now() - elapsedMs.value
  tick = setInterval(() => { elapsedMs.value = Date.now() - startTs.value }, 1000)
}
function pause() {
  if (!running.value) return
  running.value = false
  clearInterval(tick)
  tick = null
  emit('stop', elapsedMs.value)
}
function reset() {
  elapsedMs.value = 0
  if (running.value) {
    startTs.value = Date.now()
  }
}
function toggle() { running.value ? pause() : start() }
function close() {
  if (running.value) pause()
  // Verstecke durch Entfernen aus DOM via v-if im Parent (optional). Hier: einfach stoppen und minimieren.
  // Minimal: setze width auf 0 via CSS Klasse? Stattdessen emitten und Parent kann v-if binden.
  emit('stop', elapsedMs.value)
}
function minimize() { minimized.value = true; saveUiState() }
function restore() { minimized.value = false; saveUiState() }

function onPointerDown(e) {
  // Start Drag
  dragging.value = true
  dragStart = { x: e.clientX, y: e.clientY, top: top.value, left: left.value, right: right.value }
  const rect = pill.value?.getBoundingClientRect?.()
  if (rect && rect.width) currentPillWidth = rect.width
  try { e.target.setPointerCapture?.(e.pointerId) } catch {}
}
function onPointerUp(e) {
  if (!dragging.value) return
  dragging.value = false
  dragStart = null
  saveUiState()
}

// Maus bewegen (window), um auch außerhalb weiterzuziehen
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    if (!dragging.value || !dragStart) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    // Beim ersten Drag von rechtsbündig auf absolute left umstellen
    if (right.value != null && left.value == null) {
      // Compute aktuelle Left basierend auf viewport und tatsächlicher Breite
      const vw = window.innerWidth
      const pillWidth = currentPillWidth || 220
      left.value = Math.max(4, Math.min(vw - pillWidth - 4, vw - right.value - pillWidth))
      right.value = null
    }
    const vh = window.innerHeight
    const vw = window.innerWidth
    const newTop = Math.max(4, Math.min(vh - 48, (dragStart.top ?? 64) + dy))
    const newLeft = Math.max(4, Math.min(vw - 48, (dragStart.left ?? left.value ?? 12) + dx))
    top.value = newTop
    left.value = newLeft
  })
}

const stylePos = computed(() => {
  const style = { }
  if (left.value != null) style.left = left.value + 'px'
  if (right.value != null) style.right = right.value + 'px'
  style.top = top.value + 'px'
  return style
})

const formatted = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
})

// Analog-Ziffernblatt (minimiert)
const secDeg = computed(() => (Math.floor(elapsedMs.value / 1000) % 60) * 6)
const minDeg = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  return (m + s / 60) * 6
})
const hourDeg = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000)
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 12
  return (h + m / 60) * 30
})
// Größe des Ziffernblatts (mobil ~50% größer)
const analogBase = 28
const isMobile = ref(false)
const analogSize = computed(() => (isMobile.value ? Math.round(analogBase * 1.5) : analogBase))

function saveUiState() {
  try {
    const state = { top: top.value, left: left.value, right: right.value, minimized: minimized.value }
    localStorage.setItem('workoutTimer-ui', JSON.stringify(state))
  } catch {}
}
function loadUiState() {
  try {
    const raw = localStorage.getItem('workoutTimer-ui')
    if (!raw) return
    const s = JSON.parse(raw)
    if (typeof s.top === 'number') top.value = s.top
    if (typeof s.left === 'number') { left.value = s.left; right.value = null }
    if (typeof s.right === 'number' && s.left == null) right.value = s.right
    if (typeof s.minimized === 'boolean') minimized.value = s.minimized
  } catch {}
}

let mq
function setupMobileWatcher() {
  if (typeof window === 'undefined' || !window.matchMedia) return
  mq = window.matchMedia('(max-width: 480px)')
  const update = () => { isMobile.value = !!mq.matches }
  update()
  if (mq.addEventListener) mq.addEventListener('change', update)
  else if (mq.addListener) mq.addListener(update)
}
function teardownMobileWatcher() {
  if (!mq) return
  const update = () => { isMobile.value = !!mq.matches }
  if (mq.removeEventListener) mq.removeEventListener('change', update)
  else if (mq.removeListener) mq.removeListener(update)
  mq = null
}

onMounted(() => { loadUiState(); setupMobileWatcher(); if (props.autoStart) start() })
onBeforeUnmount(() => { if (tick) clearInterval(tick); teardownMobileWatcher() })
</script>

<style scoped>
.timer-pill {
  position: fixed;
  /* top/left/right werden dynamisch gesetzt */
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--card-bg);
  color: var(--fg);
  border: 1px solid var(--card-border);
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  z-index: 2000;
}
.timer-pill.running { border-color: color-mix(in oklab, var(--success-color) 40%, var(--card-border)); }
.time { font-variant-numeric: tabular-nums; font-weight: 600; }
.time.mini { font-weight: 500; opacity: 0.9; }
.btn { background: transparent; border: none; color: var(--fg); cursor: pointer; font-size: 1rem; line-height: 1; }
.btn.small { opacity: 0.8; }
.btn:hover { opacity: 1; }
/* Minimiert: nur kleine Darstellung */
.timer-pill.minimized {
  display: inline-block;
  padding: 0;
  gap: 0;
  min-width: 0;
  width: fit-content;
  inline-size: fit-content;
}
/* Analog-Ziffernblatt */
.analog { position: relative; width: var(--size, 22px); height: var(--size, 22px); border-radius: 50%; border: 2px solid var(--card-border); background: var(--surface); }
.timer-pill.minimized .analog { cursor: pointer; }
.analog .center { position: absolute; width: calc(var(--size, 22px) * 0.12); height: calc(var(--size, 22px) * 0.12); background: var(--fg); border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.hand { position: absolute; left: 50%; top: 50%; transform-origin: bottom center; border-radius: 1px; }
.hand.hour { width: 2px; height: calc(var(--size, 22px) * 0.34); background: var(--fg); }
.hand.minute { width: 2px; height: calc(var(--size, 22px) * 0.42); background: var(--fg); opacity: 0.9; }
.hand.second { width: 1.5px; height: calc(var(--size, 22px) * 0.46); background: var(--accent); opacity: 0.95; }
@media (max-width: 480px) {
  .timer-pill { top: 60px; right: 8px; padding: 6px 8px; }
  .timer-pill.minimized {
    padding: 0 !important;
    width: fit-content !important;
    inline-size: fit-content !important;
  }
}
</style>
