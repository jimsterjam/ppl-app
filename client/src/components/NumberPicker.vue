<template>
  <div v-if="visible" class="picker-overlay" @click.self="onCancel">
    <div class="picker-sheet" role="dialog" aria-modal="true">
      <header class="picker-header">
        <button class="btn text" @click="onCancel">{{ cancelText }}</button>
        <strong class="title">{{ title }}</strong>
        <button class="btn primary" @click="onConfirm">{{ confirmText }}</button>
      </header>

      <div class="picker-wheel" ref="wheelRef">
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
  title: { type: String, default: '' },
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'Abbrechen' },
  visibleRange: { type: Number, default: 50 } // number of steps each side
})

const emit = defineEmits(['update:value', 'confirm', 'cancel'])

const internalValue = ref(props.value)
const wheelRef = ref(null)
const listRef = ref(null)

watch(() => props.value, (v) => { internalValue.value = v })

// When the picker becomes visible, measure and initialize scrolling
watch(() => props.visible, async (v) => {
  if (!v) return
  await nextTick()
  try {
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
  emit('update:value', internalValue.value)
  emit('confirm', internalValue.value)
}

function onCancel() {
  emit('cancel')
}

function incrementLarge() {
  adjustBy(props.visibleRange)
}
function decrementLarge() {
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

.picker-footer { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:8px }
.picker-current { font-size: 20px; font-weight:700 }
</style>
