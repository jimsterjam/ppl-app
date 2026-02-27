<template>
  <div class="splash" @click="skip" @keydown.enter.prevent="skip" tabindex="0">
    <div class="overlay">
      <div
        v-if="currentWord"
        :key="currentWord"
        class="overlay-word"
      >
        {{ currentWord }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['done'])

const sequence = ['PUSH', 'PULL', 'LEGS', 'WORKOUT']
const currentWord = ref(null)
let index = 0
let timer = null
let finished = false

// 🔊 Startsound (laut & lang)
const startSound = new Audio('/sounds/start-long.mp3')

function playStartSound() {
  startSound.currentTime = 0
  startSound.play().catch(() => {})
}

function nextStep() {
  if (index >= sequence.length) {
    finish()
    return
  }

  currentWord.value = sequence[index]
  index++

  timer = setTimeout(nextStep, 650)
}

function startSequence() {
  playStartSound()

  setTimeout(() => {
    nextStep()
  }, 900) // Startton Dauer berücksichtigen
}

function finish() {
  if (finished) return
  finished = true
  currentWord.value = null
  emit('done')
}

function skip() {
  finish()
}

onMounted(() => {
  startSequence()
})

onBeforeUnmount(() => {
  clearTimeout(timer)
})
</script>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  background: rgba(5, 7, 10, 0.65);
  display: flex;
  justify-content: center;
  align-items: center;
  padding:
    calc(20px + env(safe-area-inset-top))
    20px
    calc(20px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.overlay-word {
  font-size: clamp(42px, 12vw, 14vh);
  font-weight: 900;
  letter-spacing: 0.05em;
  text-align: center;
  max-width: 90vw;
  line-height: 1.1;
  color: #d7ff3f;

  transform: translateZ(0);
  will-change: transform, opacity;

  animation: wordIn 0.45s ease-out both;
}

/* GPU-optimierte Animation */
@keyframes wordIn {
  0% {
    opacity: 0;
    transform: scale(0.9) translateZ(0);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateZ(0);
  }
}
</style>
