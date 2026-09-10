import { describe, test, beforeEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { createFallbackAxios } from '../http'

// Regression-Test für den Fallback-Kandidaten-Bug (siehe Kommentar in http.js): Der vorherige
// Code probierte bei einem Request-Fehler nur noch VORWÄRTS zum nächsten Kandidaten-Index.
// Stand der per sessionStorage gemerkte "preferredIndex" bereits auf dem letzten Kandidaten
// (z.B. LAN-Fallback), gab die App bei dessen Ausfall sofort auf, OHNE es nochmal mit dem
// ersten Kandidaten (der echten Render-API) zu versuchen - die App blieb dann dauerhaft ohne
// Datenverbindung hängen, bis die Session (sessionStorage) neu startete.

function mockSessionStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  }
}

function networkError(config) {
  const err = new Error('Network Error')
  err.code = 'ERR_NETWORK'
  err.config = config
  return err
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', mockSessionStorage())
})

describe('createFallbackAxios - zyklischer Fallback', () => {
  test('startet bei einem gemerkten, nicht-ersten Index und fällt trotzdem noch auf den ersten Kandidaten zurück', async () => {
    const candidates = ['https://render.example.com/api', 'http://192.168.1.5:3001/api']
    // Simuliert: sessionStorage merkt sich Index 1 (LAN-Fallback) aus einer früheren Session.
    globalThis.sessionStorage.setItem(`bro_split_api_base_idx:${candidates.join('|')}`, '1')

    let calls = 0
    const adapter = (config) => {
      calls += 1
      if (config.baseURL === candidates[1]) {
        return Promise.reject(networkError(config))
      }
      return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config })
    }

    const instance = createFallbackAxios(candidates, { adapter })
    const response = await instance.get('/x')

    assert.equal(response.data.ok, true)
    assert.equal(response.config.baseURL, candidates[0])
    assert.equal(calls, 2) // erst Index 1 (fehlgeschlagen), dann Index 0 (erfolgreich)
  })

  test('gibt nach genau einem Versuch pro Kandidat auf, statt endlos zu wiederholen', async () => {
    const candidates = ['https://a.example.com', 'https://b.example.com', 'https://c.example.com']

    let calls = 0
    const adapter = (config) => {
      calls += 1
      return Promise.reject(networkError(config))
    }

    const instance = createFallbackAxios(candidates, { adapter })

    await assert.rejects(() => instance.get('/x'))
    assert.equal(calls, candidates.length)
  })

  test('bei Erfolg im ersten Versuch wird kein Fallback ausgelöst', async () => {
    const candidates = ['https://render.example.com/api', 'http://192.168.1.5:3001/api']

    let calls = 0
    const adapter = (config) => {
      calls += 1
      return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config })
    }

    const instance = createFallbackAxios(candidates, { adapter })
    const response = await instance.get('/x')

    assert.equal(response.data.ok, true)
    assert.equal(calls, 1)
  })
})
