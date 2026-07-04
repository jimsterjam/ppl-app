<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
import TimerPortal from './components/timer/TimerPortal.vue'
import { initializeDefaultExercises } from './utils/offlineStorage'
import { logger } from './utils/logger'

// Setup Offline Support
onMounted(async () => {
  // Lade Standard-Übungen beim ersten Start
  await initializeDefaultExercises()

  // Auto-Sync wird zentral in main.js initialisiert.
  logger.debug('✅ App - Offline Support aktiviert')
})
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
    <TimerPortal />
    <ToastHost />
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
