import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Tester-Meldung 09.10.: Der Pausentimer-Gong blieb stumm, nachdem man die App verlassen hatte und
// zurückkam. Ursache: iOS setzt den AudioContext im Hintergrund auf 'interrupted'; der Code
// startete ihn nur bei 'suspended' neu. Diese Tests bilden die Zustände mit einem Fake nach.
function installFakeAudioContext({ resumeBehavior = 'running' } = {}) {
  const log = { contexts: [], resumeCalls: 0, oscStarts: 0 }
  class FakeContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
      this.listeners = {}
      log.contexts.push(this)
    }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn) }
    setState(state) { this.state = state; (this.listeners.statechange || []).forEach((fn) => fn()) }
    resume() {
      log.resumeCalls += 1
      if (resumeBehavior === 'running') { this.state = 'running'; return Promise.resolve() }
      if (resumeBehavior === 'never') return new Promise(() => {})
      return Promise.resolve() // bleibt im alten Zustand (iOS ohne Geste)
    }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} } }
    createOscillator() {
      return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start: () => { log.oscStarts += 1 }, stop() {} }
    }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} } }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} } }
  }
  globalThis.window.AudioContext = FakeContext
  return log
}

async function freshAudio() {
  vi.resetModules()
  return import('../timerAudio.js')
}

// Kein jsdom im Projekt: window, document und localStorage werden minimal nachgebaut.
describe('timerAudio: Zustand des AudioContext', () => {
  beforeEach(() => {
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    })
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', new EventTarget())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('läuft der Kontext, wird nichts neu gestartet und der Gong sofort gespielt', async () => {
    const log = installFakeAudioContext()
    const audio = await freshAudio()
    audio.getAudioContext()
    log.resumeCalls = 0
    audio.emitTimerSignal({ eventKey: 'a', soundEnabled: true, kind: 'round-start' })
    expect(log.resumeCalls).toBe(0)
    expect(log.oscStarts).toBeGreaterThan(0)
  })

  it('"interrupted" (iOS nach dem Hintergrund) wird neu gestartet - früher passierte hier nichts', async () => {
    const log = installFakeAudioContext()
    const audio = await freshAudio()
    audio.getAudioContext().state = 'interrupted'
    audio.ensureAudioUnlocked()
    await Promise.resolve()
    expect(log.resumeCalls).toBeGreaterThan(0)
  })

  it('Pausenende bei "interrupted": erst starten, dann Gong spielen', async () => {
    const log = installFakeAudioContext({ resumeBehavior: 'running' })
    const audio = await freshAudio()
    audio.getAudioContext().state = 'interrupted'
    log.resumeCalls = 0
    audio.emitTimerSignal({ eventKey: 'b', soundEnabled: true, kind: 'round-start' })
    await vi.waitFor(() => expect(log.oscStarts).toBeGreaterThan(0))
    expect(log.resumeCalls).toBeGreaterThan(0)
    expect(log.contexts[0].state).toBe('running')
  })

  it('resume() antwortet nie (iOS ohne Geste): Gong wird nach kurzer Wartezeit trotzdem angestoßen, Geste armiert', async () => {
    vi.useFakeTimers()
    const log = installFakeAudioContext({ resumeBehavior: 'never' })
    const audio = await freshAudio()
    audio.getAudioContext().state = 'interrupted'
    audio.emitTimerSignal({ eventKey: 'c', soundEnabled: true, kind: 'round-start' })
    expect(log.oscStarts).toBe(0)
    await vi.advanceTimersByTimeAsync(700)
    expect(log.oscStarts).toBeGreaterThan(0)
    // Nächstes Antippen weckt den Kontext
    log.resumeCalls = 0
    document.dispatchEvent(new Event('touchend', { bubbles: true }))
    expect(log.resumeCalls).toBeGreaterThan(0)
  })

  it('rearmAudio (App kommt zurück) startet einen stehenden Kontext und wartet auf die nächste Geste', async () => {
    const log = installFakeAudioContext({ resumeBehavior: 'stay' })
    const audio = await freshAudio()
    audio.getAudioContext().state = 'interrupted'
    log.resumeCalls = 0
    audio.rearmAudio()
    await Promise.resolve()
    expect(log.resumeCalls).toBeGreaterThan(0)
    log.resumeCalls = 0
    document.dispatchEvent(new Event('click', { bubbles: true }))
    expect(log.resumeCalls).toBeGreaterThan(0)
  })

  it('rearmAudio ohne bestehenden Kontext oder bei laufendem Kontext tut nichts', async () => {
    const log = installFakeAudioContext()
    const audio = await freshAudio()
    audio.rearmAudio()
    expect(log.contexts.length).toBe(0)
    audio.getAudioContext()
    log.resumeCalls = 0
    audio.rearmAudio()
    expect(log.resumeCalls).toBe(0)
  })

  it('vom System geschlossener Kontext ("closed") wird neu aufgebaut', async () => {
    const log = installFakeAudioContext()
    const audio = await freshAudio()
    const first = audio.getAudioContext()
    first.state = 'closed'
    const second = audio.getAudioContext()
    expect(second).not.toBe(first)
    expect(log.contexts.length).toBe(2)
  })

  it('statechange auf "interrupted" wird im Diagnose-Log festgehalten (für Tester-Rückmeldung)', async () => {
    installFakeAudioContext()
    const audio = await freshAudio()
    audio.getAudioContext().setState('interrupted')
    const entries = JSON.parse(localStorage.getItem('bro_split_load_diagnostics_v1') || '[]')
    expect(entries.some((e) => e.event === 'audio-state' && e.state === 'interrupted')).toBe(true)
  })

  it('Ton aus (soundEnabled=false): nichts wird gespielt oder gestartet', async () => {
    const log = installFakeAudioContext()
    const audio = await freshAudio()
    audio.getAudioContext().state = 'interrupted'
    log.resumeCalls = 0
    audio.emitTimerSignal({ eventKey: 'd', soundEnabled: false, kind: 'round-start' })
    expect(log.resumeCalls).toBe(0)
    expect(log.oscStarts).toBe(0)
  })

  it('Pausenende mit Melodie: spielt die Noten, nicht den Gong; unbekannte ID fällt auf den Gong zurück', async () => {
    const log = installFakeAudioContext()
    const audio = await freshAudio()
    audio.emitTimerSignal({ eventKey: 'm1', soundEnabled: true, kind: 'rest-end', melodyId: 'marimba' })
    const melodyOscs = log.oscStarts
    // 8 Noten x 3 Obertöne (+ 1 Entsperr-Oszillator)
    expect(melodyOscs).toBeGreaterThanOrEqual(24)
    audio.emitTimerSignal({ eventKey: 'm2', soundEnabled: true, kind: 'rest-end', melodyId: 'default' })
    const gongOscs = log.oscStarts - melodyOscs
    // Gong: Grundton + 2 Obertöne + Anschlag = 4
    expect(gongOscs).toBe(4)
    expect(audio.playRestMelody('nope')).toBe(false)
  })
})
