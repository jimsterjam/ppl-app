// Sperrt das Scrollen des Hintergrunds (document.body), solange mindestens
// ein Modal/Overlay geöffnet ist. Nutzt einen globalen Referenzzähler, damit
// mehrere gleichzeitig geöffnete Modals sich beim Schließen nicht gegenseitig
// den Scroll wieder freigeben (z.B. Feedback-Dialog über PostWorkoutSummary).
//
// Verwendung in einer Komponente:
//   import { useScrollLock } from '@/composables/useScrollLock'
//   const { lock, unlock } = useScrollLock()
//   watch(showModal, (open) => (open ? lock() : unlock()))
//   onBeforeUnmount(unlock) // Sicherheitsnetz falls Komponente offen entfernt wird

let lockCount = 0
let saved = null

// iOS/WKWebView ignoriert `overflow: hidden` am body beim Wischen: die Seite scrollte hinter Fenstern weiter (Paul 11.11.).
// Darum zusätzlich Wischbewegungen abfangen, die nicht in einem scrollbaren Bereich des Fensters liegen (Listen,
// Drehräder scrollen weiter), und das Weiterreichen des Scrollens am Ende solcher Bereiche an die Seite unterbinden.
// Bewusst NICHT body fixieren: das setzte window.scrollY auf 0 (gespeicherte Workout-Position), ließ die
// mitlaufende Kopfzeile verschwinden und verschob Seiten bei einem Routenwechsel mit offenem Fenster (Review 11.11.).

function isInOverlay(el) {
  // Fenster und Overlays liegen fest über der Seite (position: fixed, meist per Teleport am body). Listen im
  // Seiteninhalt dahinter gehören nicht dazu und dürfen nicht scrollen (Copilot-Review #175).
  for (let node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (window.getComputedStyle(node).position === 'fixed') return true
  }
  return false
}

/**
 * Darf eine Wischbewegung an dieser Stelle scrollen? Nur in einem senkrecht scrollbaren Bereich eines Fensters, und nur,
 * wenn dieser in Bewegungsrichtung noch Platz hat – am oberen oder unteren Ende reicht iOS das Scrollen sonst an die
 * Seite weiter (`overscroll-behavior` am Dokument hält das bei verschachtelten Bereichen nicht auf; Copilot-Review #175).
 * @param {EventTarget} target
 * @param {number} deltaY Fingerbewegung seit dem letzten Ereignis (> 0: Finger nach unten = Inhalt nach oben)
 */
export function canScrollInside(target, deltaY = 0) {
  let el = target instanceof Element ? target : target?.parentElement
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight && isInOverlay(el)) {
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if (!((deltaY > 0 && atTop) || (deltaY < 0 && atBottom))) return true
      // am Ende: ein äußerer Bereich des Fensters darf weiterscrollen, sonst nichts
    }
    el = el.parentElement
  }
  return false
}

let lastTouchY = null

function onTouchStart(event) {
  lastTouchY = event.touches?.[0]?.clientY ?? null
}

function onTouchMove(event) {
  if (event.touches && event.touches.length > 1) return // Zoom-Gesten nicht stören
  const y = event.touches?.[0]?.clientY
  const deltaY = Number.isFinite(y) && Number.isFinite(lastTouchY) ? y - lastTouchY : 0
  if (Number.isFinite(y)) lastTouchY = y
  if (!canScrollInside(event.target, deltaY)) event.preventDefault()
}

function applyLock() {
  if (typeof document === 'undefined') return
  const body = document.body
  const html = document.documentElement
  saved = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    overscroll: html.style.overscrollBehavior
  }

  // Scrollbar-Breite kompensieren, damit der Seiteninhalt beim Sperren
  // nicht "springt" (nur relevant auf Desktop mit sichtbarer Scrollbar).
  const scrollbarWidth = window.innerWidth - html.clientWidth
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
  body.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
}

function releaseLock() {
  if (typeof document === 'undefined' || !saved) return
  const body = document.body
  body.style.overflow = saved.overflow
  body.style.paddingRight = saved.paddingRight
  document.documentElement.style.overscrollBehavior = saved.overscroll
  document.removeEventListener('touchstart', onTouchStart, { passive: true })
  document.removeEventListener('touchmove', onTouchMove, { passive: false })
  lastTouchY = null
  saved = null
}

/** Nur für Tests: Zustand zurücksetzen. */
export function __resetScrollLockForTests() {
  if (saved) releaseLock()
  lockCount = 0
  saved = null
}

export function useScrollLock() {
  let lockedByThisInstance = false

  function lock() {
    if (lockedByThisInstance) return
    lockedByThisInstance = true
    lockCount += 1
    if (lockCount === 1) applyLock()
  }

  function unlock() {
    if (!lockedByThisInstance) return
    lockedByThisInstance = false
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) releaseLock()
  }

  return { lock, unlock }
}
