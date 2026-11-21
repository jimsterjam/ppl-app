// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSwipeTarget, isSwipeBlockedTarget } from '../swipeNavigation.js'

const paths = ['/dashboard', '/stats', '/exercises', '/faqs', '/settings']
const base = { startX: 200, startY: 400, endX: 100, endY: 410, viewportWidth: 390, paths, currentPath: '/stats' }

describe('resolveSwipeTarget', () => {
  it('Wisch nach links = nächste Seite, nach rechts = vorherige', () => {
    expect(resolveSwipeTarget(base)).toBe('/exercises')
    expect(resolveSwipeTarget({ ...base, endX: 300 })).toBe('/dashboard')
  })

  it('Gegenprobe: erste Seite nach rechts und letzte nach links tun nichts', () => {
    expect(resolveSwipeTarget({ ...base, currentPath: '/dashboard', endX: 300 })).toBeNull()
    expect(resolveSwipeTarget({ ...base, currentPath: '/settings' })).toBeNull()
  })

  it('Gegenprobe: zu kurz oder überwiegend senkrecht (Scrollen) wechselt nicht', () => {
    expect(resolveSwipeTarget({ ...base, endX: 160 })).toBeNull()
    expect(resolveSwipeTarget({ ...base, endX: 100, endY: 520 })).toBeNull()
  })

  it('Gegenprobe: Start am Bildschirmrand (iOS-Zurück) wechselt nicht, auch rechts', () => {
    expect(resolveSwipeTarget({ ...base, startX: 10, endX: 120 })).toBeNull()
    expect(resolveSwipeTarget({ ...base, startX: 380, endX: 250 })).toBeNull()
  })

  it('Gegenprobe: Unterseiten (nicht in der Reihe) wechseln nicht', () => {
    expect(resolveSwipeTarget({ ...base, currentPath: '/plans/123' })).toBeNull()
  })

  it('ohne FAQ (laufendes Workout) ist Übungen → Einstellungen der Nachbar', () => {
    const noFaq = paths.filter((p) => p !== '/faqs')
    expect(resolveSwipeTarget({ ...base, paths: noFaq, currentPath: '/exercises' })).toBe('/settings')
  })
})

describe('isSwipeBlockedTarget', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('freie Fläche ist erlaubt', () => {
    document.body.innerHTML = '<div id="a"><p id="t">Text</p></div>'
    expect(isSwipeBlockedTarget(document.getElementById('t'))).toBe(false)
  })

  it('Gegenprobe: Eingabefeld, markierter Bereich (Kalender) und feste Ebene sind gesperrt', () => {
    document.body.innerHTML = '<input id="i"><div data-no-swipe-nav><span id="c"></span></div><div style="position:fixed"><span id="f"></span></div>'
    expect(isSwipeBlockedTarget(document.getElementById('i'))).toBe(true)
    expect(isSwipeBlockedTarget(document.getElementById('c'))).toBe(true)
    expect(isSwipeBlockedTarget(document.getElementById('f'))).toBe(true)
  })

  it('Gegenprobe: waagerecht scrollbarer Bereich ist gesperrt, ohne Überlauf nicht', () => {
    document.body.innerHTML = '<div id="s" style="overflow-x:auto"><span id="x"></span></div>'
    const box = document.getElementById('s')
    Object.defineProperty(box, 'scrollWidth', { value: 500, configurable: true })
    Object.defineProperty(box, 'clientWidth', { value: 300, configurable: true })
    expect(isSwipeBlockedTarget(document.getElementById('x'))).toBe(true)
    Object.defineProperty(box, 'scrollWidth', { value: 300, configurable: true })
    expect(isSwipeBlockedTarget(document.getElementById('x'))).toBe(false)
  })

  it('ohne Ziel gesperrt', () => {
    expect(isSwipeBlockedTarget(null)).toBe(true)
  })
})
