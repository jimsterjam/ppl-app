import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    weeklyGoal: (() => {
      const envDefault = Number.parseInt(import.meta.env.VITE_DEFAULT_WEEKLY_GOAL || '', 10)
      const fallback = Number.isFinite(envDefault) && envDefault > 0 ? envDefault : 4
      const stored = Number.parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('weekly-goal')) || '', 10)
      return Number.isFinite(stored) && stored > 0 ? stored : fallback
    })()
  }),
  actions: {
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
