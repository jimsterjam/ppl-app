// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScrollLock, canScrollInside, __resetScrollLockForTests } from '../useScrollLock'

// iOS/WKWebView scrollt trotz `overflow: hidden` am body weiter (Paul 11.11.). Die Sperre fängt Wischbewegungen
// außerhalb scrollbarer Bereiche ab, ohne die Seite zu verschieben (window.scrollY bleibt).
function touchMoveOn(target) {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  event.touches = [{}]
  target.dispatchEvent(event)
  return event
}

function scrollable(el, { scrollHeight = 500, clientHeight = 200 } = {}) {
  el.style.overflowY = 'auto'
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  return el
}

describe('useScrollLock', () => {
  beforeEach(() => {
    __resetScrollLockForTests()
    document.body.innerHTML = '<main id="page"><p id="text">Seite</p></main><div id="modal"><div id="list"><p id="item">Eintrag</p></div></div>'
    document.body.removeAttribute('style')
    document.documentElement.removeAttribute('style')
    window.scrollTo = vi.fn()
  })

  it('Wischen auf der Seite oder dem Fensterhintergrund wird abgefangen, in scrollbaren Listen nicht', () => {
    scrollable(document.getElementById('list'))
    const { lock, unlock } = useScrollLock()
    lock()
    expect(touchMoveOn(document.getElementById('text')).defaultPrevented).toBe(true)
    expect(touchMoveOn(document.getElementById('modal')).defaultPrevented).toBe(true)
    expect(touchMoveOn(document.getElementById('item')).defaultPrevented).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overscrollBehavior).toBe('none')
    unlock()
    expect(touchMoveOn(document.getElementById('text')).defaultPrevented).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overscrollBehavior).toBe('')
  })

  it('verschiebt die Seite nicht (kein fixierter body, keine Scroll-Wiederherstellung)', () => {
    const { lock, unlock } = useScrollLock()
    lock()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    unlock()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('Liste ohne Überlauf zählt nicht als scrollbar', () => {
    scrollable(document.getElementById('list'), { scrollHeight: 200, clientHeight: 200 })
    expect(canScrollInside(document.getElementById('item'))).toBe(false)
  })

  it('zwei offene Fenster: erst das letzte Schließen gibt frei; doppeltes Sperren zählt einmal', () => {
    const a = useScrollLock()
    const b = useScrollLock()
    a.lock()
    a.lock()
    b.lock()
    a.unlock()
    expect(touchMoveOn(document.getElementById('text')).defaultPrevented).toBe(true)
    b.unlock()
    expect(touchMoveOn(document.getElementById('text')).defaultPrevented).toBe(false)
  })
})
