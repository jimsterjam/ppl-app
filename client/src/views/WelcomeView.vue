<template>
  <WelcomePage :handle-change-display="handleNavigation" />
</template>

<script setup>
import { useRouter } from 'vue-router'
import WelcomePage from '../components/WelcomePage.vue'

const router = useRouter()

function handleNavigation(displayType) {
  // displayType 2 = Dashboard basierend auf Ihrer Komponente
  if (displayType === 2) {
    router.push('/dashboard')
  }
}

// Keine automatische Weiterleitung hier – WelcomePage steuert Motivation & Redirect
</script>

<style scoped>
/* Kein zusätzliches Styling nötig - WelcomePage übernimmt das komplette Layout */
</style>