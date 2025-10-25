<template>
  <div class="stats-view">
    <HeaderBar title="Statistiken" />
    
    <div class="stats-content">
      <h2>Deine Fortschritte</h2>
      <p>Statistiken werden hier angezeigt...</p>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import HeaderBar from '../components/HeaderBar.vue'
import BottomNav from '../components/BottomNav.vue'
</script>

<style scoped>
.stats-view {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.stats-content {
  padding: 20px;
  padding-bottom: 80px; /* Platz für BottomNav */
}
</style>
