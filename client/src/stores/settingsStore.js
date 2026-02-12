import { defineStore } from 'pinia'
import { fetchAccountProfile, updateAccountProfile } from '@/api/account'

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
    async loadProfile(token) {
      if (!token) return null
      const profile = await fetchAccountProfile(token)
      const username = String(profile?.username ?? '').trim().slice(0, 24)
      const avatarUrl = String(profile?.avatarUrl ?? '').trim()
      this.username = username
      this.avatarUrl = avatarUrl
      try {
        if (username) localStorage.setItem('app-username', username)
        else localStorage.removeItem('app-username')
      } catch {}
      try {
        if (avatarUrl) localStorage.setItem('app-avatar-url', avatarUrl)
        else localStorage.removeItem('app-avatar-url')
      } catch {}
      return profile
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
