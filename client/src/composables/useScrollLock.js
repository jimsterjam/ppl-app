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
let previousOverflow = ''
let previousPaddingRight = ''

function applyLock() {
  if (typeof document === 'undefined') return
  const body = document.body
  previousOverflow = body.style.overflow
  previousPaddingRight = body.style.paddingRight

  // Scrollbar-Breite kompensieren, damit der Seiteninhalt beim Sperren
  // nicht "springt" (nur relevant auf Desktop mit sichtbarer Scrollbar).
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
  body.style.overflow = 'hidden'
}

function releaseLock() {
  if (typeof document === 'undefined') return
  const body = document.body
  body.style.overflow = previousOverflow
  body.style.paddingRight = previousPaddingRight
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
