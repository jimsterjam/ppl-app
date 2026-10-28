import { defineStore } from 'pinia'

// Sprechblasen (Absprache Paul 29.10.): kurze Hinweise, die beim ersten Besuch einer Seite auf ein Bedienelement zeigen
// (Wochenstreifen, Heute, Übung wechseln, Reihenfolge, Timer). Jede Blase erscheint einmal; „Verstanden“ merkt sie sich.
// Der Stand liegt je Konto lokal auf dem Gerät (localStorage, gleiches Schlüssel-Muster wie onboardingStore.js) - es
// gibt bewusst keinen Server-Abgleich: Das Zurücksetzen in den Einstellungen wirkt sofort und ohne Netz.
const KEY = 'coach-marks'

function storageKey(uid) {
  return uid ? `${KEY}:${uid}` : KEY
}

function load(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(uid)) || 'null')
    if (!raw || typeof raw !== 'object') return { enabled: true, dismissed: [] }
    return {
      enabled: raw.enabled !== false,
      dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((id) => typeof id === 'string').slice(0, 50) : []
    }
  } catch {
    return { enabled: true, dismissed: [] }
  }
}

export const useCoachMarkStore = defineStore('coachMarks', {
  state: () => ({ uid: '', enabled: true, dismissed: [] }),
  actions: {
    // Aus main.js nach jedem Login/Logout aufrufen (wie onboardingStore.switchUser).
    switchUser(uid) {
      this.uid = String(uid || '')
      const loaded = load(this.uid)
      this.enabled = loaded.enabled
      this.dismissed = loaded.dismissed
    },
    persist() {
      try {
        localStorage.setItem(storageKey(this.uid), JSON.stringify({ enabled: this.enabled, dismissed: this.dismissed }))
      } catch {}
    },
    isDismissed(id) {
      return this.dismissed.includes(id)
    },
    dismiss(id) {
      if (!id || this.dismissed.includes(id)) return
      this.dismissed = [...this.dismissed, id]
      this.persist()
    },
    setEnabled(value) {
      this.enabled = value === true
      this.persist()
    },
    /** Alle Blasen beim nächsten Besuch der jeweiligen Seite erneut zeigen (schaltet Hinweise auch wieder ein). */
    resetAll() {
      this.dismissed = []
      this.enabled = true
      this.persist()
    }
  }
})
