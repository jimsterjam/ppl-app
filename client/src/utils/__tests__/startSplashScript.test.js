import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Das Inline-Skript aus index.html (Startanimation nur beim echten App-Start, nicht bei jeder Rückkehr).
const html = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8')
const script = html.match(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/)[0].replace(/<\/?script>/g, '')

function run({ lastAlive = null } = {}) {
  const store = new Map()
  if (lastAlive !== null) store.set('fbe_last_alive', String(lastAlive))
  const el = { classList: { add: vi.fn() }, parentNode: { removeChild: vi.fn() } }
  const listeners = {}
  const doc = {
    hidden: false,
    getElementById: (id) => (id === 'start-splash' ? el : null),
    addEventListener: (name, fn) => { listeners[`doc:${name}`] = fn },
    fonts: { load: () => new Promise(() => {}) }
  }
  const win = { addEventListener: (name, fn) => { listeners[`win:${name}`] = fn } }
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }
  new Function('document', 'window', 'localStorage', 'setTimeout', 'clearTimeout', script)(doc, win, ls, setTimeout, clearTimeout)
  return { el, store, listeners, doc }
}

describe('Startanimation: nur beim App-Start', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('erster Start (nichts gemerkt): Animation läuft', () => {
    const { el } = run()
    expect(el.parentNode.removeChild).not.toHaveBeenCalled()
    vi.advanceTimersByTime(700)
    expect(el.classList.add).toHaveBeenCalledWith('go')
  })

  it('Rückkehr nach kurzer Zeit (Seite wurde neu geladen): keine Animation', () => {
    const { el } = run({ lastAlive: Date.now() - 5 * 60 * 1000 })
    expect(el.parentNode.removeChild).toHaveBeenCalledWith(el)
    vi.advanceTimersByTime(1000)
    expect(el.classList.add).not.toHaveBeenCalled()
  })

  it('lange nicht benutzt (über 30 Minuten): Animation wieder', () => {
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
})
