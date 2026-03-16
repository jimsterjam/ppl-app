<template>
  <div v-if="visible" class="picker-overlay" @click.self="onCancel">
    <div class="picker-sheet" role="dialog" aria-modal="true">
      <header class="picker-header">
        <button class="btn text" @click="onCancel">{{ cancelText }}</button>
        <strong class="title">{{ title }}</strong>
        <button class="btn primary" @click="onConfirm">{{ confirmText }}</button>
      </header>

      <div v-if="!splitDecimals" class="picker-wheel" ref="wheelRef">
        <div class="wheel-virtual" ref="listRef" @scroll="onScroll">
          <div class="wheel-spacer" :style="{ height: totalHeight + 'px' }"></div>
          <div class="wheel-items">
            <div
              v-for="(item, idx) in visibleItems"
              :key="item.value"
              class="wheel-item"
              :class="{ selected: item.value === internalValue }"
              :style="{ transform: `translateY(${item.top}px)` }"
              @click="select(item.value)"
            >
              {{ formatted(item.value) }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="picker-split">
        <div class="split-col" ref="wholeListRef" @scroll="onWholeScroll">
          <button
            v-for="num in wholeValues"
            :key="`w-${num}`"
            type="button"
            class="split-item"
            :class="{ selected: num === selectedWhole }"
            @click="selectWhole(num)"
          >
            {{ num }}
          </button>
        </div>
        <div class="split-col" ref="decimalListRef" @scroll="onDecimalScroll">
          <button
            v-for="opt in normalizedDecimalOptions"
            :key="`d-${opt}`"
            type="button"
            class="split-item"
            :class="{ selected: opt === selectedDecimal }"
            @click="selectDecimal(opt)"
          >
            {{ decimalLabel(opt) }}
          </button>
        </div>
      </div>

      <div class="picker-footer">
        <button class="btn" @click="decrementLarge">−</button>
        <div class="picker-current">{{ formatted(internalValue) }}</div>
        <button class="btn" @click="incrementLarge">+</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { logger } from '@/utils/logger'

const props = defineProps({
  visible: { type: Boolean, default: false },
  value: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1000 },
  step: { type: Number, default: 1 },
  splitDecimals: { type: Boolean, default: false },
  decimalOptions: { type: Array, default: () => [0, 0.25, 0.5, 0.75] },
  title: { type: String, default: '' },
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'Abbrechen' },
  visibleRange: { type: Number, default: 50 } // number of steps each side
})

const emit = defineEmits(['update:value', 'confirm', 'cancel'])

const internalValue = ref(props.value)
const wheelRef = ref(null)
const listRef = ref(null)
const wholeListRef = ref(null)
const decimalListRef = ref(null)
const selectedWhole = ref(0)
const selectedDecimal = ref(0)
const SPLIT_ITEM_HEIGHT = 42
const SPLIT_STATE_KEY = 'number_picker_split_state_v1'
let wholeScrollEndTimer = null
let decimalScrollEndTimer = null
const isSyncingSplitScroll = ref(false)

function readPersistedSplitState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SPLIT_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const whole = Number(parsed.whole)
    const decimal = Number(parsed.decimal)
    if (!Number.isFinite(whole) || !Number.isFinite(decimal)) return null
    return { whole, decimal }
  } catch {
    return null
  }
}

function persistSplitState() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SPLIT_STATE_KEY, JSON.stringify({
      whole: selectedWhole.value,
      decimal: selectedDecimal.value
    }))
  } catch {}
}

watch(() => props.value, (v) => {
  internalValue.value = v
  syncSplitFromValue(v)
})

// When the picker becomes visible, measure and initialize scrolling
watch(() => props.visible, async (v) => {
  if (!v) return
  await nextTick()
  if (props.splitDecimals) {
    const persisted = readPersistedSplitState()
    if (persisted) {
      selectedWhole.value = Math.min(wholeMax.value, Math.max(wholeMin.value, persisted.whole))
      const decimals = normalizedDecimalOptions.value
      selectedDecimal.value = decimals.includes(persisted.decimal)
        ? persisted.decimal
        : decimals[0]
      updateValueFromSplit()
    } else {
      syncSplitFromValue(internalValue.value)
    }
  } else {
    syncSplitFromValue(internalValue.value)
  }
  try {
    if (props.splitDecimals) {
      nextTick(() => {
        scrollSplitToSelection(false)
      })
      return
    }
    const list = listRef.value
    containerHeight.value = list ? list.clientHeight : 0
    // On iOS the layout/scrolling may not be ready immediately; retry a few times
    let attempts = 0
    const ensureMeasure = () => {
      attempts += 1
      try {
        const l = listRef.value
        containerHeight.value = l ? l.clientHeight : (window.innerHeight * 0.4)
        const idx = Math.round((internalValue.value - props.min) / props.step)
        const top = Math.max(0, idx * itemHeight - (containerHeight.value / 2) + (itemHeight / 2))
        if (l) l.scrollTop = top
        scrollTop.value = l ? l.scrollTop : 0
        // if measurement looks wrong, retry shortly (useful for iOS simulator)
        if ((containerHeight.value === 0 || (listRef.value && listRef.value.scrollHeight === 0)) && attempts < 6) {
          setTimeout(ensureMeasure, 80)
        }
      } catch (err) {
        if (attempts < 6) setTimeout(ensureMeasure, 80)
      }
    }
    nextTick(() => setTimeout(ensureMeasure, 30))
      } catch (err) {
    logger.warn('picker visible watch error', err)
  }
})

// Virtualization parameters
const itemHeight = 44 // px per item
const buffer = 6 // items before/after viewport
const totalCount = computed(() => Math.floor((props.max - props.min) / props.step) + 1)
const totalHeight = computed(() => totalCount.value * itemHeight)
const containerHeight = ref(0)
const scrollTop = ref(0)

// determine meaningful decimal places for the given step (works for 1.25, 0.125, etc.)
const stepDecimals = computed(() => {
  try {
    const s = String(props.step)
    if (s.indexOf('e') !== -1) {
      // handle exponential notation by using toFixed with a safe number
      const asFixed = Number(props.step).toFixed(6)
      return asFixed.includes('.') ? asFixed.replace(/0+$/, '').split('.')[1].length : 0
    }
    return s.includes('.') ? s.split('.')[1].length : 0
  } catch {
    return 0
  }
})

const visibleItems = computed(() => {
  const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - buffer)
  const visibleCount = Math.ceil(containerHeight.value / itemHeight) + buffer * 2
  const items = []
  const endIndex = Math.min(totalCount.value - 1, startIndex + visibleCount - 1)
  for (let i = startIndex; i <= endIndex; i++) {
    const value = Number((props.min + i * props.step).toFixed(stepDecimals.value))
    items.push({ index: i, value, top: i * itemHeight })
  }
  return items
})

const normalizedDecimalOptions = computed(() => {
  const list = Array.isArray(props.decimalOptions) ? props.decimalOptions : [0]
  const normalized = [...new Set(list
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value < 1)
    .map((value) => Number(value.toFixed(2))))]
  return normalized.length ? normalized : [0]
})

const wholeMin = computed(() => Math.floor(props.min))
const wholeMax = computed(() => Math.floor(props.max))
const wholeValues = computed(() => {
  const start = wholeMin.value
  const end = wholeMax.value
  const length = Math.max(0, end - start + 1)
  return Array.from({ length }, (_, idx) => start + idx)
})

function onScroll() {
  if (!listRef.value) return
  scrollTop.value = listRef.value.scrollTop
}

function formatted(v) {
  // show with sensible decimals for fractional steps but strip trailing zeros
  // e.g. step=1.25 => show 21,25 and 22,5 (not 22,50)
  const maxDecimals = stepDecimals.value
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals })
}

function decimalLabel(v) {
  const scaled = Math.round(Number(v || 0) * 100)
  return String(scaled).padStart(2, '0')
}

function syncSplitFromValue(rawValue) {
  const bounded = Math.min(props.max, Math.max(props.min, Number(rawValue) || 0))
  const whole = Math.floor(bounded)
  const fraction = Number((bounded - whole).toFixed(2))
  const closestFraction = normalizedDecimalOptions.value.reduce((best, option) => {
    return Math.abs(option - fraction) < Math.abs(best - fraction) ? option : best
  }, normalizedDecimalOptions.value[0] || 0)
  selectedWhole.value = Math.min(wholeMax.value, Math.max(wholeMin.value, whole))
  selectedDecimal.value = closestFraction
}

function updateValueFromSplit() {
  const combined = Number((selectedWhole.value + selectedDecimal.value).toFixed(2))
  internalValue.value = Math.min(props.max, Math.max(props.min, combined))
}

function selectWhole(num) {
  selectedWhole.value = Number(num)
  updateValueFromSplit()
  persistSplitState()
  centerListOnIndex(wholeListRef.value, Math.max(0, selectedWhole.value - wholeMin.value), SPLIT_ITEM_HEIGHT, true)
}

function selectDecimal(num) {
  selectedDecimal.value = Number(num)
  updateValueFromSplit()
  persistSplitState()
  const idx = Math.max(0, normalizedDecimalOptions.value.findIndex((v) => v === selectedDecimal.value))
  centerListOnIndex(decimalListRef.value, idx, SPLIT_ITEM_HEIGHT, true)
}

function centerListOnIndex(list, idx, itemPx = 42, smooth = true) {
  if (!list) return
  const target = Math.max(0, idx * itemPx - (list.clientHeight / 2) + (itemPx / 2))
  isSyncingSplitScroll.value = true
  list.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' })
  setTimeout(() => {
    isSyncingSplitScroll.value = false
  }, smooth ? 220 : 0)
}

function scrollSplitToSelection(smooth = false) {
  const wholeIdx = Math.max(0, selectedWhole.value - wholeMin.value)
  const decimalIdx = Math.max(0, normalizedDecimalOptions.value.findIndex((v) => v === selectedDecimal.value))
  centerListOnIndex(wholeListRef.value, wholeIdx, SPLIT_ITEM_HEIGHT, smooth)
  centerListOnIndex(decimalListRef.value, decimalIdx, SPLIT_ITEM_HEIGHT, smooth)
}

function getCenteredIndex(list, itemPx, maxIndex) {
  if (!list) return 0
  const raw = (list.scrollTop + (list.clientHeight / 2) - (itemPx / 2)) / itemPx
  const idx = Math.round(raw)
  return Math.max(0, Math.min(maxIndex, idx))
}

function onWholeScroll() {
  if (isSyncingSplitScroll.value) return
  const list = wholeListRef.value
  if (!list || wholeValues.value.length === 0) return
  const idx = getCenteredIndex(list, SPLIT_ITEM_HEIGHT, wholeValues.value.length - 1)
  const nextWhole = wholeValues.value[idx]
  if (Number.isFinite(nextWhole) && nextWhole !== selectedWhole.value) {
    selectedWhole.value = nextWhole
    updateValueFromSplit()
    persistSplitState()
  }

  if (wholeScrollEndTimer) clearTimeout(wholeScrollEndTimer)
  wholeScrollEndTimer = setTimeout(() => {
    centerListOnIndex(list, idx, SPLIT_ITEM_HEIGHT, true)
  }, 90)
}

function onDecimalScroll() {
  if (isSyncingSplitScroll.value) return
  const list = decimalListRef.value
  if (!list || normalizedDecimalOptions.value.length === 0) return
  const idx = getCenteredIndex(list, SPLIT_ITEM_HEIGHT, normalizedDecimalOptions.value.length - 1)
  const nextDecimal = normalizedDecimalOptions.value[idx]
  if (Number.isFinite(nextDecimal) && nextDecimal !== selectedDecimal.value) {
    selectedDecimal.value = nextDecimal
    updateValueFromSplit()
    persistSplitState()
  }

  if (decimalScrollEndTimer) clearTimeout(decimalScrollEndTimer)
  decimalScrollEndTimer = setTimeout(() => {
    centerListOnIndex(list, idx, SPLIT_ITEM_HEIGHT, true)
  }, 90)
}

function select(v) {
  internalValue.value = v
  // scroll into view
  scrollToSelected()
}

function scrollToSelected(force = false) {
  nextTick(() => {
    try {
      if (isInteracting.value && !force) return
      const list = listRef.value
      if (!list) return
      // compute index of current value
      const idx = Math.round((internalValue.value - props.min) / props.step)
      const top = Math.max(0, idx * itemHeight - (containerHeight.value / 2) + (itemHeight / 2))
      list.scrollTo({ top, behavior: 'smooth' })
    } catch {}
  })
}

function onConfirm() {
  if (props.splitDecimals) persistSplitState()
  emit('update:value', internalValue.value)
  emit('confirm', internalValue.value)
}

function onCancel() {
  emit('cancel')
}

function incrementLarge() {
  if (props.splitDecimals) {
    const next = Math.min(props.max, Math.max(props.min, internalValue.value + 1))
    internalValue.value = Number(next.toFixed(2))
    syncSplitFromValue(internalValue.value)
    scrollSplitToSelection()
    return
  }
  adjustBy(props.visibleRange)
}
function decrementLarge() {
  if (props.splitDecimals) {
    const next = Math.min(props.max, Math.max(props.min, internalValue.value - 1))
    internalValue.value = Number(next.toFixed(2))
    syncSplitFromValue(internalValue.value)
    scrollSplitToSelection()
    return
  }
  adjustBy(-props.visibleRange)
}

function adjustBy(steps) {
  const delta = steps * props.step
  let next = internalValue.value + delta
  next = Math.min(props.max, Math.max(props.min, next))
  internalValue.value = Number(next.toFixed(stepDecimals.value))
  scrollToSelected()
}

// Track user interaction so we don't fight the user's scroll
const isInteracting = ref(false)

function onPointerDown() {
  isInteracting.value = true
}

function onPointerUp() {
  // leave interaction mode shortly after pointer up
  setTimeout(() => { isInteracting.value = false }, 150)
}

// scrollInto view when internal value changes programmatically or on open
watch(() => internalValue.value, () => {
  if (!props.visible) return
  if (props.splitDecimals) return
  // don't interrupt an active user gesture
  if (isInteracting.value) return
  nextTick(() => scrollToSelected(true))
})

onMounted(() => {
  nextTick(() => {
    // measure container height and position to selected
    try {
      const list = listRef.value
      containerHeight.value = list ? list.clientHeight : 0
    } catch {}
    nextTick(scrollToSelected)
  })

  // keep containerHeight updated on resize
  try {
    if (typeof window !== 'undefined' && window.addEventListener) {
      const handler = () => {
        try { containerHeight.value = listRef.value ? listRef.value.clientHeight : 0 } catch {}
      }
      window.addEventListener('resize', handler)

      // attach pointer/touch listeners to detect user interaction
      const attachInteraction = () => {
        try {
          const l = listRef.value
          if (!l) return
          l.addEventListener('pointerdown', onPointerDown)
          l.addEventListener('pointerup', onPointerUp)
          l.addEventListener('pointercancel', onPointerUp)
          l.addEventListener('touchstart', onPointerDown, { passive: true })
          l.addEventListener('touchend', onPointerUp)
          l.addEventListener('touchcancel', onPointerUp)
        } catch (err) { /* ignore */ }
      }
      attachInteraction()

      // cleanup on unmount
      onUnmounted(() => {
        if (wholeScrollEndTimer) clearTimeout(wholeScrollEndTimer)
        if (decimalScrollEndTimer) clearTimeout(decimalScrollEndTimer)
        try { window.removeEventListener('resize', handler) } catch {}
        try {
          const l = listRef.value
          if (l) {
            l.removeEventListener('pointerdown', onPointerDown)
            l.removeEventListener('pointerup', onPointerUp)
            l.removeEventListener('pointercancel', onPointerUp)
            l.removeEventListener('touchstart', onPointerDown)
            l.removeEventListener('touchend', onPointerUp)
            l.removeEventListener('touchcancel', onPointerUp)
          }
        } catch (err) { /* ignore */ }
      })
    }
  } catch {}
})
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2000;
}
.picker-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--bg);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  padding: 8px 12px 16px;
  box-shadow: 0 -10px 30px rgba(0,0,0,0.2);
}
.picker-header { display:flex; align-items:center; justify-content:space-between; padding:8px 4px }
.picker-header .title { font-weight:700 }
.btn { background: transparent; border: none; padding: 8px 12px; font-size: 16px }
.btn.primary { color: var(--accent) }

.picker-wheel { height: 40vh; overflow: hidden; margin: 6px 0 }
.wheel-virtual { position: relative; height:100%; overflow-y: auto; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.wheel-spacer { width:100%; }
.wheel-items { position: absolute; left:0; right:0; top:0; }
.wheel-item { position: absolute; left: 0; right: 0; padding: 8px 0; text-align:center; font-size: 20px; color: var(--muted); }
.wheel-item.selected { color: var(--fg); font-weight:700; font-size:22px }

.picker-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  height: 40vh;
  margin: 6px 0;
}

.split-col {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--surface);
  padding: 6px;
}

.split-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1;
  border-radius: 8px;
  padding: 12px 6px;
  text-align: center;
}

.split-item.selected {
  color: var(--fg);
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.picker-footer { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:8px }
.picker-current { font-size: 20px; font-weight:700 }
</style>
