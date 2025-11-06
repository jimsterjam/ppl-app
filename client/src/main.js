import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { clerkPlugin } from '@clerk/vue'
import router from './router'
import { useThemeStore } from './stores/themeStore'
import { useSubscriptionStore } from './stores/subscriptionStore'
import { createI18nInstance } from './i18n'

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
const themeStore = useThemeStore(pinia)
themeStore.applyCurrent()

// Subscription Status beim App-Start laden
const subscriptionStore = useSubscriptionStore(pinia)
subscriptionStore.checkSubscription()

app.mount('#app')

