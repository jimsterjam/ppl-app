import { describe, test, expect, vi } from 'vitest'

// Das Vitest-Setup in diesem Projekt läuft mit environment: 'node' (kein jsdom, siehe
// vitest.config.js) - der echte '@/router' (vue-router createWebHistory()) greift beim Import
// synchron auf `window` zu und crasht daher komplett außerhalb eines Browser-DOM. errorHandler.js
// importiert '@/router' fest (für den 401-Redirect), daher hier gemockt: die Fehlerklassifizierung
// selbst (Status-Codes, Nachrichten, Network-Error-Pfad) hat mit dem Router nichts zu tun, nur
// der eine Redirect-Aufruf `router.push('/')` im 401-Fall.
vi.mock('@/router', () => ({
  default: { push: vi.fn() }
}))

const { APIError, handleAPIError } = await import('@/api/errorHandler')

// handleAPIError() ist die zentrale Fehlerbehandlung für praktisch jeden API-Call im Client
// (siehe TESTPHASE-TESTMATRIX.md Abschnitt 8 "Fehlerbehandlung (übergreifend)") - bisher komplett
// ungetestet. Deckt hier die Status-Code-spezifische Nachrichtenzuordnung, den Network-Error-Pfad
// (inkl. LAN-Hinweis-Heuristik) und die APIError-Hilfsmethoden ab.
describe('handleAPIError', () => {
  test('401 -> APIError mit statusCode 401 und Login-Hinweis', () => {
    const error = { response: { status: 401, data: {} } }
    expect(() => handleAPIError(error, 'Test', { redirectOnAuth: false })).toThrow(APIError)
    try {
      handleAPIError(error, 'Test', { redirectOnAuth: false })
    } catch (e) {
      expect(e.statusCode).toBe(401)
      expect(e.requiresAuth()).toBe(true)
      expect(e.message).toMatch(/angemeldet/i)
    }
  })

  test('403 -> APIError mit statusCode 403 und Berechtigungs-Hinweis', () => {
    const error = { response: { status: 403, data: {} } }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.statusCode).toBe(403)
      expect(e.message).toMatch(/Berechtigung/i)
    }
  })

  test('404 -> nutzt Server-Message aus data.message, falls vorhanden', () => {
    const error = { response: { status: 404, data: { message: 'Workout nicht gefunden' } } }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.statusCode).toBe(404)
      expect(e.message).toBe('Workout nicht gefunden')
    }
  })

  test('429 -> retryAfter aus data wird in den Context übernommen', () => {
    const error = { response: { status: 429, data: { retryAfter: 42 } } }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.statusCode).toBe(429)
      expect(e.context.retryAfter).toBe(42)
      expect(e.isRetryable()).toBe(true)
    }
  })

  test('500/502/503/504 -> context.retryable ist true, isRetryable() nur für 503/504 (nicht 500/502)', () => {
    // isRetryable() prüft eine feste Liste [429, 503, 504] auf der APIError-Klasse - 500 und 502
    // sind dort bewusst NICHT enthalten, obwohl context.retryable (vom Handler gesetzt) für alle
    // vier Statuscodes true ist. Das ist bestehendes Verhalten, kein Bug - hier festgehalten,
    // damit eine künftige Änderung an isRetryable() bewusst getroffen wird statt versehentlich.
    for (const status of [500, 502, 503, 504]) {
      const error = { response: { status, data: {} } }
      try {
        handleAPIError(error, 'Test')
        throw new Error('sollte werfen')
      } catch (e) {
        expect(e.statusCode).toBe(status)
        expect(e.isRetryable()).toBe([503, 504].includes(status))
        expect(e.context.retryable).toBe(true)
      }
    }
  })

  test('unbekannter Status-Code -> fällt auf Server-Message zurück', () => {
    const error = { response: { status: 418, data: {}, }, message: 'Ich bin eine Teekanne' }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.statusCode).toBe(418)
      expect(e.message).toBe('Ich bin eine Teekanne')
    }
  })

  test('Network Error (kein response, aber request) -> generische Netzwerk-Meldung', () => {
    const error = { request: {}, config: { baseURL: 'https://api.example.com', url: '/workouts' } }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.statusCode).toBe(0)
      expect(e.context.type).toBe('network')
      expect(e.message).toMatch(/Netzwerkfehler/i)
    }
  })

  test('Network Error gegen private LAN-Adresse mit ERR_NETWORK -> spezifischer LAN-Hinweis statt generischer Meldung', () => {
    const error = {
      request: {},
      code: 'ERR_NETWORK',
      config: { baseURL: 'http://192.168.1.50:3000', url: '/workouts' }
    }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.message).toMatch(/selben WLAN/i)
    }
  })

  test('Network Error gegen öffentliche Adresse mit ERR_NETWORK -> KEIN LAN-Hinweis', () => {
    const error = {
      request: {},
      code: 'ERR_NETWORK',
      config: { baseURL: 'https://api.example.com', url: '/workouts' }
    }
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.message).not.toMatch(/selben WLAN/i)
      expect(e.message).toMatch(/Netzwerkfehler/i)
    }
  })

  test('Setup Error (weder response noch request) -> generischer Fehler', () => {
    const error = new Error('Irgendwas beim Requestaufbau kaputt')
    try {
      handleAPIError(error, 'Test')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e.statusCode).toBe(0)
      expect(e.context.type).toBe('setup')
    }
  })
})

describe('APIError', () => {
  test('getUserMessage() gibt die message zurück', () => {
    const err = new APIError('Test-Nachricht', 500)
    expect(err.getUserMessage()).toBe('Test-Nachricht')
  })

  test('isRetryable() ist nur für 429/503/504 true', () => {
    expect(new APIError('x', 429).isRetryable()).toBe(true)
    expect(new APIError('x', 503).isRetryable()).toBe(true)
    expect(new APIError('x', 504).isRetryable()).toBe(true)
    expect(new APIError('x', 500).isRetryable()).toBe(false)
    expect(new APIError('x', 404).isRetryable()).toBe(false)
  })

  test('requiresAuth() ist nur für 401 true', () => {
    expect(new APIError('x', 401).requiresAuth()).toBe(true)
    expect(new APIError('x', 403).requiresAuth()).toBe(false)
  })
})
