import { defineStore } from 'pinia'
import { fetchAccountProfile, updateAccountProfile } from '@/api/account'
import { logger } from '@/utils/logger'

const PROFILE_REQUEST_COOLDOWN_MS = 15000
let profileLoadPromise = null
let profileLoadPromiseToken = ''
let profileCooldownUntil = 0

function isTransientRequestError(error) {
  const statusCode = Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0)
  const code = String(error?.code || error?.context?.originalError?.code || '')
  return statusCode === 0 || [502, 503, 504].includes(statusCode) || code === 'ECONNABORTED' || code === 'ERR_NETWORK'
}

// Erstellt einen UID-spezifischen localStorage-Schlüssel.
// Ohne UID → generischer Schlüssel (nur als Fallback/Migration).
function pKey(uid, base) {
  return uid ? `${base}:${uid}` : base
}

function lsGet(uid, base) {
  try { return localStorage.getItem(pKey(uid, base)) || '' } catch { return '' }
}

function lsSet(uid, base, value) {
  try {
    if (value) localStorage.setItem(pKey(uid, base), value)
    else localStorage.removeItem(pKey(uid, base))
  } catch {}
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // Geräte-Einstellungen – keine UID-Bindung
    language: (() => {
      try { return localStorage.getItem('app-lang') || null } catch { return null }
    })(),
    weeklyGoal: (() => {
      const envDefault = Number.parseInt(import.meta.env.VITE_DEFAULT_WEEKLY_GOAL || '', 10)
      const fallback = Number.isFinite(envDefault) && envDefault > 0 ? envDefault : 4
      const stored = Number.parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('weekly-goal')) || '', 10)
      return Number.isFinite(stored) && stored > 0 ? stored : fallback
    })(),
    // Account-spezifisch – werden erst nach switchUser(uid) geladen.
    // Beim Start leer, damit kein Account-fremdes Bild aufblitzt.
    _uid: '',
    username: '',
    avatarUrl: '',
    avatarData: '',
  }),
  actions: {
    // Muss aus main.js nach jedem Firebase-onAuthStateChanged aufgerufen werden.
    // Trennt die localStorage-Slots sauber pro Account-UID.
    switchUser(uid) {
      const newUid = String(uid || '').trim()
      if (this._uid === newUid) return

      this._uid = newUid

      if (!newUid) {
        // Abgemeldet: in-memory leeren, kein cross-account leak
        this.username = ''
        this.avatarUrl = ''
        this.avatarData = ''
        profileCooldownUntil = 0
        profileLoadPromise = null
        profileLoadPromiseToken = ''
        return
      }

      // Einmalige Migration: Daten aus alten generischen Schlüsseln übernehmen,
      // falls für diese UID noch keine UID-spezifischen Einträge existieren.
      for (const base of ['app-username', 'app-avatar-url', 'app-avatar-data']) {
        try {
          const generic = localStorage.getItem(base)
          const specific = localStorage.getItem(pKey(newUid, base))
          if (generic && !specific) {
            localStorage.setItem(pKey(newUid, base), generic)
            localStorage.removeItem(base)
          }
        } catch {}
      }

      // Account-Daten aus UID-Slot laden
      this.username = lsGet(newUid, 'app-username')
      this.avatarUrl = lsGet(newUid, 'app-avatar-url')
      this.avatarData = lsGet(newUid, 'app-avatar-data')

      // Cooldown zurücksetzen für neuen Account
      profileCooldownUntil = 0
      profileLoadPromise = null
      profileLoadPromiseToken = ''
    },

    async loadProfile(token, options = {}) {
      if (!token) {
        return {
          username: this.username || '',
          avatarUrl: this.avatarUrl || ''
        }
      }

      const force = options?.force === true
      const tokenKey = String(token).slice(-16)

      if (profileLoadPromise && profileLoadPromiseToken === tokenKey) {
        return profileLoadPromise
      }

      if (!force && profileCooldownUntil > Date.now()) {
        return {
          username: this.username || '',
          avatarUrl: this.avatarUrl || ''
        }
      }

      profileLoadPromiseToken = tokenKey
      profileLoadPromise = (async () => {
        try {
          const profile = await fetchAccountProfile(token)
          const username = String(profile?.username ?? '').trim().slice(0, 24)
          const avatarUrl = String(profile?.avatarUrl ?? '').trim()
          this.username = username
          this.avatarUrl = avatarUrl
          profileCooldownUntil = 0
          lsSet(this._uid, 'app-username', username)
          lsSet(this._uid, 'app-avatar-url', avatarUrl)
          return profile
        } catch (error) {
          if (isTransientRequestError(error)) {
            profileCooldownUntil = Date.now() + PROFILE_REQUEST_COOLDOWN_MS
          }
          logger.warn('⚠️ [settingsStore] loadProfile fallback to cached local values:', {
            message: error?.message,
            statusCode: error?.statusCode || 0,
            code: error?.context?.originalError?.code || null
          })
          return {
            username: this.username || '',
            avatarUrl: this.avatarUrl || ''
          }
        }
      })().finally(() => {
        profileLoadPromise = null
        profileLoadPromiseToken = ''
      })

      return profileLoadPromise
    },

    async saveUsername(token, name) {
      const clean = String(name ?? '').trim().slice(0, 24)
      this.username = clean
      lsSet(this._uid, 'app-username', clean)

      if (!token) return { username: clean }
      const updated = await updateAccountProfile(token, { username: clean })
      const serverName = String(updated?.username ?? clean).trim().slice(0, 24)
      this.username = serverName
      lsSet(this._uid, 'app-username', serverName)
      return updated
    },

    setAvatarUrl(url) {
      const clean = String(url ?? '').trim()
      this.avatarUrl = clean
      lsSet(this._uid, 'app-avatar-url', clean)
      // Gecachten DataURL löschen wenn Avatar zurückgesetzt wird
      if (!clean) {
        this.avatarData = ''
        lsSet(this._uid, 'app-avatar-data', '')
      }
    },

    setAvatarData(dataUrl) {
      const clean = String(dataUrl ?? '').trim()
      this.avatarData = clean
      lsSet(this._uid, 'app-avatar-data', clean)
    },

    // Backwards-compat: keep old call sites working
    setUsername(name) {
      const clean = String(name ?? '').trim().slice(0, 24)
      this.username = clean
      lsSet(this._uid, 'app-username', clean)
    },
    setLanguage(locale) {
      this.language = locale
      try { localStorage.setItem('app-lang', locale) } catch {}
    },
    setWeeklyGoal(val) {
      const v = Number.parseInt(val, 10)
      // Clamp auf sinnvollen Bereich
      const clamped = Number.isFinite(v) ? Math.max(1, Math.min(14, v)) : 4
      this.weeklyGoal = clamped
      try {
        localStorage.setItem('weekly-goal', String(clamped))
      } catch {}
    }
  }
})
