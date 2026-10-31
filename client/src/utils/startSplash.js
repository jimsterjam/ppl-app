// Startanimation (index.html, #start-splash): läuft ohne das JS-Bundle. Hier wird sie nach dem Start der App
// ausgeblendet - frühestens, wenn sie ausgespielt hat und das fertige Logo kurz stand.
const MIN_VISIBLE_MS = 2400
const MIN_VISIBLE_REDUCED_MOTION_MS = 400
const FADE_MS = 300

let dismissed = false

export function dismissStartSplash() {
  if (dismissed || typeof document === 'undefined') return
  dismissed = true
  const el = document.getElementById('start-splash')
  if (!el) return
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const minMs = reduced ? MIN_VISIBLE_REDUCED_MOTION_MS : MIN_VISIBLE_MS
  const started = Number(window.__splashStart) || Date.now()
  const wait = Math.max(0, started + minMs - Date.now())
  setTimeout(() => {
    el.classList.add('is-leaving')
    setTimeout(() => el.remove(), FADE_MS + 50)
  }, wait)
}
