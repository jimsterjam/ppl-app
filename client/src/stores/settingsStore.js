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

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    language: (() => {
      try { return localStorage.getItem('app-lang') || null } catch { return null }
    })(),
    username: (() => {
      try { return localStorage.getItem('app-username') || '' } catch { return '' }
    })(),
    avatarUrl: (() => {
      try { return localStorage.getItem('app-avatar-url') || '' } catch { return '' }
    })(),
    weeklyGoal: (() => {
      const envDefault = Number.parseInt(import.meta.env.VITE_DEFAULT_WEEKLY_GOAL || '', 10)
      const fallback = Number.isFinite(envDefault) && envDefault > 0 ? envDefault : 4
      const stored = Number.parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('weekly-goal')) || '', 10)
      return Number.isFinite(stored) && stored > 0 ? stored : fallback
    })()
  }),
  actions: {
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
          try {
            if (username) localStorage.setItem('app-username', username)
            else localStorage.removeItem('app-username')
          } catch {}
          try {
            if (avatarUrl) localStorage.setItem('app-avatar-url', avatarUrl)
            else localStorage.removeItem('app-avatar-url')
          } catch {}
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
      try {
        if (clean) localStorage.setItem('app-username', clean)
        else localStorage.removeItem('app-username')
      } catch {}

      if (!token) return { username: clean }
      const updated = await updateAccountProfile(token, { username: clean })
      const serverName = String(updated?.username ?? clean).trim().slice(0, 24)
      this.username = serverName
      try {
        if (serverName) localStorage.setItem('app-username', serverName)
        else localStorage.removeItem('app-username')
      } catch {}
      return updated
    },

    setAvatarUrl(url) {
      const clean = String(url ?? '').trim()
      this.avatarUrl = clean
      try {
        if (clean) localStorage.setItem('app-avatar-url', clean)
        else localStorage.removeItem('app-avatar-url')
      } catch {}
    },

    // Backwards-compat: keep old call sites working
    setUsername(name) {
      const clean = String(name ?? '').trim().slice(0, 24)
      this.username = clean
      try {
        if (clean) localStorage.setItem('app-username', clean)
        else localStorage.removeItem('app-username')
      } catch {}
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
