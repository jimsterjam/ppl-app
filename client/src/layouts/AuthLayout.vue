<template>
  <div>
    <!-- Splash/Loader bis Firebase bereit ist -->
    <div v-if="!firebaseReady" class="auth-splash">
      <div class="spinner spin-indicator" />
      <p>Initialisiere...</p>
    </div>

    <!-- Eingeloggt: Kindrouten rendern -->
    <router-view v-else-if="signedIn" />

    <!-- Ausgeloggt: Einmalig zu Welcome umleiten -->
    <div v-else class="auth-splash">
      <div class="spinner spin-indicator" />
      <p>Weiterleitung...</p>
    </div>

    <!-- BottomNav nur anzeigen, wenn eingeloggt -->
    <BottomNav v-if="signedIn" />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import BottomNav from '../components/BottomNav.vue'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const firebaseReady = computed(() => authStore.initialized)
const signedIn = computed(() => authStore.isAuthenticated)

watch(
  () => ({ ready: firebaseReady.value, authed: signedIn.value }),
  ({ ready, authed }) => {
    if (!ready || authed || route.name === 'welcome') return
    const target = route.fullPath
    router.replace({ name: 'welcome', query: target && target !== '/' ? { redirect: target } : {} })
  },
  { immediate: true }
)
</script>

<style scoped>
.auth-splash { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); }
</style>
