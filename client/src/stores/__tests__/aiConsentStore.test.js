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
})
