// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSwipeTarget, isSwipeBlockedTarget, createSwipeTracker } from '../swipeNavigation.js'

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

describe('createSwipeTracker', () => {
  const touch = (x, y, count = 1) => ({ target: document.body, touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) })
  function make(over = {}) {
    let t = 0
    const clock = { advance: (ms) => { t += ms } }
    const tracker = createSwipeTracker({ getPaths: () => paths, getCurrentPath: () => '/stats', getViewportWidth: () => 390, now: () => t, ...over })
    return { tracker, clock }
  }
  const swipe = (tracker, clock, ms = 150, activeElement = null, from = touch(200, 400), to = touch(100, 405)) => {
    tracker.start(from, activeElement)
    clock.advance(ms)
    tracker.move(to)
    return tracker.end()
  }

  it('gültiger schneller Wisch liefert die Zielseite', () => {
    const { tracker, clock } = make()
    expect(swipe(tracker, clock)).toBe('/exercises')
  })

  it('Gegenprobe: zu langsam (Scrollen/Ziehen) wechselt nicht', () => {
    const { tracker, clock } = make()
    expect(swipe(tracker, clock, 1200)).toBeNull()
  })

  it('Grenze: genau 700 ms zählt nicht mehr, 699 ms noch', () => {
    const a = make()
    expect(swipe(a.tracker, a.clock, 700)).toBeNull()
    const b = make()
    expect(swipe(b.tracker, b.clock, 699)).toBe('/exercises')
  })

  it('Gegenprobe: schräge Bewegung (70 px quer, 30 px senkrecht) wechselt nicht', () => {
    const { tracker, clock } = make()
    expect(swipe(tracker, clock, 150, null, touch(200, 400), touch(130, 430))).toBeNull()
  })

  it('Gegenprobe: zwei Finger (Zoom), auch erst während der Bewegung, wechseln nicht', () => {
    const { tracker, clock } = make()
    expect(swipe(tracker, clock, 150, null, touch(200, 400, 2))).toBeNull()
    tracker.start(touch(200, 400))
    tracker.move(touch(100, 400, 2))
    expect(tracker.end()).toBeNull()
  })

  it('Gegenprobe: abgebrochene Geste (touchcancel) wechselt nicht', () => {
    const { tracker } = make()
    tracker.start(touch(200, 400))
    tracker.move(touch(100, 400))
    tracker.cancel()
    expect(tracker.end()).toBeNull()
  })

  it('Gegenprobe: offene Tastatur (Eingabefeld hat Fokus) wechselt nicht', () => {
    const { tracker, clock } = make()
    const input = document.createElement('input')
    expect(swipe(tracker, clock, 150, input)).toBeNull()
  })

  it('Gegenprobe: laufende Navigation (zweiter Wisch zu früh) wird ignoriert', () => {
    const { tracker, clock } = make({ isBusy: () => true })
    expect(swipe(tracker, clock)).toBeNull()
  })

  it('Gegenprobe: Unterseite und offene Auswahlliste wechseln nicht', () => {
    const { tracker, clock } = make({ getCurrentPath: () => '/plans/1' })
    expect(swipe(tracker, clock)).toBeNull()
    document.body.innerHTML = '<div role="listbox"><span id="o"></span></div>'
    const { tracker: t2, clock: c2 } = make()
    expect(swipe(t2, c2, 150, null, { target: document.getElementById('o'), touches: [{ clientX: 200, clientY: 400 }] })).toBeNull()
  })
})
