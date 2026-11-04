import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Das Inline-Skript aus index.html (Startanimation nur beim echten App-Start, nicht bei jeder Rückkehr).
const html = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8')
const script = html.match(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/)[0].replace(/<\/?script>/g, '')

function run({ authUser = null, lastAlive = null, launchId = '', lastLaunchId = '', shownAt = null, navType = 'navigate' } = {}) {
  const store = new Map()
  if (authUser !== null) store.set('auth_user', authUser)
  if (lastAlive !== null) store.set('fbe_last_alive', String(lastAlive))
  if (lastLaunchId) store.set('fbe_launch_id', lastLaunchId)
  if (shownAt !== null) store.set('fbe_splash_at', String(shownAt))
  const el = { classList: { add: vi.fn() }, parentNode: { removeChild: vi.fn() } }
  const listeners = {}
  const doc = {
    hidden: false,
    getElementById: (id) => (id === 'start-splash' ? el : null),
    addEventListener: (name, fn) => { listeners[`doc:${name}`] = fn },
    fonts: { load: () => new Promise(() => {}) }
  }
  const win = { __fbeLaunchId: launchId, addEventListener: (name, fn) => { listeners[`win:${name}`] = fn } }
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }
  const perf = { getEntriesByType: () => [{ type: navType }] }
  new Function('document', 'window', 'localStorage', 'setTimeout', 'clearTimeout', 'performance', script)(doc, win, ls, setTimeout, clearTimeout, perf)
  return { el, store, listeners, doc }
}

describe('Startanimation: nur beim App-Start', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('angemeldet: nie, auch nicht beim App-Start nach langer Pause oder neuer Kennung', () => {
    const user = JSON.stringify({ uid: 'u1', email: 'a@b.c' })
    for (const opts of [
      {},
      { lastAlive: Date.now() - 5 * 1000, launchId: 'neu', lastLaunchId: 'alt' },
      { lastAlive: Date.now() - 31 * 60 * 1000 },
      { launchId: 'x', lastLaunchId: 'y', navType: 'navigate' }
    ]) {
      const { el } = run({ authUser: user, ...opts })
      expect(el.parentNode.removeChild).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(700)
      expect(el.classList.add).not.toHaveBeenCalled()
    }
  })

  it('nicht angemeldet (nichts, kaputter oder leerer Eintrag): Animation läuft', () => {
    for (const authUser of [null, 'kaputt{', 'null', '{}', '"text"']) {
      const { el } = run({ authUser })
      expect(el.parentNode.removeChild).not.toHaveBeenCalled()
      vi.advanceTimersByTime(700)
      expect(el.classList.add).toHaveBeenCalledWith('go')
    }
  })

  it('erster Start (nichts gemerkt): Animation läuft', () => {
    const { el } = run()
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
    vi.advanceTimersByTime(700)
    expect(el.classList.add).toHaveBeenCalledWith('go')
  })

  it('ohne Kennung von iOS (z. B. Einspielen fehlgeschlagen): Animation läuft, nie stillschweigend aus', () => {
    const { el } = run({ lastAlive: Date.now() - 5 * 60 * 1000 })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
    vi.advanceTimersByTime(700)
    expect(el.classList.add).toHaveBeenCalledWith('go')
  })

  it('ohne Kennung, lange nicht benutzt: Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 31 * 60 * 1000 })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
  })

  it('beim Verlassen der App wird die Aktivität gemerkt', () => {
    const { store, listeners, doc } = run({ lastAlive: Date.now() - 31 * 60 * 1000 })
    store.set('fbe_last_alive', '1')
    doc.hidden = true
    listeners['doc:visibilitychange']()
    expect(Number(store.get('fbe_last_alive'))).toBeGreaterThan(1)
    store.set('fbe_last_alive', '1')
    listeners['win:pagehide']()
    expect(Number(store.get('fbe_last_alive'))).toBeGreaterThan(1)
  })

  it('App komplett geschlossen und neu geöffnet (neue Kennung): Animation, auch nach 2 Minuten', () => {
    const { el, store } = run({ lastAlive: Date.now() - 2 * 60 * 1000, launchId: 'neu', lastLaunchId: 'alt' })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
    expect(store.get('fbe_launch_id')).toBe('neu')
  })

  it('nur neu geladen (gleiche Kennung, kurz her): keine Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 2 * 60 * 1000, launchId: 'gleich', lastLaunchId: 'gleich' })
    expect(el.parentNode.removeChild).toHaveBeenCalledWith(el)
  })

  it('gleiche Kennung, aber über 30 Minuten her: Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 40 * 60 * 1000, launchId: 'gleich', lastLaunchId: 'gleich' })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
  })

  it('erster Start überhaupt mit Kennung: Animation', () => {
    const { el } = run({ launchId: 'neu' })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
  })

  it('zweites Laden direkt nach dem Start (gleiche Kennung, Animation lief gerade an): Animation läuft weiter', () => {
    const { el } = run({ lastAlive: Date.now() - 500, launchId: 'gleich', lastLaunchId: 'gleich', shownAt: Date.now() - 500 })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
  })

  it('Rückkehr aus dem Hintergrund (gleiche Kennung, Animation lief vor Minuten): keine Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 60 * 1000, launchId: 'gleich', lastLaunchId: 'gleich', shownAt: Date.now() - 10 * 60 * 1000 })
    expect(el.parentNode.removeChild).toHaveBeenCalledWith(el)
  })

  it('ohne Kennung, aber Seite wurde neu geladen (Navigationstyp reload, kurz her): keine Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 60 * 1000, navType: 'reload' })
    expect(el.parentNode.removeChild).toHaveBeenCalledWith(el)
  })

  it('ohne Kennung, normales Laden (App-Start): Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 60 * 1000, navType: 'navigate' })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
  })

  it('mit Kennung entscheidet nur die Kennung, nicht der Navigationstyp', () => {
    const { el } = run({ lastAlive: Date.now() - 60 * 1000, launchId: 'neu', lastLaunchId: 'alt', navType: 'reload' })
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
  })
})
