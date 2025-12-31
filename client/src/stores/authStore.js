import { defineStore } from 'pinia'
import { logger } from '@/utils/logger'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    idToken: null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    uid: (state) => state.user?.uid || null,
  },
  actions: {
    setUser(user, idToken = null) {
      logger.debug('[authStore] setUser called with user:', user?.uid)
      this.user = user
      this.idToken = idToken || this.idToken
      this.initialized = true
    },
    clearUser() {
      logger.debug('[authStore] clearUser called')
      this.user = null
      this.idToken = null
      this.initialized = true
    },
  },
})
