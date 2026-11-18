import { describe, it, expect, vi, beforeEach } from 'vitest'

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('../http', () => ({
  createResourceApi: () => ({ get, put, post: vi.fn(), delete: vi.fn() }),
  resolveServerMediaUrl: (url) => url
}))
vi.mock('../errorHandler', () => ({ handleAPIError: (error) => error }))
vi.mock('@/utils/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { fetchAiConsent, fetchAccountProfile, saveAiConsent } from '../account.js'
import { AI_CONSENT_TEXT_VERSION } from '@/config/aiConsentVersion'

beforeEach(() => {
  get.mockReset()
  put.mockReset()
})

// Der Server wertet die Zustimmung nach der Textversion, die diese App zeigt (ältere Apps ohne Angabe: Text 1).
describe('Einwilligung: Textversion wird mitgeschickt', () => {
  it('Abfrage der Einwilligung und des Profils nennt die Textversion als Query (kein zusätzlicher Header)', async () => {
    get.mockResolvedValue({ data: { aiConsent: { granted: true }, uid: 'u1' } })
    await fetchAiConsent('tok')
    await fetchAccountProfile('tok')
    for (const call of get.mock.calls) {
      expect(call[1].params).toEqual({ consentVersion: AI_CONSENT_TEXT_VERSION })
      expect(call[1].headers).toEqual({ Authorization: 'Bearer tok' })
    }
    expect(get.mock.calls.map((call) => call[0])).toEqual(['/ai-consent', '/profile'])
  })

  it('Zustimmen schickt die Textversion im Body; Gegenprobe: Widerruf ebenso, ohne Query', async () => {
    put.mockResolvedValue({ data: { aiConsent: { granted: true } } })
    await saveAiConsent('tok', true)
    expect(put.mock.calls[0][1]).toEqual({ granted: true, version: AI_CONSENT_TEXT_VERSION })
    expect(put.mock.calls[0][2].params).toBeUndefined()
  })
})
