import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { useFirebaseAuth } from './utils/firebaseAuth'
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


// Firebase wird in utils/firebaseAuth initialisiert


app.use(pinia)
app.use(router)
app.use(i18n)


// Theme initial anwenden (nach Pinia-Setup)
const themeStore = useThemeStore()
themeStore.applyCurrent()

// Subscription Status beim App-Start laden
const subscriptionStore = useSubscriptionStore()
subscriptionStore.checkSubscription()

app.mount('#app')

// Debug-Logger-Umleitung entfernt, um Endlosschleifen zu vermeiden.

