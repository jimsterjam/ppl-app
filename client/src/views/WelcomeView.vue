<template>
  <WelcomePage :handleChangeDisplay="handleNavigation" />
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'
import { watch, onMounted } from 'vue'
import { useUser } from '@clerk/vue'
import WelcomePage from '../components/WelcomePage.vue'

const router = useRouter()
const route = useRoute()
const { isSignedIn } = useUser()

function handleNavigation(displayType) {
  // displayType 2 = Dashboard basierend auf Ihrer Komponente
  if (displayType === 2) {
    router.push('/dashboard')
  }
}

// Minimaler Redirect nach erfolgreichem Login
function redirectAfterLogin() {
  const target = (route.query?.redirect && String(route.query.redirect)) || '/dashboard'
  if (route.fullPath !== target) {
    router.replace(target)
  }
}

watch(isSignedIn, (v) => {
  if (v) redirectAfterLogin()
})

onMounted(() => {
  if (isSignedIn.value) redirectAfterLogin()
})
</script>

<style scoped>
/* Kein zusätzliches Styling nötig - WelcomePage übernimmt das komplette Layout */
</style>