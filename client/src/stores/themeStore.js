import { defineStore } from 'pinia'

const THEME_KEY = 'theme'
const THEME_ACCENT_KEY = 'theme-accent'
const ACCENT_MODES = ['lime', 'ocean', 'violet', 'sunset']

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  // Erstinstallation (nichts gespeichert): immer dunkel + Lime (Absprache Paul 12.10.), unabhängig von der
  // System-Einstellung - wirkt hochwertiger. Der Nutzer stellt es danach selbst um.
  return 'dark'
}

function getInitialAccent() {
  try {
    const saved = localStorage.getItem(THEME_ACCENT_KEY)
    if (ACCENT_MODES.includes(saved)) return saved
  } catch {}
  return 'lime'
}

function applyTheme(theme, accent = 'lime') {
  const t = theme === 'light' ? 'light' : 'dark'
  const a = ACCENT_MODES.includes(accent) ? accent : 'lime'
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.setAttribute('data-accent', a)
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: getInitialTheme(),
    colorMode: getInitialAccent()
  }),
  actions: {
    setTheme(t) {
      const v = t === 'light' ? 'light' : 'dark'
      this.theme = v
      try { localStorage.setItem(THEME_KEY, v) } catch {}
      applyTheme(v, this.colorMode)
    },
    setColorMode(mode) {
      const v = ACCENT_MODES.includes(mode) ? mode : 'lime'
      this.colorMode = v
      try { localStorage.setItem(THEME_ACCENT_KEY, v) } catch {}
      applyTheme(this.theme, v)
    },
    toggle() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    applyCurrent() {
      applyTheme(this.theme, this.colorMode)
    }
  }
})
