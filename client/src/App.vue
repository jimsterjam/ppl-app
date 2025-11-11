<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
import OfflineIndicator from './components/OfflineIndicator.vue'
import BottomNav from './components/BottomNav.vue'
import { setupAutoSync } from './utils/syncManager'
import { initializeDefaultExercises } from './utils/offlineStorage'
import { logger } from './utils/logger'

// Setup Offline Support
onMounted(async () => {
  // Lade Standard-Übungen beim ersten Start
  await initializeDefaultExercises()
  
  // Setup Auto-Sync
  await setupAutoSync()
  logger.debug('✅ App - Offline Support aktiviert (inkl. Initial Sync)')
})
</script>

<template>
  <div id="app">
    <RouterView />
    <ToastHost />
    <OfflineIndicator />
    <BottomNav />
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
</style>
