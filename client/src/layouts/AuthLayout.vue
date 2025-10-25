<template>
  <div>
    <!-- Splash/Loader bis Clerk bereit ist -->
    <div v-if="!clerkReady" class="auth-splash">
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
import { useUser } from '@clerk/vue'

const router = useRouter()
const route = useRoute()
const { isSignedIn } = useUser()

const clerkReady = ref(false)

function markClerkReady() {
  if (!clerkReady.value) clerkReady.value = true
}

onMounted(() => {
  // Sofort, wenn bereits geladen
  if (window?.Clerk?.loaded) {
    markClerkReady()
  } else {
    // Auf Event warten
    const handler = () => {
      window.removeEventListener('clerk:loaded', handler)
      markClerkReady()
    }
    window.addEventListener('clerk:loaded', handler)
    // Fallback Timeout
    setTimeout(() => {
      if (!clerkReady.value) markClerkReady()
    }, 1500)
  }
})

// Nutze zusätzlich Clerk Core Status, um Timing-Rennen zu vermeiden
const signedInCore = computed(() => !!window?.Clerk?.session)
const signedIn = computed(() => isSignedIn.value || signedInCore.value)

// Weiterleitungslogik, sobald Clerk bereit ist
watch(clerkReady, (ready) => {
  if (!ready) return
  const coreAuthed = !!window?.Clerk?.session
  if (coreAuthed || isSignedIn.value) {
    // Eingeloggt: Stelle sicher, dass wir nicht auf Welcome hängen bleiben
    if (route.name === 'welcome') {
      const target = (route.query?.redirect && String(route.query.redirect)) || '/dashboard'
      if (route.fullPath !== target) router.replace(target)
    }
    return
  }
  // Sicher ausgeloggt -> Welcome mit Redirect-Ziel
  const target = route.fullPath
  router.replace({ name: 'welcome', query: target && target !== '/' ? { redirect: target } : {} })
})
</script>

<style scoped>
.auth-splash { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); }
.spinner { width: 36px; height: 36px; border: 3px solid color-mix(in oklab, var(--accent-color) 30%, transparent); border-top: 3px solid var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
</style>
