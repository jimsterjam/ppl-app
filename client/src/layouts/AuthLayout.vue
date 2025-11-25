<template>
  <div>
    <!-- Splash/Loader bis Firebase bereit ist -->
    <div v-if="!firebaseReady" class="auth-splash">
      <div class="spinner" />
      <p>Initialisiere...</p>
    </div>

    <!-- Eingeloggt: Kindrouten rendern -->
    <router-view v-else-if="signedIn" />

    <!-- Ausgeloggt: Einmalig zu Welcome umleiten -->
    <div v-else class="auth-splash">
      <div class="spinner" />
      <p>Weiterleitung...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFirebaseAuth } from '../utils/firebaseAuth'

const router = useRouter()
const route = useRoute()
const { onAuthStateChanged, getCurrentUser } = useFirebaseAuth()

const firebaseReady = ref(false)
const signedIn = ref(false)

onMounted(() => {
  // Firebase Auth State beobachten
  onAuthStateChanged((user) => {
    signedIn.value = !!user
    if (!firebaseReady.value) firebaseReady.value = true
    // Weiterleitung, falls nicht eingeloggt
    if (firebaseReady.value && !signedIn.value) {
      const target = route.fullPath
      router.replace({ name: 'welcome', query: target && target !== '/' ? { redirect: target } : {} })
    }
  })
})
</script>

<style scoped>
.auth-splash { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); }
</style>
