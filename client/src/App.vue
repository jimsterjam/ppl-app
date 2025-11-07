<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
import OfflineIndicator from './components/OfflineIndicator.vue'
import { setupAutoSync } from './utils/syncManager'
import { logger } from './utils/logger'

// Setup Offline Support
onMounted(() => {
  setupAutoSync()
  logger.debug('✅ App - Offline Support aktiviert')
})
</script>

<template>
  <div id="app">
    <RouterView />
    <ToastHost />
    <OfflineIndicator />
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
