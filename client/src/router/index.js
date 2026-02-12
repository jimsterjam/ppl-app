import { createRouter, createWebHistory } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import WelcomeView from '../views/WelcomeView.vue'
// Funnel view (optional): redirects browser users to app stores
import GetTheAppView from '../views/GetTheAppView.vue'
import AuthLayout from '../layouts/AuthLayout.vue'
import DashboardView from '../views/DashboardView.vue'
import StatsView from '../views/StatsView.vue'
import ExercisesView from '../views/ExercisesView.vue'
import SettingsView from '../views/SettingsView.vue'
import WorkoutBuilder from '../components/WorkoutBuilder.vue'
import WorkoutDetailView from '../views/WorkoutDetailView.vue'
import FeedbackInboxView from '../views/FeedbackInboxView.vue'
import FaqsView from '../views/FaqsView.vue'
import FeaturesTestView from '../views/FeaturesTestView.vue'

import LegalNoticeView from '../views/LegalNoticeView.vue'
import { useAuthStore } from '@/stores/authStore'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'

const routes = [
  {
    path: '/',
    name: 'welcome',
    component: WelcomeView,
    meta: { requiresAuth: false }
  },
  {
    path: '/get-the-app',
    name: 'get-the-app',
    component: GetTheAppView,
    meta: { requiresAuth: false }
  },
  // Geschützte Routen unter AuthLayout, mit identischen (absoluten) Pfaden
  {
    path: '/',
    component: AuthLayout,
    children: [
      { path: 'dashboard', name: 'dashboard', component: DashboardView },
      { path: 'stats', name: 'stats', component: StatsView },
      { path: 'exercises', name: 'exercises', component: ExercisesView },
      { path: 'settings', name: 'settings', component: SettingsView },
      { path: 'feedback', name: 'feedback', component: FeedbackInboxView },
      { path: 'workout-builder', name: 'workout-builder', component: WorkoutBuilder },
      { path: 'faqs', name: 'faqs', component: FaqsView },
      { path: 'features-test', name: 'features-test', component: FeaturesTestView },
      { path: 'workouts/:id', name: 'workout-detail', component: WorkoutDetailView }
    ]
  },
  {
    path: '/info',
    redirect: '/faqs'
  },
  {
    path: '/legal',
    name: 'legal',
    component: LegalNoticeView,
    meta: { requiresAuth: false }
  },
  {
    path: '/plan',
    name: 'plan',
    // Weiterleitung zum Workout-Builder
    redirect: '/workout-builder'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Optional funnel: only redirect in real browsers when enabled via env flag
const isNativePlatform = () => {
  try {
    const platform = Capacitor?.getPlatform?.() ?? Capacitor?.platform
    if (platform && platform !== 'web') return true
    if (typeof location !== 'undefined' && location.protocol === 'capacitor:') return true
  } catch {}
  return false
}

router.beforeEach((to, from, next) => {
  const funnelEnabled = import.meta.env?.VITE_ENABLE_WEB_FUNNEL === '1'
  if (funnelEnabled && !isNativePlatform() && to.name !== 'get-the-app') {
    return next({ name: 'get-the-app' })
  }
  next()
})

// Einfache Auth-Guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const { getCurrentUser, getIdToken } = useFirebaseAuth()

  if (!authStore.isAuthenticated) {
    const currentUser = getCurrentUser()
    if (currentUser) {
      logger.debug('[router] restoring auth state from Firebase user')
      const token = await getIdToken().catch(() => null)
      authStore.setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      }, token)
    }
  }

  logger.debug('[router] navigating to', to.fullPath, 'auth:', authStore.isAuthenticated, 'initialized:', authStore.initialized)

  // Public routes bleiben immer zugänglich
  if (to.name === 'welcome' || to.meta.requiresAuth === false) {
    // Wenn bereits eingeloggt und auf /, direkt ins Dashboard
    if (to.name === 'welcome' && authStore.isAuthenticated) {
      logger.debug('[router] already authenticated, redirecting from welcome to dashboard')
      return next({ name: 'dashboard' })
    }
    return next()
  }

  // Für alle anderen Routen: Auth erforderlich
  if (!authStore.isAuthenticated) {
    logger.debug('[router] not authenticated, redirecting to welcome with redirect query')
    return next({ name: 'welcome', query: { redirect: to.fullPath } })
  }

  // Defense-in-depth: Wenn Store sagt eingeloggt, aber kein echter Firebase-User/Token vorhanden, zurück zur Welcome
  const realUser = getCurrentUser()
  let token = null
  try {
    token = await getIdToken()
  } catch { token = null }
  if (!realUser || !token) {
    logger.warn('[router] Auth store out of sync with Firebase (user/token missing). Forcing sign-out redirect.')
    authStore.clearUser()
    return next({ name: 'welcome', query: { redirect: to.fullPath } })
  }

  next()
})

export default router
