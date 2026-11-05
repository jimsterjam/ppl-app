// Zusammenspiel im Betrieb: Takt (setInterval), App-Sichtbarkeit und der explizite firstDelayMs-Pfad des Feedback-Trackers.
// Zeit und Netz sind ersetzt (Fake-Timer, Ersatz für axios), die Tracker-Logik selbst läuft echt.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { post } }))
vi.mock('@/api/http', () => ({ apiUrl: (name) => `http://api.test/${name}` }))
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => 'token' }) }))
vi.mock('../logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('@/i18n', () => ({ getAppLanguage: () => 'de' }))
vi.mock('../offlineStorage', () => ({ AI_FEEDBACK_UPDATED_EVENT: 'ai-feedback-updated' }))

const ID = '507f1f77bcf86cd799439011'
let store
let doc
let win

function setup() {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  })
  win = new EventTarget()
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
}

async function loadTracker() {
  vi.resetModules()
  return import('../feedbackTracker.js')
}

const entry = () => JSON.parse(store.get('ppl_feedback_tracker_v1') || '[]').find((e) => e.id === ID)
// Laufender Tracker-Lauf zu Ende bringen (async innerhalb der Fake-Timer)
const flush = () => vi.advanceTimersByTimeAsync(0)

describe('Feedback-Tracker im Betrieb', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-05T10:00:00Z') })
    post.mockReset()
    setup()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('Standard: erster Versuch beim ersten Takt nach 15 Sekunden', async () => {
    const t = await loadTracker()
    t.startFeedbackTracker() // sofortiger Lauf: noch nichts fällig
    post.mockResolvedValue({ data: { ai_feedback: 'Text' } })
    t.trackPendingFeedback(ID)
    expect(entry().nextAt - Date.now()).toBe(15_000)
    await vi.advanceTimersByTimeAsync(14_000)
    expect(post).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][0]).toBe(`http://api.test/workouts/${ID}/ai-analysis`)
    expect(entry()).toBeUndefined() // fertiges Feedback: nicht mehr beobachtet
  })

  it('expliziter firstDelayMs wird beachtet: erst beim Takt nach Ablauf', async () => {
    const t = await loadTracker()
    t.startFeedbackTracker()
    post.mockResolvedValue({ data: { ai_feedback: 'Text' } })
    t.trackPendingFeedback(ID, { firstDelayMs: 40_000 })
    await vi.advanceTimersByTimeAsync(30_000) // Takte bei 15 s und 30 s: noch nicht fällig
    expect(post).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15_000) // Takt bei 45 s
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('503 bleibt wiederholbar: Eintrag bleibt, nächster Abstand 60 s', async () => {
    const t = await loadTracker()
    t.startFeedbackTracker()
    post.mockRejectedValue({ response: { status: 503 }, message: 'Request failed' })
    t.trackPendingFeedback(ID)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(post).toHaveBeenCalledTimes(1)
    expect(entry().attempts).toBe(1)
    expect(entry().nextAt - Date.now()).toBe(60_000)
    await vi.advanceTimersByTimeAsync(45_000) // bis 60 s nach dem ersten Versuch: noch kein zweiter
    expect(post).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('leeres Kontingent (200, quota_limited) ist endgültig, ohne "Feedback fertig"-Meldung', async () => {
    const t = await loadTracker()
    const ready = vi.fn()
    win.addEventListener(t.FEEDBACK_READY_EVENT, ready)
    t.startFeedbackTracker()
    post.mockResolvedValue({ data: { success: true, feedback_status: 'quota_limited' } })
    t.trackPendingFeedback(ID)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(post).toHaveBeenCalledTimes(1)
    expect(entry()).toBeUndefined()
    expect(ready).not.toHaveBeenCalled()
  })

  it('App im Hintergrund: Takt tut nichts; Rückkehr prüft sofort, auch wenn noch nicht fällig', async () => {
    const t = await loadTracker()
    t.startFeedbackTracker()
    post.mockResolvedValue({ data: { ai_feedback: 'Text' } })
    t.trackPendingFeedback(ID)
    doc.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(60_000)
    expect(post).not.toHaveBeenCalled()
    // Rückkehr in die App kurz nach einem neuen, noch nicht fälligen Eintrag: sofort nachsehen
    store.clear()
    t.trackPendingFeedback(ID, { firstDelayMs: 600_000 })
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(post).toHaveBeenCalledTimes(1)
  })
})
