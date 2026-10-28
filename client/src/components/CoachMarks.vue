<template>
  <Teleport to="body">
    <div v-if="current" class="coach-overlay" role="presentation">
      <!-- Hervorgehobene Stelle: der Rest der Seite wird per Schatten abgedunkelt. -->
      <div class="coach-spot" :style="spotStyle" aria-hidden="true"></div>
      <div ref="bubbleRef" class="coach-bubble" :class="placement" :style="bubbleStyle" role="dialog" aria-modal="true" :aria-label="current.title">
        <strong class="coach-title">{{ current.title }}</strong>
        <p class="coach-text">{{ current.text }}</p>
        <div class="coach-foot">
          <span class="coach-count">{{ counterLabel }}</span>
          <button ref="okBtn" type="button" class="coach-ok" @click="next">{{ isLast ? t('coach.done') : t('coach.ok') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCoachMarkStore } from '@/stores/coachMarkStore'
import { useScrollLock } from '@/composables/useScrollLock'

// Sprechblasen (Absprache Paul 29.10.): zeigt nacheinander die Hinweise einer Seite, jeweils auf das Element gerichtet.
// Pro Mark: { id, selector, title, text }. Eine Blase erscheint nur, wenn `active` gilt (kein Fenster offen), Hinweise
// eingeschaltet und noch nicht „Verstanden“ sind und das Element sichtbar ist. Die Seite entscheidet über `active`.
const props = defineProps({
  marks: { type: Array, default: () => [] },
  active: { type: Boolean, default: true }
})

const { t } = useI18n()
const store = useCoachMarkStore()
const { lock, unlock } = useScrollLock()

const current = ref(null)
const rect = ref(null)
const placement = ref('below')
const bubbleRef = ref(null)
const okBtn = ref(null)
const bubbleBox = ref({ left: 16, top: 0, width: 320, arrowX: 40 })
let locked = false
let timer = null
let attempts = 0

const MARGIN = 16
const GAP = 12

function targetOf(mark) {
  try {
    const el = document.querySelector(mark.selector)
    if (!el) return null
    const box = el.getBoundingClientRect()
    return box.width > 0 && box.height > 0 ? el : null
  } catch {
    return null
  }
}

const present = computed(() => props.marks.filter((mark) => targetOf(mark)))
const counterLabel = computed(() => {
  const list = props.marks.filter((mark) => targetOf(mark))
  const index = list.findIndex((mark) => mark.id === current.value?.id)
  return t('coach.step', { n: index + 1, total: list.length })
})
const isLast = computed(() => {
  const list = props.marks.filter((mark) => targetOf(mark))
  return list.length > 0 && list[list.length - 1].id === current.value?.id
})

const spotStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` }
})

const bubbleStyle = computed(() => ({
  left: `${bubbleBox.value.left}px`,
  top: `${bubbleBox.value.top}px`,
  width: `${bubbleBox.value.width}px`,
  '--arrow-x': `${bubbleBox.value.arrowX}px`
}))

function layout() {
  const r = rect.value
  if (!r) return
  const width = Math.min(window.innerWidth - MARGIN * 2, 420)
  const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, MARGIN), window.innerWidth - MARGIN - width)
  const height = bubbleRef.value?.offsetHeight || 150
  const fitsBelow = r.bottom + 4 + GAP + height <= window.innerHeight - MARGIN
  placement.value = fitsBelow ? 'below' : 'above'
  const top = fitsBelow ? r.bottom + 4 + GAP : Math.max(MARGIN, r.top - 4 - GAP - height)
  const arrowX = Math.min(Math.max(r.left + r.width / 2 - left, 22), width - 22)
  bubbleBox.value = { left, top, width, arrowX }
}

function measure() {
  if (!current.value) return
  const el = targetOf(current.value)
  if (!el) { current.value = null; return }
  const box = el.getBoundingClientRect()
  rect.value = { left: box.left, top: box.top, width: box.width, height: box.height, bottom: box.bottom }
  layout()
}

function pick() {
  clearTimeout(timer)
  if (!props.active || !store.enabled) { current.value = null; return }
  const next = props.marks.find((mark) => !store.isDismissed(mark.id) && targetOf(mark))
  if (!next) {
    current.value = null
    // Elemente erscheinen teils erst nach dem Laden: ein paar Mal nachsehen.
    if (props.marks.some((mark) => !store.isDismissed(mark.id)) && attempts < 8) {
      attempts += 1
      timer = setTimeout(pick, 400)
    }
    return
  }
  attempts = 0
  const el = targetOf(next)
  // Liegt das Element außerhalb des sichtbaren Bereichs, erst dorthin scrollen.
  try { el.scrollIntoView({ block: 'center', behavior: 'auto' }) } catch {}
  current.value = next
  measure()
  nextTick(() => { measure(); okBtn.value?.focus?.() })
}

function next() {
  if (current.value) store.dismiss(current.value.id)
  current.value = null
  nextTick(pick)
}

watch(current, (value) => {
  if (value && !locked) { lock(); locked = true }
  if (!value && locked) { unlock(); locked = false }
})
watch(() => [props.active, props.marks, store.enabled], () => { attempts = 0; clearTimeout(timer); timer = setTimeout(pick, 250) }, { deep: true })

function onResize() { measure() }

onMounted(() => {
  timer = setTimeout(pick, 500)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  window.removeEventListener('resize', onResize)
  if (locked) { unlock(); locked = false }
})

defineExpose({ present })
</script>

<style scoped>
.coach-overlay { position: fixed; inset: 0; z-index: 1500; }
.coach-spot {
  position: fixed;
  border-radius: 16px;
  outline: 2px solid var(--accent);
  box-shadow: 0 0 0 100vmax rgba(5, 6, 8, 0.62), 0 0 0 6px color-mix(in srgb, var(--accent) 18%, transparent);
  pointer-events: none;
}
.coach-bubble {
  position: fixed;
  box-sizing: border-box;
  padding: 13px 14px 12px;
  border-radius: 16px;
  background: #f4f6fb;
  color: #101114;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
}
.coach-bubble::before {
  content: '';
  position: absolute;
  left: var(--arrow-x);
  width: 16px;
  height: 16px;
  margin-left: -8px;
  background: #f4f6fb;
  transform: rotate(45deg);
  border-radius: 3px;
}
.coach-bubble.below::before { top: -6px; }
.coach-bubble.above::before { bottom: -6px; }
.coach-title { display: block; font-size: 0.95rem; margin-bottom: 3px; }
.coach-text { margin: 0; font-size: 0.85rem; line-height: 1.45; color: #2a2c33; }
.coach-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
.coach-count { font-size: 0.72rem; color: #6a6f7c; }
.coach-ok { min-height: 40px; padding: 0 18px; border: none; border-radius: 999px; background: #101114; color: var(--accent); font: inherit; font-weight: 800; font-size: 0.82rem; cursor: pointer; }
</style>
