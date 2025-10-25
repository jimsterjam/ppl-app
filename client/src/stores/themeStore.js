import { defineStore } from 'pinia'

const THEME_KEY = 'theme'

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return getSystemTheme()
}

function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', t)
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: getInitialTheme()
  }),
  actions: {
    setTheme(t) {
      const v = t === 'light' ? 'light' : 'dark'
      this.theme = v
      try { localStorage.setItem(THEME_KEY, v) } catch {}
      applyTheme(v)
    },
    toggle() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    applyCurrent() {
      applyTheme(this.theme)
    }
  }
})
