// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScrollLock, __resetScrollLockForTests } from '../useScrollLock'

// iOS/WKWebView scrollt trotz `overflow: hidden` am body weiter (Paul 11.11.). Die Sperre fixiert den body und stellt
// die Scroll-Position beim Freigeben wieder her.
describe('useScrollLock', () => {
  beforeEach(() => {
    __resetScrollLockForTests()
    document.body.removeAttribute('style')
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    window.scrollTo = vi.fn()
  })

  it('fixiert den body an der aktuellen Position und stellt sie beim Freigeben wieder her', () => {
    const { lock, unlock } = useScrollLock()
    lock()
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-640px')
    expect(document.body.style.overflow).toBe('hidden')
    unlock()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    expect(document.body.style.overflow).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 640)
  })

  it('zwei offene Fenster: erst das letzte Schließen gibt frei', () => {
    const a = useScrollLock()
    const b = useScrollLock()
    a.lock()
    b.lock()
    a.unlock()
    expect(document.body.style.position).toBe('fixed')
    b.unlock()
    expect(document.body.style.position).toBe('')
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('doppeltes Sperren oder Freigeben derselben Instanz zählt nur einmal', () => {
    const a = useScrollLock()
    a.lock()
    a.lock()
    a.unlock()
    expect(document.body.style.position).toBe('')
    a.unlock()
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })
})
