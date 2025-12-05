import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import { useThemeStore } from './stores/themeStore'
import { useSubscriptionStore } from './stores/subscriptionStore'
import { createI18nInstance } from './i18n'
import { useAuthStore } from './stores/authStore'
import { useFirebaseAuth } from './utils/firebaseAuth'
import logger from './utils/logger'

// Development tools
if (import.meta.env.DEV) {
  import('./utils/testHelper.js')
}

const app = createApp(App)
const pinia = createPinia()
const i18n = createI18nInstance()


// Firebase wird in utils/firebaseAuth initialisiert

// Kein Redirect-Handling mehr nötig bei nativem Google Auth

app.use(pinia)
app.use(router)
app.use(i18n)

// Globales Firebase Auth State Handling
const { onAuthStateChanged, getIdToken, getCurrentUser, handleRedirectResult } = useFirebaseAuth()
const authStore = useAuthStore(pinia)

console.log('[main] Initializing auth listener, store auth state:', authStore.isAuthenticated)

onAuthStateChanged(async (user) => {
  console.log('[main] Firebase auth state changed:', user ? user.uid : 'null')
  if (user) {
    const token = await getIdToken().catch((err) => {
      console.warn('[main] Failed to fetch ID token:', err)
      return null
    })
    console.log('[main] Setting authStore user with token present:', !!token)
    authStore.setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    }, token)
  } else {
    authStore.clearUser()
  }
})

// iOS Redirect-Fluss nach App-Start sicher abschließen
handleRedirectResult().catch((err) => {
  console.warn('[main] Redirect result handling error (may be normal if none):', err?.message || err)
})

// Theme initial anwenden (nach Pinia-Setup)
const themeStore = useThemeStore()
themeStore.applyCurrent()

// Subscription Status beim App-Start laden
const subscriptionStore = useSubscriptionStore()
subscriptionStore.checkSubscription()

app.mount('#app')

// Debug-Logger-Umleitung entfernt, um Endlosschleifen zu vermeiden.

