// Großansicht (Fokus-Modus) über ein Neuladen der Seite hinweg merken: iOS beendet die Web-Ansicht im Hintergrund
// gelegentlich, die Pause läuft danach weiter (utils/restTimerStore), aber die Großansicht war bisher weg und die App
// stand plötzlich in der Übersicht. Gemerkt wird nur, solange die Großansicht aktiv ist; Schließen löscht den Eintrag.
const KEY = 'fbe_focus_state_v1'
// Ein Workout dauert höchstens ein paar Stunden; ältere Einträge gehören zu einem anderen Training.
export const FOCUS_STATE_MAX_AGE_MS = 6 * 60 * 60 * 1000

export function saveFocusState(storage, { workoutId, active, minimized, now = Date.now() }) {
  try {
    if (!active || !workoutId) {
      storage.removeItem(KEY)
      return
    }
    storage.setItem(KEY, JSON.stringify({ workoutId: String(workoutId), minimized: !!minimized, at: now }))
  } catch {}
}

/** @returns {{ minimized: boolean } | null} gemerkter Zustand für genau dieses Workout, sonst null */
export function readFocusState(storage, workoutId, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(KEY) || 'null')
    if (!saved || !workoutId || String(saved.workoutId) !== String(workoutId)) return null
    const age = now - Number(saved.at)
    if (!Number.isFinite(age) || age < 0 || age > FOCUS_STATE_MAX_AGE_MS) return null
    return { minimized: !!saved.minimized }
  } catch {
    return null
  }
}

/**
 * Gemerkten Zustand anwenden: Großansicht öffnen und, falls sie minimiert war, auch die laufenden Timer minimieren.
 * Pause und Übergangs-Stoppuhr steuern ihr Overlay über einen eigenen Minimierungszustand; ohne das erschiene eine
 * zuvor minimierte Pause nach dem Neuladen wieder im Vollbild. (Die Pause vergrößert sich bei <= 10 s von selbst.)
 * @param {{ saved: { minimized: boolean }, focus: object, restTimer: object, transition: object }} stores
 */
export function applyFocusState({ saved, focus, restTimer, transition }) {
  focus.open()
  if (!saved?.minimized) return
  focus.minimize()
  if (restTimer?.isVisible) restTimer.minimize()
  if (transition?.isActive) transition.minimize()
}
