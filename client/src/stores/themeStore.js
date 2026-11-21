import { defineStore } from 'pinia'
import { readPref, writePref } from '@/utils/userScopedStorage'
import { CARD_TONES, DEFAULT_CARD_TONE } from '@/config/cardTones'

const THEME_KEY = 'theme'
const THEME_ACCENT_KEY = 'theme-accent'
const THEME_CARD_TONE_KEY = 'theme-card-tone'
// Reihenfolge = Reihenfolge in den Einstellungen. Jede Farbe braucht Regeln in style.css (dunkel UND hell) und die
// Texte settings.colorMode<Name> (DE+EN) - das prüft accentColors.test.js.
export const ACCENT_MODES = ['lime', 'ocean', 'violet', 'sunset', 'aqua', 'gold', 'chalk']

function getInitialTheme() {
  try {
    const saved = readPref(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  // Erstinstallation (nichts gespeichert): immer dunkel + Lime (Absprache Jimmy 12.10.), unabhängig von der
  // System-Einstellung - wirkt hochwertiger. Der Nutzer stellt es danach selbst um.
  return 'dark'
}

function getInitialAccent() {
  try {
    const saved = readPref(THEME_ACCENT_KEY)
    if (ACCENT_MODES.includes(saved)) return saved
  } catch {}
  return 'lime'
}

function getInitialCardTone() {
  try {
    const saved = readPref(THEME_CARD_TONE_KEY)
    if (CARD_TONES.includes(saved)) return saved
  } catch {}
  return DEFAULT_CARD_TONE
}

function applyTheme(theme, accent = 'lime', cardTone = DEFAULT_CARD_TONE) {
  const t = theme === 'light' ? 'light' : 'dark'
  const a = ACCENT_MODES.includes(accent) ? accent : 'lime'
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.setAttribute('data-accent', a)
  document.documentElement.setAttribute('data-card-tone', CARD_TONES.includes(cardTone) ? cardTone : DEFAULT_CARD_TONE)
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: getInitialTheme(),
    colorMode: getInitialAccent(),
    cardTone: getInitialCardTone()
  }),
  actions: {
    setTheme(t) {
      const v = t === 'light' ? 'light' : 'dark'
      this.theme = v
      writePref(THEME_KEY, v)
      applyTheme(v, this.colorMode, this.cardTone)
    },
    setColorMode(mode) {
      const v = ACCENT_MODES.includes(mode) ? mode : 'lime'
      this.colorMode = v
      writePref(THEME_ACCENT_KEY, v)
      applyTheme(this.theme, v, this.cardTone)
    },
    setCardTone(tone) {
      const v = CARD_TONES.includes(tone) ? tone : DEFAULT_CARD_TONE
      this.cardTone = v
      writePref(THEME_CARD_TONE_KEY, v)
      applyTheme(this.theme, this.colorMode, v)
    },
    toggle() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    /** Nach Konto-Wechsel/Abmeldung: Werte des aktiven Kontos laden, ohne eigene Werte gelten die Standardwerte. */
    reloadForUser() {
      this.theme = getInitialTheme()
      this.colorMode = getInitialAccent()
      this.cardTone = getInitialCardTone()
      applyTheme(this.theme, this.colorMode, this.cardTone)
    },
    applyCurrent() {
      applyTheme(this.theme, this.colorMode, this.cardTone)
    }
  }
})
