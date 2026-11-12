<template>
  <!-- Zwei Drehräder für Stunde und Minute (Trainings-Erinnerung, Absprache Jimmy 11.11.): wischen oder antippen,
       Pfeiltasten auf dem fokussierten Rad. Ohne Abhängigkeit; Einrasten über CSS scroll-snap. -->
  <div class="wheels">
    <div class="wheel-band" aria-hidden="true"></div>
    <div
      v-for="col in columns"
      :key="col.key"
      :ref="(el) => (wheelEls[col.key] = el)"
      :class="['wheel', `wheel--${col.key}`]"
      role="listbox"
      tabindex="0"
      :aria-label="col.label"
      :aria-activedescendant="`wheel-${col.key}-${col.value}`"
      @scroll.passive="onScroll(col.key)"
      @keydown="onKey($event, col)"
    >
      <div class="wheel-pad" aria-hidden="true"></div>
      <button
        v-for="option in col.options"
        :id="`wheel-${col.key}-${option}`"
        :key="option"
        type="button"
        tabindex="-1"
        role="option"
        class="wheel-item"
        :class="{ 'is-on': option === col.value }"
        :aria-selected="option === col.value ? 'true' : 'false'"
        @click="select(col.key, option, true)"
      >{{ pad(option) }}</button>
      <div class="wheel-pad" aria-hidden="true"></div>
    </div>
    <span class="wheel-colon" aria-hidden="true">:</span>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive } from 'vue'
import { parseWheelTime } from '@/utils/trainingNudge'

const props = defineProps({
  /** 'HH:MM' */
  modelValue: { type: String, required: true },
  minuteStep: { type: Number, default: 5 },
  hourLabel: { type: String, required: true },
  minuteLabel: { type: String, required: true }
})
const emit = defineEmits(['update:modelValue'])

// Höhe eines Eintrags: aus dem DOM gemessen (Fund iPhone 11.11.: die globale Knopf-Mindesthöhe machte 48 statt 40 px
// daraus, das Rad zeigte eine andere Stunde als es übernahm). ITEM_PX ist nur der Rückfall ohne Layout.
const ITEM_PX = 40
function itemPx(el) {
  const h = el?.querySelector('.wheel-item')?.offsetHeight
  return h > 0 ? h : ITEM_PX
}
const pad = (n) => String(n).padStart(2, '0')
const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = computed(() => Array.from({ length: Math.floor(60 / props.minuteStep) }, (_, i) => i * props.minuteStep))

const parsed = computed(() => parseWheelTime(props.modelValue, props.minuteStep))

const columns = computed(() => [
  { key: 'hour', label: props.hourLabel, options: hours, value: parsed.value.hour },
  { key: 'minute', label: props.minuteLabel, options: minutes.value, value: parsed.value.minute }
])

const wheelEls = reactive({})
const scrollTimers = {}

function emitValue(hour, minute) {
  emit('update:modelValue', `${pad(hour)}:${pad(minute)}`)
}

function scrollToValue(key, value, smooth = false) {
  const el = wheelEls[key]
  const col = columns.value.find((c) => c.key === key)
  if (!el || !col) return
  const index = Math.max(0, col.options.indexOf(value))
  el.scrollTo({ top: index * itemPx(el), behavior: smooth ? 'smooth' : 'auto' })
}

function select(key, value, scroll = false) {
  const { hour, minute } = parsed.value
  if (key === 'hour') emitValue(value, minute)
  else emitValue(hour, value)
  if (scroll) scrollToValue(key, value, true)
}

/** Wert unter dem Band aus der Scroll-Position übernehmen. */
function settle(key) {
  clearTimeout(scrollTimers[key])
  const el = wheelEls[key]
  const col = columns.value.find((c) => c.key === key)
  if (!el || !col) return
  const index = Math.min(col.options.length - 1, Math.max(0, Math.round(el.scrollTop / itemPx(el))))
  const value = col.options[index]
  if (value !== col.value) select(key, value)
}

function onScroll(key) {
  clearTimeout(scrollTimers[key])
  scrollTimers[key] = setTimeout(() => settle(key), 90)
}

/** Wert unter dem Band eines Rads (aus der Scroll-Position), ohne zu senden. */
function valueAt(key, fallback) {
  clearTimeout(scrollTimers[key])
  const el = wheelEls[key]
  const col = columns.value.find((c) => c.key === key)
  if (!el || !col) return fallback
  const index = Math.min(col.options.length - 1, Math.max(0, Math.round(el.scrollTop / itemPx(el))))
  return col.options[index]
}

/**
 * Vor dem Übernehmen aufrufen: liest beide Räder auf einmal (ein Wischen kurz vor dem Tipp ist sonst noch nicht
 * übernommen) und sendet eine Uhrzeit. Gibt sie auch zurück, damit der Aufrufer nicht auf v-model warten muss.
 * @returns {string} 'HH:MM'
 */
function commit() {
  const { hour, minute } = parsed.value
  const time = `${pad(valueAt('hour', hour))}:${pad(valueAt('minute', minute))}`
  emit('update:modelValue', time)
  return time
}
defineExpose({ commit })

function onKey(event, col) {
  const index = col.options.indexOf(col.value)
  let next = null
  if (event.key === 'ArrowUp') next = col.options[(index - 1 + col.options.length) % col.options.length]
  if (event.key === 'ArrowDown') next = col.options[(index + 1) % col.options.length]
  if (next === null) return
  event.preventDefault()
  select(col.key, next, true)
}

onMounted(async () => {
  await nextTick()
  scrollToValue('hour', parsed.value.hour)
  scrollToValue('minute', parsed.value.minute)
})
</script>

<style scoped>
.wheels {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 4px;
  height: 200px;
}
.wheel {
  height: 200px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  overscroll-behavior: contain;
  position: relative;
  z-index: 1;
  border-radius: 12px;
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent);
}
.wheel::-webkit-scrollbar { display: none; }
.wheel--hour { grid-column: 1; grid-row: 1; }
.wheel--minute { grid-column: 3; grid-row: 1; }
.wheel:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.wheel-pad { height: 80px; }
.wheel-item {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  min-height: 0; /* globale Knopf-Mindesthöhe (48 px) hier aus: Band, Polster und Rechnung gehen von 40 px aus */
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
  scroll-snap-align: center;
  cursor: pointer;
}
.wheel-item.is-on { color: var(--fg); font-size: 1.45rem; font-weight: 800; }
.wheel-colon { grid-column: 2; grid-row: 1; font-size: 1.4rem; font-weight: 800; position: relative; z-index: 1; }
.wheel-band {
  position: absolute;
  left: 0;
  right: 0;
  top: 80px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 8%, transparent);
  pointer-events: none;
}
</style>
