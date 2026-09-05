import { defineStore } from 'pinia'
import { logger } from '@/utils/logger'

const AUTH_STORAGE_KEY = 'auth_user'
const AUTH_TOKEN_EXP_KEY = 'auth_token_exp'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    logger.warn('[authStore] Failed to read stored user:', err)
    return null
  }
}

function readStoredTokenExp() {
  try {
    const raw = localStorage.getItem(AUTH_TOKEN_EXP_KEY)
    const exp = Number(raw)
    return Number.isFinite(exp) ? exp : 0
  } catch (err) {
    logger.warn('[authStore] Failed to read stored token exp:', err)
    return 0
  }
}

function parseTokenExp(token) {
  if (!token || typeof token !== 'string') return 0
  const parts = token.split('.')
  if (parts.length < 2) return 0
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    const json = JSON.parse(decoded)
    return typeof json.exp === 'number' ? json.exp * 1000 : 0
  } catch (err) {
    logger.warn('[authStore] Failed to parse token exp:', err)
    return 0
  }
}

const cachedUser = readStoredUser()
const cachedTokenExp = readStoredTokenExp()

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: cachedUser,
    idToken: null,
    tokenExpiresAt: cachedTokenExp,
    initialized: Boolean(cachedUser),
  }),
  getters: {
    // Sicherheitsfix: bisher reichte irgendein Firebase-User-Objekt im Store, egal ob die
    // E-Mail bestätigt war oder nicht - der Router prüfte für geschützte Routen nur diesen
    // Getter. state.user.emailVerified fehlte bei bereits gecachten Sessions vor diesem Fix
    // (undefined), deshalb hier bewusst "!== false" statt "=== true": nur ein EXPLIZIT
    // bekanntes emailVerified=false blockiert, alte gecachte Sessions ohne dieses Feld bleiben
    // unverändert nutzbar, bis der nächste onAuthStateChanged-Callback es nachträgt.
    isAuthenticated: (state) => !!state.user && state.user.emailVerified !== false,
    uid: (state) => state.user?.uid || null,
    isOfflineSessionValid: (state) => !!state.user && Boolean(state.tokenExpiresAt) && Date.now() < state.tokenExpiresAt,
  },
  actions: {
    setUser(user, idToken = null) {
      logger.debug('[authStore] setUser called with user:', user?.uid)
      this.user = user
      this.idToken = idToken || this.idToken
      const expMs = parseTokenExp(idToken)
      if (idToken) {
        this.tokenExpiresAt = expMs || 0
      } else if (expMs) {
        this.tokenExpiresAt = expMs
      }
      this.initialized = true
      try {
        if (user) {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
        if (idToken) {
          if (expMs) {
            localStorage.setItem(AUTH_TOKEN_EXP_KEY, String(expMs))
          } else {
            localStorage.removeItem(AUTH_TOKEN_EXP_KEY)
          }
        } else if (expMs) {
          localStorage.setItem(AUTH_TOKEN_EXP_KEY, String(expMs))
        }
      } catch (err) {
        logger.warn('[authStore] Failed to persist user:', err)
      }
    },
    clearUser() {
      logger.debug('[authStore] clearUser called')
      this.user = null
      this.idToken = null
      this.tokenExpiresAt = 0
      this.initialized = true
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        localStorage.removeItem(AUTH_TOKEN_EXP_KEY)
      } catch (err) {
        logger.warn('[authStore] Failed to clear stored user:', err)
      }
    },
  },
})
