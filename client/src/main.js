import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { clerkPlugin } from '@clerk/vue'
import router from './router'
import { useThemeStore } from './stores/themeStore'

const app = createApp(App)
const pinia = createPinia()

// Wichtig: Clerk BEFORE Router initialisieren
app.use(clerkPlugin, {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
})

app.use(pinia)
app.use(router)

// Theme initial anwenden (nach Pinia-Setup)
const themeStore = useThemeStore(pinia)
themeStore.applyCurrent()

app.mount('#app')

