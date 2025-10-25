<script setup>
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <div id="app">
    <RouterView />
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
</style>
