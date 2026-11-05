import { describe, it, expect, beforeEach, vi } from 'vitest'

const getIdToken = vi.hoisted(() => vi.fn())
vi.mock('../firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken }) }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ idToken: null }) }))
vi.mock('../logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { getAuthToken, clearAuthTokenCache } from '../authToken.js'

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true })
  clearAuthTokenCache()
  getIdToken.mockReset()
})

describe('Token-Zwischenspeicher beim Kontowechsel', () => {
  it('ohne Löschen liefert der Zwischenspeicher weiter den Token des alten Kontos', async () => {
    getIdToken.mockResolvedValueOnce('token-konto-a')
    expect(await getAuthToken()).toBe('token-konto-a')
    getIdToken.mockResolvedValueOnce('token-konto-b')
    expect(await getAuthToken()).toBe('token-konto-a')
  })

  it('nach clearAuthTokenCache wird der Token des neuen Kontos geholt', async () => {
    getIdToken.mockResolvedValueOnce('token-konto-a')
    await getAuthToken()
    clearAuthTokenCache()
    getIdToken.mockResolvedValueOnce('token-konto-b')
    expect(await getAuthToken()).toBe('token-konto-b')
  })
})

describe('Kein Rückgriff auf den Token des alten Kontos (Ersatzwert im authStore)', () => {
  it('nach dropToken liefert auch der Ersatzweg keinen alten Token', async () => {
    const { setActivePinia, createPinia } = await import('pinia')
    const real = await vi.importActual('@/stores/authStore')
    setActivePinia(createPinia())
    const authStore = real.useAuthStore()
    // Der Mock oben liefert ein festes Objekt; hier wird der echte Store geprüft:
    authStore.setUser({ uid: 'a', emailVerified: true }, 'token-konto-a')
    expect(authStore.idToken).toBe('token-konto-a')
    authStore.tokenExpiresAt = Date.now() + 60_000
    authStore.dropToken()
    expect(authStore.idToken).toBeNull()
    expect(authStore.tokenExpiresAt).toBe(0)
    expect(authStore.isOfflineSessionValid).toBe(false)
    expect(authStore.uid).toBe('a') // das Konto selbst bleibt bis setUser unverändert
  })
})
