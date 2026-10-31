<template>
  <!-- Startanimation (Absprache Paul 31.10.): "fbe" startet riesig, fett und unscharf (Ego), wird kleiner und scharf (Form). -->
  <div v-if="visible" class="start-anim" :class="{ 'start-anim--out': leaving }" aria-hidden="true">
    <span class="start-anim__mark" data-i18n-ignore>fbe</span>
    <span class="start-anim__slogan">{{ t('brand.slogan') }}</span>
  </div>
</template>

<script>
// Pro App-Start nur einmal (Rückkehr aus dem Hintergrund lädt die Seite nicht neu).
let shown = false
</script>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const HOLD_MS = 1500
const FADE_MS = 300

const { t } = useI18n()

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const visible = ref(!shown && !prefersReducedMotion())
const leaving = ref(false)
let leaveTimer = null
let hideTimer = null

onMounted(() => {
  shown = true
  if (!visible.value) return
  leaveTimer = setTimeout(() => { leaving.value = true }, HOLD_MS)
  hideTimer = setTimeout(() => { visible.value = false }, HOLD_MS + FADE_MS)
})

onBeforeUnmount(() => {
  clearTimeout(leaveTimer)
  clearTimeout(hideTimer)
})
</script>

<style scoped>
.start-anim {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  overflow: hidden;
  background: var(--bg);
  color: var(--fg);
  pointer-events: none;
  transition: opacity 300ms ease;
}
.start-anim--out { opacity: 0; }

.start-anim__mark {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 4.2rem;
  line-height: 1;
  /* Zusätzliche Kontur macht die Buchstaben zu Beginn "richtig fett"; sie schrumpft auf 0. */
  -webkit-text-stroke: 0.14em currentColor;
  animation: start-anim-ego 1.2s cubic-bezier(0.16, 0.84, 0.24, 1) both;
}
@keyframes start-anim-ego {
  0% { transform: scale(12); filter: blur(26px); opacity: 0; -webkit-text-stroke-width: 0.14em; }
  25% { opacity: 1; }
  80% { transform: scale(1); filter: blur(0); -webkit-text-stroke-width: 0; }
  100% { transform: scale(1); filter: blur(0); opacity: 1; -webkit-text-stroke-width: 0; }
}

.start-anim__slogan {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  animation: start-anim-slogan 0.5s ease-out 0.9s both;
}
@keyframes start-anim-slogan {
  from { opacity: 0; letter-spacing: 0.7em; }
  to { opacity: 1; letter-spacing: 0.22em; }
}
</style>
