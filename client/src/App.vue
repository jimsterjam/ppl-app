<script setup>
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
import TimerPortal from './components/timer/TimerPortal.vue'
import OnboardingFlow from './components/OnboardingFlow.vue'
import { initializeDefaultExercises } from './utils/offlineStorage'
import { logger } from './utils/logger'
import { useAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useFirebaseAuth } from '@/utils/firebaseAuth'

// Setup Offline Support
onMounted(async () => {
  // Lade Standard-Übungen beim ersten Start
  await initializeDefaultExercises()

  // Auto-Sync wird zentral in main.js initialisiert.
  logger.debug('✅ App - Offline Support aktiviert')
})

// Onboarding-Flow (5-seitige Einführung nach erstem Login, siehe onboardingStore.js) - hier statt
// in main.js platziert, weil App.vue der einzige Ort ist, der garantiert nach app.mount()
// existiert und ein Overlay unabhängig von der aktuellen Route rendern kann.
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()

// Erst anzeigen, wenn: eingeloggt (authStore.isAuthenticated berücksichtigt bereits
// E-Mail-Verifizierung, siehe main.js), der Server-Abgleich abgeschlossen ist (statusReady,
// verhindert Aufblitzen) und der Flow tatsächlich noch nicht erledigt ist.
const showOnboarding = computed(() => {
  return authStore.isAuthenticated && onboardingStore.statusReady && !onboardingStore.completed
})

async function getIdTokenSafe() {
  try {
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken().catch(() => null)
  } catch (e) {
    logger.warn('[App] getIdTokenSafe failed:', e?.message || e)
    return null
  }
}

async function handleOnboardingComplete() {
  const token = await getIdTokenSafe()
  await onboardingStore.completeFlow(token)
}

async function handleOnboardingSkip() {
  const token = await getIdTokenSafe()
  await onboardingStore.skipFlow(token)
}
</script>

<template>
  <div id="app">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in" appear>
        <div :key="route.meta.layout || route.matched[0]?.name || route.path" class="route-view">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
    <BottomNav />
    <TimerPortal />
    <ToastHost />
    <OnboardingFlow
      v-if="showOnboarding"
      @complete="handleOnboardingComplete"
      @skip="handleOnboardingSkip"
    />
  </div>
</template>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.route-view {
  min-height: 100vh;
  min-height: 100dvh;
}
</style>
