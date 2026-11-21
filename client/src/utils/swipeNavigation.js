// Wischen zwischen den Hauptseiten (Tab-Leiste, siehe BottomNav.vue). Ausgelagert, damit die Regeln ohne Vue testbar sind.
//
// Ein Wisch zählt nur, wenn er deutlich waagerecht ist (normales Scrollen darf nie die Seite wechseln), nicht am
// Bildschirmrand beginnt (iOS nutzt den linken Rand für "Zurück") und nicht auf Elementen mit eigener Wischgeste liegt.

// Mindestweg in Pixeln und Verhältnis waagerecht : senkrecht.
export const SWIPE_MIN_DISTANCE = 60
export const SWIPE_DIRECTION_RATIO = 2
// Wische, die so nah am linken/rechten Rand beginnen, gehören dem System.
export const SWIPE_EDGE_ZONE = 24

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

const INTERACTIVE = 'input, textarea, select, [contenteditable="true"], [data-no-swipe-nav]'

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
