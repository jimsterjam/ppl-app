import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function fakeDom(reduced = false) {
  const classes = new Set()
  const el = { classList: { add: (c) => classes.add(c) }, remove: vi.fn(), classes }
  vi.stubGlobal('document', { getElementById: (id) => (id === 'start-splash' ? el : null) })
  vi.stubGlobal('window', { __splashStart: Date.now(), matchMedia: () => ({ matches: reduced }) })
  return el
}

describe('dismissStartSplash', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.resetModules() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('blendet erst aus, wenn die Animation ausgespielt hat und das Logo kurz stand', async () => {
    const el = fakeDom()
    const { dismissStartSplash } = await import('../startSplash.js')
    dismissStartSplash()
    vi.advanceTimersByTime(2300)
    expect(el.classes.has('is-leaving')).toBe(false)
    vi.advanceTimersByTime(150)
    expect(el.classes.has('is-leaving')).toBe(true)
    vi.advanceTimersByTime(400)
    expect(el.remove).toHaveBeenCalled()
  })

  it('startet die App langsam (Splash schon 3 s alt): sofort ausblenden', async () => {
    const el = fakeDom()
    window.__splashStart = Date.now() - 3000
    const { dismissStartSplash } = await import('../startSplash.js')
    dismissStartSplash()
    vi.advanceTimersByTime(1)
    expect(el.classes.has('is-leaving')).toBe(true)
  })

  it('"Bewegung reduzieren": nur kurz stehen lassen', async () => {
    const el = fakeDom(true)
    const { dismissStartSplash } = await import('../startSplash.js')
    dismissStartSplash()
    vi.advanceTimersByTime(450)
    expect(el.classes.has('is-leaving')).toBe(true)
  })

  it('ohne Splash-Element passiert nichts', async () => {
    vi.stubGlobal('document', { getElementById: () => null })
    const { dismissStartSplash } = await import('../startSplash.js')
    expect(() => dismissStartSplash()).not.toThrow()
  })
})
