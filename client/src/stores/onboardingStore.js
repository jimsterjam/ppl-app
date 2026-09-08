import { defineStore } from 'pinia'
import {
  fetchAccountProfile,
  completeOnboarding as apiCompleteOnboarding,
  skipOnboarding as apiSkipOnboarding,
  restartOnboarding as apiRestartOnboarding,
  dismissOnboardingHint as apiDismissOnboardingHint
} from '@/api/account'
import { logger } from '@/utils/logger'

// Onboarding-Status (5-seitiger Einführungsflow + einmalige kontextuelle Hinweise, siehe
// OnboardingFlow.vue / OneTimeHint.vue). Server ist die Quelle der Wahrheit (UserProfile.onboarding,
// siehe server/routes/account.js) - Login auf einem neuen Gerät zeigt den Flow deshalb NICHT
// erneut, sobald er einmal irgendwo abgeschlossen/übersprungen wurde. Lokal (pro UID, gleiches
// Schlüssel-Muster wie settingsStore.js) wird der zuletzt bekannte Stand zusätzlich gecacht,
// damit die Entscheidung "Flow zeigen?" beim App-Start sofort getroffen werden kann, ohne auf
// eine Server-Antwort zu warten (verhindert ein kurzes Aufblitzen des Flows bei langsamer
// Verbindung) - der Server-Abgleich überschreibt den lokalen Stand danach im Hintergrund.
function pKey(uid, base) {
  return uid ? `${base}:${uid}` : base
}

function lsGetJSON(uid, base, fallback) {
  try {
    const raw = localStorage.getItem(pKey(uid, base))
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function lsSetJSON(uid, base, value) {
  try { localStorage.setItem(pKey(uid, base), JSON.stringify(value)) } catch {}
}

const CACHE_KEY = 'onboarding-status'

export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({
    _uid: '',
    // true erst, nachdem entweder der lokale Cache ODER die Server-Antwort ausgewertet wurde -
    // verhindert, dass der Flow kurz aufblitzt, bevor der echte Status bekannt ist (siehe
    // shouldShowFlow-Nutzung in App.vue: die zeigt den Flow erst, wenn statusReady true ist).
    statusReady: false,
    completed: false,
    dismissedHints: []
  }),
  actions: {
    // Muss aus main.js nach jedem Firebase-onAuthStateChanged aufgerufen werden (analog
    // settingsStore.switchUser) - trennt den Cache sauber pro Account-UID.
    switchUser(uid) {
      const newUid = String(uid || '').trim()
      if (this._uid === newUid) return
      this._uid = newUid

      if (!newUid) {
        this.statusReady = false
        this.completed = false
        this.dismissedHints = []
        return
      }

      const cached = lsGetJSON(newUid, CACHE_KEY, null)
      if (cached && typeof cached === 'object') {
        this.completed = !!cached.completed
        this.dismissedHints = Array.isArray(cached.dismissedHints) ? cached.dismissedHints : []
        this.statusReady = true
      } else {
        this.statusReady = false
        this.completed = false
        this.dismissedHints = []
      }
    },

    _persistCache() {
      if (!this._uid) return
      lsSetJSON(this._uid, CACHE_KEY, {
        completed: this.completed,
        dismissedHints: this.dismissedHints
      })
    },

    _applyServerOnboarding(onboarding) {
      if (!onboarding || typeof onboarding !== 'object') return
      this.completed = !!onboarding.completed
      this.dismissedHints = Array.isArray(onboarding.dismissedHints) ? onboarding.dismissedHints : []
      this.statusReady = true
      this._persistCache()
    },

    // Mit dem Server abgleichen - non-blocking gedacht (Aufrufer wartet i.d.R. nicht darauf,
    // der lokale Cache reicht für die erste Anzeige-Entscheidung). Fehler werden bewusst nur
    // geloggt: ohne Server-Antwort bleibt der lokale (oder Default-)Stand gültig, der Flow wird
    // dadurch nie fälschlich blockiert.
    async syncFromServer(token) {
      try {
        const profile = await fetchAccountProfile(token)
        if (profile?.onboarding) {
          this._applyServerOnboarding(profile.onboarding)
        } else if (!this.statusReady) {
          // Kein onboarding-Feld in der Antwort (z.B. Netzwerk-Fallback von fetchAccountProfile
          // liefert {}) und noch kein lokaler Cache vorhanden - als "noch nicht abgeschlossen"
          // behandeln (neuer Nutzer), aber als bereit markieren, damit der Flow angezeigt werden kann.
          this.statusReady = true
        }
      } catch (error) {
        logger.warn('[onboardingStore] syncFromServer fehlgeschlagen:', error?.message || error)
        if (!this.statusReady) {
          // Ohne jegliche Information (kein lokaler Cache, kein Server erreichbar): als "noch
          // nicht abgeschlossen" behandeln, damit ein wirklich neuer Nutzer den Flow trotz
          // Netzwerkproblem sieht statt ihn nie zu bekommen - bewusst NICHT in den lokalen Cache
          // geschrieben (kein this._persistCache() hier), damit diese Annahme nicht dauerhaft
          // "einfriert": der nächste erfolgreiche Sync korrigiert sie ggf. auf "bereits erledigt".
          // Schlimmstenfalls sieht ein bestehender Nutzer den Flow einmalig erneut - unkritisch,
          // im Gegensatz zu einem Nutzer, der ihn nie zu sehen bekommt.
          this.statusReady = true
          this.completed = false
        }
      }
    },

    async completeFlow(token) {
      this.completed = true
      this._persistCache()
      try {
        const res = await apiCompleteOnboarding(token)
        if (res?.onboarding) this._applyServerOnboarding(res.onboarding)
      } catch (error) {
        logger.warn('[onboardingStore] completeFlow Server-Sync fehlgeschlagen:', error?.message || error)
      }
    },

    async skipFlow(token) {
      this.completed = true
      this._persistCache()
      try {
        const res = await apiSkipOnboarding(token)
        if (res?.onboarding) this._applyServerOnboarding(res.onboarding)
      } catch (error) {
        logger.warn('[onboardingStore] skipFlow Server-Sync fehlgeschlagen:', error?.message || error)
      }
    },

    // Für "Einführungsguide erneut starten" in den Einstellungen.
    async restartFlow(token) {
      this.completed = false
      this._persistCache()
      try {
        const res = await apiRestartOnboarding(token)
        if (res?.onboarding) this._applyServerOnboarding(res.onboarding)
      } catch (error) {
        logger.warn('[onboardingStore] restartFlow Server-Sync fehlgeschlagen:', error?.message || error)
      }
    },

    isHintDismissed(hintId) {
      return this.dismissedHints.includes(hintId)
    },

    // Fire-and-forget-Sync zum Server (wie reconcileFavoritesWithServer) - der lokale Zustand
    // gilt sofort, damit der Hinweis beim nächsten Öffnen der gleichen Ansicht nicht erneut
    // erscheint, auch wenn der Server-Request noch unterwegs oder offline ist.
    async dismissHint(token, hintId) {
      if (!hintId || this.dismissedHints.includes(hintId)) return
      this.dismissedHints = [...this.dismissedHints, hintId]
      this._persistCache()
      try {
        const res = await apiDismissOnboardingHint(token, hintId)
        if (res?.onboarding) this._applyServerOnboarding(res.onboarding)
      } catch (error) {
        logger.warn('[onboardingStore] dismissHint Server-Sync fehlgeschlagen:', error?.message || error)
      }
    }
  }
})
