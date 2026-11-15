import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({
  fetchAccountProfile: vi.fn(),
  fetchAiConsent: vi.fn(),
  saveAiConsent: vi.fn()
}))
vi.mock('@/api/account', () => api)
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue('token') }))

import { useAiConsentStore } from '../aiConsentStore.js'

describe('aiConsentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const data = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k)
    })
    Object.values(api).forEach((fn) => fn.mockReset())
  })

  it('request: ohne Einwilligung öffnet das Fenster, Zustimmen speichert und liefert true', async () => {
    api.saveAiConsent.mockResolvedValue({ granted: true })
    const store = useAiConsentStore()
    store.switchUser('u1')
    const pending = store.request()
    expect(store.modalOpen).toBe(true)
    await store.accept()
    expect(await pending).toBe(true)
    expect(api.saveAiConsent).toHaveBeenCalledWith('token', true)
    expect(store.granted).toBe(true)
    expect(store.modalOpen).toBe(false)
    expect(await store.request()).toBe(true)
  })

  it('request: "Nicht jetzt" liefert false und speichert nichts', async () => {
    const store = useAiConsentStore()
    store.switchUser('u1')
    const pending = store.request()
    store.decline()
    expect(await pending).toBe(false)
    expect(api.saveAiConsent).not.toHaveBeenCalled()
    expect(store.granted).toBe(false)
  })

  it('accept: Speichern scheitert -> Fenster bleibt offen, keine Einwilligung', async () => {
    api.saveAiConsent.mockRejectedValue(new Error('offline'))
    const store = useAiConsentStore()
    store.switchUser('u1')
    store.request()
    await store.accept()
    expect(store.modalOpen).toBe(true)
    expect(store.saveFailed).toBe(true)
    expect(store.granted).toBe(false)
  })

  it('syncFromServer übernimmt den Serverstand; revoke setzt zurück', async () => {
    api.fetchAccountProfile.mockResolvedValue({ aiConsent: { granted: true } })
    api.saveAiConsent.mockResolvedValue({ granted: false })
    const store = useAiConsentStore()
    store.switchUser('u1')
    await store.syncFromServer('token')
    expect(store.granted).toBe(true)
    expect(await store.revoke()).toBe(true)
    expect(store.granted).toBe(false)
  })

  it('Cache gilt pro Nutzer; Nutzerwechsel setzt zurück', () => {
    const store = useAiConsentStore()
    store.switchUser('u1')
    store._setGranted(true)
    store.switchUser('u2')
    expect(store.granted).toBe(false)
    store.switchUser('u1')
    expect(store.granted).toBe(true)
  })

  it('noteServerRefusal nimmt die lokale Einwilligung zurück', () => {
    const store = useAiConsentStore()
    store.switchUser('u1')
    store._setGranted(true)
    store.noteServerRefusal()
    expect(store.granted).toBe(false)
  })

  it('Zustimmung zum alten Text (Version 1, alter Zwischenspeicher) gilt nach der Textänderung nicht', () => {
    localStorage.setItem('ai-consent:u1', '1')
    const store = useAiConsentStore()
    store.switchUser('u1')
    expect(store.granted).toBe(false)
  })

  it('Zwischenspeicher trägt die Textversion im Namen', () => {
    const store = useAiConsentStore()
    store.switchUser('u1')
    store._setGranted(true)
    expect(localStorage.getItem('ai-consent-v2:u1')).toBe('1')
    expect(localStorage.getItem('ai-consent:u1')).toBeNull()
    const other = useAiConsentStore()
    other._uid = ''
    other.switchUser('u1')
    expect(other.granted).toBe(true)
  })

  it('refreshFromServer: Antwort eines früheren Kontos wird nach einem Kontowechsel verworfen', async () => {
    let resolveFetch
    api.fetchAiConsent.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))
    const store = useAiConsentStore()
    store.switchUser('u1')
    const pending = store.refreshFromServer()
    await Promise.resolve()
    store.switchUser('u2')
    resolveFetch({ granted: true })
    await pending
    expect(store.granted).toBe(false)
    expect(localStorage.getItem('ai-consent-v2:u2')).toBeNull()
    expect(localStorage.getItem('ai-consent-v2:u1')).toBeNull()
  })

  it('refreshFromServer: übernimmt den Serverstand; bei Fehler bleibt der lokale Stand', async () => {
    const store = useAiConsentStore()
    store.switchUser('u1')
    store._setGranted(true)
    api.fetchAiConsent.mockResolvedValue({ granted: false })
    await store.refreshFromServer()
    expect(store.granted).toBe(false)
    store._setGranted(true)
    api.fetchAiConsent.mockRejectedValue(new Error('offline'))
    await store.refreshFromServer()
    expect(store.granted).toBe(true)
  })

  it('Eine ältere Server-Antwort überschreibt eine neuere nicht (Profil sagt "erteilt", später "widerrufen")', async () => {
    let resolveProfile
    api.fetchAccountProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve }))
    api.fetchAiConsent.mockResolvedValue({ granted: false })
    const store = useAiConsentStore()
    store.switchUser('u1')
    store._setGranted(true)
    const older = store.syncFromServer('token') // startet zuerst, antwortet zuletzt
    await store.refreshFromServer() // neuer, sagt "widerrufen"
    expect(store.granted).toBe(false)
    resolveProfile({ aiConsent: { granted: true } })
    await older
    expect(store.granted).toBe(false)
  })

  it('gilt auch nach Kontowechsel weg und zurück zur selben UID', async () => {
    let resolveFetch
    api.fetchAiConsent.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))
    const store = useAiConsentStore()
    store.switchUser('u1')
    const pending = store.refreshFromServer()
    await Promise.resolve()
    store.switchUser('u2')
    store.switchUser('u1')
    resolveFetch({ granted: true })
    await pending
    expect(store.granted).toBe(false)
  })

  it('Entscheidung des Nutzers (Widerruf) ist neuer als eine noch laufende Server-Anfrage', async () => {
    let resolveFetch
    api.fetchAiConsent.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))
    api.saveAiConsent.mockResolvedValue({ granted: false })
    const store = useAiConsentStore()
    store.switchUser('u1')
    store._setGranted(true)
    const pending = store.refreshFromServer()
    await Promise.resolve()
    expect(await store.revoke()).toBe(true)
    resolveFetch({ granted: true })
    await pending
    expect(store.granted).toBe(false)
  })

  it('Gegenprobe: eine spätere Antwort wird übernommen, wenn keine neuere vorlag', async () => {
    api.fetchAiConsent.mockResolvedValue({ granted: true })
    const store = useAiConsentStore()
    store.switchUser('u1')
    await store.refreshFromServer()
    expect(store.granted).toBe(true)
    api.fetchAiConsent.mockResolvedValue({ granted: false })
    await store.refreshFromServer()
    expect(store.granted).toBe(false)
  })
})
