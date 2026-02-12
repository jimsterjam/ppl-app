<template>
  <div class="splash" role="status" aria-live="polite" @click="skip" @keydown.enter.prevent="skip" tabindex="0">
    <div class="word-layer" aria-hidden="true">
      <div class="word-stack">
        <div
          v-for="item in items"
          :key="item.id"
          class="word-item"
          :style="item.vars"
        >
          <div class="pill" :class="item.pillClass">{{ item.text }}</div>
        </div>
      </div>
    </div>

    <div class="hint" aria-hidden="true">Tippen zum Überspringen</div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  // Keep prop for compatibility with previous usage; not used for sequencing.
  durationMs: { type: Number, default: 550 }
})

const emit = defineEmits(['done'])

let timer = null
const timeouts = []

const WORDS = ['PUSH', 'PULL', 'LEGS']
const ENTER_DIRS = ['left', 'up', 'right']
const ENTER_MS = 900
const STAGGER_MS = 90
const GROUP_HOLD_MS = 1500
const GROUP_FADE_MS = 900

const items = ref([])
let nextId = 1

function pickDir() {
  const dirs = ['left', 'right', 'up', 'down']
  return dirs[Math.floor(Math.random() * dirs.length)]
}

function dirToXY(dir) {
  if (dir === 'left') return ['-110vw', '0vh']
  if (dir === 'right') return ['110vw', '0vh']
  if (dir === 'up') return ['0vw', '-110vh']
  return ['0vw', '110vh']
}

function pillClassFor(word) {
  if (word === 'PULL') return 'pill-pull'
  if (word === 'LEGS') return 'pill-legs'
  return 'pill-push'
}

function prefersReducedMotion() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function finish() {
  if (timer) clearTimeout(timer)
  timer = null
  while (timeouts.length) clearTimeout(timeouts.pop())
  items.value = []
  emit('done')
}

function skip() {
  finish()
}

function addWord(word, i, startDelayMs) {
  const reduced = prefersReducedMotion()
  const enterMs = reduced ? 0 : ENTER_MS
  const fadeMs = reduced ? 0 : GROUP_FADE_MS

  const inDir = ENTER_DIRS[i] || pickDir()
  const [inX, inY] = dirToXY(inDir)

  const id = nextId++

  // fade starts after the LAST word has finished entering + group hold
  const fadeDelayMs = (STAGGER_MS * (WORDS.length - 1)) + enterMs + (reduced ? 0 : GROUP_HOLD_MS)
  const totalMs = fadeDelayMs + fadeMs

  const vars = {
    '--in-x': inX,
    '--in-y': inY,
    '--enter-ms': `${enterMs}ms`,
    '--fade-ms': `${fadeMs}ms`,
    '--start-delay': `${startDelayMs}ms`,
    '--fade-delay': `${fadeDelayMs}ms`
  }

  // create slightly after delay to make CSS delays deterministic
  const tCreate = window.setTimeout(() => {
    items.value = [...items.value, { id, text: word, pillClass: pillClassFor(word), vars }]
  }, startDelayMs)
  timeouts.push(tCreate)

  const tRemove = window.setTimeout(() => {
    items.value = items.value.filter((x) => x.id !== id)
  }, startDelayMs + totalMs + 80)
  timeouts.push(tRemove)

  // Only finish once, after the last word completed the group fade.
  if (i === WORDS.length - 1) {
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(() => {
      finish()
    }, totalMs + 120)
  }
}

onMounted(() => {
  const reduced = prefersReducedMotion()
  if (reduced) {
    // No animation in reduced motion: show nothing and finish quickly.
    timer = window.setTimeout(() => finish(), 0)
    return
  }
  WORDS.forEach((w, i) => {
    addWord(w, i, i * STAGGER_MS)
  })
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  while (timeouts.length) clearTimeout(timeouts.pop())
})
</script>

<style scoped>
.splash {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  padding-top: calc(24px + var(--safe-top));
  padding-bottom: calc(24px + var(--safe-bottom));
  outline: none;
  position: relative;
}

.word-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.word-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.word-item {
  position: relative;
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  animation:
    wordIn var(--enter-ms, 900ms) cubic-bezier(0.16, 1, 0.3, 1) both,
    groupFade var(--fade-ms, 900ms) ease both;
  animation-delay: var(--start-delay, 0ms), var(--fade-delay, 2400ms);
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 22px;
  border-radius: 999px;
  font-weight: 800;
  letter-spacing: 0.08em;
  font-size: 1.15rem;
  color: var(--accent-contrast);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  box-shadow: var(--shadow-hard);
  border: 1px solid color-mix(in srgb, var(--line-soft) 75%, transparent);
}

.pill-pull {
  background: linear-gradient(180deg, color-mix(in srgb, var(--powder) 90%, #fff), var(--powder));
  color: #08131a;
}

.pill-legs {
  background: linear-gradient(180deg, color-mix(in srgb, var(--orange) 95%, #fff), var(--orange));
  color: #1a0c05;
}

.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(14px + var(--safe-bottom));
  text-align: center;
  font-size: 0.9rem;
  font-weight: 650;
  color: color-mix(in srgb, var(--muted) 80%, transparent);
}

@keyframes wordIn {
  0% {
    opacity: 0;
    transform: translate3d(var(--in-x, 0vw), var(--in-y, 0vh), 0) scale(0.985);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes groupFade {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .word-item {
    animation: none !important;
    opacity: 0;
  }
}
</style>
