import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { clerkPlugin } from '@clerk/vue'
import router from './router'
import { useThemeStore } from './stores/themeStore'
import { useSubscriptionStore } from './stores/subscriptionStore'
import { createI18nInstance } from './i18n'
import logger from './utils/logger'

// Development tools
if (import.meta.env.DEV) {
  import('./utils/testHelper.js')
}

const app = createApp(App)
const pinia = createPinia()
const i18n = createI18nInstance()

// Wichtig: Clerk BEFORE Router initialisieren
app.use(clerkPlugin, {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
})

app.use(pinia)
app.use(router)
app.use(i18n)

// Theme initial anwenden (nach Pinia-Setup)
// Verwende die Stores OHNE das `pinia`-Argument, damit sie die App-Context-Injektionen
// (z.B. Plugins wie @clerk/vue) korrekt erhalten.
const themeStore = useThemeStore()
themeStore.applyCurrent()

// Subscription Status beim App-Start laden
const subscriptionStore = useSubscriptionStore()
subscriptionStore.checkSubscription()

app.mount('#app')

// Dev: leite console.log/info über den zentralen Logger um, damit Debugging
// konsistent ist und späteres Refactoring auf logger.* nicht zwingend nötig ist.
if (import.meta.env.DEV) {
  try {
    // Nur überschreiben, wenn logger verfügbar
    if (logger && typeof logger.debug === 'function') {
      const originalLog = console.log.bind(console)
      const originalInfo = console.info.bind(console)

      console.log = (...args) => {
        try { logger.debug(...args) } catch (e) { originalLog(...args) }
      }
      console.info = (...args) => {
        try { logger.info(...args) } catch (e) { originalInfo(...args) }
      }
    }
  } catch (e) {
    // Fallback: nichts tun
  }
}

