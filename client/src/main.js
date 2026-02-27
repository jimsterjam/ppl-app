import { createApp } from 'vue'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import { createI18nInstance } from './i18n'
import { useThemeStore } from './stores/themeStore'
import { useSubscriptionStore } from './stores/subscriptionStore'
import { useAuthStore } from './stores/authStore'
import { initFirebaseAuth, useFirebaseAuth } from './utils/firebaseAuth'
import { App as CapacitorApp } from '@capacitor/app'
import { logger } from '@/utils/logger'
import { setCacheLimits } from '@/utils/assetCache'
import { setDownloadConcurrency } from '@/utils/assetResolver'

const app = createApp(App)
const pinia = createPinia()
const i18n = createI18nInstance()
app.use(pinia)
app.use(router)
app.use(i18n)

// Asset-Cache Limits/Concurrency (optional via env)
const maxBytesEnv = Number(import.meta.env.VITE_ASSET_CACHE_MAX_BYTES)
const maxItemsEnv = Number(import.meta.env.VITE_ASSET_CACHE_MAX_ITEMS)
setCacheLimits({
  maxBytes: Number.isFinite(maxBytesEnv) ? maxBytesEnv : undefined,
  maxItems: Number.isFinite(maxItemsEnv) ? maxItemsEnv : undefined
})
setDownloadConcurrency(import.meta.env.VITE_ASSET_DOWNLOAD_CONCURRENCY)

// Async bootstrap für Firebase
async function bootstrapAuth() {
  await initFirebaseAuth() // <---- unbedingt zuerst

  const { onAuthStateChanged, getIdToken, getCurrentUser, handleRedirectResult } = useFirebaseAuth()
  const authStore = useAuthStore(pinia)

  logger.debug('[main] Initializing auth listener, store auth state:', authStore.isAuthenticated)

  onAuthStateChanged(async (user) => {
    logger.debug('[main] Firebase auth state changed:', user ? user.uid : 'null')
    if (user) {
      const token = await getIdToken().catch((err) => {
        logger.warn('[main] Failed to fetch ID token:', err)
        return null
      })
      authStore.setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }, token)
      // If the app currently shows the welcome page, navigate to target immediately to avoid race conditions
      try {
        const current = router.currentRoute.value
        if (current && current.name === 'welcome') {
          const redirect = current.query?.redirect
          const target = (typeof redirect === 'string' && redirect.startsWith('/')) ? redirect : '/dashboard'
          logger.debug('[main] User signed in and current route is welcome — navigating to', target)
          router.replace(target).catch(() => {})
        }
      } catch (e) {
        logger.warn('[main] auto-redirect after sign-in failed:', e)
      }
    } else {
      authStore.clearUser()
    }
  })

  // Helper mit Logging für Redirect-Ergebnis
  const processRedirectResult = async (source) => {
    try {
      logger.debug('[main] handleRedirectResult start (source:', source, ')')
      const res = await handleRedirectResult()
      if (res?.user) {
        logger.debug('[main] handleRedirectResult success, user:', res.user.uid, 'provider:', res.providerId)
      } else {
        logger.debug('[main] handleRedirectResult no user returned (source:', source, ')')
      }
    } catch (err) {
      logger.warn('[main] handleRedirectResult error (source:', source, '):', err?.message || err)
    }
  }

  // iOS Redirect-Fluss nach App-Start sicher abschließen
  processRedirectResult('startup')

  // Falls die App aus dem Redirect (Safari/WKWebView) zurückkehrt, erneut Result abholen
  CapacitorApp.addListener('appUrlOpen', async (data) => {
    logger.debug('[main] appUrlOpen event', data)
    await processRedirectResult('appUrlOpen')
  })
}

bootstrapAuth()

// Theme initial anwenden
const themeStore = useThemeStore()
themeStore.applyCurrent()

// Subscription Status beim App-Start laden
const subscriptionStore = useSubscriptionStore()
subscriptionStore.checkSubscription()

app.mount('#app')
