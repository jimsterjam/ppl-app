// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScrollLock, canScrollInside, __resetScrollLockForTests } from '../useScrollLock'

// iOS/WKWebView scrollt trotz `overflow: hidden` am body weiter (Paul 11.11.). Die Sperre fängt Wischbewegungen ab,
// außer in scrollbaren Bereichen eines Fensters, die in Wischrichtung noch Platz haben.
function touch(type, target, y) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  event.touches = [{ clientY: y }]
  target.dispatchEvent(event)
  return event
}
/** Finger von y0 nach y1 bewegen; liefert das touchmove-Ereignis. */
const swipe = (target, y0, y1) => (touch('touchstart', target, y0), touch('touchmove', target, y1))

function scrollable(el, { scrollHeight = 500, clientHeight = 200, scrollTop = 100 } = {}) {
  el.style.overflowY = 'auto'
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  el.scrollTop = scrollTop
  return el
}
const $ = (id) => document.getElementById(id)

describe('useScrollLock', () => {
  beforeEach(() => {
    __resetScrollLockForTests()
    document.body.innerHTML = `
      <main id="page"><p id="text">Seite</p><div id="pagelist"><p id="pageitem">Liste der Seite</p></div></main>
      <div id="modal" style="position: fixed"><div id="list"><p id="item">Eintrag</p></div></div>`
    document.body.removeAttribute('style')
    document.documentElement.removeAttribute('style')
    window.scrollTo = vi.fn()
  })

  it('Seite und Fensterhintergrund: abgefangen; Liste im Fenster mit Platz: scrollt', () => {
    scrollable($('list'))
    const { lock, unlock } = useScrollLock()
    lock()
    expect(swipe($('text'), 300, 250).defaultPrevented).toBe(true)
    expect(swipe($('modal'), 300, 250).defaultPrevented).toBe(true)
    expect(swipe($('item'), 300, 250).defaultPrevented).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')
    unlock()
    expect(swipe($('text'), 300, 250).defaultPrevented).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('Liste im Seiteninhalt hinter dem Fenster scrollt nicht (Copilot-Review #175)', () => {
    scrollable($('pagelist'))
    useScrollLock().lock()
    expect(swipe($('pageitem'), 300, 250).defaultPrevented).toBe(true)
  })

  it('Liste im Fenster am Ende: Wischen über das Ende hinaus wird abgefangen (kein Weiterreichen an die Seite)', () => {
    useScrollLock().lock()
    scrollable($('list'), { scrollTop: 0 })
    expect(swipe($('item'), 200, 260).defaultPrevented).toBe(true) // ganz oben, Finger nach unten
    expect(swipe($('item'), 260, 200).defaultPrevented).toBe(false) // ganz oben, Finger nach oben: Platz
    scrollable($('list'), { scrollTop: 300 }) // 300 + 200 = 500: ganz unten
    expect(swipe($('item'), 260, 200).defaultPrevented).toBe(true)
    expect(swipe($('item'), 200, 260).defaultPrevented).toBe(false)
  })

  it('verschiebt die Seite nicht (kein fixierter body, keine Scroll-Wiederherstellung)', () => {
    const { lock, unlock } = useScrollLock()
    lock()
    expect(document.body.style.position).toBe('')
    unlock()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('Liste ohne Überlauf zählt nicht als scrollbar', () => {
    scrollable($('list'), { scrollHeight: 200, clientHeight: 200, scrollTop: 0 })
    expect(canScrollInside($('item'), -10)).toBe(false)
  })

  it('zwei offene Fenster: erst das letzte Schließen gibt frei; doppeltes Sperren zählt einmal', () => {
    const a = useScrollLock()
    const b = useScrollLock()
    a.lock()
    a.lock()
    b.lock()
    a.unlock()
    expect(swipe($('text'), 300, 250).defaultPrevented).toBe(true)
    b.unlock()
    expect(swipe($('text'), 300, 250).defaultPrevented).toBe(false)
  })
})
