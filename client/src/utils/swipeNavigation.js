// Wischen zwischen den Hauptseiten (Tab-Leiste, siehe BottomNav.vue). Ausgelagert, damit die Regeln ohne Vue testbar sind.
//
// Ein Wisch zählt nur, wenn er deutlich waagerecht ist (normales Scrollen darf nie die Seite wechseln), nicht am
// Bildschirmrand beginnt (iOS nutzt den linken Rand für "Zurück") und nicht auf Elementen mit eigener Wischgeste liegt.

// Mindestweg in Pixeln und Verhältnis waagerecht : senkrecht.
export const SWIPE_MIN_DISTANCE = 60
export const SWIPE_DIRECTION_RATIO = 3
// Wische, die so nah am linken/rechten Rand beginnen, gehören dem System.
export const SWIPE_EDGE_ZONE = 24
// Längere, langsame Bewegungen sind Scrollen oder Ziehen, kein Wisch.
export const SWIPE_MAX_DURATION_MS = 700

/**
 * Zielseite eines Wischs, oder null (kein gültiger Wisch, Rand der Reihe erreicht, aktuelle Seite nicht in der Reihe).
 * Wisch nach links (Finger nach links) = nächste Seite, nach rechts = vorherige.
 * @param {{startX:number,startY:number,endX:number,endY:number,viewportWidth:number,paths:string[],currentPath:string}} s
 */
export function resolveSwipeTarget({ startX, startY, endX, endY, viewportWidth, paths, currentPath }) {
  const dx = endX - startX
  const dy = endY - startY
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return null
  if (startX < SWIPE_EDGE_ZONE || startX > viewportWidth - SWIPE_EDGE_ZONE) return null
  const index = paths.indexOf(currentPath)
  if (index === -1) return null
  const next = index + (dx < 0 ? 1 : -1)
  return next >= 0 && next < paths.length ? paths[next] : null
}

// Eigene Wischgesten markieren sich mit data-no-swipe-nav (z. B. der Kalender in der Statistik); offene Auswahllisten sperren ebenfalls.
const INTERACTIVE = 'input, textarea, select, [contenteditable="true"], [data-no-swipe-nav], [role="listbox"], [role="menu"], [aria-expanded="true"]'

/**
 * Liegt der Wisch auf etwas, das selbst wischt oder scrollt? Eingabefelder, markierte Bereiche (Kalender),
 * waagerecht scrollbare Bereiche und feste Ebenen (Fenster, Tab-Leiste, Zeitleisten).
 * @param {EventTarget|null} target
 */
export function isSwipeBlockedTarget(target) {
  let el = target instanceof Element ? target : target?.parentElement
  if (!el) return true
  if (el.closest(INTERACTIVE)) return true
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = window.getComputedStyle(el)
    if (style.position === 'fixed') return true
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

/**
 * Verfolgt eine Wischgeste über touchstart/-move/-end. Gibt beim Ende die Zielseite oder null zurück.
 * @param {{getPaths:()=>string[], getCurrentPath:()=>string, getViewportWidth:()=>number, isBusy?:()=>boolean, now?:()=>number}} deps
 */
export function createSwipeTracker({ getPaths, getCurrentPath, getViewportWidth, isBusy = () => false, now = () => Date.now() }) {
  let gesture = null
  return {
    start(event, activeElement = null) {
      gesture = null
      if (event.touches.length !== 1) return
      if (isBusy()) return // eine Navigation läuft noch
      if (!getPaths().includes(getCurrentPath())) return
      if (activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return // Tastatur offen
      if (isSwipeBlockedTarget(event.target)) return
      const touch = event.touches[0]
      gesture = { startX: touch.clientX, startY: touch.clientY, endX: touch.clientX, endY: touch.clientY, at: now() }
    },
    move(event) {
      if (!gesture) return
      if (event.touches.length !== 1) { gesture = null; return } // zweiter Finger (Zoom) bricht ab
      gesture.endX = event.touches[0].clientX
      gesture.endY = event.touches[0].clientY
    },
    end() {
      const g = gesture
      gesture = null
      if (!g || now() - g.at >= SWIPE_MAX_DURATION_MS) return null
      return resolveSwipeTarget({ ...g, viewportWidth: getViewportWidth(), paths: getPaths(), currentPath: getCurrentPath() })
    },
    cancel() {
      gesture = null
    }
  }
}
