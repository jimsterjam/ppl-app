import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Laufende Zustände gehören zum Konto (Absprache Paul 06.11.2026, zweite Gruppe): Kontowechsel und Abmelden beenden Pause,
// Aufwärm-Timer, Übergang, Timer und Stoppuhr des bisherigen Kontos; ein Kaltstart mit demselben Konto stellt sie wieder her.
const post = vi.hoisted(() => vi.fn(async () => ({ data: { feedback_ready: true } })))
// Haken, um mitten in einem asynchronen Schritt das Konto zu wechseln
const hooks = vi.hoisted(() => ({ token: async () => 'token', resolveId: async (id) => id }))
const cancelSignal = vi.hoisted(() => vi.fn(async () => {}))
const cancelWarmup = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('axios', () => ({ default: { post } }))
vi.mock('@/api/http', () => ({ apiUrl: (name) => `http://api.test/${name}` }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => false }, registerPlugin: () => ({}) }))
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: { keepAwake: async () => {}, allowSleep: async () => {}, isSupported: async () => ({ isSupported: false }) } }))
vi.mock('@/utils/restEndSignal', () => ({ scheduleRestEndSignal: async () => {}, cancelRestEndSignal: cancelSignal, NOTIFICATION_ID: 1, NOTIFICATION_DELAY_MS: 1200, NOTIFICATION_SOUND: 'x.wav' }))
vi.mock('@/utils/warmupSignal', () => ({ scheduleWarmupNotification: async () => {}, cancelWarmupNotification: cancelWarmup }))
vi.mock('@/utils/timerAudio', () => ({ ensureAudioUnlocked: async () => {}, clearSignalHistory: () => {}, emitTimerSignal: () => {} }))
vi.mock('@/api/account', () => ({ fetchAccountProfile: async () => ({}), updateAccountProfile: async () => ({}) }))
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: () => hooks.token() }) }))
vi.mock('../logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('../offlineStorage', () => ({ AI_FEEDBACK_UPDATED_EVENT: 'ai-feedback-updated' }))
vi.mock('../workoutHelpers', () => ({ isValidObjectId: (id) => /^[a-f0-9]{24}$/i.test(String(id)), resolveRealIdFromDraftId: (id) => hooks.resolveId(id) }))

function installBrowser() {
  const data = new Map([['ppl_user_prefs_migrated_v1', '1']])
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)) },
    removeItem: (k) => { data.delete(k) }
  })
  vi.stubGlobal('document', { documentElement: { setAttribute: () => {} }, visibilityState: 'visible' })
  vi.stubGlobal('navigator', { language: 'de-DE' })
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setInterval, clearInterval }))
  return data
}

async function setup(existing) {
  vi.resetModules()
  const data = installBrowser()
  if (existing) for (const [k, v] of existing) data.set(k, v)
  setActivePinia(createPinia())
  const [prefs, scoped, rest, warm, trans, tmr, sw] = await Promise.all([
    import('../userPreferences.js'), import('../userScopedStorage.js'), import('@/stores/restTimerStore'),
    import('@/stores/warmupTimerStore'), import('@/stores/transitionTimerStore'), import('@/stores/timerStore'), import('@/stores/sessionStopwatch')
  ])
  const stores = { restTimer: rest.useRestTimerStore(), warmupTimer: warm.useWarmupTimerStore(), transitionTimer: trans.useTransitionTimerStore(), timer: tmr.useTimerStore(), stopwatch: sw.useSessionStopwatchStore() }
  return { data, prefs, scoped, stores, switchTo: (uid) => prefs.applyUserPreferences(uid, stores) }
}

describe('Laufende Zustände beim Kontowechsel', () => {
  beforeEach(() => { vi.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z') }); post.mockClear(); cancelSignal.mockClear(); cancelWarmup.mockClear() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  function startEverything(stores) {
    stores.restTimer.start({ seconds: 120, exerciseName: 'Bench Press Barbell', exIndex: 0, rowIndex: 0 })
    stores.warmupTimer.start({ step: 'cardio', workoutKey: 'w1', notifyTitle: 'Cardio geschafft', notifyBody: 'Weiter mit Bench Press', seconds: 300 })
    stores.transitionTimer.start(0)
    stores.stopwatch.start()
  }

  it('Abmelden beendet alle laufenden Zustände, löscht ihren gespeicherten Stand und nimmt Mitteilungen zurück', async () => {
    const { data, stores, switchTo } = await setup()
    switchTo('uidA')
    startEverything(stores)
    expect(data.has('ppl_rest_timer_state_v1')).toBe(true)
    expect(JSON.parse(data.get('ppl_rest_timer_state_v1')).uid).toBe('uidA')
    cancelSignal.mockClear()

    switchTo(null)
    expect(stores.restTimer.endsAt).toBe(0)
    expect(stores.warmupTimer.endsAt).toBe(0)
    expect(stores.transitionTimer.startedAt).toBe(0)
    expect(stores.stopwatch.startedAt).toBeNull()
    for (const key of ['ppl_rest_timer_state_v1', 'ppl_warmup_timer_v1', 'ppl_transition_timer_v1', 'bro_split_session_stopwatch_v1']) {
      expect(data.has(key)).toBe(false)
    }
    expect(cancelSignal).toHaveBeenCalled()
    expect(cancelWarmup).toHaveBeenCalled()
  })

  it('Wechsel auf ein anderes Konto beendet die Zustände des bisherigen', async () => {
    const { stores, switchTo } = await setup()
    switchTo('uidA')
    startEverything(stores)
    switchTo('uidB')
    expect(stores.restTimer.endsAt).toBe(0)
    expect(stores.restTimer.exerciseName).toBe('')
    expect(stores.stopwatch.startedAt).toBeNull()
  })

  it('Kaltstart mit demselben Konto stellt Pause und Stoppuhr wieder her (kein Reset)', async () => {
    const first = await setup()
    first.switchTo('uidA')
    startEverything(first.stores)
    const saved = new Map(first.data)

    const second = await setup(saved)
    expect(second.scoped.getActiveUid()).toBe('uidA')
    second.stores.restTimer.restore()
    expect(second.stores.restTimer.exerciseName).toBe('Bench Press Barbell')
    expect(second.stores.restTimer.endsAt).toBeGreaterThan(Date.now())
    expect(second.stores.stopwatch.startedAt).toBeTruthy()
    // Anmeldung desselben Kontos nach dem Start ändert nichts
    second.switchTo('uidA')
    expect(second.stores.restTimer.exerciseName).toBe('Bench Press Barbell')
    expect(second.stores.stopwatch.startedAt).toBeTruthy()
  })

  it('gespeicherter Stand eines anderen Kontos wird beim Start nicht wiederhergestellt', async () => {
    const first = await setup()
    first.switchTo('uidA')
    startEverything(first.stores)
    const saved = new Map(first.data)
    saved.set('ppl_active_uid_v1', 'uidB') // Gerät erinnert sich an ein anderes Konto

    const second = await setup(saved)
    second.stores.restTimer.restore()
    second.stores.warmupTimer.restore()
    second.stores.transitionTimer.restore()
    expect(second.stores.restTimer.endsAt).toBe(0)
    expect(second.stores.restTimer.exerciseName).toBe('')
    expect(second.stores.warmupTimer.endsAt).toBe(0)
    expect(second.stores.transitionTimer.startedAt).toBe(0)
    expect(second.stores.stopwatch.startedAt).toBeNull()
    expect(second.data.has('bro_split_session_stopwatch_v1')).toBe(false)
  })

  it('ältere Stände ohne Konto-Angabe (vor diesem Update) zählen für das aktive Konto', async () => {
    const legacy = new Map([['ppl_active_uid_v1', 'uidA'], ['ppl_user_prefs_migrated_v1', '1'],
      ['bro_split_session_stopwatch_v1', JSON.stringify({ startedAt: Date.now() - 60_000, pausedAt: null, pausedTotalMs: 0, isRunning: true })]])
    const s = await setup(legacy)
    expect(s.stores.stopwatch.startedAt).toBeTruthy()
  })

  it('Erstanmeldung (kein gemerktes Konto) beendet nichts', async () => {
    const { stores, switchTo } = await setup()
    stores.restTimer.start({ seconds: 120, exerciseName: 'Squat', exIndex: 0, rowIndex: 0 })
    switchTo('uidA')
    expect(stores.restTimer.endsAt).toBeGreaterThan(0)
  })

  it('Admin-Schlüssel wird beim Abmelden und Kontowechsel gelöscht, bei gleichem Konto nicht', async () => {
    const { data, switchTo } = await setup()
    switchTo('uidA')
    data.set('admin_feedback_key', 'geheim')
    switchTo('uidA')
    expect(data.get('admin_feedback_key')).toBe('geheim')
    switchTo(null)
    expect(data.has('admin_feedback_key')).toBe(false)
    switchTo('uidA')
    data.set('admin_feedback_key', 'geheim')
    switchTo('uidB')
    expect(data.has('admin_feedback_key')).toBe(false)
  })
})

describe('Wartende KI-Feedbacks gehören zum Konto', () => {
  const ID = '507f1f77bcf86cd799439011'
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z') })
    post.mockClear()
    hooks.token = async () => 'token'
    hooks.resolveId = async (id) => id
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  async function load() {
    vi.resetModules()
    const data = installBrowser()
    const scoped = await import('../userScopedStorage.js')
    const tracker = await import('../feedbackTracker.js')
    return { data, scoped, tracker }
  }

  it('Tracker: Eintrag trägt die Konto-ID; ein anderes Konto fragt nicht für fremde Workouts an, A bekommt sein Feedback später', async () => {
    const { data, scoped, tracker } = await load()
    scoped.setActiveUid('uidA')
    tracker.trackPendingFeedback(ID, { name: 'Push', firstDelayMs: 0 })
    expect(JSON.parse(data.get('ppl_feedback_tracker_v1'))[0].uid).toBe('uidA')

    scoped.setActiveUid('uidB')
    await tracker.runFeedbackTracker()
    expect(post).not.toHaveBeenCalled()
    expect(JSON.parse(data.get('ppl_feedback_tracker_v1'))).toHaveLength(1)

    scoped.setActiveUid('uidA')
    await tracker.runFeedbackTracker()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('Tracker: fremde Einträge verfallen nach der Frist, ohne dass für sie angefragt wird', async () => {
    const { data, scoped, tracker } = await load()
    scoped.setActiveUid('uidA')
    tracker.trackPendingFeedback(ID, { firstDelayMs: 0 })
    scoped.setActiveUid('uidB')
    vi.setSystemTime(Date.now() + tracker.GIVE_UP_AFTER_MS + 1000)
    await tracker.runFeedbackTracker()
    expect(post).not.toHaveBeenCalled()
    expect(data.has('ppl_feedback_tracker_v1')).toBe(false)
  })

  it('Warteschlange: Eintrag trägt die Konto-ID; ein anderes Konto lässt ihn liegen, A arbeitet ihn ab', async () => {
    const { data, scoped } = await load()
    const pending = await import('../pendingAiFeedback.js')
    scoped.setActiveUid('uidA')
    pending.queuePendingAiFeedback(ID)
    expect(JSON.parse(data.get('bro_split_pending_ai_feedback_v1'))[0].uid).toBe('uidA')

    scoped.setActiveUid('uidB')
    await pending.processPendingAiFeedback()
    expect(post).not.toHaveBeenCalled()
    expect(JSON.parse(data.get('bro_split_pending_ai_feedback_v1'))).toHaveLength(1)

    scoped.setActiveUid('uidA')
    await pending.processPendingAiFeedback()
    expect(post).toHaveBeenCalledTimes(1)
    expect(data.has('bro_split_pending_ai_feedback_v1')).toBe(false)
  })
})

const jwtFor = (uid) => `x.${btoa(JSON.stringify({ user_id: uid })).replace(/=/g, '')}.y`

describe('Kontowechsel mitten in einem asynchronen Schritt', () => {
  const ID = '507f1f77bcf86cd799439011'
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z') })
    post.mockClear()
    hooks.token = async () => 'token'
    hooks.resolveId = async (id) => id
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  async function load() {
    vi.resetModules()
    const data = installBrowser()
    const scoped = await import('../userScopedStorage.js')
    const tracker = await import('../feedbackTracker.js')
    const pending = await import('../pendingAiFeedback.js')
    return { data, scoped, tracker, pending }
  }

  it('Tracker: Wechsel während des Token-Abrufs → keine Anfrage, Eintrag bleibt', async () => {
    const { data, scoped, tracker } = await load()
    scoped.setActiveUid('uidA')
    tracker.trackPendingFeedback(ID, { firstDelayMs: 0 })
    hooks.token = async () => { scoped.setActiveUid('uidB'); return jwtFor('uidB') }
    await tracker.runFeedbackTracker()
    expect(post).not.toHaveBeenCalled()
    expect(JSON.parse(data.get('ppl_feedback_tracker_v1'))).toHaveLength(1)
  })

  it('Tracker: Token eines anderen Kontos (Firebase schon gewechselt, App noch nicht) → keine Anfrage', async () => {
    const { data, scoped, tracker } = await load()
    scoped.setActiveUid('uidA')
    tracker.trackPendingFeedback(ID, { firstDelayMs: 0 })
    hooks.token = async () => jwtFor('uidB')
    await tracker.runFeedbackTracker()
    expect(post).not.toHaveBeenCalled()
    expect(JSON.parse(data.get('ppl_feedback_tracker_v1'))).toHaveLength(1)
  })

  it('Tracker: Wechsel während der Anfrage → keine Meldung (Workout-Name) an das neue Konto, Eintrag bleibt', async () => {
    const { data, scoped, tracker } = await load()
    scoped.setActiveUid('uidA')
    tracker.trackPendingFeedback(ID, { name: 'Geheimes Workout', firstDelayMs: 0 })
    const heard = []
    window.addEventListener(tracker.FEEDBACK_READY_EVENT, (e) => heard.push(e.detail))
    post.mockImplementationOnce(async () => { scoped.setActiveUid('uidB'); return { data: { feedback_ready: true } } })
    await tracker.runFeedbackTracker()
    expect(heard).toEqual([])
    expect(JSON.parse(data.get('ppl_feedback_tracker_v1'))).toHaveLength(1)
  })

  it('Warteschlange: Wechsel während der ID-Auflösung → keine Anfrage, Eintrag bleibt unverändert', async () => {
    const { data, scoped, pending } = await load()
    scoped.setActiveUid('uidA')
    pending.queuePendingAiFeedback(ID)
    hooks.resolveId = async (id) => { scoped.setActiveUid('uidB'); return id }
    await pending.processPendingAiFeedback()
    expect(post).not.toHaveBeenCalled()
    const queue = JSON.parse(data.get('bro_split_pending_ai_feedback_v1'))
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ id: ID, uid: 'uidA' })
  })

  it('Warteschlange: Token eines anderen Kontos → keine Anfrage, Eintrag bleibt', async () => {
    const { data, scoped, pending } = await load()
    scoped.setActiveUid('uidA')
    pending.queuePendingAiFeedback(ID)
    hooks.token = async () => jwtFor('uidB')
    await pending.processPendingAiFeedback()
    expect(post).not.toHaveBeenCalled()
    expect(JSON.parse(data.get('bro_split_pending_ai_feedback_v1'))).toHaveLength(1)
  })

  it('Warteschlange: während der Verarbeitung neu eingereihte Einträge gehen nicht verloren', async () => {
    const { data, scoped, pending } = await load()
    scoped.setActiveUid('uidA')
    pending.queuePendingAiFeedback(ID)
    hooks.resolveId = async (id) => { pending.queuePendingAiFeedback('507f1f77bcf86cd799439022'); return id }
    await pending.processPendingAiFeedback()
    const queue = JSON.parse(data.get('bro_split_pending_ai_feedback_v1'))
    expect(queue.map((e) => e.id)).toEqual(['507f1f77bcf86cd799439022'])
  })
})

describe('Admin-Schlüssel in offenen Panels', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('wird beim Anmelden nach einem Neustart gelöscht (Rest aus älterer App-Version) und in offenen Panels geleert', async () => {
    vi.resetModules()
    const data = installBrowser()
    data.set('admin_feedback_key', 'geheim')
    const prefs = await import('../userPreferences.js')
    const reset = await import('../adminKeyReset.js')
    const field = { value: 'geheim' }
    const stop = reset.clearAdminKeyRefOnReset(field)
    prefs.applyUserPreferences('uidA', {})
    expect(data.has('admin_feedback_key')).toBe(false)
    expect(field.value).toBe('')
    stop()
    field.value = 'neu'
    prefs.applyUserPreferences('uidB', {})
    expect(field.value).toBe('neu')
  })

  it('bleibt bei erneutem Rückruf desselben Kontos erhalten', async () => {
    vi.resetModules()
    const data = installBrowser()
    const prefs = await import('../userPreferences.js')
    prefs.applyUserPreferences('uidA', {})
    data.set('admin_feedback_key', 'geheim')
    prefs.applyUserPreferences('uidA', {})
    expect(data.get('admin_feedback_key')).toBe('geheim')
  })
})
