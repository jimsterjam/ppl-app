import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({ fetchAccountProfile: vi.fn(), updateAccountProfile: vi.fn() }))
vi.mock('@/api/account', () => api)

import { useSettingsStore } from '../settingsStore.js'

describe('settingsStore: Kontowechsel bei langsamer Profil-Antwort', () => {
  beforeEach(() => {
    const mem = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    })
    setActivePinia(createPinia())
    Object.values(api).forEach((fn) => fn.mockReset())
  })

  it('späte Antwort des alten Kontos überschreibt Name/Bild des neuen Kontos nicht', async () => {
    let resolveOld
    api.fetchAccountProfile.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const store = useSettingsStore()
    store.switchUser('uid-a')
    const pending = store.loadProfile('token-a-1234567890')
    store.switchUser('uid-b')
    resolveOld({ username: 'Alt', avatarUrl: 'http://alt/bild.jpg' })
    await pending
    expect(store.username).toBe('')
    expect(store.avatarUrl).toBe('')
    expect(localStorage.getItem('app-username:uid-b')).toBeNull()
    expect(localStorage.getItem('app-username:uid-a')).toBeNull()
  })

  it('ohne Kontowechsel wird das Profil wie bisher übernommen', async () => {
    api.fetchAccountProfile.mockResolvedValue({ username: 'Max', avatarUrl: '' })
    const store = useSettingsStore()
    store.switchUser('uid-a')
    await store.loadProfile('token-a-1234567890')
    expect(store.username).toBe('Max')
  })
})
