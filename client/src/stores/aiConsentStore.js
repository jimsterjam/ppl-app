import { defineStore } from 'pinia'
import { fetchAccountProfile, saveAiConsent } from '@/api/account'
import { getAuthToken } from '@/utils/authToken'
import { logger } from '@/utils/logger'

// Einwilligung zur Weitergabe von Trainingsdaten an den KI-Dienst (OpenAI). Der Server ist die
// Quelle der Wahrheit (UserProfile.aiConsent) und lehnt KI-Aufrufe ohne Einwilligung ab; der
// lokale Cache pro UID dient nur dazu, nicht bei jedem Start erneut zu fragen, bevor der
// Server geantwortet hat. Alle KI-Auslöser rufen request() auf: bei vorhandener Einwilligung
// sofort true, sonst öffnet sich das Fenster (AiConsentModal.vue) und die Antwort kommt zurück.
const CACHE_KEY = 'ai-consent'

function cacheKey(uid) {
  return `${CACHE_KEY}:${uid}`
}

export const useAiConsentStore = defineStore('aiConsent', {
  state: () => ({
    _uid: '',
    granted: false,
    modalOpen: false,
    saving: false,
    saveFailed: false,
    _waiters: []
  }),
  actions: {
    switchUser(uid) {
      const newUid = String(uid || '').trim()
      if (this._uid === newUid) return
      this._uid = newUid
      this.granted = false
      if (this.modalOpen) this._settle(false)
      if (!newUid) return
      try {
        this.granted = localStorage.getItem(cacheKey(newUid)) === '1'
      } catch { /* Cache optional */ }
    },

    _setGranted(value) {
      this.granted = !!value
      if (!this._uid) return
      try { localStorage.setItem(cacheKey(this._uid), this.granted ? '1' : '0') } catch { /* optional */ }
    },

    async syncFromServer(token) {
      try {
        const profile = await fetchAccountProfile(token)
        if (profile?.aiConsent && typeof profile.aiConsent.granted === 'boolean') {
          this._setGranted(profile.aiConsent.granted)
        }
      } catch (error) {
        logger.warn('[aiConsentStore] syncFromServer fehlgeschlagen:', error?.message || error)
      }
    },

    // Der Server hat einen KI-Aufruf wegen fehlender Einwilligung abgelehnt (z.B. neue Textversion).
    noteServerRefusal() {
      this._setGranted(false)
    },

    // true = KI darf Daten senden. Öffnet bei Bedarf das Einwilligungsfenster.
    request() {
      if (this.granted) return Promise.resolve(true)
      return new Promise((resolve) => {
        this._waiters.push(resolve)
        this.saveFailed = false
        this.modalOpen = true
      })
    },

    _settle(result) {
      const waiters = this._waiters
      this._waiters = []
      this.modalOpen = false
      waiters.forEach((resolve) => resolve(result))
    },

    async accept() {
      if (this.saving) return
      this.saving = true
      this.saveFailed = false
      try {
        const token = await getAuthToken()
        const result = await saveAiConsent(token, true)
        if (!result?.granted) throw new Error('not granted')
        this._setGranted(true)
        this._settle(true)
      } catch (error) {
        logger.warn('[aiConsentStore] accept fehlgeschlagen:', error?.message || error)
        // Fenster bleibt offen: ohne gespeicherte Einwilligung würde der Server ablehnen.
        this.saveFailed = true
      } finally {
        this.saving = false
      }
    },

    decline() {
      this._settle(false)
    },

    // Widerruf (Einstellungen). Bei Fehler bleibt der alte Stand; Rückgabe: gelungen?
    async revoke() {
      try {
        const token = await getAuthToken()
        const result = await saveAiConsent(token, false)
        if (result?.granted) return false
        this._setGranted(false)
        return true
      } catch (error) {
        logger.warn('[aiConsentStore] revoke fehlgeschlagen:', error?.message || error)
        return false
      }
    }
  }
})
