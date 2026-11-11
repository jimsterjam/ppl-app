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
// Darum den body fixieren und an der aktuellen Scroll-Position festhalten; beim Freigeben genau dorthin zurück.
// Scroll-Bereiche innerhalb des Fensters (z. B. Listen, Drehräder) scrollen weiter.
const LOCKED_STYLES = ['overflow', 'paddingRight', 'position', 'top', 'left', 'right', 'width']

function applyLock() {
  if (typeof document === 'undefined') return
  const body = document.body
  const scrollY = window.scrollY || window.pageYOffset || 0
  saved = { scrollY, styles: Object.fromEntries(LOCKED_STYLES.map((k) => [k, body.style[k]])) }

  // Scrollbar-Breite kompensieren, damit der Seiteninhalt beim Sperren
  // nicht "springt" (nur relevant auf Desktop mit sichtbarer Scrollbar).
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
}

function releaseLock() {
  if (typeof document === 'undefined' || !saved) return
  const body = document.body
  for (const key of LOCKED_STYLES) body.style[key] = saved.styles[key] || ''
  const { scrollY } = saved
  saved = null
  window.scrollTo(0, scrollY)
}

/** Nur für Tests: Zustand zurücksetzen. */
export function __resetScrollLockForTests() {
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
