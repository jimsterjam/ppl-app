<template>
  <div class="welcome-root">
    <div class="welcome-under" :class="{ ready: welcomeVisible }">
      <WelcomePage :handle-change-display="handleNavigation" />
    </div>

    <div v-if="showSplash" class="welcome-overlay">
      <WorkoutSplash @reveal="onReveal" @done="onSplashDone" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import WelcomePage from '../components/WelcomePage.vue'
import WorkoutSplash from '../components/WorkoutSplash.vue'

const router = useRouter()
const showSplash = ref(true)
const welcomeVisible = ref(false)

function onReveal() {
  // intentionally ignored: welcome should appear after splash fade-out is complete
}

function onSplashDone() {
  showSplash.value = false
  welcomeVisible.value = true
}

function handleNavigation(displayType) {
  // displayType 2 = Dashboard basierend auf Ihrer Komponente
  if (displayType === 2) {
    router.push('/dashboard')
  }
}

// Keine automatische Weiterleitung hier – WelcomePage steuert Motivation & Redirect
</script>

<style scoped>
.welcome-root {
  position: relative;
  min-height: 100vh;
}

.welcome-under {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translate3d(0, 12px, 0);
  transition: opacity 1700ms ease, transform 1700ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform-origin: 50% 50%;
}

.welcome-under.ready {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.welcome-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
}
</style>