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
import { useUserStore } from './stores/userStore'
import { useSettingsStore } from './stores/settingsStore'
import { useTimerStore } from './stores/timerStore'
import { initFirebaseAuth, useFirebaseAuth, isEffectivelyEmailVerified } from './utils/firebaseAuth'
import { reconcileFavoritesWithServer } from './utils/workoutFavorites'
import { App as CapacitorApp } from '@capacitor/app'
import { logger } from '@/utils/logger'
import { setCacheLimits } from '@/utils/assetCache'
import { setDownloadConcurrency } from '@/utils/assetResolver'
import { setupAutoSync, processSyncQueue } from '@/utils/syncManager'
import { saveWorkoutService } from '@/utils/SaveWorkoutService'
import { deleteWorkoutOffline, OFFLINE_WORKOUTS_UPDATED_EVENT } from '@/utils/offlineStorage'
// Bewusst NICHT statisch importiert (siehe warmupExercisesArea unten): defaultExercisesLoader.js
// importiert die ~3,3MB große Übungsdatenbank (default-exercises.json) statisch - ein Top-Level-
// Import hier würde sie fest in den Haupt-Bundle-Chunk backen, obwohl sie erst gebraucht wird,
// wenn der Übungen-Bereich tatsächlich geöffnet wird (Ursache der "chunk > 500kB"-Build-Warnung).

const APP_RESUME_STATE_KEY = 'app_resume_state_v1'
const APP_RESUME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function setupGlobalDoubleTapZoomBlock() {
  if (typeof document === 'undefined') return

  let lastTouchEndAt = 0

  // Block browser-level zoom gesture on quick double taps.
  document.addEventListener('touchend', (event) => {
    const now = Date.now()
    if (now - lastTouchEndAt <= 320) {
      event.preventDefault()
    }
    lastTouchEndAt = now
  }, { passive: false })

  document.addEventListener('dblclick', (event) => {
    event.preventDefault()
  }, { passive: false })
}

setupGlobalDoubleTapZoomBlock()

function isRouteEligibleForResume(route) {
  const name = String(route?.name || '')
  if (!name) return false
  if (name === 'welcome' || name === 'get-the-app') return false
  return true
}

function saveResumeSnapshot(route, source = 'unknown') {
  try {
    if (!isRouteEligibleForResume(route)) return
    const fullPath = String(route?.fullPath || '').trim()
    if (!fullPath || !fullPath.startsWith('/')) return

    localStorage.setItem(APP_RESUME_STATE_KEY, JSON.stringify({
      fullPath,
      name: String(route?.name || ''),
      source,
      timestamp: Date.now()
    }))
  } catch {}
}

function readResumeSnapshot() {
  try {
    const raw = localStorage.getItem(APP_RESUME_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const fullPath = String(parsed.fullPath || '').trim()
    const timestamp = Number(parsed.timestamp || 0)
    if (!fullPath || !fullPath.startsWith('/')) return null
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null
    if (Date.now() - timestamp > APP_RESUME_MAX_AGE_MS) return null
    return { fullPath, timestamp, name: String(parsed.name || '') }
  } catch {
    return null
  }
}

function clearResumeSnapshot() {
  try { localStorage.removeItem(APP_RESUME_STATE_KEY) } catch {}
}

function warmupExercisesArea() {
  const runWarmup = () => {
    // Route-/Component-Chunk vorladen, damit der Wechsel in den Übungen-Bereich direkter wirkt.
    Promise.all([
      import('./views/ExercisesView.vue'),
      import('./components/ExerciseList.vue'),
      import('@/utils/defaultExercisesLoader').then((m) => m.loadDefaultExercises()).catch(() => null)
    ]).catch(() => null)
  }

  if (typeof window === 'undefined') {
    runWarmup()
    return
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => runWarmup(), { timeout: 1500 })
    return
  }

  setTimeout(runWarmup, 350)
}

async function tryRestoreLastRoute(reason = 'unknown') {
  const snapshot = readResumeSnapshot()
  if (!snapshot) return false

  const current = router.currentRoute.value
  const currentPath = String(current?.fullPath || '')
  const currentName = String(current?.name || '')

  // Nicht in laufende Navigation eingreifen; nur von "Start"-Routen zurücksetzen.
  const canOverrideCurrent = currentName === 'welcome' || currentName === 'dashboard' || currentPath === '/'
  if (!canOverrideCurrent) return false
  if (currentPath === snapshot.fullPath) return false

  try {
    await router.replace(snapshot.fullPath)
    logger.debug('[main] Restored last route', {
      reason,
      from: currentPath,
      to: snapshot.fullPath,
      ageMs: Date.now() - snapshot.timestamp
    })
    return true
  } catch (error) {
    logger.warn('[main] Route restore failed', {
      reason,
      to: snapshot.fullPath,
      message: error?.message || String(error)
    })
    return false
  }
}

const app = createApp(App)
const pinia = createPinia()
const i18n = createI18nInstance()
app.use(pinia)
app.use(router)
app.use(i18n)
const timerStore = useTimerStore(pinia)
timerStore.restoreState('main-init')

// Letzten Navigationszustand fortlaufend speichern, damit die App nach Background/Screen-Off
// oder Process-Restart an derselben Stelle weiterlaufen kann.
router.afterEach((to) => {
  saveResumeSnapshot(to, 'afterEach')
})

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
  const userStore = useUserStore(pinia)
  const settingsStore = useSettingsStore(pinia)
  let lastUid = authStore.uid || null

  logger.debug('[main] Initializing auth listener, store auth state:', authStore.isAuthenticated)

  onAuthStateChanged(async (user) => {
    logger.debug('[main] Firebase auth state changed:', user ? user.uid : 'null')
    if (user) {
      if (lastUid && lastUid !== user.uid) {
        userStore.$reset()
      }
      lastUid = user.uid
      // Account-spezifische Daten (avatar, username) für diesen User laden
      settingsStore.switchUser(user.uid)
      const token = await getIdToken().catch((err) => {
        logger.warn('[main] Failed to fetch ID token:', err)
        return null
      })
      authStore.setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        // Für die Konto-Info-Anzeige in den Einstellungen (welcher Login-Anbieter gerade aktiv
        // ist) - hilft Nutzern zu erkennen, dass E-Mail/Passwort-, Google- und Apple-Logins bei
        // Firebase eigenständige, nicht automatisch verknüpfte Konten sind.
        providerId: user.providerData?.[0]?.providerId || null,
        // Sicherheitsfix: fehlte bisher komplett - isAuthenticated in authStore.js prüft das
        // jetzt zusätzlich, damit ein Firebase-Session-Objekt mit emailVerified=false (egal auf
        // welchem Weg zustande gekommen) nicht automatisch vollen App-Zugriff gewährt.
        // isEffectivelyEmailVerified() behandelt Apple/Google-Logins zusätzlich als verifiziert,
        // auch wenn Firebase user.emailVerified dafür nicht zuverlässig auf true setzt (siehe
        // Kommentar in firebaseAuth.js) - sonst verlieren genau diese Nutzer den Datenzugriff.
        emailVerified: isEffectivelyEmailVerified(user),
      }, token)

      if (token) {
        logger.debug('[main] Trigger processSyncQueue after auth', {
          uid: user.uid,
          hasToken: !!token
        })
        processSyncQueue(token).catch((error) => {
          logger.warn('[main] processSyncQueue after auth failed:', error)
        })

        // Favoriten-Workouts liefen bisher rein lokal (localStorage) - bei Geräteverlust,
        // Neuinstallation oder UID-Wechsel (z.B. Apple-Sign-In-Fall) gingen sie verloren.
        // Beim Login jetzt zusätzlich mit dem Server abgleichen (Server-Favoriten lokal
        // ergänzen, lokale Favoriten nachliefern, die der Server noch nicht kennt).
        if (authStore.isAuthenticated) {
          reconcileFavoritesWithServer(user.uid, token)
            .then((result) => {
              logger.debug('[main] Favoriten-Abgleich abgeschlossen', result)
            })
            .catch((error) => {
              logger.warn('[main] Favoriten-Abgleich fehlgeschlagen:', error)
            })
        }
      } else {
        logger.warn('[main] No token after auth state change, starte trotzdem Sync-Versuch', {
          uid: user.uid
        })
        processSyncQueue().catch((error) => {
          logger.warn('[main] processSyncQueue without initial token failed:', error)
        })
      }
      // If the app currently shows the welcome page, navigate to target immediately to avoid race conditions.
      // Wichtig: nur wenn authStore.isAuthenticated auch wirklich true ist (also E-Mail verifiziert) -
      // sonst würde z.B. direkt nach der Registrierung (Firebase loggt den neuen, noch unverifizierten
      // User kurzzeitig automatisch ein) unnötig Richtung Dashboard navigiert und sofort wieder zurück
      // zur Welcome-Seite gebounct, was als kurzes "Dashboard blitzt auf" sichtbar war.
      try {
        if (!authStore.isAuthenticated) {
          // E-Mail noch nicht verifiziert (z.B. gerade erst registriert) - keine Navigation
          // auslösen, sonst blitzt kurz das Dashboard auf, bevor der Router-Guard wieder zurück
          // zur Welcome-Seite schickt.
          logger.debug('[main] Firebase user present but not yet verified/authenticated - skipping auto-redirect')
        } else {
          const current = router.currentRoute.value
          if (current && current.name === 'welcome') {
            const redirect = current.query?.redirect
            const restored = await tryRestoreLastRoute('auth-state-welcome')
            const target = (typeof redirect === 'string' && redirect.startsWith('/'))
              ? redirect
              : (restored ? null : '/dashboard')
            logger.debug('[main] User signed in and current route is welcome — navigating to', target)
            if (target) {
              router.replace(target).catch(() => {})
            }
          } else {
            await tryRestoreLastRoute('auth-state-general')
          }
        }
      } catch (e) {
        logger.warn('[main] auto-redirect after sign-in failed:', e)
      }
    } else {
      lastUid = null
      settingsStore.switchUser(null)
      authStore.clearUser()
      userStore.$reset()
      clearResumeSnapshot()
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

// App-Lifecycle: Beim Verlassen Zustand sichern, beim Zurückkehren ggf. wiederherstellen.
CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
  try {
    timerStore.setAppActive(isActive)
    if (!isActive) {
      saveResumeSnapshot(router.currentRoute.value, 'appState-inactive')
      timerStore.persistState(true, 'appState-inactive')
      return
    }
    await tryRestoreLastRoute('appState-active')
    timerStore.restoreState('appState-active')
  } catch {}
})

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      timerStore.setAppActive(false)
      saveResumeSnapshot(router.currentRoute.value, 'visibility-hidden')
      timerStore.persistState(true, 'visibility-hidden')
    } else {
      timerStore.setAppActive(true)
    }
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    saveResumeSnapshot(router.currentRoute.value, 'beforeunload')
    timerStore.persistState(true, 'beforeunload')
  })
}

// Theme initial anwenden
const themeStore = useThemeStore()
themeStore.applyCurrent()

// Subscription Status beim App-Start laden
const subscriptionStore = useSubscriptionStore()
subscriptionStore.checkSubscription()

// Reconciliation: wenn syncManager ein offline_xxx Workout erfolgreich zum Server pusht,
// wird der lokale Store-Eintrag durch den echten Server-Eintrag ersetzt.
saveWorkoutService.init(async (tempId, workout) => {
  if (!tempId || !workout?._id) return
  const userStore = useUserStore()
  const idx = userStore.workouts.findIndex(w => String(w?._id || '') === String(tempId))
  if (idx !== -1) {
    userStore.workouts.splice(idx, 1, { ...workout, _offlineCreated: false })
    logger.debug('[main] reconcileCallback: Store-Eintrag ersetzt', { tempId, realId: workout._id })
  }
  userStore.invalidateStatsCache()
  logger.debug('[main] reconcileCallback: Stats-Cache invalidiert')
  try {
    await deleteWorkoutOffline(tempId)
    logger.debug('[main] reconcileCallback: offline_xxx aus IndexedDB gelöscht', tempId)
  } catch (e) {
    logger.warn('[main] reconcileCallback: deleteWorkoutOffline fehlgeschlagen', e?.message)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_WORKOUTS_UPDATED_EVENT, { detail: { type: 'reconcile', tempId, realId: workout._id } }))
  }
})

setupAutoSync().catch((error) => {
  logger.warn('[main] setupAutoSync failed:', error)
})

router.isReady().then(() => {
  // Startwiederherstellung ohne Auth-Zwang: Router-Guards entscheiden final über Zugriff.
  tryRestoreLastRoute('router-ready').catch(() => {})
  warmupExercisesArea()
})

app.mount('#app')
