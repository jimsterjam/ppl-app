// @vitest-environment happy-dom
// Ablauf Fragen nach dem Training in der Zusammenfassung (Backlog F16, Etappe 3): Fragen VOR der KI-Auswertung, Antworten
// werden vor der Auswertung gespeichert, "Überspringen"/Schließen löst die Auswertung ohne Antworten aus.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const calls = []
vi.mock('axios', () => {
  const instance = () => ({
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }, defaults: { headers: { common: {} } }
  })
  return { default: {
    create: instance,
    get: vi.fn(async (url) => { calls.push(['GET', url]); return { data: {} } }),
    post: vi.fn(async (url, body, config) => {
      calls.push(['POST', url, body, config])
      if (String(url).endsWith('/ai-analysis')) return { data: { ai_feedback: 'Starker Tag.', feedback_kind: 'comparison' } }
      return { data: { success: true, feedbackGenerated: globalThis.__feedbackGenerated === true } }
    })
  } }
})
const consentOnServer = vi.hoisted(() => ({ granted: true, fail: false, delayMs: 0 }))
vi.mock('@/api/account', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAccountProfile: vi.fn(async () => ({ aiConsent: { granted: consentOnServer.granted } })),
  fetchAiConsent: vi.fn(async () => {
    if (consentOnServer.delayMs) await new Promise((resolve) => setTimeout(resolve, consentOnServer.delayMs))
    if (consentOnServer.fail) throw new Error('offline')
    return { granted: consentOnServer.granted }
  })
}))
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue('token') }))
vi.mock('@/utils/firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => 'token' }) }))
vi.mock('@/utils/offlineStorage', async (importOriginal) => ({
  ...(await importOriginal()),
  OFFLINE_WORKOUTS_UPDATED_EVENT: 'offline-workouts-updated',
  AI_FEEDBACK_UPDATED_EVENT: 'ai-feedback-updated',
  getAllWorkoutsOffline: vi.fn(async () => [])
}))
vi.mock('@/utils/defaultExercisesLoader', async (importOriginal) => ({ ...(await importOriginal()), loadDefaultExercises: async () => [] }))
vi.mock('@/utils/keepAwakeGuard', () => ({ acquireKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() }))
vi.mock('@/utils/pendingAiFeedback', () => ({ queuePendingAiFeedback: vi.fn(), clearPendingAiFeedback: vi.fn() }))
vi.mock('@/utils/feedbackTracker', () => ({ trackPendingFeedback: vi.fn(), untrackFeedback: vi.fn(), FEEDBACK_READY_EVENT: 'feedback-ready' }))
vi.mock('@/utils/diagnosticsLog', () => ({ logDiagnostic: vi.fn() }))
vi.mock('@/utils/feedbackMail', () => ({ sendFeedbackMail: vi.fn() }))
vi.mock('vue-router', async (importOriginal) => ({ ...(await importOriginal()), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/utils/workoutHelpers', () => ({
  resolveRealIdFromDraftId: vi.fn(async () => ''),
  isValidObjectId: (id) => /^[0-9a-f]{24}$/i.test(String(id || ''))
}))

import PostWorkoutSummary from '../PostWorkoutSummary.vue'
import { createI18nInstance } from '@/i18n'
import { useUserStore } from '@/stores/userStore'
import { useAiConsentStore } from '@/stores/aiConsentStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { setActiveUid, __resetUserScopedStorageForTests } from '@/utils/userScopedStorage'
import { setQuestionsEnabled, markIntroSeen, hasSeenIntro, recordSkip, skipsInARow } from '@/utils/postWorkoutQuestionPrefs'
import { getAllWorkoutsOffline } from '@/utils/offlineStorage'

const ID = 'a'.repeat(24)
const sets = (weight, repsList) => repsList.map((reps) => ({ weight, reps, done: true }))
const workout = (id, date, weight) => ({ _id: id, date, completed: true, goal: 'hypertrophy', exercises: [{ name: 'Lift A', setDetails: sets(weight, [10, 10, 10]) }] })
// Heute 60 kg statt 80 kg: deutlich weniger -> Frage "War das Absicht?"
const lastSession = workout('b'.repeat(24), '2026-11-08T10:00:00Z', 80)
const today = workout(ID, '2026-11-15T10:00:00Z', 60)

let pinia
function setup({ granted = true, history = [lastSession], workouts = [today] } = {}) {
  const user = useUserStore()
  user.workouts = workouts
  user.user = { uid: 'uid-a' }
  const consent = useAiConsentStore()
  consent.switchUser('uid-a')
  consent.granted = granted
  const subscription = useSubscriptionStore()
  subscription.checkSubscription = vi.fn().mockResolvedValue(undefined)
  getAllWorkoutsOffline.mockResolvedValue(history)
}

async function mountSummary(props = {}) {
  const i18n = createI18nInstance()
  i18n.global.locale.value = 'de'
  const wrapper = mount(PostWorkoutSummary, { props: { workoutId: ID, ...props }, global: { plugins: [pinia, i18n], stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}
const analysisCalls = () => calls.filter((c) => c[0] === 'POST' && String(c[1]).endsWith('/ai-analysis'))
const answerCalls = () => calls.filter((c) => c[0] === 'POST' && String(c[1]).endsWith('/athlete-answers'))
const click = async (w, label) => {
  const button = w.findAll('button').find((b) => b.text() === label)
  expect(button, `Knopf "${label}" fehlt: ${w.findAll('button').map((b) => b.text()).join(' | ')}`).toBeTruthy()
  await button.trigger('click')
  await flushPromises()
}

describe('Zusammenfassung: Fragen nach dem Training', () => {
  beforeEach(() => {
    calls.length = 0
    consentOnServer.granted = true
    consentOnServer.fail = false
    consentOnServer.delayMs = 0
    pinia = createPinia()
    setActivePinia(pinia)
    try { localStorage.clear() } catch { /* ohne Speicher */ }
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
    markIntroSeen()
  })

  it('fragt VOR der Auswertung, speichert die Antworten und löst dann die Auswertung aus', async () => {
    setup()
    const w = await mountSummary()
    expect(w.text()).toContain('War das Absicht?')
    expect(analysisCalls()).toHaveLength(0)
    // Server wird beim Antworten schon aufgeweckt
    expect(calls.some((c) => c[0] === 'GET' && String(c[1]).endsWith('/health'))).toBe(true)
    await click(w, 'Nein, ich musste anpassen')
    await click(w, 'Zeitmangel')
    expect(answerCalls()).toHaveLength(1)
    expect(answerCalls()[0][2]).toEqual({ answers: [{ topic: 'intent', exerciseIndex: 0, answer: 'adjusted', reason: 'no_time' }] })
    expect(analysisCalls()).toHaveLength(1)
    // Reihenfolge: erst Antworten, dann Auswertung
    const order = calls.filter((c) => c[0] === 'POST').map((c) => String(c[1]).split('/').pop())
    expect(order).toEqual(['athlete-answers', 'ai-analysis'])
    expect(w.text()).toContain('Starker Tag.')
    expect(skipsInARow()).toBe(0)
  })

  it('"Überspringen": Auswertung ohne Antworten, Zähler zählt mit', async () => {
    setup()
    const w = await mountSummary()
    await click(w, 'Überspringen und Feedback anzeigen')
    expect(answerCalls()).toHaveLength(0)
    expect(analysisCalls()).toHaveLength(1)
    expect(skipsInARow()).toBe(1)
  })

  it('Schließen mitten in den Fragen löst die Auswertung trotzdem aus', async () => {
    setup()
    const w = await mountSummary()
    expect(analysisCalls()).toHaveLength(0)
    await w.find('.close-btn').trigger('click')
    await flushPromises()
    expect(analysisCalls()).toHaveLength(1)
    expect(answerCalls()).toHaveLength(0)
  })

  it('Erklärung beim ersten Mal; "Ohne Fragen weiter" zählt als Überspringen', async () => {
    localStorage.clear() // Erklärung noch nicht gesehen
    setup()
    const w = await mountSummary()
    expect(w.text()).toContain('Kurz zum Training?')
    await click(w, 'Ohne Fragen weiter')
    expect(analysisCalls()).toHaveLength(1)
    expect(skipsInARow()).toBe(1)
    expect(hasSeenIntro()).toBe(true)
  })

  it('nach dreimal Überspringen: Angebot zum Ausschalten statt der Frage', async () => {
    recordSkip(); recordSkip(); recordSkip()
    setup()
    const w = await mountSummary()
    expect(w.text()).toContain('Du hast die Fragen dreimal übersprungen')
    await click(w, 'Ausschalten')
    expect(analysisCalls()).toHaveLength(1)
  })

  it.each([
    ['Schalter aus', () => setQuestionsEnabled(false), {}],
    ['keine KI-Einwilligung', () => { consentOnServer.granted = false }, { granted: false }],
    ['kein auffälliges Workout', () => {}, { history: [] }]
  ])('Gegenprobe: %s -> keine Fragen, Auswertung läuft wie bisher', async (_label, prepare, options) => {
    setup(options)
    prepare()
    const w = await mountSummary()
    expect(w.text()).not.toContain('War das Absicht?')
    expect(answerCalls()).toHaveLength(0)
    if (options.granted !== false) expect(analysisCalls()).toHaveLength(1)
  })

  it('Gegenprobe: nachträglich bearbeitetes Workout (deferred) fragt nie', async () => {
    setup()
    const w = await mountSummary({ deferred: true, edited: true })
    expect(w.text()).not.toContain('War das Absicht?')
    expect(analysisCalls()).toHaveLength(0)
    expect(calls.some((c) => String(c[1]).endsWith('/health'))).toBe(false)
  })

  it('Gegenprobe: schlägt das Speichern der Antworten fehl, kommt die Auswertung trotzdem', async () => {
    setup()
    const axios = (await import('axios')).default
    axios.post.mockImplementationOnce(async (url, body) => { calls.push(['POST', url, body]); throw new Error('offline') })
    const w = await mountSummary()
    await click(w, 'Ja, bewusst')
    await click(w, 'Anderes')
    expect(answerCalls()).toHaveLength(1)
    expect(analysisCalls()).toHaveLength(1)
  })

  it('Einwilligung galt nicht mehr (neue Textversion): erst Einwilligung einholen, dann Antworten erneut speichern', async () => {
    setup()
    const axios = (await import('axios')).default
    axios.post.mockImplementationOnce(async (url, body) => {
      calls.push(['POST', url, body])
      const error = new Error('forbidden')
      error.response = { status: 403, data: { code: 'AI_CONSENT_REQUIRED' } }
      throw error
    })
    const consent = useAiConsentStore()
    consent.request = vi.fn().mockResolvedValue(true)
    const w = await mountSummary()
    await click(w, 'Ja, bewusst')
    await click(w, 'Anderes')
    expect(consent.request).toHaveBeenCalled()
    expect(answerCalls()).toHaveLength(2)
    expect(analysisCalls()).toHaveLength(1)
  })

  it('Gegenprobe: lehnt der Nutzer die neue Einwilligung ab, gibt es keine Auswertung und keinen zweiten Versuch', async () => {
    setup()
    const axios = (await import('axios')).default
    axios.post.mockImplementationOnce(async (url, body) => {
      calls.push(['POST', url, body])
      const error = new Error('forbidden')
      error.response = { status: 403, data: { code: 'AI_CONSENT_REQUIRED' } }
      throw error
    })
    const consent = useAiConsentStore()
    consent.request = vi.fn().mockResolvedValue(false)
    const w = await mountSummary()
    await click(w, 'Ja, bewusst')
    await click(w, 'Anderes')
    expect(answerCalls()).toHaveLength(1)
    expect(analysisCalls()).toHaveLength(0)
    expect(w.text()).toContain('keine Trainingsdaten an die KI')
  })

  it('wird die Ansicht mitten in den Fragen entfernt, läuft die Auswertung trotzdem', async () => {
    setup()
    const w = await mountSummary()
    expect(analysisCalls()).toHaveLength(0)
    w.unmount()
    await flushPromises()
    expect(analysisCalls()).toHaveLength(1)
  })

  it('temporäre Workout-ID, im Store schon unter der echten ID: es wird trotzdem gefragt', async () => {
    const { resolveRealIdFromDraftId } = await import('@/utils/workoutHelpers')
    resolveRealIdFromDraftId.mockResolvedValue(ID)
    setup()
    const w = await mountSummary({ workoutId: 'offline_123' })
    expect(w.text()).toContain('War das Absicht?')
    resolveRealIdFromDraftId.mockResolvedValue('')
  })

  it('Kontingent erst nach der Server-Antwort geprüft: meldet der Server "leer", wird nicht gefragt', async () => {
    setup()
    const subscription = useSubscriptionStore()
    subscription.checkSubscription = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      subscription.applyAiUsageSnapshot({ monthlyCount: 5, monthlyLimit: 5, phase: 'monthly' })
    })
    const w = await mountSummary()
    await new Promise((resolve) => setTimeout(resolve, 60))
    await flushPromises()
    expect(w.text()).not.toContain('War das Absicht?')
    expect(answerCalls()).toHaveLength(0)
  })

  it('es gab schon Feedback: die Auswertung wird neu angefordert, damit die Antworten wirken', async () => {
    globalThis.__feedbackGenerated = true
    try {
      setup()
      const w = await mountSummary()
      await click(w, 'Ja, bewusst')
      await click(w, 'Anderes')
      expect(analysisCalls()).toHaveLength(1)
      expect(analysisCalls()[0][3]?.params).toEqual({ refresh: '1' })
    } finally {
      delete globalThis.__feedbackGenerated
    }
  })

  it('Gegenprobe: ohne vorhandenes Feedback keine Neu-Anforderung (kein zusätzlicher Verbrauch)', async () => {
    setup()
    const w = await mountSummary()
    await click(w, 'Ja, bewusst')
    await click(w, 'Anderes')
    expect(analysisCalls()).toHaveLength(1)
    expect(analysisCalls()[0][3]?.params).toBeUndefined()
  })

  it('Einwilligung auf einem anderen Gerät widerrufen: der Abgleich mit dem Server verhindert die Fragen trotz lokalem "erteilt"', async () => {
    setup() // lokal: erteilt
    consentOnServer.granted = false
    const consent = useAiConsentStore()
    consent.request = vi.fn().mockResolvedValue(false)
    const w = await mountSummary()
    await flushPromises()
    expect(consent.granted).toBe(false)
    expect(w.text()).not.toContain('War das Absicht?')
    expect(answerCalls()).toHaveLength(0)
  })

  it('Gegenprobe: bestätigt der Server die Einwilligung, wird gefragt', async () => {
    setup()
    consentOnServer.granted = true
    const w = await mountSummary()
    expect(w.text()).toContain('War das Absicht?')
  })

  it('Gegenprobe: Server nicht erreichbar -> der lokale Stand gilt, es wird gefragt', async () => {
    setup()
    consentOnServer.fail = true
    const w = await mountSummary()
    expect(w.text()).toContain('War das Absicht?')
  })

  it('Gegenprobe: lokal noch nichts gespeichert, Server sagt "erteilt" -> es wird gefragt', async () => {
    setup({ granted: false })
    consentOnServer.granted = true
    const w = await mountSummary()
    expect(w.text()).toContain('War das Absicht?')
  })

  it('Server antwortet erst spät mit "widerrufen": die Fragen brechen ab und die Auswertung fragt nach der Einwilligung', async () => {
    setup()
    consentOnServer.granted = false
    consentOnServer.delayMs = 3200 // länger als die Wartezeit vor den Fragen
    const consent = useAiConsentStore()
    consent.request = vi.fn().mockResolvedValue(false)
    const w = await mountSummary()
    await new Promise((resolve) => setTimeout(resolve, 2700))
    await flushPromises()
    expect(w.text()).toContain('War das Absicht?') // Wartezeit abgelaufen, lokal noch "erteilt"
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(w.text()).not.toContain('War das Absicht?')
    expect(consent.request).toHaveBeenCalled()
    expect(answerCalls()).toHaveLength(0)
  })

  it('Widerruf kommt erst während der Vorbereitung der Fragen an: die Fragen werden trotzdem nicht gezeigt', async () => {
    setup()
    consentOnServer.granted = false
    consentOnServer.delayMs = 2800 // nach der Wartezeit (2,5 s), während der Verlauf noch lädt
    getAllWorkoutsOffline.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700))
      return [lastSession]
    })
    const consent = useAiConsentStore()
    consent.request = vi.fn().mockResolvedValue(false)
    const w = await mountSummary()
    await new Promise((resolve) => setTimeout(resolve, 3800))
    await flushPromises()
    expect(w.text()).not.toContain('War das Absicht?')
    expect(consent.request).toHaveBeenCalled()
    expect(answerCalls()).toHaveLength(0)
  })
})
