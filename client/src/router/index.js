import { createRouter, createWebHistory } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { useAuthStore } from '@/stores/authStore'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'
import { isOnline } from '@/utils/offlineStorage'

const WelcomeView = () => import('../views/WelcomeView.vue')
const GetTheAppView = () => import('../views/GetTheAppView.vue')
const AuthLayout = () => import('../layouts/AuthLayout.vue')
const DashboardView = () => import('../views/DashboardView.vue')
const StatsView = () => import('../views/StatsView.vue')
const ExercisesView = () => import('../views/ExercisesView.vue')
const SettingsView = () => import('../views/SettingsView.vue')
const WorkoutBuilder = () => import('../components/WorkoutBuilder.vue')
const WorkoutDetailView = () => import('../views/WorkoutDetailView.vue')
const FeedbackInboxView = () => import('../views/FeedbackInboxView.vue')
const FaqsView = () => import('../views/FaqsView.vue')
const FeaturesTestView = () => import('../views/FeaturesTestView.vue')
const LegalNoticeView = () => import('../views/LegalNoticeView.vue')

const routes = [
  {
    path: '/',
    name: 'welcome',
    component: WelcomeView,
    meta: { requiresAuth: false, layout: 'public' }
  },
  {
    path: '/get-the-app',
    name: 'get-the-app',
    component: GetTheAppView,
    meta: { requiresAuth: false, layout: 'public' }
  },
  // Geschützte Routen unter AuthLayout, mit identischen (absoluten) Pfaden
  {
    path: '/',
    component: AuthLayout,
    meta: { layout: 'auth' },
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

async function waitForAuthHydration(authStore, getCurrentUser, timeoutMs = 1800) {
  if (authStore.initialized || authStore.isAuthenticated || getCurrentUser()) return

  await new Promise((resolve) => {
    const startedAt = Date.now()
    const tick = () => {
      if (authStore.initialized || authStore.isAuthenticated || getCurrentUser() || Date.now() - startedAt >= timeoutMs) {
        resolve()
        return
      }
      setTimeout(tick, 100)
    }
    tick()
  })
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

  if (to.meta.requiresAuth !== false) {
    await waitForAuthHydration(authStore, getCurrentUser)
  }

  if (!authStore.isAuthenticated) {
    const currentUser = getCurrentUser()
    if (currentUser) {
      logger.debug('[router] restoring auth state from Firebase user')
      const token = isOnline() ? await getIdToken().catch(() => null) : null
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

  // Wenn bereits authentifiziert und Store initialisiert → kein erneuter Token-Check,
  // um Navigation zwischen App-Seiten nicht mit async Firebase-Calls zu verzögern.
  if (authStore.initialized && authStore.isAuthenticated) {
    if (!isOnline()) {
      if (!authStore.isOfflineSessionValid) {
        logger.warn('[router] offline session expired or missing token, redirecting to welcome')
        authStore.clearUser()
        return next({ name: 'welcome', query: { redirect: to.fullPath, reason: 'offline-expired' } })
      }
    }
    return next()
  }

  // Defense-in-depth: nur beim ersten Init oder wenn Store-Zustand unklar
  if (!isOnline()) {
    if (!authStore.isOfflineSessionValid) {
      logger.warn('[router] offline session expired or missing token, redirecting to welcome')
      authStore.clearUser()
      return next({ name: 'welcome', query: { redirect: to.fullPath, reason: 'offline-expired' } })
    }
    return next()
  }

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
