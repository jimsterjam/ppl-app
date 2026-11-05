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
